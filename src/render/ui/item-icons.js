"use strict";

const { UI_COLORS } = require("./theme");

function visual(width, height, shapes) {
  return Object.freeze({
    width,
    height,
    shapes: Object.freeze(shapes.map((shape) => Object.freeze(shape.slice())))
  });
}

// A weapon owns a stable visualId in content data. These silhouettes are shared
// by the shop, inventory and the actor's held-weapon layer.
const WEAPON_VISUALS = Object.freeze({
  "scrap-sidearm": visual(42, 29, [
    [4, 7, 28, 11, "dark"], [8, 4, 24, 6, "accent"], [13, 17, 10, 12, "wood"],
    [16, 18, 5, 8, "metalDark"], [31, 9, 8, 6, "metal"], [35, 8, 7, 3, "light"],
    [11, 9, 6, 2, "shell"], [24, 12, 5, 3, "metalDark"]
  ]),
  "swarm-compact": visual(54, 31, [
    [1, 12, 10, 8, "metalDark"], [7, 8, 35, 14, "dark"], [11, 6, 29, 7, "accent"],
    [21, 20, 9, 11, "metalDark"], [23, 21, 5, 9, "accentDark"], [40, 11, 12, 6, "metal"],
    [48, 10, 6, 3, "light"], [14, 8, 6, 2, "shell"], [33, 9, 5, 5, "light"]
  ]),
  "breaker-pump": visual(62, 27, [
    [0, 11, 17, 11, "wood"], [8, 8, 17, 15, "dark"], [16, 7, 31, 12, "metalDark"],
    [22, 9, 37, 5, "accent"], [35, 14, 13, 8, "wood"], [46, 8, 16, 8, "metal"],
    [57, 7, 5, 3, "light"], [18, 8, 6, 2, "shell"], [11, 19, 8, 8, "woodDark"]
  ]),
  "needle-longrifle": visual(64, 31, [
    [0, 13, 13, 9, "metalDark"], [7, 9, 38, 14, "dark"], [12, 11, 38, 6, "accentDark"],
    [23, 3, 18, 7, "dark"], [27, 4, 10, 3, "glow"], [15, 21, 10, 10, "metalDark"],
    [45, 12, 17, 5, "metal"], [59, 10, 5, 3, "light"], [13, 10, 6, 2, "shell"],
    [36, 13, 12, 3, "accent"]
  ]),
  "rust-revolver": visual(46, 31, [
    [5, 9, 29, 12, "dark"], [9, 6, 25, 6, "accent"], [30, 10, 14, 7, "metal"],
    [40, 9, 6, 3, "light"], [8, 19, 11, 12, "wood"], [11, 20, 6, 8, "woodDark"],
    [19, 12, 11, 11, "metal"], [21, 14, 7, 7, "shell"], [12, 8, 5, 2, "light"]
  ]),
  "ember-carbine": visual(60, 32, [
    [0, 13, 14, 11, "woodDark"], [6, 9, 37, 15, "dark"], [11, 7, 31, 7, "accent"],
    [20, 22, 10, 10, "metalDark"], [22, 23, 7, 8, "wood"], [41, 12, 17, 6, "metal"],
    [55, 10, 5, 3, "light"], [29, 4, 12, 5, "dark"], [32, 5, 6, 2, "glow"],
    [13, 9, 6, 2, "shell"], [34, 15, 10, 3, "accentDark"]
  ]),
  "coil-heavy": visual(66, 34, [
    [0, 14, 13, 12, "metalDark"], [8, 9, 38, 20, "dark"], [12, 6, 31, 7, "metal"],
    [15, 12, 7, 12, "glow"], [24, 12, 7, 12, "accent"], [33, 12, 7, 12, "glow"],
    [43, 14, 20, 8, "metal"], [59, 12, 7, 4, "light"], [17, 27, 12, 7, "metalDark"],
    [10, 10, 6, 3, "shell"], [46, 10, 10, 5, "accentDark"], [48, 23, 8, 4, "metalDark"]
  ])
});

