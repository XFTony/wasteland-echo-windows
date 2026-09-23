"use strict";

const { drawSurvivorActor } = require("../pixel-actors");
const { equippedDefinitionMap } = require("../../core/equipment");
const { UI_COLORS } = require("./theme");
const {
  drawEchoMark,
  drawOverhangArt,
  focusBrackets,
  screenFrame,
  sectionPlate,
  sectionTitle,
  statBlock
} = require("./art-primitives");

const SELECTOR_META = Object.freeze({
  stage: { label: "行动章节", prev: "stagePrev", next: "stageNext", accent: "#c69a4a" },
  mode: { label: "作战规则", prev: "modePrev", next: "modeNext", accent: "#789892" },
  map: { label: "战区地图", prev: "mapPrev", next: "mapNext", accent: "#87916a" }
});

function itemFor(renderer, model, type) {
  if (type === "stage") return renderer.content.get("stages", model.selectedStage, renderer.content.defaults.stage);
  if (type === "mode") return renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  return renderer.content.get("maps", model.selectedMap, renderer.content.defaults.map);
}

function selectorDescription(item, type) {
  if (type === "map") return `${item.description} · ${item.worldSize}×${item.worldSize}`;
  return item.description;
}

function drawSelector(renderer, model, type, x, y, w, h, compact) {
  const meta = SELECTOR_META[type];
  const item = itemFor(renderer, model, type);
  sectionPlate(renderer, x, y, w, h, {
    material: type === "stage" ? "leather" : "iron",
    fill: type === "stage" ? "#4d3526" : "#292720",
    stroke: meta.accent,
    accent: meta.accent,
    raised: type === "stage"
  });
  sectionTitle(renderer, meta.label, type === "stage" ? "A-01" : type === "mode" ? "RULE" : "MAP", x + (compact ? 14 : 19), y + (compact ? 17 : 22), w - (compact ? 28 : 38), {
    accent: meta.accent,
    size: compact ? 11 : 14,
    role: "ui"
  });
  renderer.fitText(
    item.name || item.objective,
    x + w / 2,
    y + h * (compact ? 0.52 : 0.51),
    compact ? 17 : type === "stage" ? 28 : 23,
    w - (compact ? 94 : 132),
    UI_COLORS.white,
    "center",
    "900",
    compact ? 12 : 16,
    "display"
  );
  renderer.fitText(
    selectorDescription(item, type),
    x + w / 2,
    y + h * (compact ? 0.78 : 0.76),
    compact ? 11 : 13,
    w - (compact ? 92 : 126),
    UI_COLORS.muted,
    "center",
    "700",
    11
  );
  const arrow = compact ? Math.min(36, h * 0.4) : Math.min(46, h * 0.38);
  const arrowY = y + h / 2 - arrow / 2 + (compact ? 6 : 8);
  renderer.button(meta.prev, "‹", x + (compact ? 9 : 13), arrowY, arrow, arrow, "secondary");
  renderer.button(meta.next, "›", x + w - arrow - (compact ? 9 : 13), arrowY, arrow, arrow, "secondary");
}

function pixelWheel(ctx, x, y, size, accent) {
  ctx.fillStyle = "#0b1013";
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.fillStyle = "#222c31";
  ctx.fillRect(x - size * 0.38, y - size * 0.38, size * 0.76, size * 0.76);
  ctx.fillStyle = accent;
  ctx.fillRect(x - size * 0.16, y - size * 0.16, size * 0.32, size * 0.32);
  ctx.fillStyle = "#0b1013";
  ctx.fillRect(x - size * 0.07, y - size * 0.07, size * 0.14, size * 0.14);
}

