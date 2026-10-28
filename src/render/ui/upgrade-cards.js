"use strict";

const { clamp } = require("../../core/math");
const { UPGRADE_FAMILY_STYLES, UPGRADE_RARITIES } = require("./theme");
const { surface, paperClip, focusInk, RADIO } = require("./radio-materials");
const { drawUpgradeIllustration } = require("./upgrade-illustrations");
const { pointInCard, cardBounds } = require("./card-motion");

function effectLines(detail, width = 14) {
  const parts = String(detail || "").split(" · "), lines = [];
  for (const part of parts) {
    const chars = Array.from(part);
    while (chars.length) lines.push(chars.splice(0, width).join(""));
  }
  return lines.slice(0, 3);
}

function drawCard(r, option, index, level, x, y, w, h, family, rarity, active, compact) {
  const ctx = r.ctx, tiny = h < 170;
  const pad = Math.max(10, Math.min(22, w * .075));
  surface(ctx, x, y, w, h, { fill: "#41382a", raised: true });
  surface(ctx, x + 4, y + 4, w - 8, h - 8, { material: "paper", fill: active ? "#f0dfb7" : "#ddc69a" });
  ctx.fillStyle = "#766247"; ctx.fillRect(x + 10, y + 10, 5, Math.max(15, h - 20));
  ctx.fillStyle = family.fill; ctx.fillRect(x + pad + 2, y + 13, w - pad * 2 - 4, tiny ? 20 : 28);
  r.text(String(index + 1), x + pad + 10, y + (tiny ? 23 : 27), tiny ? 11 : 15, "#f7e7c3", "left", "900", "mono");
  r.fitText(`${family.label} / ${rarity.label}`, x + w - pad - 10, y + (tiny ? 23 : 27), tiny ? 10 : 12, w - pad * 2 - 35, "#f7e7c3", "right", "800", 9);
  if (!tiny) paperClip(ctx, x + w / 2 - 12, y + 3, 24);
  const iconSize = tiny ? Math.min(50, h * .55) : Math.min(w * .6, h * .31, 144);
  const iconX = tiny ? x + 41 : x + w / 2, iconY = tiny ? y + h * .6 : y + h * .30;
  if (!tiny) {
    ctx.fillStyle = "rgba(130,106,63,.10)"; ctx.fillRect(x + pad, y + h * .14, w - pad * 2, h * .32);
    ctx.fillStyle = "rgba(94,75,45,.14)";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + pad + 6, y + h * .19 + i * 15, 18 + i * 4, 1);
  }
  drawUpgradeIllustration(ctx, option.id, iconX, iconY, iconSize, option.family);
  const textX = tiny ? x + 77 : x + w / 2, align = tiny ? "left" : "center";
  const textW = tiny ? w - 88 : w - pad * 2;
  r.fitText(option.name, textX, y + h * (tiny ? .49 : .51), tiny ? 13 : Math.min(24, w * .092), textW, RADIO.ink, align, "900", tiny ? 10 : 16);
  if (!tiny) r.text("装 配 效 果", x + w / 2, y + h * .60, 10, "#6b583a", "center", "800");
  const lines = effectLines(option.detail, tiny ? 17 : Math.max(10, Math.floor((w - pad * 2) / 15)));
  lines.forEach((line, i) => r.fitText(line, textX, y + h * (tiny ? .71 : .68) + i * (tiny ? 13 : 22), tiny ? 10 : 16, textW, "#3e3424", align, "800", tiny ? 9 : 12));
  if (!tiny) {
    if (option.flavor && lines.length < 3) r.fitText(option.flavor, x + w / 2, y + h * .83, 12, w - pad * 2, "#685334", "center", "600", 10);
    const footer = y + h - 43;
    ctx.fillStyle = "#aa9064"; ctx.fillRect(x + pad, footer - 5, w - pad * 2, 1);
    r.text(`装配 ${Math.min(level + 1, option.max)}/${option.max}`, x + pad, footer + 13, 12, "#513f29", "left", "900");
    const count = Math.min(8, option.max), pip = Math.min(8, (w * .43 - count * 3) / count);
    for (let i = 0; i < count; i++) { ctx.fillStyle = i <= level ? family.fill : "#b6a17a"; ctx.fillRect(x + w - pad - (count - i) * (pip + 3), footer + 8, pip, 8); }
  }
  if (active) focusInk(ctx, x + 9, y + 5, w - 18, h - 12, family.dark, 3);
}

