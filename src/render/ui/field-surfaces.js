"use strict";

const { ART_IDS } = require("../art/asset-catalog");
const { focusBrackets, sectionPlate } = require("./art-primitives");
const { drawNineSlice } = require("./image-primitives");
const { UI_COLORS } = require("./theme");

function inside(pointer, x, y, w, h) {
  return Boolean(pointer && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h);
}

function drawFieldPlate(renderer, x, y, w, h, options = {}) {
  const alpha = Number.isFinite(options.alpha) ? options.alpha : 1;
  const drawn = drawNineSlice(renderer, ART_IDS.UI_FIELD_PLATE, x, y, w, h, { alpha });
  if (!drawn) {
    sectionPlate(renderer, x, y, w, h, {
      material: "iron",
      fill: options.fill || "#272820",
      stroke: options.stroke || "#74684d",
      accent: options.accent || UI_COLORS.gold,
      lineWidth: options.lineWidth || 2,
      raised: Boolean(options.raised)
    });
  }

  const accent = options.accent;
  if (accent) {
    const ctx = renderer.ctx;
    const inset = Math.max(4, Math.min(9, h * 0.1));
    ctx.fillStyle = accent;
    ctx.fillRect(x + inset, y + inset, Math.max(4, options.active ? w - inset * 2 : Math.min(w - inset * 2, w * 0.2)), Math.max(2, Math.min(4, h * 0.045)));
  }
  return drawn;
}

function drawFieldButton(renderer, action, label, x, y, w, h, options = {}) {
  const pointer = renderer.pointerState || { x: -1000, y: -1000, down: false };
  const hovered = inside(pointer, x, y, w, h);
  const focused = renderer.focusAction === action;
  const active = hovered || focused;
  const pressed = hovered && pointer.down;
  const offset = pressed ? 2 : active ? -2 : 0;
  const accent = options.accent || UI_COLORS.gold;
  drawFieldPlate(renderer, x, y + offset, w, h, { accent, active, raised: active });

  if (options.primary) {
    const insetX = Math.max(18, w * 0.09);
    const insetY = Math.max(10, h * 0.22);
    renderer.ctx.fillStyle = active ? "rgba(159,65,43,0.9)" : "rgba(116,49,36,0.88)";
    renderer.ctx.fillRect(x + insetX, y + offset + insetY, w - insetX * 2, h - insetY * 2);
  }

  renderer.fitText(
    label,
    x + w / 2,
    y + offset + h / 2 + 1,
    options.size || Math.max(13, Math.min(20, h * 0.34)),
    w * 0.76,
    options.color || UI_COLORS.white,
    "center",
    "900",
    11,
    options.role || "ui"
  );
  if (focused) focusBrackets(renderer, x - 3, y + offset - 3, w + 6, h + 6, accent, 2, Math.min(14, h * 0.28));
  renderer.addRegion(action, x, y, w, h);
  return active;
}

function drawTextScrim(renderer, x, y, w, h, options = {}) {
  const ctx = renderer.ctx;
  ctx.fillStyle = options.fill || "rgba(14,13,10,0.86)";
  ctx.fillRect(x, y, w, h);
  if (options.accent) {
    ctx.fillStyle = options.accent;
    ctx.fillRect(x, y, Math.max(3, Math.min(6, w * 0.012)), h);
  }
}

module.exports = { inside, drawFieldPlate, drawFieldButton, drawTextScrim };
