"use strict";

const { clamp } = require("../../core/math");
const { UPGRADE_FAMILY_STYLES, UPGRADE_RARITIES, UI_COLORS } = require("./theme");
const { drawEchoMark, focusBrackets } = require("./art-primitives");
const { surface, paperClip } = require("./radio-materials");
const OFFSCREEN_POINTER = Object.freeze({ x: -1000, y: -1000, down: false });

function effectLines(detail, compact) {
  const text = String(detail || "");
  const parts = text.split(" · ");
  if (parts.length > 1) return parts;
  if (!compact || text.length <= 12) return [text];
  const chars = Array.from(text);
  const midpoint = Math.ceil(chars.length / 2);
  return [chars.slice(0, midpoint).join(""), chars.slice(midpoint).join("")];
}

function drawCard(renderer, option, index, level, x, y, w, h, family, rarity, active, compact) {
  const ctx = renderer.ctx;
  const visualScale = compact ? 1 : Math.min(1.55, Math.max(1, renderer.height / 720));
  const pad = compact ? 10 : 20 * visualScale;
  const footerY = y + h - (compact ? 34 : 46 * visualScale);
  surface(ctx, x, y, w, h, { active, raised: true, fill: active ? "#383b2c" : "#252a22", accent: family.color });
  if (!compact) paperClip(ctx, x + w / 2 - 13, y + 6);
  ctx.fillStyle = rarity.color;
  ctx.fillRect(x + pad, y + (compact ? 4 : 8), Math.min(w * 0.26, 70), 3);
  ctx.fillStyle = family.color;
  ctx.fillRect(x + pad, y + (compact ? 37 : 47 * visualScale), Math.min(compact ? 25 : 38 * visualScale, w * 0.24), 2 * visualScale);

  renderer.text(String(index + 1), x + pad, y + (compact ? 20 : 27 * visualScale), compact ? 13 : 16 * visualScale, rarity.color, "left", "900", "mono");
  renderer.fitText(rarity.label, x + pad + (compact ? 20 : 28 * visualScale), y + (compact ? 20 : 27 * visualScale), compact ? 10 : 13 * visualScale, w * 0.54, UI_COLORS.paper, "left", "800", 9);
  renderer.text(family.label, x + w - pad, y + (compact ? 20 : 27 * visualScale), compact ? 10 : 12 * visualScale, family.color, "right", "800");

  const iconSize = Math.min(compact ? 50 : 92 * visualScale, h * (compact ? 0.27 : 0.23), w * 0.48);
  const iconY = y + h * (compact ? 0.36 : 0.36);
  renderer.drawUpgradeIcon(option.id, x + w / 2, iconY, iconSize, family.color);
  renderer.fitText(option.name, x + w / 2, y + h * (compact ? 0.55 : 0.58), compact ? 14 : 24 * visualScale, w - pad * 2, UI_COLORS.white, "center", "900", compact ? 11 : 17 * visualScale, "display");

  const lines = effectLines(option.detail, compact);
  const lineGap = compact ? 14 : 23 * visualScale;
  const detailY = y + h * (compact ? 0.65 : 0.68);
  lines.forEach((line, lineIndex) => {
    renderer.fitText(line, x + w / 2, detailY + lineIndex * lineGap, compact ? 11 : 17 * visualScale, w - pad * 2, UI_COLORS.paper, "center", "800", compact ? 9 : 13 * visualScale);
  });
  if (!compact && option.flavor) {
    renderer.fitText(option.flavor, x + w / 2, y + h * 0.85, 12 * visualScale, w - pad * 2, UI_COLORS.muted, "center", "600", 10 * visualScale);
  }

  ctx.fillStyle = "rgba(196,178,141,0.26)";
  ctx.fillRect(x + pad, footerY, w - pad * 2, visualScale);
  renderer.text(`${level}/${option.max}`, x + pad, footerY + (compact ? 18 : 23 * visualScale), compact ? 10 : 12 * visualScale, family.color, "left", "900", "mono");
  const pipSize = compact ? 6 : 9 * visualScale;
  const pipGap = compact ? 3 : 4 * visualScale;
  const pipsW = option.max * pipSize + (option.max - 1) * pipGap;
  const pipX = x + w - pad - pipsW;
  for (let pip = 0; pip < option.max; pip += 1) {
    ctx.fillStyle = pip < level ? family.color : "#5d594e";
    ctx.fillRect(pipX + pip * (pipSize + pipGap), footerY + (compact ? 15 : 20 * visualScale), pipSize, compact ? 5 : 6 * visualScale);
  }
  if (active) focusBrackets(renderer, x - 4, y - 4, w + 8, h + 8, UI_COLORS.gold, 3 * visualScale, compact ? 10 : 15 * visualScale);
}