function drawArmoredTransport(renderer, model, x, y, w, h, compact) {
  const ctx = renderer.ctx;
  const hero = renderer.content.get("heroes", model.selectedHero, renderer.content.defaults.hero);
  const skin = renderer.content.get("skins", model.selectedSkin, renderer.content.defaults.skin);
  const weapon = renderer.content.get("weapons", model.selectedWeapon, renderer.content.defaults.weapon);
  const equipment = equippedDefinitionMap(model.save, renderer.content);
  const scale = Math.max(0.55, Math.min(compact ? 1.05 : 1.7, Math.min(w / 310, h / 235)));
  const centerX = x + w / 2;
  const groundY = y + h * (compact ? 0.66 : 0.68);
  const truckW = 246 * scale;
  const truckH = 80 * scale;
  const truckX = centerX - truckW / 2;
  const truckY = groundY - truckH;

  ctx.fillStyle = "#211e19";
  ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
  ctx.fillStyle = "#383126";
  ctx.fillRect(x + 12, y + 12, w - 24, Math.max(3, h * 0.06));
  ctx.fillStyle = "#51412f";
  for (let stripe = 0; stripe < 4; stripe += 1) {
    ctx.fillRect(x + 18 + stripe * (w - 36) / 4, y + 15, Math.max(2, w * 0.012), Math.max(2, h * 0.045));
  }
  renderer.text("车库 07 / 出车位", x + 19, y + (compact ? 19 : 23), compact ? 10 : 12, UI_COLORS.muted, "left", "800", "mono");
  ctx.strokeStyle = "#494137";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.08, groundY + 20 * scale);
  ctx.lineTo(x + w * 0.38, y + h * 0.28);
  ctx.moveTo(x + w * 0.92, groundY + 20 * scale);
  ctx.lineTo(x + w * 0.67, y + h * 0.28);
  ctx.stroke();
  ctx.fillStyle = "#2e3432";
  ctx.fillRect(x + 12, groundY + 17 * scale, w - 24, Math.max(2, 4 * scale));
  ctx.fillStyle = "#58483a";
  ctx.fillRect(x + 25, groundY + 22 * scale, w - 50, Math.max(1, 2 * scale));

  // Drawing the survivor behind the armor makes the pose read as riding in the
  // transport bay rather than standing beside a pasted-on vehicle.
  drawSurvivorActor(ctx, {
    x: truckX + truckW * 0.42,
    y: truckY + 18 * scale,
    unit: Math.max(0.72, 1.15 * scale),
    skin,
    skinId: model.selectedSkin,
    heroId: model.selectedHero,
    weapon,
    aimX: 0.96,
    aimY: -0.28,
    elapsed: renderer.frame / 60,
    moving: false,
    portrait: true,
    equipment
  });

  ctx.fillStyle = "#171e21";
  ctx.fillRect(truckX - 5 * scale, truckY + 27 * scale, truckW + 10 * scale, 56 * scale);
  ctx.fillStyle = "#49524e";
  ctx.fillRect(truckX, truckY + 25 * scale, 148 * scale, 47 * scale);
  ctx.fillStyle = "#59615a";
  ctx.fillRect(truckX + 145 * scale, truckY + 18 * scale, 63 * scale, 54 * scale);
  ctx.fillRect(truckX + 201 * scale, truckY + 33 * scale, 40 * scale, 39 * scale);
  ctx.fillStyle = "#273238";
  ctx.fillRect(truckX + 160 * scale, truckY + 25 * scale, 37 * scale, 23 * scale);
  ctx.fillStyle = "#668b87";
  ctx.fillRect(truckX + 164 * scale, truckY + 28 * scale, 29 * scale, 16 * scale);
  ctx.fillStyle = "#354442";
  ctx.fillRect(truckX + 166 * scale, truckY + 30 * scale, 25 * scale, 12 * scale);
  ctx.fillStyle = "#303936";
  ctx.fillRect(truckX + 9 * scale, truckY + 31 * scale, 126 * scale, 8 * scale);
  ctx.fillStyle = "#c36c3f";
  ctx.fillRect(truckX + 14 * scale, truckY + 46 * scale, 114 * scale, 6 * scale);
  ctx.fillStyle = "#8b633e";
  ctx.fillRect(truckX + 33 * scale, truckY + 54 * scale, 36 * scale, 14 * scale);
  ctx.fillStyle = "#29312f";
  ctx.fillRect(truckX + 82 * scale, truckY + 52 * scale, 48 * scale, 18 * scale);
  ctx.fillStyle = "#6a7470";
  ctx.fillRect(truckX + 152 * scale, truckY + 52 * scale, 55 * scale, 15 * scale);
  ctx.fillStyle = "#f0b94f";
  ctx.fillRect(truckX + 210 * scale, truckY + 48 * scale, 20 * scale, 7 * scale);
  ctx.fillStyle = "#171e21";
  ctx.fillRect(truckX + 237 * scale, truckY + 53 * scale, 10 * scale, 11 * scale);

  ctx.fillStyle = "#242c2d";
  ctx.fillRect(truckX + 12 * scale, truckY + 17 * scale, 112 * scale, 5 * scale);
  ctx.fillRect(truckX + 19 * scale, truckY + 10 * scale, 5 * scale, 15 * scale);
  ctx.fillRect(truckX + 112 * scale, truckY + 10 * scale, 5 * scale, 15 * scale);
  ctx.fillStyle = "#74523a";
  ctx.fillRect(truckX + 31 * scale, truckY + 7 * scale, 34 * scale, 10 * scale);
  ctx.fillStyle = "#4f6d6e";
  ctx.fillRect(truckX + 72 * scale, truckY + 5 * scale, 28 * scale, 12 * scale);
  ctx.strokeStyle = UI_COLORS.cyan;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  ctx.moveTo(truckX + 184 * scale, truckY + 17 * scale);
  ctx.lineTo(truckX + 178 * scale, truckY - 18 * scale);
  ctx.stroke();
  ctx.fillStyle = renderer.frame % 80 < 40 ? UI_COLORS.cyan : "#355b5e";
  ctx.fillRect(truckX + 174 * scale, truckY - 22 * scale, 8 * scale, 7 * scale);

  pixelWheel(ctx, truckX + 47 * scale, groundY + 2 * scale, 43 * scale, "#a66a3f");
  pixelWheel(ctx, truckX + 195 * scale, groundY + 2 * scale, 43 * scale, "#a66a3f");

  const tagY = y + h - (compact ? 72 : 104);
  renderer.fitText(hero.name, x + 12, tagY, compact ? 10 : 14, w - 24, UI_COLORS.white, "left", "900", 8);
  renderer.fitText(`${weapon.name} · ${skin.name}`, x + 12, tagY + (compact ? 15 : 21), compact ? 8 : 11, w - 24, UI_COLORS.muted, "left", "800", 7);
}

