"use strict";

const { ART_IDS } = require("./art/asset-catalog");

const HERO_SKIN_ART = Object.freeze({
  ranger: Object.freeze({ wanderer: ART_IDS.ACTOR_RANGER, mechanic: ART_IDS.ACTOR_RANGER_MECHANIC, nightwatch: ART_IDS.ACTOR_RANGER_NIGHTWATCH }),
  mechanic: Object.freeze({ wanderer: ART_IDS.ACTOR_MECHANIC, mechanic: ART_IDS.ACTOR_MECHANIC_MECHANIC, nightwatch: ART_IDS.ACTOR_MECHANIC_NIGHTWATCH }),
  bulwark: Object.freeze({ wanderer: ART_IDS.ACTOR_BULWARK })
});

const ENEMY_ART = Object.freeze({
  drifter: ART_IDS.ACTOR_DRIFTER,
  runner: ART_IDS.ACTOR_RUNNER,
  spitter: ART_IDS.ACTOR_SPITTER,
  brute: ART_IDS.ACTOR_BRUTE,
  screecher: ART_IDS.ACTOR_SCREECHER,
  crawler: ART_IDS.ACTOR_CRAWLER,
  warden: ART_IDS.ACTOR_WARDEN,
  iron_colossus: ART_IDS.ACTOR_IRON_COLOSSUS
});

const WEAPON_ART = Object.freeze({
  scrap_pistol: ART_IDS.WEAPON_SCRAP_PISTOL,
  swarm_smg: ART_IDS.WEAPON_SWARM_SMG,
  breaker_shotgun: ART_IDS.WEAPON_BREAKER_SHOTGUN,
  needle_rifle: ART_IDS.WEAPON_NEEDLE_RIFLE,
  rust_revolver: ART_IDS.WEAPON_RUST_REVOLVER,
  ember_carbine: ART_IDS.WEAPON_EMBER_CARBINE,
  coil_cannon: ART_IDS.WEAPON_COIL_CANNON
});

const WEAPON_WIDTH = Object.freeze({
  scrap_pistol: 39,
  swarm_smg: 49,
  breaker_shotgun: 56,
  needle_rifle: 61,
  rust_revolver: 40,
  ember_carbine: 55,
  coil_cannon: 64
});

function paintedShadow(ctx, x, y, radius) {
  ctx.save();
  ctx.fillStyle = "rgba(13,12,10,0.42)";
  ctx.beginPath();
  ctx.arc(x, y + 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCutout(ctx, image, x, y, height, options = {}) {
  const width = height * image.naturalWidth / image.naturalHeight;
  const bob = Number(options.bob) || 0;
  ctx.save();
  ctx.translate(x, y);
  if (options.mirror) ctx.scale(-1, 1);
  ctx.globalAlpha *= Number.isFinite(options.alpha) ? options.alpha : 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, -width / 2, -height * 0.86 + bob, width, height);
  ctx.restore();
}

function drawIllustratedSurvivor(renderer, player, run, flicker) {
  const heroArt = HERO_SKIN_ART[player.heroId] && HERO_SKIN_ART[player.heroId][player.skinId];
  const weaponArt = WEAPON_ART[player.weaponId];
  if (!heroArt || !weaponArt) return false;
  const store = renderer.artStore;
  if (!store || !store.ready(heroArt) || !store.ready(weaponArt)) return false;
  const body = store.get(heroArt);
  const weapon = store.get(weaponArt);
  const position = renderer.worldToScreen(player.x, player.y, renderer.screenPoint);
  const moving = Math.hypot(run.input.moveX, run.input.moveY) > 0.12;
  const bob = moving ? Math.sin(run.elapsed * 13) * 2.1 : Math.sin(run.elapsed * 2.2) * 0.7;
  const ctx = renderer.ctx;
  paintedShadow(ctx, position.x, position.y, 17);
  drawCutout(ctx, body, position.x, position.y, 76, {
    bob,
    mirror: player.lastAimX < -0.2,
    alpha: flicker ? 0.48 : 1
  });
  ctx.save();
  const weaponAnchorX = player.heroId === "mechanic" ? (player.lastAimX < 0 ? -11 : 11) : 0;
  const weaponAnchorY = player.heroId === "bulwark" ? -34 : player.heroId === "mechanic" ? -23 : -30;
  ctx.translate(position.x + weaponAnchorX, position.y + weaponAnchorY + bob);
  ctx.rotate(Math.atan2(player.lastAimY, player.lastAimX));
  if (player.lastAimX < 0) ctx.scale(1, -1);
  ctx.globalAlpha *= flicker ? 0.48 : 1;
  ctx.imageSmoothingEnabled = true;
  const gunWidth = WEAPON_WIDTH[player.weaponId];
  const gunHeight = gunWidth * weapon.naturalHeight / weapon.naturalWidth;
  const grip = player.weaponId === "scrap_pistol" || player.weaponId === "rust_revolver" ? 0.29 : 0.39;
  ctx.drawImage(weapon, -gunWidth * grip, -gunHeight * 0.43, gunWidth, gunHeight);
  ctx.restore();
  return true;
}

function drawIllustratedPortrait(renderer, heroId, skinId, x, y, width, height) {
  const id = HERO_SKIN_ART[heroId] && HERO_SKIN_ART[heroId][skinId];
  if (!id || !renderer.artStore || !renderer.artStore.ready(id)) return false;
  const image = renderer.artStore.get(id);
  const scale = Math.min(width * 0.85 / image.naturalWidth, height * 0.94 / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  renderer.ctx.save();
  renderer.ctx.imageSmoothingEnabled = true;
  renderer.ctx.drawImage(image, x + (width - drawWidth) / 2, y + height - drawHeight, drawWidth, drawHeight);
  renderer.ctx.restore();
  return true;
}

function drawIllustratedEnemy(renderer, enemy, elapsed) {
  const id = ENEMY_ART[enemy.type];
  if (!id || !renderer.artStore || !renderer.artStore.ready(id)) return false;
  const image = renderer.artStore.get(id);
  const position = renderer.worldToScreen(enemy.x, enemy.y, renderer.screenPoint);
  const height = enemy.boss ? 108 : enemy.type === "warden" ? 89 : enemy.type === "brute" ? 78 : enemy.type === "crawler" ? 48 : 61;
  const bob = Math.sin(elapsed * (enemy.boss ? 3.2 : 5.5) + enemy.id * 0.7) * (enemy.boss ? 1.4 : 1.7);
  paintedShadow(renderer.ctx, position.x, position.y, enemy.boss ? 31 : 13);
  drawCutout(renderer.ctx, image, position.x, position.y, height, {
    bob,
    mirror: Math.cos(enemy.heading || 0) < 0,
    alpha: enemy.hitFlash > 0 ? 0.82 : 1
  });
  return true;
}

module.exports = { HERO_SKIN_ART, ENEMY_ART, WEAPON_ART, drawIllustratedSurvivor, drawIllustratedEnemy, drawIllustratedPortrait };
