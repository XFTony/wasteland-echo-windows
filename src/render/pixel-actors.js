"use strict";

const { PALETTE } = require("../config");
const { drawWeaponShape, weaponVisual } = require("./ui/item-icons");

const ACTOR_COMPONENTS = Object.freeze({
  survivor: Object.freeze(["shadow", "legs", "boots", "legArmor", "coat", "backpack", "torso", "chestArmor", "head", "heroAccessory", "outfitAccessory", "helmet", "arms", "weapon"]),
  infected: Object.freeze(["shadow", "legs", "torso", "head", "arms", "wounds", "roleAccessory"])
});

const INFECTED_PROFILES = Object.freeze({
  boss: Object.freeze({ unit: 1.9, body: "#703934", flesh: "#9a6657", dark: "#252724", glow: PALETTE.danger }),
  elite: Object.freeze({ unit: 1.45, body: "#6f3b32", flesh: "#99705c", dark: "#282b27", glow: PALETTE.amber }),
  tank: Object.freeze({ unit: 1.28, body: "#575d5a", flesh: "#87917a", dark: "#292d2b", glow: PALETTE.rust }),
  runner: Object.freeze({ unit: 0.9, body: "#884c36", flesh: "#ba7e59", dark: "#342722", glow: "#efb75a" }),
  ranged: Object.freeze({ unit: 1.05, body: "#527661", flesh: "#83a66f", dark: "#25342c", glow: "#b9db72" }),
  buffer: Object.freeze({ unit: 1.02, body: "#675273", flesh: "#8e7296", dark: "#2d2732", glow: "#d19ae1" }),
  swarm: Object.freeze({ unit: 0.72, body: "#78583e", flesh: "#a07855", dark: "#2c251f", glow: "#dfbe72" }),
  chaser: Object.freeze({ unit: 1, body: "#5d684e", flesh: "#8b956f", dark: "#293029", glow: "#d5bd72" })
});

function pixel(ctx, x, y, w, h, color, unit = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x * unit),
    Math.round(y * unit),
    Math.max(1, Math.round(w * unit)),
    Math.max(1, Math.round(h * unit))
  );
}

function line(ctx, x1, y1, x2, y2, color, width, unit = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.round(width * unit));
  ctx.beginPath();
  ctx.moveTo(Math.round(x1 * unit), Math.round(y1 * unit));
  ctx.lineTo(Math.round(x2 * unit), Math.round(y2 * unit));
  ctx.stroke();
}

function drawActorShadow(ctx, x, y, width, unit, alpha = 0.34) {
  ctx.fillStyle = `rgba(17,15,13,${alpha})`;
  ctx.fillRect(
    Math.round(x - width * unit * 0.5),
    Math.round(y - 2 * unit),
    Math.round(width * unit),
    Math.max(2, Math.round(5 * unit))
  );
}

function drawWeaponSprite(ctx, options) {
  const {
    x, y, unit, aimX, aimY, recoil = 0, weapon,
    weaponColor = PALETTE.amber, shellColor = "#c89b4b", skinAccent = "#8f4d38"
  } = options;
  const angle = Math.atan2(aimY, aimX);
  const kick = Math.min(10, recoil) * unit;
  ctx.save();
  ctx.translate(Math.round(x - aimX * kick), Math.round(y - aimY * kick));
  ctx.rotate(angle);

  // Rear and forward arms are deliberately separate so recoil reads at a glance.
  pixel(ctx, -3, -6, 15, 12, "#211f1c", unit);
  pixel(ctx, -1, -4, 8, 8, skinAccent, unit);
  pixel(ctx, 6, -3, 7, 7, "#cda981", unit);
  pixel(ctx, 10, -5, 8, 7, "#d7bd91", unit);

  const definition = weapon || { visualId: "scrap-sidearm", color: weaponColor, shellColor };
  const spec = weaponVisual(definition);
  const targetLength = Math.max(38, (Number(definition.muzzleLength) || 25) + 14);
  const visualUnit = unit * Math.max(0.78, Math.min(1, targetLength / spec.width));
  drawWeaponShape(ctx, definition, {
    x: 3 * unit,
    y: -10 * unit,
    unit: visualUnit,
    palette: {
      accent: definition.color || weaponColor,
      shell: definition.shellColor || shellColor,
      wood: "#765238",
      woodDark: "#4c3427",
      glow: PALETTE.cyan
    }
  });
  ctx.restore();
}