function drawCrewPanel(renderer, model, x, y, w, h, compact) {
  const pointer = renderer.pointerState || { x: -1, y: -1, down: false };
  const hovered = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const focused = renderer.focusAction === "inventory";
  const active = hovered || focused;
  sectionPlate(renderer, x, y, w, h, {
    material: "wood",
    fill: active ? "#43362a" : "#302820",
    stroke: active ? UI_COLORS.amber : "#71634e",
    accent: UI_COLORS.amber,
    raised: active || focused,
    lineWidth: active || focused ? 3 : 2
  });
  sectionTitle(renderer, "车组整备", "CREW 07", x + 15, y + (compact ? 18 : 23), w - 30, {
    accent: UI_COLORS.amber,
    size: compact ? 12 : 16,
    role: "display"
  });
  renderer.text("点击幸存者，检查人物、枪械与四部位护具", x + 15, y + (compact ? 42 : 52), compact ? 11 : 13, UI_COLORS.paper, "left", "700");
  drawArmoredTransport(renderer, model, x + 4, y + (compact ? 50 : 62), w - 8, h - (compact ? 54 : 66), compact);
  const calloutW = Math.min(w - 28, compact ? 178 : 240);
  const calloutH = compact ? 30 : 40;
  const calloutX = x + w - calloutW - 12;
  const calloutY = y + h - calloutH - (compact ? 9 : 14);
  renderer.ctx.fillStyle = active ? "#ad573d" : "#874331";
  renderer.ctx.fillRect(calloutX, calloutY, calloutW, calloutH);
  renderer.ctx.strokeStyle = active ? UI_COLORS.paper : UI_COLORS.gold;
  renderer.ctx.lineWidth = 2;
  renderer.ctx.strokeRect(calloutX, calloutY, calloutW, calloutH);
  renderer.text("打开行装与背包  ›", calloutX + calloutW / 2, calloutY + calloutH / 2, compact ? 12 : 14, UI_COLORS.white, "center", "900");
  if (focused) {
    focusBrackets(renderer, x - 4, y - 4, w + 8, h + 8, UI_COLORS.gold, 3, 18);
  }
  renderer.addRegion("inventory", x, y, w, h);
}

function drawMissionReadout(renderer, model, x, y, w, h, compact) {
  const stage = renderer.content.get("stages", model.selectedStage, renderer.content.defaults.stage);
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const map = renderer.content.get("maps", model.selectedMap, renderer.content.defaults.map);
  const duration = mode.rule === "endless" ? "无限" : `${Math.round(stage.duration / 60)} 分钟`;
  const threat = Math.round((Number(stage.difficulty) || 1) * (Number(map.threat) || 1) * 100);
  const gap = compact ? 5 : 9;
  const cellW = (w - gap * 2) / 3;
  statBlock(renderer, "行动时限", duration, x, y, cellW, h, { accent: UI_COLORS.gold, valueColor: UI_COLORS.white });
  statBlock(renderer, "战区威胁", `${threat}%`, x + cellW + gap, y, cellW, h, {
    accent: threat >= 150 ? UI_COLORS.danger : UI_COLORS.orange,
    valueColor: threat >= 150 ? "#ef8b6f" : UI_COLORS.white
  });
  statBlock(renderer, "行动目标", mode.objective, x + (cellW + gap) * 2, y, cellW, h, { accent: UI_COLORS.cyan, valueColor: UI_COLORS.paper });
}

