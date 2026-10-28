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
  ctx.fillStyle = "#1c211b";
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.fillStyle = "#5b5c46";
  ctx.fillRect(x - size / 2 + 7, y + size / 2 - 4, size - 14, 1);
  drawGrantIcon(renderer, item.grantType, item.grantId, x, y, size * 0.88, color);
}

function drawItemCard(renderer, model, item, x, y, w, h) {
  const state = model.getShopState(item.id);
  const unlockRule = item.unlockRuleId ? renderer.content.get("unlockRules", item.unlockRuleId) : null;
  const equipment = item.grantType === "equipment" ? renderer.content.get("equipment", item.grantId) : null;
  const equipped = Boolean(equipment && model.save.equippedEquipment[equipment.slot] === equipment.id);
  const compact = h < 145, tiny = h < 116;
  const accent = state.owned ? UI_COLORS.green : state.ruleLocked || state.status === "locked" ? "#aaa18a" : UI_COLORS.copper;
  const action = !state.owned ? "buy:" + item.id : equipment && !equipped ? "equip:" + equipment.id : !equipment ? "inventory" : null;
  const active = renderer.focusAction === action;
  drawFieldPlate(renderer, x, y, w, h, { accent, active, raised: active, fill: active ? "#383a2c" : "#292c23" });
  const iconSize = tiny ? 38 : compact ? 65 : 80;
  drawShopIcon(renderer, item, x + 14 + iconSize / 2, y + (tiny ? h / 2 : 18 + iconSize / 2), iconSize, accent);
  const textX = x + iconSize + 29, textW = Math.max(75, w - iconSize - 155);
  renderer.fitText(item.name, textX, y + (tiny ? 16 : 25), tiny ? 13 : compact ? 17 : 20, textW, UI_COLORS.white, "left", "900", 11);
  if (!tiny) {
    renderer.fitText(itemTypeLine(renderer, item), textX, y + 48, 11, w - iconSize - 47, accent, "left", "700", 10);
    if (!compact) renderer.fitText(item.description, textX, y + 72, 14, w - iconSize - 47, UI_COLORS.muted, "left", "500", 12);
    renderer.fitText(itemStatLine(renderer, item), x + 15, y + (compact ? 79 : 106), compact ? 12 : 13, w - 30, UI_COLORS.paper, "left", "600", 11);
    renderer.text((item.currency === "gold" ? "金币 " : "铜币 ") + item.price, x + w - 16, y + 25, compact ? 12 : 13, UI_COLORS.gold, "right", "800", "mono");
  } else if (h >= 74) {
    renderer.fitText(itemStatLine(renderer, item), textX, y + 40, 10, w - iconSize - 47, UI_COLORS.paper, "left", "600", 10);
  }
  const status = state.ruleLocked ? (unlockRule ? unlockRule.description : "取得蓝图后开放")
    : state.status === "locked" ? "第 " + item.unlockStage + " 章开放"
    : equipped ? "当前已装备" : state.owned ? "已收入背包"
    : state.status === "insufficient" ? "还差 " + Math.max(0, item.price - (model.save.currencies[item.currency] || 0)) + (item.currency === "gold" ? " 金币" : " 铜币") : "可整备";
  const statusY = y + h - (tiny ? 13 : 23);
  renderer.fitText(status, tiny ? textX : x + 15, statusY, tiny ? 10 : 11,
    tiny ? w - iconSize - 136 : w - 147, state.ruleLocked ? UI_COLORS.gold : UI_COLORS.muted, "left", "600", 10);
  if (action) {
    const label = state.owned ? equipment ? "装备" : "整备" : state.ruleLocked ? "档案未达成" : state.status === "locked" ? "未解锁" : state.status === "insufficient" ? "余额不足" : "购买";
    const buttonW = tiny ? 82 : 108, buttonH = tiny ? 29 : 36;
    renderer.button(action, label, x + w - buttonW - 13, y + h - buttonH - (tiny ? 8 : 13), buttonW, buttonH,
      state.owned || state.status === "available" ? "primary" : "secondary");
  }
}

function drawShopPage(renderer, model) {
  const compact = renderer.height < 600 || renderer.width < 900;
  const margin = compact ? 14 : 30, x = margin, y = compact ? 12 : 24;
  const w = renderer.width - margin * 2, headerH = compact ? 55 : 78;
  drawTextScrim(renderer, x, y, Math.min(w * 0.62, 620), headerH, { fill: "rgba(24,27,20,0.94)" });
  drawEchoMark(renderer, x + 14, y + 12, UI_COLORS.copper, compact ? 0.8 : 1);
  renderer.displayText("拾荒者商栈", x + 55, y + (compact ? 24 : 31), compact ? 28 : 38, UI_COLORS.white);
  if (!compact) renderer.text("按用途挑选，带上真正用得着的东西。", x + 57, y + 62, 12, UI_COLORS.muted, "left", "500");
  drawFieldButton(renderer, "back", "返回营地", x + w - (compact ? 116 : 142), y + 4, compact ? 108 : 134, compact ? 36 : 44);
  const walletX = x + w - (compact ? 127 : 300);
  renderer.fitText("铜币 " + model.save.currencies.copper + "   金币 " + model.save.currencies.gold,
    compact ? x + w : walletX, y + (compact ? 57 : 64), 12, compact ? 230 : 270, UI_COLORS.gold, compact ? "right" : "left", "800", 10, "mono");
  const tabsY = y + headerH + (compact ? 7 : 5), arrow = compact ? 30 : 36;
  renderer.button("shopCategoryPrev", "‹", x, tabsY, arrow, arrow, "secondary");
  renderer.text(CATEGORY_LABELS[model.shopCategory], x + arrow + 18, tabsY + arrow / 2, compact ? 16 : 20, UI_COLORS.paper, "left", "800");
  renderer.button("shopCategoryNext", "›", x + (compact ? 205 : 270), tabsY, arrow, arrow, "secondary");
  if (model.shopMessage) renderer.fitText(model.shopMessage.text, x + w, tabsY + arrow / 2, 12, w * 0.48,
    model.shopMessage.tone === "success" ? UI_COLORS.green : UI_COLORS.danger, "right", "700", 10);
  const items = renderer.content.ids("shopItems").map(id => renderer.content.shopItems[id]).filter(item => item.category === model.shopCategory);
  const columns = 2, rows = Math.max(1, Math.ceil(items.length / columns)), gap = compact ? 10 : 16;
  const gridY = tabsY + arrow + (compact ? 9 : 14), cardW = (w - gap) / columns;
  const cardH = (renderer.height - gridY - margin - gap * (rows - 1)) / rows;
  items.forEach((item, index) => drawItemCard(renderer, model, item, x + index % columns * (cardW + gap),
    gridY + Math.floor(index / columns) * (cardH + gap), cardW, cardH));
}

module.exports = { CATEGORY_LABELS, drawShopIcon, drawShopPage, drawItemCard };
