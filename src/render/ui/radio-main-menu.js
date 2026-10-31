"use strict";

const { UI_COLORS } = require("./theme");
const { RADIO, surface, radioMark, focusInk } = require("./radio-materials");

function drawRadioMenuChoice(renderer, action, label, detail, x, y, w, h, primary = false) {
  const ctx = renderer.ctx, pointer = renderer.pointerState || {};
  const hover = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const focused = renderer.focusAction === action, active = hover || focused;
  const dy = hover && pointer.down ? 2 : active ? -2 : 0;
  surface(ctx, x, y + dy, w, h, { material: primary ? "paper" : "cloth", raised: true,
    active, fill: primary ? active ? RADIO.paperLight : RADIO.paper : active ? "#393a2d" : "#23271f" });
  const color = primary ? RADIO.ink : UI_COLORS.white;
  const compact = h < 70, pad = w < 150 ? 13 : 22;
  if (primary && w > 190) radioMark(ctx, x + 18, y + dy + h / 2 - 15, "#745733", 1.25);
  const textX = x + pad + (primary && w > 190 ? 41 : 0);
  renderer.fitText(label, textX, y + dy + h * 0.37, compact ? 17 : 23, w - (textX - x) - 18, color, "left", "900", 12);
  renderer.fitText(detail, textX, y + dy + h * 0.72, compact ? 10 : 12, w - (textX - x) - 18,
    primary ? "#5c4b35" : "#bdb393", "left", "600", 10);
  if (!primary) { ctx.fillStyle = "#96815a";ctx.fillRect(x + w - 36, y + dy + 3, 18, 3); }
  if (focused) focusInk(ctx, x - 3, y - 3 + dy, w + 6, h + 7, RADIO.paperLight, 2);
  renderer.addRegion(action, x, y, w, h);
}

function drawRadioMainMenu(renderer, model) {
  const ctx = renderer.ctx, width = renderer.width, height = renderer.height;
  const compact = height < 600 || width < 980, tiny = width < 720 || height < 420;
  const margin = tiny ? 16 : compact ? 28 : 64;
  const titleY = tiny ? 48 : compact ? 76 : 118;
  const titleSize = tiny ? 42 : compact ? 60 : 84;
  ctx.save();ctx.fillStyle = renderer.menuReadabilityGradient || "rgba(20,23,18,0.38)";
  ctx.globalAlpha = 0.65;ctx.fillRect(0, 0, width, height);ctx.restore();
  radioMark(ctx, margin, titleY - (tiny ? 30 : 61), RADIO.copper, tiny ? 0.6 : 0.9);
  renderer.text("余火未熄，广播仍在。", margin + (tiny ? 26 : 34), titleY - (tiny ? 21 : 49), tiny ? 10 : 12, "#c5b18a", "left", "600");
  for (const [label, y] of [["荒原", titleY], ["回响", titleY + titleSize * 1.05]]) {
    renderer.text(label, margin + 3, y + 4, titleSize, "#211b17", "left", "900", "brand");
    renderer.text(label, margin, y, titleSize, "#eddbb8", "left", "900", "brand");
  }
  const subY = titleY + titleSize * 1.78;
  renderer.trackedText("WASTELAND ECHO", margin + 2, subY, tiny ? 9 : 12, RADIO.copper, tiny ? 1 : 2.3);
  if (!tiny) renderer.text("走出营地，把失落的回声带回来。", margin + 2, subY + 31, compact ? 12 : 14, "#c7bd9e", "left", "500");
  if (!tiny && renderer.compactActors) renderer.compactActors.drawPortrait(renderer, model, width * 0.6, height * 0.35, width * 0.19, height * 0.48);
  const navW = width - margin * 2, gap = tiny ? 8 : 14;
  const primaryW = navW * (tiny ? 0.31 : 0.29), secondaryW = (navW - primaryW - gap * 3) / 3;
  const buttonH = tiny ? 50 : compact ? 72 : 88;
  const y = height - (tiny ? 85 : compact ? 126 : 166);
  renderer.menuChoice("start", "开始游戏", "整备行装 · 前往战区", margin, y, primaryW, buttonH, true);
  const choices = [["shop", "拾荒者商栈", "补给与装备"], ["settings", "设置", "声音与操控"], ["credits", "行动档案", "记录与制作"]];
  choices.forEach(([action, label, detail], i) => renderer.menuChoice(action, label, detail,
    margin + primaryW + gap + i * (secondaryW + gap), y, secondaryW, buttonH));
  const footerY = height - (tiny ? 16 : 33);
  renderer.text(`铜币 ${model.save.currencies.copper}  ·  金币 ${model.save.currencies.gold}`, margin, footerY, tiny ? 10 : 12, "#c5b18a", "left", "700", "mono");
  const hint = renderer.gamepadConnected ? "十字键选择 · A 确认" : "方向键选择 · Enter 确认 · F 全屏";
  renderer.fitText(hint, width - margin, footerY, tiny ? 10 : 12, width * 0.5, "#c7bd9e", "right", "600", 10);
}

module.exports = { drawRadioMainMenu, drawRadioMenuChoice };
