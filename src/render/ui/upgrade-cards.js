"use strict";

const { clamp } = require("../../core/math");
const { UPGRADE_FAMILY_STYLES, UPGRADE_RARITIES, UI_COLORS } = require("./theme");
const { drawEchoMark, focusBrackets, sectionPlate } = require("./art-primitives");
const OFFSCREEN_POINTER = Object.freeze({ x: -1000, y: -1000, down: false });

function drawGem(renderer, x, y, radius, color) {
  const ctx = renderer.ctx;
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = UI_COLORS.white;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = UI_COLORS.paper;
  ctx.fillRect(x - 2, y - radius * 0.55, 3, 3);
}

function drawCard(renderer, option, index, level, x, y, w, h, family, rarity, active, compact) {
  const ctx = renderer.ctx;
  const edge = compact ? 6 : 10;
  const headerH = Math.max(compact ? 40 : 56, h * 0.16);
  const artY = y + headerH + (compact ? 5 : 8);
  const artH = Math.max(compact ? 58 : 92, h * 0.3);
  const bodyY = artY + artH + (compact ? 5 : 8);
  const bodyH = h - (bodyY - y) - (compact ? 40 : 54);

  sectionPlate(renderer, x, y, w, h, {
    material: "leather",
    fill: family.dark,
    stroke: active ? UI_COLORS.white : rarity.color,
    accent: family.color,
    accentEdge: "top",
    raised: active,
    lineWidth: active ? 4 : 3
  });
  ctx.fillStyle = active ? family.fill : "#403126";
  ctx.fillRect(x + edge, y + edge, w - edge * 2, headerH - edge);
  ctx.fillStyle = rarity.color;
  ctx.fillRect(x + edge, y + headerH - 3, w - edge * 2, 4);

  const gemRadius = compact ? 7 : 10;
  drawGem(renderer, x + w / 2, y + edge + 5, gemRadius, rarity.gem);
  renderer.text(String(index + 1), x + edge + 9, y + headerH * 0.54, compact ? 12 : 15, UI_COLORS.white, "left", "900", "mono");
  renderer.fitText(rarity.label, x + w - edge - 8, y + headerH * 0.54, compact ? 10 : 13, w * 0.44, UI_COLORS.white, "right", "800", 10);

  sectionPlate(renderer, x + edge + 3, artY, w - edge * 2 - 6, artH, {
    material: "iron",
    fill: "#24221c",
    stroke: family.color,
    accent: rarity.color,
    raised: active,
    lineWidth: active ? 3 : 2
  });
  ctx.fillStyle = family.fill;
  ctx.fillRect(x + edge + 8, artY + 7, w - edge * 2 - 16, 4);
  ctx.fillStyle = active ? "rgba(234,217,173,0.08)" : "rgba(234,217,173,0.035)";
  for (let ray = 0; ray < 5; ray += 1) {
    const rayW = Math.max(2, (w - edge * 2 - 26) * (0.7 - ray * 0.1));
    ctx.fillRect(x + w / 2 - rayW / 2, artY + 18 + ray * Math.max(5, artH * 0.11), rayW, 2);
  }
  const iconSize = Math.min(compact ? 48 : 72, artH * 0.72, w * 0.4);
  renderer.drawUpgradeIcon(option.id, x + w / 2, artY + artH * 0.57, iconSize, family.color);

  sectionPlate(renderer, x + edge + 3, bodyY, w - edge * 2 - 6, Math.max(34, bodyH), {
    material: "canvas",
    fill: UI_COLORS.paper,
    stroke: UI_COLORS.paperMuted,
    raised: true,
    lineWidth: 2
  });
  ctx.fillStyle = family.fill;
  ctx.fillRect(x + edge + 3, bodyY, w - edge * 2 - 6, compact ? 27 : 38);
  renderer.fitText(option.name, x + w / 2, bodyY + (compact ? 14 : 20), compact ? 15 : 21, w - 24, UI_COLORS.white, "center", "900", compact ? 12 : 15, "display");
  renderer.fitText(option.detail, x + w / 2, bodyY + bodyH * 0.57, compact ? 12 : 15, w - 24, UI_COLORS.ink, "center", "900", 11);
  if (bodyH > 74) renderer.fitText(option.flavor, x + w / 2, bodyY + bodyH * 0.8, compact ? 10 : 12, w - 28, "#5c5139", "center", "700", 10);

  const pipSize = compact ? 8 : 11;
  const pipGap = compact ? 3 : 5;
  const pipsW = option.max * pipSize + (option.max - 1) * pipGap;
  const pipX = x + (w - pipsW) / 2;
  const pipY = y + h - (compact ? 19 : 27);
  for (let pip = 0; pip < option.max; pip += 1) {
    ctx.fillStyle = pip < level ? family.color : "#5d594e";
    ctx.fillRect(pipX + pip * (pipSize + pipGap), pipY, pipSize, compact ? 5 : 7);
  }
  renderer.text(`${family.label}  ${level}/${option.max}`, x + w / 2, pipY - (compact ? 11 : 15), compact ? 10 : 12, active ? family.color : UI_COLORS.muted, "center", "900", "mono");
  if (active) focusBrackets(renderer, x - 4, y - 4, w + 8, h + 8, UI_COLORS.gold, 3, compact ? 12 : 18);
}

function drawUpgradeDraft(renderer, model) {
  renderer.drawOverlay();
  const options = model.run.upgradeOptions;
  const compact = renderer.height < 560 || renderer.width < 900;
  const age = Math.max(0, renderer.frame - renderer.screenEnteredFrame);
  drawEchoMark(renderer, renderer.width / 2 - (compact ? 114 : 154), compact ? 17 : 27, UI_COLORS.gold, compact ? 0.68 : 0.9);
  renderer.displayText("选择战地改造", renderer.width / 2, compact ? 29 : 43, compact ? 26 : 38, UI_COLORS.white, "center");
  renderer.text(
    `等级 ${String(model.run.player.level).padStart(2, "0")}  ·  从四张改造卡中选择一张`,
    renderer.width / 2,
    compact ? 55 : 78,
    compact ? 11 : 14,
    UI_COLORS.gold,
    "center",
    "800",
    "card"
  );
  const gap = compact ? 6 : 14;
  const totalW = Math.min(1420, renderer.width - (compact ? 12 : 64));
  const cardW = (totalW - gap * 3) / 4;
  const top = compact ? 68 : 103;
  const footerH = compact ? 54 : 72;
  const cardH = Math.min(compact ? 330 : 480, renderer.height - top - footerH);
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
    const fanDrop = compact ? 0 : Math.abs(index - 1.5) * 11;
    const lift = pressed ? 4 : hovered ? (compact ? -7 : -17) : 0;
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
  const salvageW = Math.min(compact ? 188 : 250, renderer.width * 0.3);
  const salvageH = compact ? 30 : 40;
  const salvageY = renderer.height - salvageH - (compact ? 7 : 14);
  renderer.button("upgradeSalvage", `拆解本轮 · +${salvageValue} 废料`, renderer.width / 2 - salvageW / 2, salvageY, salvageW, salvageH, "secondary");
  if (!compact) {
    const hint = renderer.gamepadConnected ? "十字键选择 · A 装配" : "鼠标悬浮查看 · 点击或数字键 1—4 装配";
    renderer.fitText(hint, renderer.width / 2 - salvageW / 2 - 18, salvageY + salvageH / 2, 12, Math.max(140, renderer.width / 2 - salvageW / 2 - 44), UI_COLORS.muted, "right", "700", 10);
  }
}

module.exports = { drawUpgradeDraft, drawCard };