function drawUpgradeDraft(renderer, model) {
  renderer.drawOverlay();
  const options = model.run.upgradeOptions;
  const compact = renderer.height < 560 || renderer.width < 900;
  const visualScale = compact ? 1 : Math.min(1.55, Math.max(1, renderer.height / 720));
  const age = Math.max(0, renderer.frame - renderer.screenEnteredFrame);
  drawEchoMark(renderer, renderer.width / 2 - (compact ? 114 : 154 * visualScale), compact ? 17 : 27 * visualScale, UI_COLORS.gold, compact ? 0.68 : 0.9 * visualScale);
  renderer.displayText("选择战地改造", renderer.width / 2, compact ? 29 : 43 * visualScale, compact ? 26 : 38 * visualScale, UI_COLORS.white, "center");
  renderer.text(
    `等级 ${String(model.run.player.level).padStart(2, "0")}  ·  从四张改造卡中选择一张`,
    renderer.width / 2,
    compact ? 55 : 78 * visualScale,
    compact ? 11 : 14 * visualScale,
    UI_COLORS.gold,
    "center",
    "800",
    "card"
  );
  const gap = compact ? 6 : 14 * visualScale;
  const totalW = Math.min(1420 * visualScale, renderer.width - (compact ? 12 : 64));
  const cardW = (totalW - gap * 3) / 4;
  const footerH = compact ? 54 : 72 * visualScale;
  const preferredCardH = compact ? 330 : 480 * visualScale;
  const top = compact ? 68 : Math.max(103 * visualScale, (renderer.height - preferredCardH - footerH - 30 * visualScale) / 2);
  const cardH = Math.min(preferredCardH, renderer.height - top - footerH);
  const startX = (renderer.width - totalW) / 2;
  const pointer = renderer.pointerState || OFFSCREEN_POINTER;
  let activeIndex = -1;
  for (let index = 0; index < options.length; index += 1) {
    const x = startX + index * (cardW + gap);
    if (renderer.focusAction === `upgrade:${options[index].id}` || (pointer.x >= x && pointer.x <= x + cardW && pointer.y >= top && pointer.y <= top + cardH)) {
      activeIndex = index;
      break;
    }
  }
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const x = startX + index * (cardW + gap);
    const family = UPGRADE_FAMILY_STYLES[option.family] || UPGRADE_FAMILY_STYLES.utility;
    const rarity = UPGRADE_RARITIES[option.rarity] || UPGRADE_RARITIES.standard;
    const focused = renderer.focusAction === `upgrade:${option.id}`;
    const hovered = focused || (pointer.x >= x && pointer.x <= x + cardW && pointer.y >= top && pointer.y <= top + cardH);
    const pressed = hovered && pointer.down;
    const progress = clamp((age - index * 5) / 20, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const fanDrop = compact ? 0 : Math.abs(index - 1.5) * 11 * visualScale;
    const lift = pressed ? 4 : hovered ? (compact ? -7 : -17 * visualScale) : 0;
    const cardY = top + fanDrop + (1 - eased) * Math.min(150, cardH * 0.55) + lift;
    const angle = compact ? 0 : (index - 1.5) * 0.035 * (hovered ? 0.18 : 1);
    renderer.ctx.save();
    const dim = activeIndex >= 0 && activeIndex !== index ? 0.82 : 1;
    renderer.ctx.globalAlpha = (0.12 + progress * 0.88) * dim;
    renderer.ctx.translate(x + cardW / 2, cardY + cardH / 2);
    renderer.ctx.rotate(angle);
    drawCard(renderer, option, index, model.run.upgrades[option.id] || 0, -cardW / 2, -cardH / 2, cardW, cardH, family, rarity, hovered, compact);
    renderer.ctx.restore();
    renderer.addRegion(`upgrade:${option.id}`, x, top, cardW, cardH);
  }
  const salvageValue = model.upgradeSalvageValue();
  const salvageW = Math.min(compact ? 188 : 250 * visualScale, renderer.width * 0.3);
  const salvageH = compact ? 30 : 40 * visualScale;
  const bottomSalvageY = renderer.height - salvageH - (compact ? 7 : 14 * visualScale);
  const salvageY = compact ? bottomSalvageY : Math.min(bottomSalvageY, Math.max(top + cardH + 40 * visualScale, bottomSalvageY - 90 * visualScale));
  renderer.button("upgradeSalvage", `拆解本轮 · +${salvageValue} 废料`, renderer.width / 2 - salvageW / 2, salvageY, salvageW, salvageH, "secondary");
  if (!compact) {
    const hint = renderer.gamepadConnected ? "十字键选择 · A 装配" : "鼠标悬浮查看 · 点击或数字键 1—4 装配";
    renderer.fitText(hint, renderer.width / 2 - salvageW / 2 - 18 * visualScale, salvageY + salvageH / 2, 12 * visualScale, Math.max(140, renderer.width / 2 - salvageW / 2 - 44), UI_COLORS.muted, "right", "700", 10);
  }
}

module.exports = { drawUpgradeDraft, drawCard };
