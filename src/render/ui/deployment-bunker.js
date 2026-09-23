"use strict";

const { INPUT_DEVICES } = require("../../core/contracts");
const { equippedDefinitionMap } = require("../../core/equipment");
const { ART_IDS } = require("../art/asset-catalog");
const { drawSurvivorActor } = require("../pixel-actors");
const { focusBrackets } = require("./art-primitives");
const { drawAssetContain } = require("./image-primitives");
const { drawFieldButton, drawFieldPlate, drawTextScrim, inside } = require("./field-surfaces");
const { UI_COLORS } = require("./theme");

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
  return type === "map" ? `${item.description} · ${item.worldSize}×${item.worldSize}` : item.description;
}

function drawSelectorArrow(renderer, action, direction, x, y, size, accent) {
  const pointer = renderer.pointerState;
  const active = inside(pointer, x, y, size, size) || renderer.focusAction === action;
  const pressed = inside(pointer, x, y, size, size) && pointer && pointer.down;
  const offset = pressed ? 2 : active ? -1 : 0;
  const ctx = renderer.ctx;
  ctx.fillStyle = active ? accent : "#25251f";
  ctx.fillRect(x, y + offset, size, size);
  ctx.strokeStyle = active ? UI_COLORS.paper : "#7a705c";
  ctx.lineWidth = renderer.focusAction === action ? 3 : 2;
  ctx.strokeRect(x, y + offset, size, size);
  renderer.text(direction < 0 ? "‹" : "›", x + size / 2, y + offset + size / 2 - 1, Math.max(18, size * 0.62), UI_COLORS.white, "center", "900", "display");
  if (renderer.focusAction === action) focusBrackets(renderer, x - 3, y + offset - 3, size + 6, size + 6, accent, 2, 8);
  renderer.addRegion(action, x, y, size, size);
}

function drawSelector(renderer, model, type, x, y, w, h, compact) {
  const meta = SELECTOR_META[type];
  const item = itemFor(renderer, model, type);
  const active = inside(renderer.pointerState, x, y, w, h)
    || renderer.focusAction === meta.prev
    || renderer.focusAction === meta.next;
  drawFieldPlate(renderer, x, y, w, h, { accent: meta.accent, active });
  const pad = compact ? 12 : 22;
  const arrow = Math.max(compact ? 27 : 38, Math.min(compact ? 34 : 48, h * 0.34));
  const arrowY = y + (h - arrow) / 2 + (compact ? 3 : 7);
  drawSelectorArrow(renderer, meta.prev, -1, x + pad, arrowY, arrow, meta.accent);
  drawSelectorArrow(renderer, meta.next, 1, x + w - pad - arrow, arrowY, arrow, meta.accent);
  renderer.text(meta.label, x + pad, y + (compact ? 13 : 22), compact ? 11 : 13, meta.accent, "left", "900", "ui");
  renderer.text(meta.code, x + w - pad, y + (compact ? 13 : 22), compact ? 10 : 11, UI_COLORS.mutedDark, "right", "900", "mono");
  renderer.fitText(item.name || item.objective, x + w / 2, y + h * (compact ? 0.48 : 0.46), compact ? 16 : 24, w - (pad + arrow) * 2 - 20, UI_COLORS.white, "center", "900", 12, "display");
  if (h >= (compact ? 51 : 86)) {
    renderer.fitText(selectorDescription(item, type), x + w / 2, y + h * 0.72, compact ? 10 : 13, w - (pad + arrow) * 2 - 12, UI_COLORS.paper, "center", "700", 10);
  }
}

function drawFallbackCrew(renderer, model, x, y, w, h) {
  const skin = renderer.content.get("skins", model.selectedSkin, renderer.content.defaults.skin);
  const weapon = renderer.content.get("weapons", model.selectedWeapon, renderer.content.defaults.weapon);
  drawSurvivorActor(renderer.ctx, {
    x: x + w * 0.5,
    y: y + h * 0.68,
    unit: Math.max(1.4, Math.min(4.3, h / 80)),
    skin,
    skinId: model.selectedSkin,
    heroId: model.selectedHero,
    weapon,
    aimX: 0.92,
    aimY: -0.22,
    elapsed: renderer.frame / 60,
    portrait: true,
    equipment: equippedDefinitionMap(model.save, renderer.content)
  });
}