const EQUIPMENT_VISUALS = Object.freeze({
  "field-canvas-vest": visual(40, 40, [
    [8, 6, 24, 31, "canvasDark"], [11, 8, 18, 27, "canvas"], [3, 10, 9, 17, "leather"],
    [28, 10, 9, 17, "leather"], [14, 12, 12, 4, "accent"], [18, 7, 4, 28, "ironDark"],
    [11, 28, 18, 6, "leatherDark"], [7, 8, 4, 4, "rivet"], [29, 8, 4, 4, "rivet"]
  ]),
  "riveted-iron-shell": visual(42, 40, [
    [7, 7, 28, 31, "ironDark"], [10, 9, 22, 26, "iron"], [1, 7, 11, 13, "iron"],
    [30, 7, 11, 13, "iron"], [13, 12, 16, 7, "ironLight"], [18, 8, 5, 27, "accentDark"],
    [11, 27, 20, 7, "leatherDark"], [8, 9, 3, 3, "rivet"], [31, 9, 3, 3, "rivet"],
    [13, 29, 3, 3, "rivet"], [26, 29, 3, 3, "rivet"]
  ]),
  "runner-wrap-boots": visual(42, 40, [
    [6, 5, 12, 28, "leatherDark"], [24, 5, 12, 28, "leatherDark"], [8, 7, 9, 23, "leather"],
    [25, 7, 9, 23, "leather"], [4, 29, 17, 8, "ironDark"], [21, 29, 18, 8, "ironDark"],
    [5, 31, 16, 3, "accent"], [22, 31, 16, 3, "accent"], [8, 13, 9, 3, "canvas"],
    [25, 13, 9, 3, "canvas"], [8, 21, 9, 3, "canvas"], [25, 21, 9, 3, "canvas"]
  ]),
  "salvage-sensor-helm": visual(42, 40, [
    [8, 9, 26, 23, "ironDark"], [11, 7, 20, 22, "canvas"], [7, 20, 28, 10, "iron"],
    [12, 12, 17, 5, "ironLight"], [29, 11, 7, 17, "coil"], [31, 6, 3, 7, "rivet"],
    [32, 3, 7, 4, "accent"], [14, 21, 13, 5, "lens"], [16, 22, 5, 2, "light"]
  ]),
  "ammo-thigh-rig": visual(42, 40, [
    [6, 4, 12, 33, "canvasDark"], [24, 4, 12, 33, "canvasDark"], [8, 7, 8, 27, "canvas"],
    [26, 7, 8, 27, "canvas"], [4, 12, 16, 5, "leather"], [22, 12, 16, 5, "leather"],
    [4, 23, 16, 5, "leather"], [22, 23, 16, 5, "leather"], [8, 13, 4, 13, "shell"],
    [13, 13, 4, 13, "shell"], [26, 13, 4, 13, "shell"], [31, 13, 4, 13, "shell"]
  ]),
  "longwave-visor-helm": visual(42, 40, [
    [7, 8, 28, 25, "ironDark"], [10, 6, 22, 24, "iron"], [6, 17, 30, 10, "leatherDark"],
    [10, 18, 22, 7, "lens"], [13, 19, 8, 3, "light"], [29, 2, 4, 16, "ironLight"],
    [27, 1, 8, 4, "accent"], [4, 14, 6, 14, "coil"], [12, 29, 18, 5, "canvasDark"]
  ]),
  "servo-braced-greaves": visual(42, 40, [
    [6, 4, 12, 32, "ironDark"], [24, 4, 12, 32, "ironDark"], [8, 6, 8, 27, "iron"],
    [26, 6, 8, 27, "iron"], [4, 12, 16, 6, "leatherDark"], [22, 12, 16, 6, "leatherDark"],
    [11, 7, 3, 24, "coil"], [28, 7, 3, 24, "coil"], [7, 22, 10, 5, "accent"],
    [25, 22, 10, 5, "accent"], [5, 33, 14, 4, "rivet"], [23, 33, 14, 4, "rivet"]
  ]),
  "stormstep-insulated-boots": visual(42, 40, [
    [5, 5, 13, 27, "canvasDark"], [24, 5, 13, 27, "canvasDark"], [7, 8, 10, 21, "canvas"],
    [25, 8, 10, 21, "canvas"], [3, 29, 18, 9, "ironDark"], [21, 29, 18, 9, "ironDark"],
    [4, 31, 17, 4, "accent"], [22, 31, 17, 4, "accent"], [8, 14, 8, 3, "coil"],
    [26, 14, 8, 3, "coil"], [8, 22, 8, 3, "leather"], [26, 22, 8, 3, "leather"]
  ])
});

