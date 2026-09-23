"use strict";

const { UI_COLORS } = require("./theme");
const { RANGE_BANDS, WEAPON_CLASS_LABELS, drawGrantIcon } = require("./item-icons");
const { EQUIPMENT_SLOT_LABELS, equipmentStatTokens } = require("./equipment-presentation");
const {
  drawEchoMark,
  focusBrackets,
  sectionTitle
} = require("./art-primitives");
const { drawFieldButton, drawFieldPlate, drawTextScrim } = require("./field-surfaces");

const CATEGORY_LABELS = Object.freeze({ weapon: "枪械", outfit: "服饰", equipment: "四部位护具" });

function itemTypeLine(renderer, item) {
  if (item.grantType === "weapon") {
    const weapon = renderer.content.get("weapons", item.grantId, renderer.content.defaults.weapon);
    const band = RANGE_BANDS[weapon.rangeBand] || RANGE_BANDS.mid;
    return `${band.label} · ${WEAPON_CLASS_LABELS[weapon.weaponClass] || weapon.weaponClass}`;
  }
  if (item.grantType === "skin") return "永久服饰";
  const equipment = renderer.content.get("equipment", item.grantId, renderer.content.defaults.equipment);
  return `${EQUIPMENT_SLOT_LABELS[equipment.slot] || "护具"}槽 · 永久装备`;
}

function itemStatLine(renderer, item) {
  if (item.grantType === "weapon") {
    const weapon = renderer.content.get("weapons", item.grantId, renderer.content.defaults.weapon);
    const rate = Math.min(99, 1 / weapon.interval).toFixed(weapon.interval < 0.15 ? 1 : 2);
    return `伤害 ${weapon.damage}  ·  射速 ${rate}/秒  ·  锁定 ${weapon.lockRange}`;
  }
  if (item.grantType === "equipment") {
    const equipment = renderer.content.get("equipment", item.grantId, renderer.content.defaults.equipment);
    const tokens = equipmentStatTokens(equipment);
    return tokens.length ? tokens.join("  ·  ") : equipment.description;
  }
  const skin = renderer.content.get("skins", item.grantId, renderer.content.defaults.skin);
  return skin.description;
}

function drawShopIcon(renderer, item, x, y, size, color) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(14,15,13,0.78)";
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  drawGrantIcon(renderer, item.grantType, item.grantId, x, y, size * 0.8, color);
}

function drawItemCard(renderer, model, item, x, y, w, h) {
  const state = model.getShopState(item.id);
  const unlockRule = item.unlockRuleId ? renderer.content.get("unlockRules", item.unlockRuleId) : null;
  const equipment = item.grantType === "equipment" ? renderer.content.get("equipment", item.grantId) : null;
  const equipped = Boolean(equipment && model.save.equippedEquipment[equipment.slot] === equipment.id);
  const compactCard = h < 112 || w < 190;
  const accent = state.status === "locked" || state.ruleLocked ? "#76818a"
    : state.status === "insufficient" ? UI_COLORS.danger
      : state.owned ? UI_COLORS.green : item.currency === "gold" ? UI_COLORS.gold : UI_COLORS.copper;
  const pointer = renderer.pointerState || { x: -1000, y: -1000, down: false };
  const actionPrefix = !state.owned ? `buy:${item.id}` : equipment && !equipped ? `equip:${equipment.id}` : "inventory";
  const active = renderer.focusAction === actionPrefix || (pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h);
  drawFieldPlate(renderer, x, y - (active ? 3 : 0), w, h, { accent, active, raised: active, alpha: 0.94 });
  const drawY = y - (active ? 3 : 0);

  const iconSize = compactCard ? Math.min(42, h - 28, w * 0.29) : Math.min(106, h * 0.46, w * 0.3);
  const iconX = x + (compactCard ? 8 : 16) + iconSize / 2;
  const iconY = drawY + (compactCard ? 11 : 23) + iconSize / 2;
  drawShopIcon(renderer, item, iconX, iconY, iconSize, accent);
  const textX = iconX + iconSize / 2 + (compactCard ? 7 : 13);
  const textRight = x + w - (compactCard ? 6 : 14);
  renderer.fitText(item.name, textX, drawY + (compactCard ? 17 : 34), compactCard ? 12 : 19, textRight - textX, UI_COLORS.white, "left", "900", compactCard ? 10 : 13, "display");
  const typeColor = item.grantType === "weapon"
    ? (RANGE_BANDS[renderer.content.get("weapons", item.grantId, renderer.content.defaults.weapon).rangeBand] || RANGE_BANDS.mid).color
    : accent;
  renderer.fitText(itemTypeLine(renderer, item), textX, drawY + (compactCard ? 35 : 61), compactCard ? 10 : 12, textRight - textX, typeColor, "left", "900", 10);
  if (!compactCard) {
    renderer.fitText(item.description, textX, drawY + 90, 13, textRight - textX, UI_COLORS.muted, "left", "700", 11);
    renderer.ctx.fillStyle = "#5a5142";
    renderer.ctx.fillRect(x + 16, drawY + h - 91, w - 32, 1);
    renderer.fitText(itemStatLine(renderer, item), x + 16, drawY + h - 73, 12, w - 32, UI_COLORS.paper, "left", "800", 10, "mono");
  }

  const statusText = state.ruleLocked ? (unlockRule ? unlockRule.description : "完成档案规则后取得蓝图")
    : state.status === "locked" ? `第 ${item.unlockStage} 章开放`
    : equipped ? "当前已装备"
      : state.owned ? item.grantType === "equipment" ? "已拥有 · 可装备" : "已收入背包"
        : `${item.currency === "gold" ? "金币" : "铜币"} ${item.price}`;
  const statusColor = state.ruleLocked ? UI_COLORS.gold : accent;

  let action = null;
  let actionLabel = "";
  if (state.owned && equipment && !equipped) {
    action = `equip:${equipment.id}`;
    actionLabel = "装备";
  } else if (state.owned && !equipment) {
    action = "inventory";
    actionLabel = "整备";
  } else if (!state.owned) {
    action = `buy:${item.id}`;
    actionLabel = state.ruleLocked ? "档案未达成" : state.status === "locked" ? "未解锁" : state.status === "insufficient" ? "余额不足" : "购买";
  }

  if (compactCard) {
    const buttonW = action ? Math.min(53, w * 0.32) : 0;
    renderer.fitText(statusText, x + 8, drawY + h - 14, 10, w - buttonW - 17, statusColor, "left", "900", 10);
    if (action) renderer.button(action, actionLabel, x + w - buttonW - 5, drawY + h - 31, buttonW, 27, state.status === "available" || state.owned ? "primary" : "secondary");
  } else {
    renderer.text(statusText, x + 16, drawY + h - 39, 13, statusColor, "left", "900", "card");
    if (action) renderer.button(action, actionLabel, x + w - 116, drawY + h - 58, 100, 40, state.status === "available" || state.owned ? "primary" : "secondary");
  }
  if (active && action) focusBrackets(renderer, x - 3, drawY - 3, w + 6, h + 6, UI_COLORS.gold, 2, 14);
}