function equipmentForSlot(equipment, slot) {
  if (!equipment) return null;
  if (equipment[slot]) return equipment[slot];
  if (!Array.isArray(equipment)) return null;
  for (const item of equipment) if (item && item.slot === slot) return item;
  return null;
}

function drawBootLayer(ctx, x, y, bob, stride, unit, item) {
  if (!item) return;
  if (item.visualId === "runner-wrap-boots") {
    pixel(ctx, x - 11 - stride, y + 10 - bob, 9, 4, "#8b7754", unit);
    pixel(ctx, x + 3 + stride, y + 10 - bob, 9, 4, "#8b7754", unit);
    pixel(ctx, x - 12 - stride, y + 16, 11, 3, "#70452f", unit);
    pixel(ctx, x + 2 + stride, y + 16, 12, 3, "#70452f", unit);
    pixel(ctx, x - 13 - stride, y + 20, 13, 4, "#9d6a3f", unit);
    pixel(ctx, x + 1 + stride, y + 20, 14, 4, "#9d6a3f", unit);
  } else if (item.visualId === "stormstep-insulated-boots") {
    pixel(ctx, x - 12 - stride, y + 9 - bob, 10, 8, "#44504c", unit);
    pixel(ctx, x + 2 + stride, y + 9 - bob, 10, 8, "#44504c", unit);
    pixel(ctx, x - 13 - stride, y + 16, 12, 7, "#252c2b", unit);
    pixel(ctx, x + 1 + stride, y + 16, 13, 7, "#252c2b", unit);
    pixel(ctx, x - 12 - stride, y + 19, 11, 3, PALETTE.cyan, unit);
    pixel(ctx, x + 2 + stride, y + 19, 11, 3, PALETTE.cyan, unit);
  }
}

function drawLegArmorLayer(ctx, x, y, bob, stride, unit, item) {
  if (!item) return;
  if (item.visualId === "ammo-thigh-rig") {
    pixel(ctx, x - 13 - stride, y + 6 - bob, 11, 12, "#4a3c2d", unit);
    pixel(ctx, x + 2 + stride, y + 6 - bob, 11, 12, "#4a3c2d", unit);
    pixel(ctx, x - 12 - stride, y + 8 - bob, 3, 8, "#bd9350", unit);
    pixel(ctx, x - 7 - stride, y + 8 - bob, 3, 8, "#bd9350", unit);
    pixel(ctx, x + 4 + stride, y + 8 - bob, 3, 8, "#bd9350", unit);
    pixel(ctx, x + 9 + stride, y + 8 - bob, 3, 8, "#bd9350", unit);
    pixel(ctx, x - 14 - stride, y + 16 - bob, 12, 3, "#76503a", unit);
    pixel(ctx, x + 2 + stride, y + 16 - bob, 12, 3, "#76503a", unit);
  } else if (item.visualId === "servo-braced-greaves") {
    pixel(ctx, x - 13 - stride, y + 5 - bob, 11, 14, "#555850", unit);
    pixel(ctx, x + 2 + stride, y + 5 - bob, 11, 14, "#555850", unit);
    pixel(ctx, x - 10 - stride, y + 7 - bob, 5, 10, "#8c8878", unit);
    pixel(ctx, x + 5 + stride, y + 7 - bob, 5, 10, "#8c8878", unit);
    pixel(ctx, x - 14 - stride, y + 11 - bob, 4, 7, "#ae8242", unit);
    pixel(ctx, x + 10 + stride, y + 11 - bob, 4, 7, "#ae8242", unit);
  }
}

