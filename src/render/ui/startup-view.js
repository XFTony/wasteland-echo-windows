"use strict";

const { RADIO, radioMark, stitch } = require("./radio-materials");

function drawStartup(renderer, state) {
  const ctx = renderer.ctx, width = renderer.width, height = renderer.height;
  const p = state.progress;
  ctx.fillStyle = `rgba(17,21,18,${Math.max(0.38, 0.96 - p * 0.48)})`;
  ctx.fillRect(0, 0, width, height);
  const cx = width * 0.5, cy = height * 0.43;
  const scale = Math.max(1.2, Math.min(2.8, height / 270));
  ctx.save();ctx.globalAlpha = Math.min(1, p * 5);
  for (let i = 0; i < 3; i++) {
    const phase = (p * 1.5 + i / 3) % 1;
    ctx.save();ctx.globalAlpha *= (1 - phase) * 0.2;
    ctx.strokeStyle = RADIO.copper;ctx.lineWidth = 1.5;
    ctx.beginPath();ctx.arc(cx, cy - 32 * scale, (29 + phase * 22) * scale, -0.76, 0.76);ctx.stroke();ctx.restore();
  }
  radioMark(ctx, cx - 12 * scale, cy - 44 * scale, RADIO.paperLight, scale);
  renderer.text("荒原回响", cx, cy + 23 * scale, Math.max(24, Math.floor(Math.min(72, width * 0.1) / 12) * 12), "#eeddbb", "center", "900", "brand");
  renderer.text("WASTELAND ECHO", cx, cy + 50 * scale, 12, RADIO.copper, "center", "700", "mono");
  const dialW = Math.min(340, width * 0.48), dialY = cy + 81 * scale;
  stitch(ctx, cx - dialW / 2, dialY, dialW, "#a89066", 10);
  ctx.fillStyle = "#d3b681";
  ctx.fillRect(cx - dialW / 2 + dialW * (0.08 + p * 0.84), dialY - 11, 2, 24);
  renderer.text(state.assetsReady ? "远征电台 · 信号已接通" : "远征电台 · 正在寻找回声", cx, dialY + 39, 13, "#d8c7a3", "center", "700");
  ctx.restore();
  const label = renderer.gamepadConnected ? "A / B 跳过" : "点击或按 Enter 跳过";
  renderer.text(label, width - 30, height - 30, 12, "#d5c7aa", "right", "600");
  renderer.addRegion("skipStartup", width - Math.min(230, width * 0.6), height - 58, Math.min(210, width * 0.56), 44);
}

module.exports = { drawStartup };
