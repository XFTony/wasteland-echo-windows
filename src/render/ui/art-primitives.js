"use strict";

const { UI_COLORS, MATERIALS } = require("./theme");

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
  const ctx = renderer.ctx;
  const unit = Math.max(1, scale);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(24 * unit), Math.max(2, Math.round(3 * unit)));
  ctx.fillRect(Math.round(x + 5 * unit), Math.round(y + 6 * unit), Math.round(15 * unit), Math.max(2, Math.round(3 * unit)));
  ctx.fillRect(Math.round(x + 10 * unit), Math.round(y + 12 * unit), Math.round(6 * unit), Math.max(2, Math.round(3 * unit)));
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
  const ctx = renderer.ctx;
  const material = MATERIALS[options.material] || MATERIALS.iron;
  const cut = Number(options.cut) || Math.max(4, Math.min(9, Math.min(w, h) * 0.08));
  const raised = Boolean(options.raised);
  const depth = raised ? Math.max(3, Math.min(6, Math.min(w, h) * 0.04)) : 2;
  fillCutShape(ctx, x + depth, y + depth, w, h, cut, options.shadowColor || UI_COLORS.shadow);
  fillCutShape(
    ctx,
    x,
    y,
    w,
    h,
    cut,
    options.fill || (raised ? material.raised : material.fill),
    options.stroke || material.edge,
    options.lineWidth || (raised ? 2.5 : 2)
  );
  ctx.fillStyle = options.highlight || material.highlight;
  ctx.fillRect(x + cut + 3, y + 3, Math.max(8, w - cut * 2 - 6), 1);
  ctx.fillStyle = options.lowlight || material.shadow;
  ctx.fillRect(x + cut + 3, y + h - 4, Math.max(8, w - cut * 2 - 6), 2);
  if (options.accent) {
    ctx.fillStyle = options.accent;
    if (options.accentEdge === "top") ctx.fillRect(x + cut + 4, y + 3, Math.max(18, w * 0.24), 4);
    else ctx.fillRect(x + 3, y + cut + 3, 4, Math.max(18, h - cut * 2 - 6));
  }
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

function focusBrackets(renderer, x, y, w, h, color = UI_COLORS.gold, width = 2, length = 12) {
  const ctx = renderer.ctx;
  const l = Math.max(7, Math.min(length, w * 0.22, h * 0.34));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const corners = [
    [x, y, x + l, y, x, y + l],
    [x + w, y, x + w - l, y, x + w, y + l],
    [x, y + h, x + l, y + h, x, y + h - l],
    [x + w, y + h, x + w - l, y + h, x + w, y + h - l]
  ];
  for (const [cx, cy, hx, hy, vx, vy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(hx, hy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(vx, vy);
    ctx.stroke();
  }
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