const RANGE_BANDS = Object.freeze({
  close: Object.freeze({ label: "近程", color: "#b65b43" }),
  mid: Object.freeze({ label: "中程", color: "#c69b4b" }),
  long: Object.freeze({ label: "远程", color: "#789b95" })
});

const WEAPON_CLASS_LABELS = Object.freeze({
  sidearm: "副武器",
  smg: "冲锋枪",
  shotgun: "霰弹枪",
  rifle: "精确步枪",
  revolver: "左轮",
  carbine: "卡宾枪",
  heavy: "重型武器"
});

function weaponVisual(weapon) {
  return WEAPON_VISUALS[weapon && weapon.visualId] || WEAPON_VISUALS["scrap-sidearm"];
}

function weaponPalette(weapon, override = {}) {
  const accent = override.accent || (weapon && weapon.color) || UI_COLORS.amber;
  return {
    dark: override.dark || "#11171b",
    metalDark: override.metalDark || "#263039",
    metal: override.metal || "#68757a",
    accent,
    accentDark: override.accentDark || "#3b5558",
    shell: override.shell || (weapon && weapon.shellColor) || "#c89b4b",
    wood: override.wood || "#815536",
    woodDark: override.woodDark || "#4b3428",
    glow: override.glow || "#8fb4aa",
    light: override.light || "#e3cf98"
  };
}

function paintVisual(ctx, spec, x, y, unit, palette, shadow = false) {
  if (shadow) {
    ctx.fillStyle = "rgba(7,11,13,0.72)";
    for (const shape of spec.shapes) {
      ctx.fillRect(
        Math.round(x + (shape[0] + 1.5) * unit),
        Math.round(y + (shape[1] + 1.5) * unit),
        Math.max(1, Math.round(shape[2] * unit)),
        Math.max(1, Math.round(shape[3] * unit))
      );
    }
  }
  for (const shape of spec.shapes) {
    ctx.fillStyle = palette[shape[4]] || palette.accent;
    ctx.fillRect(
      Math.round(x + shape[0] * unit),
      Math.round(y + shape[1] * unit),
      Math.max(1, Math.round(shape[2] * unit)),
      Math.max(1, Math.round(shape[3] * unit))
    );
  }
}

function drawWeaponShape(ctx, weapon, options = {}) {
  const spec = weaponVisual(weapon);
  const unit = Math.max(0.25, Number(options.unit) || 1);
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  paintVisual(ctx, spec, x, y, unit, weaponPalette(weapon, options.palette), Boolean(options.shadow));
  return { width: spec.width * unit, height: spec.height * unit };
}

function drawWeaponIcon(ctx, weapon, x, y, size, options = {}) {
  const spec = weaponVisual(weapon);
  const scale = Math.max(0.4, Math.min(size * 0.88 / spec.width, size * 0.7 / spec.height));
  const drawW = spec.width * scale;
  const drawH = spec.height * scale;
  drawWeaponShape(ctx, weapon, {
    x: x - drawW / 2,
    y: y - drawH / 2,
    unit: scale,
    palette: options.palette,
    shadow: true
  });
}