function drawChestArmorLayer(ctx, x, y, bob, unit, item) {
  if (!item) return;
  if (item.visualId === "riveted-iron-shell") {
    pixel(ctx, x - 18, y - 15 - bob, 10, 10, "#555850", unit);
    pixel(ctx, x + 8, y - 15 - bob, 10, 10, "#555850", unit);
    pixel(ctx, x - 12, y - 13 - bob, 24, 19, "#696b61", unit);
    pixel(ctx, x - 9, y - 11 - bob, 18, 6, "#8c8878", unit);
    pixel(ctx, x - 2, y - 12 - bob, 4, 18, "#3a3933", unit);
    pixel(ctx, x - 9, y + 2 - bob, 18, 4, "#51382a", unit);
    pixel(ctx, x - 9, y - 10 - bob, 3, 3, "#c3a464", unit);
    pixel(ctx, x + 6, y - 10 - bob, 3, 3, "#c3a464", unit);
  } else if (item.visualId === "field-canvas-vest") {
    pixel(ctx, x - 11, y - 12 - bob, 22, 18, "#75694c", unit);
    pixel(ctx, x - 8, y - 11 - bob, 5, 16, "#4c382a", unit);
    pixel(ctx, x + 3, y - 11 - bob, 5, 16, "#4c382a", unit);
    pixel(ctx, x - 8, y - 6 - bob, 16, 4, "#9c8253", unit);
    pixel(ctx, x - 9, y + 1 - bob, 7, 5, "#5c412e", unit);
    pixel(ctx, x + 2, y + 1 - bob, 7, 5, "#5c412e", unit);
  }
}

function drawHelmetLayer(ctx, headX, headY, bob, unit, item) {
  if (!item) return;
  if (item.visualId === "salvage-sensor-helm") {
    pixel(ctx, headX - 10, headY - 31 - bob, 20, 7, "#5e604f", unit);
    pixel(ctx, headX - 8, headY - 34 - bob, 16, 5, "#777457", unit);
    pixel(ctx, headX + 7, headY - 30 - bob, 6, 12, "#4a4b42", unit);
    pixel(ctx, headX + 9, headY - 34 - bob, 3, 6, "#ae8242", unit);
    pixel(ctx, headX + 8, headY - 37 - bob, 7, 4, PALETTE.amber, unit);
    pixel(ctx, headX - 5, headY - 25 - bob, 12, 4, PALETTE.cyan, unit);
    pixel(ctx, headX - 3, headY - 24 - bob, 4, 2, "#d9d0a8", unit);
  } else if (item.visualId === "longwave-visor-helm") {
    pixel(ctx, headX - 11, headY - 32 - bob, 22, 8, "#575a54", unit);
    pixel(ctx, headX - 9, headY - 29 - bob, 18, 8, "#3b3c37", unit);
    pixel(ctx, headX - 8, headY - 26 - bob, 16, 5, "#668c87", unit);
    pixel(ctx, headX - 5, headY - 25 - bob, 7, 2, "#d8d3ad", unit);
    pixel(ctx, headX + 8, headY - 38 - bob, 3, 11, "#8e8876", unit);
    pixel(ctx, headX + 6, headY - 39 - bob, 7, 4, PALETTE.amber, unit);
    pixel(ctx, headX - 12, headY - 26 - bob, 4, 8, "#765039", unit);
  }
}

