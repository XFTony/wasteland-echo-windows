"use strict";

const { INPUT_DEVICES } = require("../../core/contracts");
const { focusBrackets } = require("./art-primitives");
const { drawFieldButton, drawFieldPlate, drawTextScrim, inside } = require("./field-surfaces");
const { UI_COLORS } = require("./theme");
const { drawIllustratedPortrait } = require("../illustrated-actors");
const { paperClip } = require("./radio-materials");

const SELECTOR_META = Object.freeze({
  stage: Object.freeze({ label: "行动章节", code: "CHAPTER", prev: "stagePrev", next: "stageNext", accent: "#bd684c" }),
  mode: Object.freeze({ label: "作战规则", code: "RULE", prev: "modePrev", next: "modeNext", accent: "#78a79d" }),
  map: Object.freeze({ label: "战区地图", code: "MAP", prev: "mapPrev", next: "mapNext", accent: "#a0a671" })
});

function itemFor(renderer, model, type) {
  if (type === "stage") return renderer.content.get("stages", model.selectedStage, renderer.content.defaults.stage);
  if (type === "mode") return renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  return renderer.content.get("maps", model.selectedMap, renderer.content.defaults.map);
}

function selectorDescription(item, type) {
  return item.description;
}

function drawSelectorArrow(renderer, action, direction, x, y, size, accent) {
  const pointer = renderer.pointerState;
  drawFieldButton(renderer, action, direction < 0 ? "‹" : "›", x, y, size, size, { accent, size: Math.max(18, size * 0.62) });
}

function drawSelector(renderer, model, type, x, y, w, h, compact) {
  const meta = SELECTOR_META[type];
  const item = itemFor(renderer, model, type);
  const active = inside(renderer.pointerState, x, y, w, h)
    || renderer.focusAction === meta.prev
    || renderer.focusAction === meta.next;
  renderer.ctx.fillStyle = "rgba(211,190,149,0.24)";
  renderer.ctx.fillRect(x + 14, y + h - 1, w - 28, 1);
  const pad = compact ? 12 : 22;
  const arrow = Math.max(compact ? 27 : 38, Math.min(compact ? 34 : 48, h * 0.34));
  const arrowY = y + (h - arrow) / 2 + (compact ? 3 : 7);
  drawSelectorArrow(renderer, meta.prev, -1, x + pad, arrowY, arrow, meta.accent);
  drawSelectorArrow(renderer, meta.next, 1, x + w - pad - arrow, arrowY, arrow, meta.accent);
  renderer.text(meta.label, x + pad, y + (compact ? 13 : 22), compact ? 11 : 13, meta.accent, "left", "900", "ui");
  renderer.fitText(item.name || item.objective, x + w / 2, y + h * (compact ? 0.48 : 0.46), compact ? 16 : 24, w - (pad + arrow) * 2 - 20, UI_COLORS.white, "center", "900", 12, "display");
  if (h >= (compact ? 51 : 86)) {
    renderer.fitText(selectorDescription(item, type), x + w / 2, y + h * 0.72, compact ? 10 : 13, w - (pad + arrow) * 2 - 12, UI_COLORS.paper, "center", "700", 10);
  }
}

