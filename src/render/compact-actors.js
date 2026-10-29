"use strict";

const Motion = require("../shared/compact-ranger-motion");
const Grip = require("../shared/modular-grip-compositor");
const { HERO, MATERIALS, PART_ASSETS, ENEMY_SPRITES } = require("../content/active-compact-actors");
const { nativeWeaponTexture } = require("./native-weapons");
const { DEFINITIONS, usesCompactPlayer } = require("../core/compact-weapon-pose");
const { sampleWeaponFeedback } = require("./weapon-feedback");
const { attackMotion } = require("../core/weapon-geometry");

function sampleTravel(state, entity, elapsed, stride) {
  if (state.sampleId !== entity.id || state.sampleElapsed === undefined || elapsed < state.sampleElapsed) {
    state.sampleId = entity.id;
    state.phase = 0;
    state.walking = false;
  } else if (elapsed > state.sampleElapsed) {
    const distance = Math.hypot(entity.x - state.sampleX, entity.y - state.sampleY);
    state.walking = distance > 0.001;
    if (state.walking) state.phase = (state.phase + distance / stride) % 1;
  }
  state.sampleX = entity.x;
  state.sampleY = entity.y;
  state.sampleElapsed = elapsed;
  return state;
}

function defaultCanvas(width, height) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function shadow(ctx, x, y, radius) {
  ctx.save();
  ctx.fillStyle = "rgba(10,13,14,0.38)";
  ctx.translate(x, y + 1);
  ctx.scale(1, 0.36);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

class CompactActorView {
  constructor(options = {}) {
    this.canvasFactory = options.canvasFactory || defaultCanvas;
    this.clear();
  }

  clear() {
    if (this.grips) this.grips.clear();
    this.grips = null;
    this.textures = Object.create(null);
    this.enemies = new WeakMap();
    this.playerRun = null;
    this.playerState = null;
    this.portrait = null;
    this.lastDraw = null;
  }

  prepare(renderer, weaponId) {
    const weapon = MATERIALS.weapons.find(w => w.id === weaponId);
    if (!weapon) return null;
    let ready = renderer.artStore.ready(HERO.assetId);
    const ids = [weapon.visual.asset, 'hands.' + MATERIALS.defaultHands, 'cuffs.' + MATERIALS.defaultCuffs];
    for (const id of ids) {
      if (id.startsWith("native.")) {
        if (!this.textures[id]) this.textures[id] = nativeWeaponTexture(weaponId, this.canvasFactory);
        ready = ready && Boolean(this.textures[id]); continue;
      }
      const assetId = PART_ASSETS[id];
      const loaded = renderer.artStore.ready(assetId);
      if (loaded) this.textures[id] = renderer.artStore.get(assetId);
      ready = ready && loaded;
    }
    if (!ready) return null;
    if (!this.grips) {
      const probe = this.canvasFactory(1, 1);
      if (!probe) return null;
      this.grips = Grip.createCache(MATERIALS, this.textures, { limit: 8, canvasFactory: this.canvasFactory });
    }
    return renderer.artStore.get(HERO.assetId);
  }

  stateFor(weaponId) {
    return Motion.createState({ x: 100, y: 100, pixelScale: HERO.pixelScale,
      body: HERO.body, weapons: DEFINITIONS, weaponId, strideLength: HERO.stride });
  }

  applyGrip(state, weaponId) {
    if (state.weaponId !== weaponId) Motion.setWeapon(state, weaponId);
    if (state.appliedWeapon !== weaponId) {
      state.grip = this.grips.apply(state, weaponId);
      state.appliedWeapon = weaponId;
    }
    return state.grip;
  }

  drawPlayer(renderer, player, run, flicker) {
    if (!usesCompactPlayer(player)) return false;
    const body = this.prepare(renderer, player.weaponId);
    if (!body) return false;
    if (this.playerRun !== run) {
      this.playerRun = run;
      this.playerState = this.stateFor(player.weaponId);
    }
    const state = this.playerState;
    const grip = this.applyGrip(state, player.weaponId);
    sampleTravel(state, player, run.elapsed, HERO.stride);
    const point = renderer.worldToScreen(player.x, player.y, renderer.screenPoint);
    state.x = point.x;
    state.y = point.y;
    state.facing = player.compactFacing || state.facing;
    state.depth = player.compactDepth || state.depth;
    Motion.setAimAngle(state, Math.atan2(player.lastAimY, player.lastAimX));
    const feedback = sampleWeaponFeedback(renderer.shotFeedback, run.elapsed, player.weaponId, state.facing, state.angle);
    state.recoil = feedback.offset / Math.max(.01, state.config.weapon.recoil * state.pixelScale);
    state.visualAngle = run.attack && run.attack.weaponId === player.weaponId ? attackMotion(run.attack,run.elapsed) : feedback.angle;
    shadow(renderer.ctx, point.x, point.y, 15);
    // A stable foot marker identifies the player without enlarging the hitbox.
    renderer.ctx.save();
    renderer.ctx.strokeStyle = "rgba(146,211,194,0.8)";
    renderer.ctx.lineWidth = 1.5;
    renderer.ctx.beginPath();
    renderer.ctx.arc(point.x, point.y, player.radius + 3, 0, Math.PI * 2);
    renderer.ctx.stroke();
    renderer.ctx.restore();
    const pose = Motion.draw(renderer.ctx, state, { body, weapon: grip.image }, {
      drawTargets: false, drawShadow: false, drawProjectiles: false,
      drawImpacts: false, drawFlash: false, alpha: flicker ? 0.48 : 1
    });
    this.lastDraw = { heroId: player.heroId, weaponId: player.weaponId, frame: pose.bodyFrame,
      phase: state.phase, walking: state.walking, worldX: player.x, worldY: player.y,
      muzzleX: pose.weapon.muzzleX + renderer.camera.x, muzzleY: pose.weapon.muzzleY + renderer.camera.y,
      gripX: pose.weapon.anchorX + renderer.camera.x, gripY: pose.weapon.anchorY + renderer.camera.y,
      weaponAngle: pose.weapon.angle, feedback };
    return true;
  }

  drawEnemy(renderer, enemy, elapsed) {
    const config = ENEMY_SPRITES[enemy.type];
    if (!config || !renderer.artStore.ready(config.assetId)) return false;
    let state = this.enemies.get(enemy);
    if (!state || state.sampleId !== enemy.id) {
      state = { phase: (enemy.id * 0.381966) % 1, facing: 1 };
      this.enemies.set(enemy, state);
    }
    sampleTravel(state, enemy, elapsed, config.stride);
    if (Math.cos(enemy.heading || 0) > 0.12) state.facing = 1;
    else if (Math.cos(enemy.heading || 0) < -0.12) state.facing = -1;
    const frame = state.walking ? config.walkFrames[Math.floor(state.phase * config.walkFrames.length) % config.walkFrames.length] : config.idleFrame;
    state.frame = frame;
    const point = renderer.worldToScreen(enemy.x, enemy.y, renderer.screenPoint);
    const scale = config.pixelScale;
    shadow(renderer.ctx, point.x, point.y, enemy.radius + (enemy.boss ? 5 : 2));
    const ctx = renderer.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(scale * state.facing, scale);
    if (enemy.hitFlash > 0 && renderer.flashSetting !== "off") ctx.globalAlpha = 0.7;
    ctx.drawImage(renderer.artStore.get(config.assetId), frame * config.canvas, 0, config.canvas, config.canvas,
      -config.root[0], -config.root[1], config.canvas, config.canvas);
    ctx.restore();
    return true;
  }

  drawPortrait(renderer, model, x, y, width, height) {
    const player = { heroId: model.selectedHero, skinId: model.selectedSkin, weaponId: model.selectedWeapon };
    if (!usesCompactPlayer(player)) return false;
    const body = this.prepare(renderer, player.weaponId);
    if (!body) return false;
    if (!this.portrait) this.portrait = this.stateFor(player.weaponId);
    const state = this.portrait;
    const grip = this.applyGrip(state, player.weaponId);
    state.x = x + width * 0.43;
    state.y = y + height * 0.87;
    state.pixelScale = Math.max(1, Math.floor(Math.min(width / 55, height / 50)));
    state.walking = false;
    state.phase = 0;
    state.recoil = 0;
    state.visualAngle = 0;
    Motion.setAimAngle(state, -0.16);
    Motion.draw(renderer.ctx, state, { body, weapon: grip.image }, { drawTargets: false,
      drawShadow: false, drawProjectiles: false, drawImpacts: false, drawFlash: false });
    return true;
  }

  info() {
    return { playerIntegrated: Boolean(this.playerRun), enemies: Object.keys(ENEMY_SPRITES).length,
      gripCache: this.grips ? this.grips.info() : null, lastDraw: this.lastDraw };
  }
}

module.exports = { CompactActorView, sampleTravel };