function drawSurvivorActor(ctx, options) {
  const {
    x, y, unit = 1, skin, skinId = "wanderer", heroId = "ranger", weapon,
    aimX = 1, aimY = 0, elapsed = 0, moving = false,
    recoil = 0, alpha = 1, portrait = false, equipment = null,
    lookX = aimX, lookY = aimY
  } = options;
  const stride = moving ? Math.round(Math.sin(elapsed * 13) * 3) : 0;
  const bob = moving ? Math.abs(Math.round(Math.sin(elapsed * 13) * 1.5)) : 0;
  const bodyKick = recoil * 0.18;
  const bodyX = Math.round(x - aimX * bodyKick * unit);
  const bodyY = Math.round(y - aimY * bodyKick * unit);
  const safeLookX = Math.max(-1, Math.min(1, Number(lookX) || 0));
  const safeLookY = Math.max(-1, Math.min(1, Number(lookY) || 0));
  const headShiftX = Math.round(safeLookX * (portrait ? 2.5 : 1.5));
  const headShiftY = Math.round(safeLookY * (portrait ? 1.5 : 1));
  const headX = bodyX / unit + headShiftX;
  const headY = bodyY / unit + headShiftY;
  const facing = Math.abs(safeLookX) > 0.12 ? (safeLookX >= 0 ? 1 : -1) : aimX >= 0 ? 1 : -1;
  const helmet = equipmentForSlot(equipment, "helmet");
  const chest = equipmentForSlot(equipment, "chest");
  const legs = equipmentForSlot(equipment, "legs");
  const boots = equipmentForSlot(equipment, "boots");
  const oldAlpha = ctx.globalAlpha;
  ctx.globalAlpha = oldAlpha * alpha;

  drawActorShadow(ctx, bodyX, bodyY + 22 * unit, portrait ? 43 : 38, unit, portrait ? 0.42 : 0.34);

  // legs
  pixel(ctx, bodyX / unit - 11 - stride, bodyY / unit + 7, 10, 14, "#1d201e", unit);
  pixel(ctx, bodyX / unit + 2 + stride, bodyY / unit + 7, 10, 14, "#1d201e", unit);
  pixel(ctx, bodyX / unit - 10 - stride, bodyY / unit + 7, 8, 10, skin.dark, unit);
  pixel(ctx, bodyX / unit + 3 + stride, bodyY / unit + 7, 8, 10, skin.dark, unit);
  pixel(ctx, bodyX / unit - 12 - stride, bodyY / unit + 17, 11, 5, "#171918", unit);
  pixel(ctx, bodyX / unit + 2 + stride, bodyY / unit + 17, 12, 5, "#171918", unit);
  pixel(ctx, bodyX / unit - 9 - stride, bodyY / unit + 9, 6, 3, "#7d6b50", unit);
  pixel(ctx, bodyX / unit + 4 + stride, bodyY / unit + 9, 6, 3, "#7d6b50", unit);
  drawBootLayer(ctx, bodyX / unit, bodyY / unit, bob, stride, unit, boots);
  drawLegArmorLayer(ctx, bodyX / unit, bodyY / unit, bob, stride, unit, legs);

  // coat, scarf and backpack
  pixel(ctx, bodyX / unit - 17, bodyY / unit - 12 - bob, 8, 24, "#242622", unit);
  pixel(ctx, bodyX / unit - 18, bodyY / unit - 8 - bob, 3, 12, "#5a4836", unit);
  if (skinId === "wanderer") {
    line(ctx, bodyX / unit - 6, bodyY / unit - 8 - bob, bodyX / unit - 20 - aimX * 5, bodyY / unit + 10 - bob + stride, skin.accent, 4, unit);
    pixel(ctx, bodyX / unit - 11, bodyY / unit + 7 - bob, 9, 11 + stride, "#72503a", unit);
    pixel(ctx, bodyX / unit + 2, bodyY / unit + 7 - bob, 9, 11 - stride, "#72503a", unit);
  }

  // torso shell, chest plates, harness and utility belt
  pixel(ctx, bodyX / unit - 14, bodyY / unit - 15 - bob, 28, 25, "#20221f", unit);
  pixel(ctx, bodyX / unit - 12, bodyY / unit - 13 - bob, 24, 21, skin.body, unit);
  pixel(ctx, bodyX / unit - 14, bodyY / unit - 10 - bob, 5, 17, skin.dark, unit);
  pixel(ctx, bodyX / unit + 9, bodyY / unit - 10 - bob, 5, 17, skin.dark, unit);
  pixel(ctx, bodyX / unit - 12, bodyY / unit - 8 - bob, 24, 5, skin.accent, unit);
  pixel(ctx, bodyX / unit - 7, bodyY / unit - 12 - bob, 4, 16, "#42392e", unit);
  pixel(ctx, bodyX / unit + 4, bodyY / unit - 12 - bob, 4, 16, "#42392e", unit);
  pixel(ctx, bodyX / unit - 10, bodyY / unit + 3 - bob, 20, 5, "#24231f", unit);
  pixel(ctx, bodyX / unit - 8, bodyY / unit + 4 - bob, 6, 5, "#84633e", unit);
  pixel(ctx, bodyX / unit + 3, bodyY / unit + 4 - bob, 6, 5, "#84633e", unit);
  drawChestArmorLayer(ctx, bodyX / unit, bodyY / unit, bob, unit, chest);

  // head, hood, respirator and directional goggle
  pixel(ctx, headX - 9, headY - 29 - bob, 18, 16, "#20221f", unit);
  pixel(ctx, headX - 7, headY - 27 - bob, 14, 12, "#d2af86", unit);
  pixel(ctx, headX - 8, headY - 25 - bob, 16, 6, "#354047", unit);
  pixel(ctx, headX - 6, headY - 20 - bob, 12, 5, "#687675", unit);
  pixel(ctx, headX - 2, headY - 17 - bob, 4, 3, "#303735", unit);
  pixel(ctx, headX + (facing > 0 ? 1 : -6), headY - 24 - bob + Math.round(safeLookY), 5, 2, "#b5d8cc", unit);

  // Hero identity is built as a separate component layer so body silhouette,
  // outfit palette and equipment can evolve independently.
  if (heroId === "mechanic") {
    pixel(ctx, bodyX / unit - 20, bodyY / unit - 13 - bob, 8, 21, "#34484a", unit);
    pixel(ctx, bodyX / unit - 22, bodyY / unit - 8 - bob, 5, 13, PALETTE.cyan, unit);
    pixel(ctx, headX - 10, headY - 30 - bob, 20, 5, PALETTE.amber, unit);
    pixel(ctx, headX - 7, headY - 25 - bob, 14, 4, "#7aa59c", unit);
    line(ctx, bodyX / unit - 14, bodyY / unit + 2 - bob, bodyX / unit - 24, bodyY / unit + 14 - bob, "#d8bf72", 3, unit);
  } else if (heroId === "bulwark") {
    pixel(ctx, bodyX / unit - 19, bodyY / unit - 16 - bob, 10, 13, "#555d5d", unit);
    pixel(ctx, bodyX / unit + 9, bodyY / unit - 16 - bob, 10, 13, "#555d5d", unit);
    pixel(ctx, bodyX / unit - 15, bodyY / unit - 13 - bob, 30, 8, "#69716d", unit);
    pixel(ctx, headX - 11, headY - 32 - bob, 22, 7, "#4c5655", unit);
    pixel(ctx, headX - 9, headY - 25 - bob, 18, 4, PALETTE.rust, unit);
    pixel(ctx, bodyX / unit - 5, bodyY / unit - 5 - bob, 10, 12, "#3f4745", unit);
  } else {
    pixel(ctx, headX + 11, headY - 29 - bob, 3, 16, "#323d3d", unit);
    pixel(ctx, headX + 9, headY - 32 - bob, 7, 5, PALETTE.cyan, unit);
    pixel(ctx, bodyX / unit - 16, bodyY / unit - 12 - bob, 5, 9, "#9d4738", unit);
  }

  // Outfit accessory layer.
  if (skinId === "mechanic") {
    pixel(ctx, headX - 9, headY - 31 - bob, 18, 5, PALETTE.amber, unit);
    pixel(ctx, headX - 3, headY - 34 - bob, 7, 4, "#b88942", unit);
    pixel(ctx, bodyX / unit - 19, bodyY / unit - 10 - bob, 5, 15, "#d9c68a", unit);
    pixel(ctx, bodyX / unit - 18, bodyY / unit - 8 - bob, 3, 5, PALETTE.cyan, unit);
  } else if (skinId === "nightwatch") {
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = Math.max(2, Math.round(3 * unit));
    ctx.strokeRect(Math.round((headX - 10) * unit), Math.round((headY - 31 - bob) * unit), Math.round(20 * unit), Math.round(17 * unit));
    pixel(ctx, bodyX / unit + 13, bodyY / unit - 21 - bob, 5, 14, PALETTE.cyan, unit);
    pixel(ctx, bodyX / unit + 11, bodyY / unit - 24 - bob, 9, 4, PALETTE.cyan, unit);
  } else {
    pixel(ctx, headX - 9, headY - 30 - bob, 18, 4, "#8a4937", unit);
    pixel(ctx, headX - 12, headY - 29 - bob, 5, 3, "#6c352c", unit);
  }

  drawHelmetLayer(ctx, headX, headY, bob, unit, helmet);

  drawWeaponSprite(ctx, {
    x: bodyX,
    y: bodyY - (4 + bob) * unit,
    unit,
    aimX,
    aimY,
    recoil,
    weapon,
    weaponColor: weapon.color,
    shellColor: weapon.shellColor,
    skinAccent: skin.accent
  });
  ctx.globalAlpha = oldAlpha;
}