function drawOutfitIcon(ctx, skin, x, y, size) {
  const unit = Math.max(0.6, size / 42);
  const left = x - 18 * unit;
  const top = y - 18 * unit;
  ctx.fillStyle = "rgba(7,11,13,0.7)";
  ctx.fillRect(Math.round(left + 5 * unit), Math.round(top + 5 * unit), Math.round(28 * unit), Math.round(34 * unit));
  ctx.fillStyle = skin.dark;
  ctx.fillRect(Math.round(left + 8 * unit), Math.round(top), Math.round(20 * unit), Math.round(10 * unit));
  ctx.fillRect(Math.round(left + 5 * unit), Math.round(top + 9 * unit), Math.round(28 * unit), Math.round(28 * unit));
  ctx.fillStyle = skin.body;
  ctx.fillRect(Math.round(left + 8 * unit), Math.round(top + 10 * unit), Math.round(22 * unit), Math.round(23 * unit));
  ctx.fillStyle = skin.accent;
  ctx.fillRect(Math.round(left + 8 * unit), Math.round(top + 15 * unit), Math.round(22 * unit), Math.max(2, Math.round(4 * unit)));
  ctx.fillRect(Math.round(left + 1 * unit), Math.round(top + 11 * unit), Math.round(7 * unit), Math.round(20 * unit));
  ctx.fillRect(Math.round(left + 30 * unit), Math.round(top + 11 * unit), Math.round(7 * unit), Math.round(20 * unit));
  if (skin.id === "mechanic") {
    ctx.fillStyle = UI_COLORS.cyan;
    ctx.fillRect(Math.round(left + 2 * unit), Math.round(top + 22 * unit), Math.round(4 * unit), Math.round(6 * unit));
    ctx.fillStyle = UI_COLORS.amber;
    ctx.fillRect(Math.round(left + 12 * unit), Math.round(top + 3 * unit), Math.round(12 * unit), Math.round(3 * unit));
  } else if (skin.id === "nightwatch") {
    ctx.fillStyle = UI_COLORS.cyan;
    ctx.fillRect(Math.round(left + 27 * unit), Math.round(top + 11 * unit), Math.round(3 * unit), Math.round(22 * unit));
  }
}

function equipmentVisual(item) {
  return EQUIPMENT_VISUALS[item && item.visualId] || EQUIPMENT_VISUALS["field-canvas-vest"];
}

function drawEquipmentIcon(ctx, item, x, y, size, accent = UI_COLORS.green) {
  const spec = equipmentVisual(item);
  const scale = Math.max(0.42, Math.min(size * 0.82 / spec.width, size * 0.82 / spec.height));
  const palette = {
    ironDark: "#33342f",
    iron: "#66675f",
    ironLight: "#969080",
    canvasDark: "#494333",
    canvas: "#817151",
    leatherDark: "#3b281e",
    leather: "#765039",
    coil: "#8c6738",
    shell: "#c19a51",
    lens: UI_COLORS.cyan,
    light: UI_COLORS.paper,
    rivet: "#c1a66a",
    accent,
    accentDark: "#624230"
  };
  paintVisual(ctx, spec, x - spec.width * scale / 2, y - spec.height * scale / 2, scale, palette, true);
}

function drawGrantIcon(renderer, grantType, grantId, x, y, size, accent) {
  if (grantType === "weapon") {
    const weapon = renderer.content.get("weapons", grantId, renderer.content.defaults.weapon);
    drawWeaponIcon(renderer.ctx, weapon, x, y, size, { palette: { accent: accent || weapon.color } });
    return;
  }
  if (grantType === "skin") {
    const skin = renderer.content.get("skins", grantId, renderer.content.defaults.skin);
    drawOutfitIcon(renderer.ctx, skin, x, y, size);
    return;
  }
  const equipment = renderer.content.get("equipment", grantId, renderer.content.defaults.equipment);
  drawEquipmentIcon(renderer.ctx, equipment, x, y, size, accent);
}

module.exports = {
  WEAPON_VISUALS,
  EQUIPMENT_VISUALS,
  RANGE_BANDS,
  WEAPON_CLASS_LABELS,
  weaponVisual,
  equipmentVisual,
  drawWeaponShape,
  drawWeaponIcon,
  drawOutfitIcon,
  drawEquipmentIcon,
  drawGrantIcon
};
