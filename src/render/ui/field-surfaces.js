"use strict";

const { focusBrackets } = require("./art-primitives");
const { UI_COLORS } = require("./theme");

function inside(pointer, x, y, w, h) {
  return Boolean(pointer && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h);
}

function drawFieldPlate(renderer, x, y, w, h, options = {}) {
  const ctx = renderer.ctx;
  const active = Boolean(options.active);
  const accent = options.accent || UI_COLORS.gold;
  const alpha = Number.isFinite(options.alpha) ? options.alpha : 1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (options.raised) {
    ctx.fillStyle = "rgba(8,8,7,0.46)";
    ctx.fillRect(x + 3, y + 4, w, h);
  }
  ctx.fillStyle = options.fill || (active ? "#36302a" : "#25231f");
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(239,216,171,0.035)";
  ctx.fillRect(x + 2, y + 2, Math.max(0, w - 4), Math.max(0, h * 0.4));
  ctx.strokeStyle = options.stroke || (active ? accent : "#766b59");
  ctx.lineWidth = options.lineWidth || (active ? 2 : 1);
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, Math.min(4, Math.max(2, h * 0.055)), h);
  ctx.restore();
  return true;
}

function drawFieldButton(renderer, action, label, x, y, w, h, options = {}) {
  const pointer = renderer.pointerState || { x: -1000, y: -1000, down: false };
  const hovered = inside(pointer, x, y, w, h);
  const focused = renderer.focusAction === action;
  const active = hovered || focused;
  const pressed = hovered && pointer.down;
  const offset = pressed ? 2 : active ? -2 : 0;
  const accent = options.accent || UI_COLORS.gold;
  drawFieldPlate(renderer, x, y + offset, w, h, {
    accent,
    active,
    raised: active,
    fill: options.primary ? (active ? "#944c38" : "#713d31") : undefined
  });

  renderer.fitText(
    label,
    x + w / 2,
    y + offset + h / 2 + 1,
    options.size || Math.max(13, Math.min(20, h * 0.34)),
    w * 0.82,
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