function drawDeploymentPage(renderer, model) {
  const compact = renderer.height < 620 || renderer.width < 1000;
  const panelW = Math.min(1500, renderer.width - (compact ? 14 : 54));
  const panelH = Math.min(830, renderer.height - (compact ? 14 : 46));
  const x = (renderer.width - panelW) / 2;
  const y = (renderer.height - panelH) / 2;
  screenFrame(renderer, x, y, panelW, panelH, { material: "wood", fill: "#1b1813", stroke: "#8b6844", accent: UI_COLORS.orange });
  if (!compact) {
    const largeArt = renderer.width >= 1500 && panelH >= 760;
    const artW = largeArt ? 350 : 250;
    drawOverhangArt(renderer, "mutant", x + panelW - artW, y - (largeArt ? 50 : 20), artW, artW * 0.914, { alpha: 0.96 });
  }

  const headerH = compact ? 54 : 82;
  drawEchoMark(renderer, x + (compact ? 18 : 28), y + (compact ? 13 : 18), UI_COLORS.orange, compact ? 0.7 : 0.95);
  renderer.displayText("作战部署", x + (compact ? 58 : 82), y + headerH / 2 + 2, compact ? 27 : 42, UI_COLORS.white);
  if (!compact || panelW > 760) renderer.text("编排行动残卷，确认车组与战区", x + (compact ? 236 : 330), y + headerH / 2 + 4, compact ? 11 : 14, UI_COLORS.muted, "left", "700");
  const backX = compact ? x + panelW - 108 : x + panelW - 470;
  renderer.button("back", "返回营地", backX, y + (compact ? 10 : 21), compact ? 94 : 122, compact ? 34 : 42, "secondary");

  const bodyY = y + headerH;
  const bodyH = panelH - headerH - (compact ? 9 : 20);
  const gap = compact ? 9 : 18;
  const leftX = x + (compact ? 10 : 20);
  const leftW = compact ? Math.max(220, panelW * 0.39) : Math.min(630, panelW * 0.43);
  drawCrewPanel(renderer, model, leftX, bodyY, leftW, bodyH, compact);

  const configX = leftX + leftW + gap;
  const configW = x + panelW - configX - (compact ? 10 : 20);
  const selectorGap = compact ? 7 : 13;
  const stageH = compact ? Math.max(86, bodyH * 0.23) : Math.min(148, bodyH * 0.23);
  drawSelector(renderer, model, "stage", configX, bodyY, configW, stageH, compact);
  const choicesY = bodyY + stageH + selectorGap;
  const choicesH = compact ? Math.max(96, bodyH * 0.27) : Math.min(172, bodyH * 0.28);
  const halfW = (configW - selectorGap) / 2;
  drawSelector(renderer, model, "mode", configX, choicesY, halfW, choicesH, compact);
  drawSelector(renderer, model, "map", configX + halfW + selectorGap, choicesY, halfW, choicesH, compact);

  const remainingTop = choicesY + choicesH + selectorGap;
  const deployH = compact ? 46 : 64;
  const readoutH = Math.max(compact ? 58 : 82, Math.min(compact ? 74 : 112, bodyY + bodyH - remainingTop - deployH - selectorGap));
  drawMissionReadout(renderer, model, configX, remainingTop, configW, readoutH, compact);
  const deployY = remainingTop + readoutH + selectorGap;
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const deployLabel = mode.rule === "endless" ? "进入无尽尸潮" : mode.rule === "extract" ? "确认出征 · 撤离行动" : "确认出征 · 坚守行动";
  renderer.button("deploy", deployLabel, configX, deployY, configW, deployH, "primary");

  const hintY = deployY + deployH + (compact ? 8 : 14);
  if (hintY < bodyY + bodyH - 4) {
    const hint = renderer.gamepadConnected ? "十字键导航 · A 确认 · B 返回" : "方向键导航 · Enter 确认 · Esc 返回";
    renderer.fitText(hint, configX + configW, hintY, compact ? 11 : 12, configW, UI_COLORS.muted, "right", "700", 10);
  }

  if (!compact) {
    renderer.ctx.fillStyle = "#6f4a31";
    renderer.ctx.fillRect(x + panelW - 96, y + 8, 72, 5);
    if (renderer.width >= 1500) {
      drawOverhangArt(renderer, "mutant", x + panelW - 108, y + panelH - 142, 150, 126, {
        alpha: 0.96,
        source: { x: 425, y: 475, w: 343, h: 227 }
      });
    }
  }
}

module.exports = { SELECTOR_META, drawSelector, drawDeploymentPage };
