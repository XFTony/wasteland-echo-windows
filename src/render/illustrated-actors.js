"use strict";

const { ART_IDS } = require("./art/asset-catalog");

const HERO_ART = Object.freeze({
  ranger: ART_IDS.ACTOR_RANGER,
  mechanic: ART_IDS.ACTOR_MECHANIC,
  bulwark: ART_IDS.ACTOR_BULWARK
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
  if (player.skinId !== "wanderer" || player.weaponId !== "scrap_pistol") return false;
  const heroArt = HERO_ART[player.heroId];
  if (!heroArt) return false;
  const store = renderer.artStore;
  if (!store || !store.ready(heroArt) || !store.ready(ART_IDS.WEAPON_SCRAP_PISTOL)) return false;
  const body = store.get(heroArt);
  const pistol = store.get(ART_IDS.WEAPON_SCRAP_PISTOL);
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
  ctx.translate(position.x, position.y - 43 + bob);
  ctx.rotate(Math.atan2(player.lastAimY, player.lastAimX));
  ctx.globalAlpha *= flicker ? 0.48 : 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(pistol, -10, -11, 39, 26);
  ctx.restore();
  return true;
}

function drawIllustratedPortrait(renderer, heroId, skinId, x, y, width, height) {
  if (skinId !== "wanderer") return false;
  const id = HERO_ART[heroId];
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

module.exports = { HERO_ART, ENEMY_ART, drawIllustratedSurvivor, drawIllustratedEnemy, drawIllustratedPortrait };