function drawCrew(renderer, model, x, y, w, h, compact) {
  renderer.text("当前车组", x + 2, y + (compact ? 12 : 20), compact ? 11 : 14, UI_COLORS.orange, "left", "900", "ui");
  renderer.trackedText("CREW 07 / READY", x + (compact ? 74 : 104), y + (compact ? 12 : 20), compact ? 9 : 11, UI_COLORS.gold, compact ? 0.5 : 1.2);
  const captionH = compact ? 52 : 98;
  const artY = y + (compact ? 24 : 38);
  const artH = Math.max(80, h - captionH - (compact ? 31 : 54));
  const art = drawAssetContain(renderer, ART_IDS.DEPLOYMENT_CONVOY, x, artY, w, artH, { padding: 2, alignY: 0.62 });
  if (!art) drawFallbackCrew(renderer, model, x, artY, w, artH);

  const hero = renderer.content.get("heroes", model.selectedHero, renderer.content.defaults.hero);
  const weapon = renderer.content.get("weapons", model.selectedWeapon, renderer.content.defaults.weapon);
  const skin = renderer.content.get("skins", model.selectedSkin, renderer.content.defaults.skin);
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
  const threat = Math.round((Number(stage.difficulty) || 1) * (Number(map.threat) || 1) * 100);
  const stats = [
    ["时限", duration, UI_COLORS.white],
    ["威胁", `${threat}%`, threat >= 150 ? UI_COLORS.danger : UI_COLORS.orange],
    ["目标", mode.objective, UI_COLORS.cyan]
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
  renderer.trackedText("FIELD COMMAND / ROUTE 07", marginX + (compact ? 15 : 26), marginY + headerH * 0.78, compact ? 8 : 11, UI_COLORS.gold, compact ? 0.4 : 1.1);
  drawFieldButton(renderer, "back", "返回营地", renderer.width - marginX - (compact ? 94 : 142), marginY + (compact ? 3 : 9), compact ? 94 : 142, compact ? 31 : 48, { accent: UI_COLORS.gold });

  const bodyY = marginY + headerH + (compact ? 4 : 12);
  const bodyH = renderer.height - bodyY - marginY;
  const availableW = renderer.width - marginX * 2;
  const leftW = availableW * (compact ? 0.4 : 0.42);
  const rightX = marginX + leftW + gap;
  const rightW = renderer.width - marginX - rightX;
  drawCrew(renderer, model, marginX, bodyY, leftW, bodyH, compact);

  const contentH = Math.min(bodyH, compact ? bodyH : 720);
  const contentY = bodyY + Math.max(0, (bodyH - contentH) * 0.46);
  const contentGap = compact ? 3 : 10;
  const readoutH = compact ? 34 : 76;
  const actionH = compact ? 42 : 68;
  const hintH = compact ? 14 : 25;
  const selectorH = (contentH - readoutH - actionH - hintH - contentGap * 5) / 3;
  drawSelector(renderer, model, "stage", rightX, contentY, rightW, selectorH, compact);
  drawSelector(renderer, model, "mode", rightX, contentY + selectorH + contentGap, rightW, selectorH, compact);
  drawSelector(renderer, model, "map", rightX, contentY + (selectorH + contentGap) * 2, rightW, selectorH, compact);

  const readoutY = contentY + (selectorH + contentGap) * 3;
  drawReadout(renderer, model, rightX, readoutY, rightW, readoutH, compact);
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const label = mode.rule === "endless" ? "进入无尽尸潮" : mode.rule === "extract" ? "确认出征 · 撤离行动" : "确认出征 · 坚守行动";
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