function drawUpgradeDraft(r, model) {
  r.regions.length = 0; r.regionCount = 0;
  r.drawOverlay();
  const options = model.run.upgradeOptions, twoRows = r.width < 780 || r.height < 430;
  const columns = twoRows ? 2 : 4, rows = Math.ceil(options.length / columns);
  const narrow = r.height < 600, top = twoRows ? 48 : narrow ? 82 : 124;
  const footer = twoRows ? 40 : narrow ? 55 : 86, gap = twoRows ? 8 : 14;
  const totalW = Math.min(1340, r.width - (twoRows ? 20 : 44));
  const w = (totalW - gap * (columns - 1)) / columns;
  const h = Math.min(twoRows ? 180 : 478, (r.height - top - footer - gap * (rows - 1) - 18) / rows);
  const startX = (r.width - totalW) / 2, dt = clamp(r.uiTime - (r.draftLastTime ?? r.uiTime), 0, .1);
  r.draftLastTime = r.uiTime;
  if (r.draftRun !== model.run || r.draftOptions !== options) {
    r.draftRun = model.run; r.draftOptions = options; r.draftHovers = options.map(() => 0);
    r.draftCards = []; r.draftStarted = r.uiTime;
  }
  r.displayText("战地改造 · 装配新改件", r.width / 2, twoRows ? 20 : narrow ? 32 : 48, twoRows ? 20 : narrow ? 28 : 36, "#efddb7", "center");
  if (!twoRows) r.text(`生存计时暂停 · 等级 ${model.run.player.level} · 选择一项立即生效`, r.width / 2, narrow ? 61 : 83, narrow ? 12 : 15, "#cbb791", "center", "700");
  const pointer = r.pointerState || { x: -1000, y: -1000 }, age = Math.max(0, r.uiTime - r.draftStarted);
  if (pointer.x !== r.draftPointerX || pointer.y !== r.draftPointerY) r.draftPointerPriority = true;
  if (r.focusAction !== r.draftLastFocus || r.activeInputDevice === "gamepad") r.draftPointerPriority = false;
  r.draftPointerX = pointer.x; r.draftPointerY = pointer.y; r.draftLastFocus = r.focusAction;
  const pointerIndex = options.findIndex((option, i) => {
    const prior = r.draftCards.find(card => card.option.id === option.id);
    const x = startX + i % columns * (w + gap), y = top + Math.floor(i / columns) * (h + gap);
    return prior && pointInCard(prior.shape, pointer.x, pointer.y) || pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  });
  const activeIndex = r.draftPointerPriority && pointerIndex >= 0 ? pointerIndex : options.findIndex(option => r.focusAction === `upgrade:${option.id}`);
  const cards = options.map((option, i) => {
    const x = startX + i % columns * (w + gap), y = top + Math.floor(i / columns) * (h + gap);
    const hovered = activeIndex === i;
    r.draftHovers[i] += ((hovered ? 1 : 0) - r.draftHovers[i]) * (r.reducedMotion ? 1 : 1 - Math.exp(-dt * 19));
    const hover = r.draftHovers[i], progress = r.reducedMotion ? 1 : clamp((age - i * .045) / .27, 0, 1);
    const ease = 1 - (1 - progress) ** 3;
    const shape = { cx: x + w / 2, cy: y + h / 2 + (1 - ease) * 16 - hover * (twoRows ? 3 : 12),
      w, h, angle: twoRows || r.reducedMotion ? 0 : (i - 1.5) * .022 * (1 - hover * .85), scale: .94 + ease * .06 + hover * .012 };
    return { option, i, shape, hovered, progress, family: UPGRADE_FAMILY_STYLES[option.family] || UPGRADE_FAMILY_STYLES.utility,
      rarity: UPGRADE_RARITIES[option.rarity] || UPGRADE_RARITIES.standard };
  });
  const order = cards.slice().sort((a, b) => a.hovered - b.hovered);
  for (const card of order) {
    const { shape: s, option, i } = card;
    r.ctx.save(); r.ctx.globalAlpha = .2 + card.progress * .8;
    r.ctx.translate(s.cx, s.cy); r.ctx.rotate(s.angle); r.ctx.scale(s.scale, s.scale);
    drawCard(r, option, i, model.run.upgrades[option.id] || 0, -w / 2, -h / 2, w, h, card.family, card.rarity, card.hovered, twoRows);
    r.ctx.restore();
    const bounds = cardBounds(s);
    r.addRegion(`upgrade:${option.id}`, bounds.x, bounds.y, bounds.w, bounds.h, s);
    card.screenShape = r.regions[r.regions.length - 1].cardShape;
  }
  r.draftCards = cards;
  const salvageW = Math.min(250, r.width * .44), salvageH = twoRows ? 27 : 36;
  const salvageY = r.height - salvageH - (twoRows ? 5 : 12);
  r.button("upgradeSalvage", `拆解本轮 · +${model.upgradeSalvageValue()} 拾荒币`, r.width / 2 - salvageW / 2, salvageY, salvageW, salvageH, "secondary");
  if (!twoRows) r.fitText(r.gamepadConnected ? "方向键选卡 · A装配" : "悬停查看 · 点击或数字键1—4装配", r.width / 2, salvageY - 16, 12, r.width - 40, "#cbb994", "center", "700", 10);
}

function drawUpgradeReceipt(r) {
  const receipt = r.cardReceipt;
  if (!receipt || receipt.life <= 0) return;
  const progress = 1 - receipt.life / receipt.duration, ease = progress * progress * (3 - 2 * progress);
  const x = r.reducedMotion ? r.width / 2 - 120 : receipt.x * (1 - ease) + 170 * ease - 120;
  const y = r.reducedMotion ? 115 : receipt.y * (1 - ease) + 120 * ease - 35;
  r.ctx.save(); r.ctx.globalAlpha = Math.min(1, receipt.life / .12);
  surface(r.ctx, x, y, 240, 70, { material: "paper", raised: true });
  r.ctx.strokeStyle = "#86503b"; r.ctx.lineWidth = 2; r.ctx.beginPath(); r.ctx.arc(x + 33, y + 34, 22, 0, Math.PI * 2); r.ctx.stroke();
  r.text("装配", x + 33, y + 34, 13, "#81432e", "center", "900");
  r.fitText(receipt.name, x + 68, y + 28, 17, 158, RADIO.ink, "left", "900", 12);
  r.text("改件已生效", x + 68, y + 49, 11, "#665033", "left", "700");
  r.ctx.restore();
}

module.exports = { drawUpgradeDraft, drawCard, drawUpgradeReceipt };
