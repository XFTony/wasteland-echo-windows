"use strict";

const { UI_COLORS, MATERIALS } = require("./theme");
const { radioMark, focusInk, surface } = require("./radio-materials");

function cutCornerPath(ctx, x, y, w, h, cut = 9) {
  const c = Math.max(0, Math.min(cut, w * 0.18, h * 0.32));
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function fillCutShape(ctx, x, y, w, h, cut, fill, stroke = null, lineWidth = 1) {
  cutCornerPath(ctx, x, y, w, h, cut);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawRivet(ctx, x, y, color = UI_COLORS.gold, size = 3) {
  const s = Math.max(2, size);
  ctx.fillStyle = UI_COLORS.shadow;
  ctx.fillRect(Math.round(x + 1), Math.round(y + 1), s, s);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), s, s);
  ctx.fillStyle = UI_COLORS.paper;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function drawEchoMark(renderer, x, y, color = UI_COLORS.gold, scale = 1) {
  radioMark(renderer.ctx, x, y, color, scale);
}

function screenFrame(renderer, x, y, w, h, options = {}) {
  const ctx = renderer.ctx;
  const material = MATERIALS[options.material] || MATERIALS.iron;
  const cut = Number(options.cut) || Math.max(8, Math.min(15, Math.min(w, h) * 0.022));
  const depth = Number(options.depth) || Math.max(5, Math.min(10, Math.min(w, h) * 0.018));
  const accent = options.accent || UI_COLORS.orange;

  fillCutShape(ctx, x + depth + 2, y + depth + 3, w, h, cut, UI_COLORS.shadow);
  fillCutShape(ctx, x + depth, y + depth, w, h, cut, material.shadow, material.edge, 2);

  ctx.fillStyle = "#171510";
  ctx.beginPath();
  ctx.moveTo(x + w, y + cut);
  ctx.lineTo(x + w + depth, y + cut + depth);
  ctx.lineTo(x + w + depth, y + h - cut + depth);
  ctx.lineTo(x + w, y + h - cut);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + cut, y + h);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + w - cut + depth, y + h + depth);
  ctx.lineTo(x + cut + depth, y + h + depth);
  ctx.closePath();
  ctx.fill();

  fillCutShape(ctx, x, y, w, h, cut, options.fill || material.fill, options.stroke || material.edge, options.lineWidth || 3);
  fillCutShape(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(3, cut - 4), "rgba(0,0,0,0)", options.innerStroke || material.highlight, 1);

  ctx.fillStyle = accent;
  ctx.fillRect(x + cut + 5, y + 4, Math.max(38, Math.min(94, w * 0.1)), 4);
  ctx.fillStyle = material.highlight;
  ctx.fillRect(x + cut + 5, y + 9, Math.max(22, Math.min(54, w * 0.065)), 1);
  ctx.fillStyle = material.shadow;
  ctx.fillRect(x + 6, y + h - 9, w - 12, 4);

  if (options.rivets !== false && w > 180 && h > 100) {
    drawRivet(ctx, x + cut + 7, y + 10, material.edge, 3);
    drawRivet(ctx, x + w - cut - 10, y + 10, material.edge, 3);
    drawRivet(ctx, x + cut + 7, y + h - 14, material.edge, 3);
    drawRivet(ctx, x + w - cut - 10, y + h - 14, material.edge, 3);
  }
}

function sectionPlate(renderer, x, y, w, h, options = {}) {
  surface(renderer.ctx, x, y, w, h, { fill: options.fill, raised: options.raised,
    accent: options.accent, active: false });
}

function sectionTitle(renderer, label, index, x, y, w, options = {}) {
  const accent = options.accent || UI_COLORS.gold;
  const size = options.size || 14;
  renderer.text(label, x, y, size, options.color || UI_COLORS.white, "left", "900", options.role || "display");
  const indexText = String(index || "").trim();
  if (indexText) renderer.text(indexText, x + w, y, Math.max(10, size * 0.62), accent, "right", "900", "mono");
  const lineY = y + size * 0.82;
  renderer.ctx.fillStyle = accent;
  renderer.ctx.fillRect(x, lineY, Math.max(28, Math.min(82, w * 0.22)), 3);
  renderer.ctx.fillStyle = UI_COLORS.iron;
  renderer.ctx.fillRect(x + Math.max(34, Math.min(90, w * 0.24)), lineY + 1, Math.max(20, w * 0.34), 1);
}

function focusBrackets(renderer, x, y, w, h, color = UI_COLORS.gold, width = 2) {
  focusInk(renderer.ctx, x, y, w, h, color, width);
}

function statBlock(renderer, label, value, x, y, w, h, options = {}) {
  const accent = options.accent || UI_COLORS.gold;
  sectionPlate(renderer, x, y, w, h, {
    material: options.material || "canvas",
    fill: options.fill || UI_COLORS.canvasDeep,
    stroke: options.stroke || "#80745b",
    accent,
    raised: Boolean(options.raised)
  });
  renderer.text(label, x + 11, y + Math.max(12, h * 0.27), Math.max(10, Math.min(13, h * 0.2)), UI_COLORS.muted, "left", "800");
  renderer.fitText(value, x + 11, y + h * 0.65, Math.max(16, Math.min(24, h * 0.34)), w - 22, options.valueColor || UI_COLORS.white, "left", "900", 12, "display");
}

module.exports = {
  cutCornerPath,
  drawEchoMark,
  drawRivet,
  focusBrackets,
  screenFrame,
  sectionPlate,
  sectionTitle,
  statBlock
};
