"use strict";

const { INPUT_DEVICES } = require("../../core/contracts");
const { equippedDefinitionMap } = require("../../core/equipment");
const { ART_IDS } = require("../art/asset-catalog");
const { drawSurvivorActor } = require("../pixel-actors");
const { focusBrackets, screenFrame, sectionPlate } = require("./art-primitives");
const { drawAssetContain, drawNineSlice } = require("./image-primitives");
const { UI_COLORS } = require("./theme");

const JOURNAL_INK = Object.freeze({
  primary: "#2b2118",
  secondary: "#4c3827",
  faint: "#745d42",
  rust: "#873b2b",
  signal: "#315d58",
  danger: "#9c352a",
  light: "#f4e6bd"
});

const SELECTOR_META = Object.freeze({
  stage: Object.freeze({ label: "行动章节", code: "CHAPTER", prev: "stagePrev", next: "stageNext", accent: JOURNAL_INK.rust }),
  mode: Object.freeze({ label: "作战规则", code: "RULE", prev: "modePrev", next: "modeNext", accent: JOURNAL_INK.signal }),
  map: Object.freeze({ label: "战区地图", code: "MAP", prev: "mapPrev", next: "mapNext", accent: "#5f663d" })
});

function inside(pointer, x, y, w, h) {
  return Boolean(pointer && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h);
}

function itemFor(renderer, model, type) {
  if (type === "stage") return renderer.content.get("stages", model.selectedStage, renderer.content.defaults.stage);
  if (type === "mode") return renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  return renderer.content.get("maps", model.selectedMap, renderer.content.defaults.map);
}

function selectorDescription(item, type) {
  if (type === "map") return `${item.description} · ${item.worldSize}×${item.worldSize}`;
  return item.description;
}

function drawJournalBase(renderer, x, y, w, h) {
  const imageRect = drawAssetContain(renderer, ART_IDS.DEPLOYMENT_JOURNAL, x, y, w, h, { alignX: 0.5, alignY: 0.5 });
  if (imageRect) return imageRect;
  screenFrame(renderer, x, y, w, h, { material: "leather", fill: "#2b2118", stroke: "#987247", accent: UI_COLORS.orange });
  sectionPlate(renderer, x + w * 0.055, y + h * 0.065, w * 0.42, h * 0.86, { material: "canvas", fill: "#d7c18e", stroke: "#745637" });
  sectionPlate(renderer, x + w * 0.525, y + h * 0.065, w * 0.42, h * 0.86, { material: "canvas", fill: "#d7c18e", stroke: "#745637" });
  return { x, y, w, h };
}

function drawNote(renderer, x, y, w, h, active = false) {
  const drawY = y - (active ? 2 : 0);
  if (!drawNineSlice(renderer, ART_IDS.DEPLOYMENT_NOTE, x, drawY, w, h, { alpha: active ? 1 : 0.96 })) {
    sectionPlate(renderer, x, drawY, w, h, {
      material: "canvas",
      fill: active ? "#ead8aa" : "#d8c18d",
      stroke: active ? "#8d3d2e" : "#765b3d",
      raised: active,
      lineWidth: active ? 3 : 2
    });
  }
  return drawY;
}