function drawCrew(renderer, model, x, y, w, h, compact) {
  renderer.text("出征行装", x + 18, y + (compact ? 12 : 20), compact ? 12 : 16, UI_COLORS.paper, "left", "800");
  const captionH = compact ? 52 : 98;

  const hero = renderer.content.get("heroes", model.selectedHero, renderer.content.defaults.hero);
  const weapon = renderer.content.get("weapons", model.selectedWeapon, renderer.content.defaults.weapon);
  const skin = renderer.content.get("skins", model.selectedSkin, renderer.content.defaults.skin);
  const portraitY = y + (compact ? 30 : 48), portraitH = Math.max(52, h - captionH - (compact ? 37 : 65));
  paperClip(renderer.ctx, x + w * 0.45, portraitY + 7);
  const compactBody = renderer.compactActors && renderer.compactActors.drawPortrait(renderer, model, x + 12, portraitY, w - 24, portraitH);
  if (!compactBody) drawIllustratedPortrait(renderer, model.selectedHero, model.selectedSkin, x + 12, portraitY, w - 24, portraitH);
  const captionY = y + h - captionH;
  const focused = renderer.focusAction === "inventory";
  const active = focused || inside(renderer.pointerState, x, captionY, w, captionH);
  drawFieldPlate(renderer, x, captionY, w, captionH, { accent: UI_COLORS.orange, active });
  renderer.text("行装档案", x + (compact ? 12 : 22), captionY + (compact ? 13 : 23), compact ? 10 : 12, UI_COLORS.orange, "left", "900", "mono");
  renderer.fitText(hero.name, x + (compact ? 12 : 22), captionY + (compact ? 31 : 50), compact ? 14 : 21, w * 0.48, UI_COLORS.white, "left", "900", 11, "display");
  renderer.fitText(`${weapon.name} · ${skin.name}`, x + w - (compact ? 12 : 22), captionY + (compact ? 19 : 37), compact ? 10 : 13, w * 0.48, UI_COLORS.paper, "right", "800", 10);
  renderer.text("打开行装与背包  ›", x + w - (compact ? 12 : 22), captionY + captionH - (compact ? 10 : 22), compact ? 10 : 13, active ? UI_COLORS.gold : UI_COLORS.muted, "right", "900", "ui");
  if (focused) focusBrackets(renderer, x - 3, captionY - 3, w + 6, captionH + 6, UI_COLORS.gold, 2, 14);
  renderer.addRegion("inventory", x, captionY, w, captionH);
}

function drawReadout(renderer, model, x, y, w, h, compact) {
  const stage = renderer.content.get("stages", model.selectedStage, renderer.content.defaults.stage);
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const map = renderer.content.get("maps", model.selectedMap, renderer.content.defaults.map);
  const duration = mode.rule === "endless" ? "无限" : `${Math.round(stage.duration / 60)} 分钟`;
  const threat = Math.round((Number(map.threat) || 1) * 100);
  const stats = [
    ["生存", "持续计时", UI_COLORS.white],
    ["威胁", `${threat}%`, threat >= 150 ? UI_COLORS.danger : UI_COLORS.orange],
    ["补给", "地图交易站", UI_COLORS.cyan]
  ];
  drawTextScrim(renderer, x, y, w, h, { fill: "rgba(16,15,12,0.92)", accent: UI_COLORS.gold });
  const cellW = w / 3;
  for (let index = 0; index < stats.length; index += 1) {
    const [label, value, color] = stats[index];
    const cellX = x + index * cellW;
    if (index) {
      renderer.ctx.fillStyle = "#665a45";
      renderer.ctx.fillRect(cellX, y + h * 0.2, 1, h * 0.6);
    }
    renderer.text(label, cellX + (compact ? 9 : 15), y + h * 0.32, compact ? 10 : 12, UI_COLORS.muted, "left", "900", "ui");
    renderer.fitText(value, cellX + (compact ? 9 : 15), y + h * 0.68, compact ? 13 : 18, cellW - (compact ? 18 : 30), color, "left", "900", 11, "display");
  }
}

