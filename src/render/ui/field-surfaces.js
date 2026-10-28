"use strict";

const { focusBrackets } = require("./art-primitives");
const { UI_COLORS } = require("./theme");
const { RADIO, surface, radioMark } = require("./radio-materials");

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
  surface(ctx, x, y, w, h, { ...options, active, accent });
  ctx.restore();
  return true;
}

function drawFieldButton(renderer, action, label, x, y, w, h, options = {}) {
  const pointer = renderer.pointerState || { x: -1000, y: -1000, down: false };
  const hovered = inside(pointer, x, y, w, h);
  const focused = renderer.focusAction === action;
  const active = hovered || focused;
  const pressed = hovered && pointer.down;
  const offset = pressed ? 2 : active ? -1 : 0;
  const accent = options.accent || UI_COLORS.gold;
  const knob = w <= 56 && h <= 56 && w / h > 0.65 && w / h < 1.5;
  if (knob) {
    const ctx = renderer.ctx, radius = Math.min(w, h) * 0.42;
    ctx.save();ctx.beginPath();ctx.arc(x + w / 2, y + offset + h / 2 + 2, radius, 0, Math.PI * 2);ctx.fillStyle = "#131710";ctx.fill();
    ctx.beginPath();ctx.arc(x + w / 2, y + offset + h / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = active ? "#716044" : "#423f30";ctx.fill();ctx.strokeStyle = "#988362";ctx.lineWidth = 1;ctx.stroke();ctx.restore();
  } else drawFieldPlate(renderer, x, y + offset, w, h, {
    accent,
    active,
    raised: active,
    material: options.primary ? "paper" : "cloth",
    fill: options.fill || (options.primary ? (active ? RADIO.paperLight : RADIO.paper) : active ? "#3b3b2d" : "#2b2b22")
  });

  renderer.fitText(
    label,
    x + w / 2,
    y + offset + h / 2 + 1,
    options.size || Math.max(13, Math.min(20, h * 0.34)),
    w * 0.82,
    options.color || (options.primary && !knob ? RADIO.ink : UI_COLORS.white),
    "center",
    "900",
    11,
    options.role || "ui"
  );
  if (w > 140 && h >= 40) radioMark(renderer.ctx, x + 12, y + offset + h / 2 - 9, options.primary ? "#705639" : accent, 0.7);
  if (focused) focusBrackets(renderer, x - 3, y + offset - 3, w + 6, h + 6, options.primary ? RADIO.paperLight : accent, 2, Math.min(14, h * 0.28));
  renderer.addRegion(action, x, y, w, h);
  return active;
}

function drawTextScrim(renderer, x, y, w, h, options = {}) {
  const ctx = renderer.ctx;
  ctx.fillStyle = options.fill || "rgba(14,13,10,0.86)";
  ctx.fillRect(x, y, w, h);
  if (options.accent && h > 32) {
    ctx.fillStyle = options.accent;
    ctx.fillRect(x + 13, y + h - 3, Math.max(24, Math.min(64, w * 0.18)), 2);
  }
}

module.exports = { inside, drawFieldPlate, drawFieldButton, drawTextScrim };