function drawJournalArrow(renderer, action, direction, x, y, size, accent) {
  const pointer = renderer.pointerState;
  const hovered = inside(pointer, x, y, size, size);
  const focused = renderer.focusAction === action;
  const active = hovered || focused;
  const pressed = hovered && pointer && pointer.down;
  const centerX = x + size / 2;
  const centerY = y + size / 2 + (pressed ? 2 : 0);
  const ctx = renderer.ctx;
  ctx.beginPath();
  ctx.arc(centerX + 2, centerY + 3, size * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(43,33,24,0.38)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = active ? accent : "#4b3828";
  ctx.fill();
  ctx.strokeStyle = active ? "#e0bd73" : "#8b6b45";
  ctx.lineWidth = focused ? 3 : 2;
  ctx.stroke();
  renderer.text(direction < 0 ? "‹" : "›", centerX, centerY - 1, Math.max(16, size * 0.58), JOURNAL_INK.light, "center", "900", "display");
  if (focused) focusBrackets(renderer, x - 2, y - 2, size + 4, size + 4, "#a56d35", 2, 8);
  renderer.addRegion(action, x, y, size, size);
}

function drawJournalSelector(renderer, model, type, x, y, w, h, compact) {
  const meta = SELECTOR_META[type];
  const item = itemFor(renderer, model, type);
  const pointer = renderer.pointerState;
  const active = inside(pointer, x, y, w, h) || renderer.focusAction === meta.prev || renderer.focusAction === meta.next;
  const drawY = drawNote(renderer, x, y, w, h, active);
  const edge = compact ? 9 : 15;
  const labelY = drawY + (compact ? 11 : 17);
  renderer.text(meta.label, x + edge, labelY, compact ? 10 : 12, meta.accent, "left", "900", "ui");
  renderer.text(meta.code, x + w - edge, labelY, compact ? 10 : 11, JOURNAL_INK.faint, "right", "900", "mono");
  const arrowSize = Math.max(compact ? 24 : 32, Math.min(compact ? 30 : 42, h * 0.38));
  const arrowY = drawY + h * 0.5 - arrowSize * 0.5 + (compact ? 4 : 6);
  drawJournalArrow(renderer, meta.prev, -1, x + edge, arrowY, arrowSize, meta.accent);
  drawJournalArrow(renderer, meta.next, 1, x + w - edge - arrowSize, arrowY, arrowSize, meta.accent);
  renderer.fitText(
    item.name || item.objective,
    x + w / 2,
    drawY + h * (compact ? 0.52 : 0.49),
    compact ? 14 : type === "stage" ? 24 : 20,
    w - (arrowSize + edge) * 2 - 10,
    JOURNAL_INK.primary,
    "center",
    "900",
    compact ? 11 : 15,
    "display"
  );
  if (h >= (compact ? 56 : 72)) {
    const washX = x + arrowSize + edge + 5;
    const washW = Math.max(20, w - (arrowSize + edge) * 2 - 10);
    renderer.ctx.fillStyle = "rgba(244,225,184,0.5)";
    renderer.ctx.fillRect(washX, drawY + h * 0.65, washW, Math.max(12, h * 0.18));
    renderer.ctx.fillStyle = "rgba(220,188,132,0.18)";
    renderer.ctx.fillRect(washX + 5, drawY + h * 0.65 - 2, Math.max(10, washW - 12), 2);
    renderer.fitText(
      selectorDescription(item, type),
      x + w / 2,
      drawY + h * 0.75,
      compact ? 10 : 12,
      w - (arrowSize + edge) * 2 - 6,
      JOURNAL_INK.secondary,
      "center",
      "700",
      10
    );
  }
}

function drawFallbackSurvivor(renderer, model, x, y, w, h) {
  const skin = renderer.content.get("skins", model.selectedSkin, renderer.content.defaults.skin);
  const weapon = renderer.content.get("weapons", model.selectedWeapon, renderer.content.defaults.weapon);
  drawSurvivorActor(renderer.ctx, {
    x: x + w * 0.5,
    y: y + h * 0.65,
    unit: Math.max(1.4, Math.min(3.2, h / 85)),
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

function drawCrewPage(renderer, model, page, compact) {
  const pointer = renderer.pointerState;
  const hovered = inside(pointer, page.x, page.y, page.w, page.h);
  const focused = renderer.focusAction === "inventory";
  const active = hovered || focused;
  const ctx = renderer.ctx;
  if (active) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = JOURNAL_INK.rust;
    ctx.fillRect(page.x + 6, page.y + 8, page.w - 12, page.h - 16);
    ctx.restore();
  }
  renderer.text("作战部署", page.x + (compact ? 10 : 18), page.y + (compact ? 20 : 31), compact ? 21 : 34, JOURNAL_INK.primary, "left", "900", "display");
  renderer.text("FIELD LOG / CREW 07", page.x + (compact ? 10 : 19), page.y + (compact ? 39 : 57), compact ? 10 : 12, JOURNAL_INK.rust, "left", "900", "mono");
  ctx.fillStyle = JOURNAL_INK.rust;
  ctx.fillRect(page.x + (compact ? 10 : 19), page.y + (compact ? 48 : 70), Math.min(page.w * 0.34, compact ? 76 : 120), compact ? 2 : 3);

  const artBox = {
    x: page.x + page.w * 0.035,
    y: page.y + page.h * (compact ? 0.17 : 0.15),
    w: page.w * 0.93,
    h: page.h * (compact ? 0.55 : 0.58)
  };
  const art = drawAssetContain(renderer, ART_IDS.DEPLOYMENT_CONVOY, artBox.x, artBox.y, artBox.w, artBox.h, { padding: compact ? 2 : 5, alignY: 0.58 });
  if (!art) drawFallbackSurvivor(renderer, model, artBox.x, artBox.y, artBox.w, artBox.h);

  const hero = renderer.content.get("heroes", model.selectedHero, renderer.content.defaults.hero);
  const weapon = renderer.content.get("weapons", model.selectedWeapon, renderer.content.defaults.weapon);
  const skin = renderer.content.get("skins", model.selectedSkin, renderer.content.defaults.skin);
  const captionX = page.x + (compact ? 6 : page.w * 0.07);
  const captionY = page.y + page.h * (compact ? 0.73 : 0.715);
  const captionW = page.w - (compact ? 12 : page.w * 0.14);
  const captionH = page.h * (compact ? 0.19 : 0.185);
  if (!compact) drawNote(renderer, captionX, captionY, captionW, captionH, active);
  const captionTextX = captionX + (compact ? 5 : captionW * 0.25);
  const captionTextW = compact ? captionW - 10 : captionW * 0.5;
  const detailY = captionY + captionH * (compact ? 0.22 : 0.24);
  renderer.text("当前车组", captionTextX, detailY, compact ? 10 : 12, JOURNAL_INK.rust, "left", "900", "ui");
  renderer.fitText(hero.name, captionTextX, detailY + (compact ? 15 : 22), compact ? 12 : 18, captionTextW, JOURNAL_INK.primary, "left", "900", 11, "display");
  renderer.fitText(`${weapon.name}  ·  ${skin.name}`, captionTextX, detailY + (compact ? 30 : 43), compact ? 10 : 12, captionTextW, JOURNAL_INK.secondary, "left", "700", 10);
  const calloutY = compact ? captionY + captionH - 10 : captionY + captionH + 14;
  const calloutX = compact ? captionX + captionW * 0.98 : captionX + captionW * 0.75;
  renderer.text(compact ? "打开背包  ›" : "点击整页进入行装与背包  ›", calloutX, calloutY, compact ? 11 : 13, active ? JOURNAL_INK.rust : JOURNAL_INK.primary, "right", "900", "ui");
  ctx.fillStyle = active ? JOURNAL_INK.rust : JOURNAL_INK.faint;
  ctx.fillRect(captionTextX, calloutY + (compact ? 7 : 9), captionTextW, 2);
  if (focused) focusBrackets(renderer, page.x + 3, page.y + 3, page.w - 6, page.h - 6, JOURNAL_INK.rust, 3, 18);
  renderer.addRegion("inventory", page.x, page.y, page.w, page.h);
}

function drawMissionReadout(renderer, model, x, y, w, h, compact) {
  const stage = renderer.content.get("stages", model.selectedStage, renderer.content.defaults.stage);
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const map = renderer.content.get("maps", model.selectedMap, renderer.content.defaults.map);
  const duration = mode.rule === "endless" ? "无限" : `${Math.round(stage.duration / 60)} 分钟`;
  const threat = Math.round((Number(stage.difficulty) || 1) * (Number(map.threat) || 1) * 100);
  const stats = [
    ["时限", duration, JOURNAL_INK.primary],
    ["威胁", `${threat}%`, threat >= 150 ? JOURNAL_INK.danger : JOURNAL_INK.rust],
    ["目标", mode.objective, JOURNAL_INK.signal]
  ];
  const cellW = w / 3;
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(67,48,31,0.34)";
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  for (let index = 0; index < stats.length; index += 1) {
    const [label, value, color] = stats[index];
    const cellX = x + index * cellW;
    if (index) ctx.fillRect(cellX, y + h * 0.18, 1, h * 0.64);
    renderer.text(label, cellX + (compact ? 6 : 10), y + h * 0.3, compact ? 10 : 11, JOURNAL_INK.faint, "left", "900", "ui");
    renderer.fitText(value, cellX + (compact ? 6 : 10), y + h * 0.66, compact ? 13 : 17, cellW - (compact ? 12 : 20), color, "left", "900", 11, "display");
  }
}

function drawActionStrap(renderer, label, x, y, w, h) {
  const pointer = renderer.pointerState;
  const hovered = inside(pointer, x, y, w, h);
  const focused = renderer.focusAction === "deploy";
  const pressed = hovered && pointer && pointer.down;
  const active = hovered || focused;
  const drawY = y + (pressed ? 3 : active ? -2 : 0);
  if (!drawNineSlice(renderer, ART_IDS.DEPLOYMENT_ACTION, x, drawY, w, h, { alpha: active ? 1 : 0.94 })) {
    sectionPlate(renderer, x, drawY, w, h, { material: "leather", fill: "#873727", stroke: "#ba8748", raised: active, accent: "#d0a24d" });
  }
  renderer.fitText(label, x + w / 2, drawY + h / 2 + 1, Math.max(14, h * 0.29), w * 0.68, JOURNAL_INK.light, "center", "900", 12, "display");
  if (focused) {
    renderer.ctx.fillStyle = "#d5a94f";
    renderer.ctx.fillRect(x + w * 0.31, drawY - 4, w * 0.38, 3);
    renderer.ctx.fillRect(x + w * 0.38, drawY + h + 2, w * 0.24, 3);
  }
  renderer.addRegion("deploy", x, y, w, h);
}

function drawBackTab(renderer, x, y, w, h) {
  const pointer = renderer.pointerState;
  const active = inside(pointer, x, y, w, h) || renderer.focusAction === "back";
  const drawY = y - (active ? 2 : 0);
  if (!drawNineSlice(renderer, ART_IDS.DEPLOYMENT_BACK, x, drawY, w, h, { alpha: active ? 1 : 0.94 })) {
    sectionPlate(renderer, x, drawY, w, h, { material: "leather", fill: "#4a3b24", stroke: "#aa7e3e", raised: active });
  }
  renderer.text("返回营地", x + w / 2, drawY + h / 2, Math.max(12, h * 0.3), JOURNAL_INK.light, "center", "900", "ui");
  if (renderer.focusAction === "back") {
    renderer.ctx.fillStyle = "#d0a24d";
    renderer.ctx.fillRect(x + w * 0.32, drawY + h + 1, w * 0.36, 3);
  }
  renderer.addRegion("back", x, y, w, h);
}

function drawDeploymentJournalPage(renderer, model) {
  const compact = renderer.height < 620 || renderer.width < 1000;
  const panelW = Math.min(1560, renderer.width - (compact ? 10 : 36));
  const panelH = Math.min(880, renderer.height - (compact ? 8 : 28));
  const panelX = (renderer.width - panelW) / 2;
  const panelY = (renderer.height - panelH) / 2;
  const book = drawJournalBase(renderer, panelX, panelY, panelW, panelH);

  if (!compact) {
    drawAssetContain(
      renderer,
      ART_IDS.DEPLOYMENT_EDGE_MUTANT,
      book.x + book.w * 0.865,
      book.y + book.h * 0.12,
      book.w * 0.135,
      book.h * 0.77,
      { alignX: 1, alignY: 0.46, alpha: 0.98 }
    );
  }

  const leftPage = {
    x: book.x + book.w * 0.064,
    y: book.y + book.h * 0.07,
    w: book.w * 0.405,
    h: book.h * 0.84
  };
  const rightPage = {
    x: book.x + book.w * 0.535,
    y: book.y + book.h * 0.07,
    w: book.w * 0.3,
    h: book.h * 0.84
  };

  drawCrewPage(renderer, model, leftPage, compact);
  renderer.text("行动编排", rightPage.x + (compact ? 7 : 13), rightPage.y + (compact ? 16 : 27), compact ? 17 : 27, JOURNAL_INK.primary, "left", "900", "display");
  renderer.text("ROUTE / RULE / MAP", rightPage.x + (compact ? 8 : 14), rightPage.y + (compact ? 32 : 49), compact ? 10 : 11, JOURNAL_INK.rust, "left", "900", "mono");
  const backW = Math.min(compact ? 86 : 170, rightPage.w * 0.38);
  const backH = compact ? 32 : 54;
  drawBackTab(renderer, rightPage.x + rightPage.w - backW - (compact ? 0 : 7), rightPage.y + (compact ? 2 : 5), backW, backH);

  const contentTop = rightPage.y + rightPage.h * (compact ? 0.13 : 0.115);
  const gap = compact ? Math.max(3, rightPage.h * 0.008) : Math.max(7, rightPage.h * 0.012);
  const stageH = rightPage.h * (compact ? 0.19 : 0.195);
  const selectorH = rightPage.h * (compact ? 0.165 : 0.17);
  drawJournalSelector(renderer, model, "stage", rightPage.x, contentTop, rightPage.w, stageH, compact);
  const modeY = contentTop + stageH + gap;
  drawJournalSelector(renderer, model, "mode", rightPage.x, modeY, rightPage.w, selectorH, compact);
  const mapY = modeY + selectorH + gap;
  drawJournalSelector(renderer, model, "map", rightPage.x, mapY, rightPage.w, selectorH, compact);

  const readoutY = mapY + selectorH + gap;
  const readoutH = rightPage.h * (compact ? 0.095 : 0.105);
  drawMissionReadout(renderer, model, rightPage.x + (compact ? 4 : 9), readoutY, rightPage.w - (compact ? 8 : 18), readoutH, compact);
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const deployLabel = mode.rule === "endless" ? "进入无尽尸潮" : mode.rule === "extract" ? "确认出征 · 撤离行动" : "确认出征 · 坚守行动";
  const actionY = readoutY + readoutH + gap;
  const actionH = Math.max(compact ? 30 : 48, rightPage.h * (compact ? 0.105 : 0.11));
  drawActionStrap(renderer, deployLabel, rightPage.x, actionY, rightPage.w, actionH);

  const hint = renderer.gamepadConnected
    ? "十字键选择 · A 确认 · B 返回"
    : renderer.activeInputDevice === INPUT_DEVICES.KEYBOARD_MOUSE
      ? "方向键选择 · Enter 确认 · Esc 返回"
      : "Enter 确认 · Esc 返回";
  renderer.fitText(hint, rightPage.x + rightPage.w, actionY + actionH + (compact ? 10 : 17), compact ? 10 : 12, rightPage.w, JOURNAL_INK.primary, "right", "700", 10);
}

module.exports = {
  JOURNAL_INK,
  SELECTOR_META,
  drawDeploymentJournalPage,
  drawJournalSelector,
  drawMissionReadout
};