function drawDeploymentBunkerPage(renderer, model) {
  const compact = renderer.height < 620 || renderer.width < 1000;
  const marginX = compact ? 8 : Math.max(28, renderer.width * 0.035);
  const marginY = compact ? 7 : Math.max(22, renderer.height * 0.03);
  const headerH = compact ? 38 : 78;
  const gap = compact ? 8 : Math.max(18, renderer.width * 0.016);

  drawTextScrim(renderer, marginX, marginY, Math.min(compact ? 275 : 520, renderer.width * 0.48), headerH, {
    fill: "rgba(14,13,10,0.9)",
    accent: UI_COLORS.orange
  });
  renderer.displayText("作战部署", marginX + (compact ? 14 : 24), marginY + headerH * 0.42, compact ? 25 : 43, UI_COLORS.white);
  renderer.text("把行装准备好，再走进荒原。", marginX + (compact ? 15 : 26), marginY + headerH * 0.8, compact ? 10 : 12, UI_COLORS.muted, "left", "600");
  drawFieldButton(renderer, "back", "返回营地", renderer.width - marginX - (compact ? 94 : 142), marginY + (compact ? 3 : 9), compact ? 94 : 142, compact ? 31 : 48, { accent: UI_COLORS.gold });

  const bodyY = marginY + headerH + (compact ? 4 : 12);
  const bodyH = renderer.height - bodyY - marginY;
  const availableW = renderer.width - marginX * 2;
  const leftW = availableW * (compact ? 0.38 : 0.36);
  const rightX = marginX + leftW + gap;
  const rightW = renderer.width - marginX - rightX;
  drawTextScrim(renderer, marginX, bodyY, leftW, bodyH, { fill: "rgba(27,29,22,0.88)" });
  drawTextScrim(renderer, rightX, bodyY, rightW, bodyH, { fill: "rgba(27,29,22,0.92)" });
  drawCrew(renderer, model, marginX, bodyY, leftW, bodyH, compact);

  const contentH = Math.min(bodyH, compact ? bodyH : 720);
  const contentY = bodyY + Math.max(0, (bodyH - contentH) * 0.46);
  const contentGap = compact ? 3 : 10;
  const readoutH = compact ? 34 : 76;
  const actionH = compact ? 42 : 68;
  const hintH = compact ? 14 : 25;
  const selectorArea = contentH - readoutH - actionH - hintH - contentGap * 5;
  const selectorH = selectorArea * .44;
  drawSelector(renderer, model, "map", rightX, contentY, rightW, selectorH, compact);
  const textX = rightX + (compact ? 18 : 30), detailY = contentY + selectorH + contentGap;
  renderer.displayText("连续生存", textX, detailY + 18, compact ? 19 : 27, UI_COLORS.gold);
  const details = renderer.height < 430 ? ["移动生存 · 拾取经验与金币", "回交易站购枪、改装与部署塔台"] : ["移动躲避 · 自动瞄准射击", "捡拾经验与金币 · 升级技能", "返回交易站购枪改装 · 部署塔台", "威胁随时间增强 · 暂停可结算本局"];
  details.forEach((line, index) => renderer.fitText(line, textX, detailY + (compact ? 46 : 60) + index * (compact ? 20 : 28), compact ? 12 : 16, rightW - 45, UI_COLORS.paper, "left", "700", 10));
  const readoutY = contentY + selectorArea + contentGap * 3;
  drawReadout(renderer, model, rightX, readoutY, rightW, readoutH, compact);
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const label = "进入地图 · 连续生存";
  const actionY = readoutY + readoutH + contentGap;
  drawFieldButton(renderer, "deploy", label, rightX, actionY, rightW, actionH, { accent: UI_COLORS.orange, primary: true, role: "display", size: compact ? 15 : 21 });
  const hint = renderer.gamepadConnected
    ? "十字键选择 · A 确认 · B 返回"
    : renderer.activeInputDevice === INPUT_DEVICES.KEYBOARD_MOUSE
      ? "方向键选择 · Enter 确认 · Esc 返回"
      : "Enter 确认 · Esc 返回";
  renderer.fitText(hint, rightX + rightW, actionY + actionH + contentGap + hintH / 2, compact ? 10 : 12, rightW, UI_COLORS.paper, "right", "800", 10);
}

module.exports = { SELECTOR_META, drawSelector, drawReadout, drawDeploymentBunkerPage };
