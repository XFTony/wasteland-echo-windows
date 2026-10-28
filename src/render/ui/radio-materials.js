"use strict";

const { UI_COLORS } = require("./theme");

const RADIO = Object.freeze({ paper: "#dbc69b", paperLight: "#eeddbb", paperEdge: "#a28a60",
  ink: "#29241e", copper: "#c29a62", cloth: "#272921", clothRaised: "#34362b",
  seam: "#6b6853", wood: "#534130", shadow: "#111610" });

function tagPath(ctx, x, y, w, h, torn = false) {
  const notch = Math.min(7, h * 0.14, w * 0.06);
  ctx.beginPath();
  ctx.moveTo(x + notch, y);
  ctx.lineTo(x + w - notch * 2, y + (torn ? 1 : 0));
  ctx.lineTo(x + w, y + notch);
  ctx.lineTo(x + w - 1, y + h - notch);
  ctx.lineTo(x + w - notch, y + h);
  ctx.lineTo(x + notch, y + h - (torn ? 1 : 0));
  ctx.lineTo(x, y + h - notch);
  ctx.lineTo(x, y + notch);
  ctx.closePath();
}

function stitch(ctx, x1, y, width, color, spacing = 12) {
  ctx.fillStyle = color;
  const count = Math.min(48, Math.floor(width / spacing));
  for (let i = 0; i < count; i++) ctx.fillRect(x1 + i * width / Math.max(1, count), y, 3, 1);
}

function surface(ctx, x, y, w, h, options = {}) {
  const paper = options.material === "paper";
  const active = Boolean(options.active);
  ctx.save();
  if (options.raised) {
    tagPath(ctx, x + 2, y + 4, w, h, paper);
    ctx.fillStyle = RADIO.shadow;
    ctx.fill();
  }
  tagPath(ctx, x, y, w, h, paper);
  ctx.fillStyle = options.fill || (paper ? RADIO.paper : active ? RADIO.clothRaised : RADIO.cloth);
  ctx.fill();
  // Small broken seams and edge wear replace continuous luminous outlines.
  ctx.strokeStyle = options.stroke || (paper ? RADIO.paperEdge : "#504f40");
  ctx.lineWidth = 1;
  ctx.stroke();
  if (w > 90 && h > 30) {
    stitch(ctx, x + 13, y + h - 7, w - 26, paper ? "#b9a77f" : "#605f4b", 15);
    ctx.fillStyle = paper ? "rgba(255,244,211,0.18)" : "rgba(222,210,171,0.035)";
    ctx.fillRect(x + 8, y + 3, Math.max(0, w - 18), 2);
  }
  if (paper && w > 100) {
    ctx.fillStyle = "rgba(91,70,41,0.07)";
    for (let i = 0; i < 14; i++) ctx.fillRect(x + 12 + (i * 37 % Math.max(1, w - 26)),
      y + 6 + (i * 13 % Math.max(1, h - 15)), 2 + i % 3, 1);
    ctx.fillStyle = "#af986d";
    ctx.beginPath();ctx.moveTo(x + w - 14, y + 1);ctx.lineTo(x + w - 2, y + 11);ctx.lineTo(x + w - 15, y + 11);ctx.closePath();ctx.fill();
  }
  if (active && !paper && w > 72) {
    ctx.fillStyle = options.accent || RADIO.copper;
    ctx.fillRect(x + 12, y + h - 4, Math.min(48, w * 0.24), 2);
  }
  ctx.restore();
}

function radioMark(ctx, x, y, color = RADIO.copper, scale = 1) {
  const s = Math.max(0.45, scale);
  ctx.save();ctx.translate(x, y);ctx.scale(s, s);
  ctx.strokeStyle = color;ctx.fillStyle = color;ctx.lineWidth = 1.8;
  ctx.beginPath();ctx.arc(12, 12, 11, -Math.PI * 0.78, Math.PI * 0.78);ctx.stroke();
  ctx.beginPath();ctx.arc(12, 12, 7, -Math.PI * 0.78, Math.PI * 0.78);ctx.stroke();
  ctx.beginPath();ctx.moveTo(8, 21);ctx.lineTo(12, 7);ctx.lineTo(16, 21);ctx.moveTo(10, 16);ctx.lineTo(14, 16);ctx.stroke();
  ctx.beginPath();ctx.arc(12, 7, 2, 0, Math.PI * 2);ctx.fill();
  ctx.restore();
}

function focusInk(ctx, x, y, w, h, color = RADIO.copper, width = 2) {
  ctx.save();ctx.strokeStyle = color;ctx.lineWidth = width;
  ctx.beginPath();ctx.moveTo(x + 5, y + h - 2);ctx.lineTo(x + w - 5, y + h - 2);ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();ctx.moveTo(x + 2, y + h / 2);ctx.lineTo(x + 8, y + h / 2 - 4);ctx.lineTo(x + 8, y + h / 2 + 4);ctx.closePath();ctx.fill();
  ctx.restore();
}

function paperClip(ctx, x, y, width = 26) {
  ctx.save();ctx.strokeStyle = "#968e71";ctx.lineWidth = 2;
  ctx.beginPath();ctx.moveTo(x + 7, y + 10);ctx.lineTo(x + width - 6, y + 10);
  ctx.arc(x + width - 6, y + 4, 6, Math.PI / 2, -Math.PI / 2, true);
  ctx.lineTo(x + 6, y - 2);ctx.arc(x + 6, y + 3, 5, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(x + width - 9, y + 8);ctx.stroke();ctx.restore();
}

function toggleSwitch(renderer, action, label, x, y, w, h) {
  const ctx = renderer.ctx, on = label === "开", pointer = renderer.pointerState || {};
  const active = renderer.focusAction === action || pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const cy = y + h / 2, trackX = x + 6, trackW = Math.min(47, w * 0.48);
  ctx.save();ctx.fillStyle = "#151c15";ctx.fillRect(trackX, cy - 6, trackW, 12);
  ctx.strokeStyle = "#76735a";ctx.lineWidth = 1;ctx.strokeRect(trackX, cy - 6, trackW, 12);
  const knobX = on ? trackX + trackW - 8 : trackX + 8;
  ctx.beginPath();ctx.arc(knobX, cy, 10, 0, Math.PI * 2);ctx.fillStyle = active ? "#d4b77d" : on ? "#af9160" : "#635e49";ctx.fill();
  ctx.fillStyle = "#e4cc97";ctx.fillRect(knobX - 1, cy - 6, 2, 7);ctx.restore();
  renderer.text(label, x + w - 7, cy, Math.min(15, h * 0.36), on ? UI_COLORS.paper : UI_COLORS.muted, "right", "700");
  if (renderer.focusAction === action) focusInk(ctx, x, y, w, h, RADIO.paperLight);
  renderer.addRegion(action, x, y, w, h);
}

module.exports = { RADIO, tagPath, stitch, surface, radioMark, focusInk, paperClip, toggleSwitch };