function drawShopPage(renderer, model) {
  const compact = renderer.height < 520 || renderer.width < 820;
  const panelW = Math.min(1660, renderer.width - (compact ? 16 : 58));
  const panelH = Math.min(940, renderer.height - (compact ? 16 : 42));
  const x = (renderer.width - panelW) / 2;
  const y = (renderer.height - panelH) / 2;
  const headerH = compact ? 54 : 82;
  const titleW = Math.min(panelW * 0.53, compact ? 430 : 720);
  drawTextScrim(renderer, x, y, titleW, headerH, { fill: "rgba(14,13,10,0.91)", accent: UI_COLORS.copper });
  drawEchoMark(renderer, x + (compact ? 18 : 28), y + (compact ? 13 : 18), UI_COLORS.copper, compact ? 0.7 : 0.95);
  renderer.displayText("拾荒者商栈", x + (compact ? 58 : 82), y + (compact ? 32 : 43), compact ? 26 : 40, UI_COLORS.white);
  renderer.text("每件战利品都有自己的轮廓、用途与归属", x + (compact ? 230 : 350), y + (compact ? 34 : 46), compact ? 11 : 14, UI_COLORS.paper, "left", "700");
  drawFieldButton(renderer, "back", "返回营地", x + panelW - (compact ? 112 : 142), y + (compact ? 10 : 17), compact ? 104 : 134, compact ? 34 : 48, { accent: UI_COLORS.gold });
  const walletW = compact ? 250 : 330;
  const walletX = x + panelW - walletW - (compact ? 16 : 24);
  drawFieldPlate(renderer, walletX, y + (compact ? 54 : 72), walletW, compact ? 34 : 44, { accent: UI_COLORS.gold });
  renderer.text(`铜币  ${model.save.currencies.copper}`, walletX + 14, y + (compact ? 71 : 94), compact ? 11 : 14, UI_COLORS.copper, "left", "900", "mono");
  renderer.text(`金币  ${model.save.currencies.gold}`, walletX + walletW - 14, y + (compact ? 71 : 94), compact ? 11 : 14, UI_COLORS.gold, "right", "900", "mono");

  const tabsY = y + (compact ? 92 : 126);
  const tabsW = Math.min(540, panelW - 240);
  renderer.button("shopCategoryPrev", "‹", x + 24, tabsY, 42, 38, "secondary");
  drawFieldPlate(renderer, x + 74, tabsY, tabsW, 40, { accent: UI_COLORS.copper, active: true });
  sectionTitle(renderer, CATEGORY_LABELS[model.shopCategory], "货架 01", x + 90, tabsY + 18, tabsW - 32, { accent: UI_COLORS.copper, size: compact ? 14 : 18, role: "display" });
  renderer.button("shopCategoryNext", "›", x + 82 + tabsW, tabsY, 42, 38, "secondary");
  if (model.shopMessage) {
    renderer.fitText(model.shopMessage.text, x + panelW - 24, tabsY + 20, 13, panelW * 0.38, model.shopMessage.tone === "success" ? UI_COLORS.green : UI_COLORS.danger, "right", "900", 11);
  }

  let count = 0;
  for (const id of renderer.content.ids("shopItems")) if (renderer.content.shopItems[id].category === model.shopCategory) count += 1;
  const columns = 3;
  const rows = Math.max(1, Math.ceil(count / columns));
  const gap = compact ? 7 : 16;
  const gridX = x + (compact ? 12 : 24);
  const gridY = tabsY + (compact ? 49 : 58);
  const gridW = panelW - (compact ? 24 : 48);
  const gridH = y + panelH - gridY - (compact ? 10 : 28);
  const cardW = (gridW - gap * (columns - 1)) / columns;
  const cardH = Math.min(compact ? 138 : 244, (gridH - gap * (rows - 1)) / rows);
  let index = 0;
  for (const id of renderer.content.ids("shopItems")) {
    const item = renderer.content.shopItems[id];
    if (item.category !== model.shopCategory) continue;
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawItemCard(renderer, model, item, gridX + column * (cardW + gap), gridY + row * (cardH + gap), cardW, cardH);
    index += 1;
  }
}

module.exports = { CATEGORY_LABELS, drawShopIcon, drawShopPage, drawItemCard };