function infectedProfile(enemy) {
  if (enemy.boss) return INFECTED_PROFILES.boss;
  if (enemy.elite) return INFECTED_PROFILES.elite;
  return INFECTED_PROFILES[enemy.role] || INFECTED_PROFILES.chaser;
}

function drawCrawler(ctx, enemy, profile, walk, facing) {
  const u = profile.unit;
  pixel(ctx, -14, -5, 28, 11, enemy.hitFlash > 0 ? PALETTE.white : profile.body, u);
  pixel(ctx, -9, -9, 14, 8, enemy.hitFlash > 0 ? PALETTE.white : profile.flesh, u);
  pixel(ctx, facing > 0 ? 0 : -7, -8, 6, 3, profile.dark, u);
  pixel(ctx, facing > 0 ? 2 : -6, -7, 3, 2, profile.glow, u);
  pixel(ctx, -18, 2 + walk, 10, 4, profile.dark, u);
  pixel(ctx, 8, 2 - walk, 10, 4, profile.dark, u);
  pixel(ctx, -15, 6 - walk, 5, 10, profile.flesh, u);
  pixel(ctx, 10, 6 + walk, 5, 10, profile.flesh, u);
  pixel(ctx, -4, -3, 10, 3, "#4a2d27", u);
}

function drawZombieActor(ctx, options) {
  const { enemy, x, y, elapsed = 0 } = options;
  const profile = infectedProfile(enemy);
  const u = profile.unit;
  const gaitSpeed = enemy.role === "runner" ? 15 : enemy.role === "swarm" ? 18 : 9;
  const walk = Math.round(Math.sin(elapsed * gaitSpeed + enemy.id * 0.71) * (enemy.role === "runner" ? 3 : 2));
  const facing = Math.cos(enemy.heading || 0) >= 0 ? 1 : -1;
  const bob = Math.abs(walk) * 0.45;
  drawActorShadow(ctx, x, y + (enemy.role === "swarm" ? 9 : 20) * u, enemy.role === "swarm" ? 34 : enemy.boss ? 42 : 30, u, enemy.boss ? 0.52 : 0.34);

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + bob));
  if (enemy.role === "swarm") {
    drawCrawler(ctx, enemy, profile, walk, facing);
    ctx.restore();
    return;
  }

  const flashBody = enemy.hitFlash > 0 ? PALETTE.white : profile.body;
  const flashFlesh = enemy.hitFlash > 0 ? PALETTE.white : profile.flesh;

  // legs and torn footwear
  pixel(ctx, -10 - walk, 8, 8, 15, profile.dark, u);
  pixel(ctx, 2 + walk, 8, 8, 15, profile.dark, u);
  pixel(ctx, -12 - walk, 19, 11, 5, "#181a18", u);
  pixel(ctx, 2 + walk, 19, 12, 5, "#181a18", u);
  pixel(ctx, -8 - walk, 9, 5, 6, flashFlesh, u);
  pixel(ctx, 4 + walk, 9, 5, 5, flashFlesh, u);

  // torso shell and exposed rib/wound layer
  const torsoW = enemy.boss ? 30 : enemy.role === "tank" ? 27 : 22;
  pixel(ctx, -torsoW / 2 - 2, -13, torsoW + 4, 24, profile.dark, u);
  pixel(ctx, -torsoW / 2, -12, torsoW, 21, flashBody, u);
  pixel(ctx, -5, -9, 10, 4, "#4d2d2a", u);
  pixel(ctx, -4, -4, 3, 10, "#d0b283", u);
  pixel(ctx, 2, -4, 3, 9, "#d0b283", u);
  pixel(ctx, -7, 2, 14, 3, "#482a27", u);

  // asymmetrical arms keep silhouettes readable in crowds
  line(ctx, -torsoW / 2, -8, -torsoW / 2 - 9 - walk, 7, flashFlesh, enemy.boss ? 7 : 5, u);
  line(ctx, torsoW / 2, -7, torsoW / 2 + 10 + walk, enemy.role === "runner" ? -1 : 5, flashFlesh, enemy.boss ? 7 : 5, u);
  pixel(ctx, -torsoW / 2 - 12 - walk, 5, 6, 5, profile.dark, u);
  pixel(ctx, torsoW / 2 + 7 + walk, enemy.role === "runner" ? -3 : 3, 6, 5, profile.dark, u);

  // head, missing cheek and luminous directional eye
  pixel(ctx, -8, -27, 16, 15, profile.dark, u);
  pixel(ctx, -7, -26, 14, 12, flashFlesh, u);
  pixel(ctx, facing > 0 ? 2 : -7, -21, 5, 5, "#47302a", u);
  pixel(ctx, facing > 0 ? 2 : -5, -24, 3, 2, profile.glow, u);
  pixel(ctx, -5, -16, 10, 3, "#322824", u);
  pixel(ctx, -4, -15, 2, 2, "#d9c49b", u);
  pixel(ctx, 1, -15, 2, 2, "#d9c49b", u);

  // role accessories are independent components and can be swapped by content data later.
  if (enemy.role === "runner") {
    pixel(ctx, -10, -29, 21, 4, "#7b302b", u);
    pixel(ctx, -14, -28, 6, 3, "#a94b39", u);
    pixel(ctx, -13, -5, 8, 4, "#87342e", u);
  } else if (enemy.role === "ranged") {
    pixel(ctx, -13, -11, 7, 15, "#456b54", u);
    pixel(ctx, 6, -9, 8, 13, profile.glow, u);
    pixel(ctx, 8, -7, 4, 4, "#d7ed8b", u);
    ctx.fillStyle = "rgba(185,219,114,0.18)";
    ctx.fillRect(Math.round(5 * u), Math.round(-12 * u), Math.round(12 * u), Math.round(19 * u));
  } else if (enemy.role === "tank") {
    pixel(ctx, -16, -14, 32, 7, "#777b73", u);
    pixel(ctx, -18, -9, 8, 18, "#3b4140", u);
    pixel(ctx, 10, -9, 8, 18, "#3b4140", u);
    pixel(ctx, -9, -29, 18, 6, "#656b67", u);
    pixel(ctx, -3, -26, 6, 3, PALETTE.rust, u);
  } else if (enemy.role === "buffer") {
    pixel(ctx, -3, -35, 6, 9, "#3c3342", u);
    pixel(ctx, -5, -37, 10, 5, profile.glow, u);
    ctx.strokeStyle = "rgba(209,154,225,0.62)";
    ctx.lineWidth = Math.max(1, Math.round(2 * u));
    ctx.beginPath();
    ctx.arc(0, -5 * u, (20 + Math.sin(elapsed * 7) * 3) * u, 0, Math.PI * 2);
    ctx.stroke();
  } else if (enemy.elite || enemy.boss) {
    pixel(ctx, -torsoW / 2, -13, torsoW, 6, enemy.boss ? "#5c5b55" : "#a65c42", u);
    pixel(ctx, -torsoW / 2 - 5, -11, 7, 18, "#353936", u);
    pixel(ctx, torsoW / 2 - 2, -11, 7, 18, "#353936", u);
    pixel(ctx, -4, -10, 8, 4, profile.glow, u);
    if (enemy.boss) {
      pixel(ctx, -18, -31, 8, 10, "#3f433f", u);
      pixel(ctx, 10, -31, 8, 10, "#3f433f", u);
      pixel(ctx, -16, -29, 4, 4, Math.floor(elapsed * 8) % 2 ? PALETTE.amber : "#6a5137", u);
      pixel(ctx, 12, -29, 4, 4, PALETTE.amber, u);
    }
  } else {
    pixel(ctx, -12, -10, 5, 14, "#474f42", u);
    pixel(ctx, 7, -8, 5, 12, "#454c40", u);
    pixel(ctx, facing > 0 ? -10 : 6, -2, 5, 5, "#71362f", u);
  }

  ctx.restore();
}

module.exports = {
  ACTOR_COMPONENTS,
  INFECTED_PROFILES,
  drawSurvivorActor,
  drawZombieActor,
  drawWeaponSprite
};
