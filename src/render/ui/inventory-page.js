"use strict";

const { drawSurvivorActor } = require("../pixel-actors");
const { createBasePlayerStats } = require("../../core/run-state");
const {
  calculateLoadoutStats,
  equippedDefinitionMap
} = require("../../core/equipment");
const { INPUT_DEVICES } = require("../../core/contracts");
const { nextMasteryReward } = require("../../core/mastery-system");
const { UI_COLORS } = require("./theme");
const {
  drawEchoMark,
  focusBrackets,
  sectionTitle,
  statBlock
} = require("./art-primitives");
const { drawFieldButton, drawFieldPlate, drawTextScrim } = require("./field-surfaces");
const {
  RANGE_BANDS,
  WEAPON_CLASS_LABELS,
  drawGrantIcon
} = require("./item-icons");
const {
  EQUIPMENT_SLOT_LABELS,
  equipmentAccent,
  equipmentStatTokens,
  equipmentMeta
} = require("./equipment-presentation");

const INVENTORY_PAGE_SIZE = 20;
const ENTRY_LABELS = Object.freeze({ weapon: "枪械", skin: "服饰", equipment: "护具" });
const ARMOR_SLOTS = Object.freeze(["helmet", "chest", "legs", "boots"]);

function inventoryEntries(renderer, model) {
  const entries = [];
  for (const id of renderer.content.ids("weapons")) {
    if (!model.save.unlockedWeapons.includes(id)) continue;
    entries.push({ grantType: "weapon", id, item: renderer.content.weapons[id], action: `selectWeapon:${id}` });
  }
  for (const id of renderer.content.ids("skins")) {
    if (!model.save.unlockedSkins.includes(id)) continue;
    entries.push({ grantType: "skin", id, item: renderer.content.skins[id], action: `selectSkin:${id}` });
  }
  for (const id of renderer.content.ids("equipment")) {
    if (!model.save.ownedEquipment.includes(id)) continue;
    entries.push({ grantType: "equipment", id, item: renderer.content.equipment[id], action: `equip:${id}` });
  }
  return entries;
}

function entryAccent(entry) {
  if (entry.grantType === "weapon") {
    const band = RANGE_BANDS[entry.item.rangeBand];
    return band ? band.color : UI_COLORS.amber;
  }
  if (entry.grantType === "skin") return entry.item.accent || UI_COLORS.orange;
  return equipmentAccent(entry.item);
}

function entryIsEquipped(entry, model) {
  if (entry.grantType === "weapon") return model.selectedWeapon === entry.id;
  if (entry.grantType === "skin") return model.selectedSkin === entry.id;
  return model.save.equippedEquipment[entry.item.slot] === entry.id;
}

function entryMeta(entry) {
  if (entry.grantType === "weapon") {
    const band = RANGE_BANDS[entry.item.rangeBand];
    return `${band ? band.label : "武器"} · ${WEAPON_CLASS_LABELS[entry.item.weaponClass] || entry.item.weaponClass}`;
  }
  if (entry.grantType === "skin") return "永久行动服饰";
  return equipmentMeta(entry.item);
}

function entryStats(entry) {
  if (entry.grantType === "weapon") {
    const rate = Math.min(99, 1 / entry.item.interval).toFixed(entry.item.interval < 0.15 ? 1 : 2);
    return `伤害 ${entry.item.damage} · 射速 ${rate}/秒 · 锁定 ${entry.item.lockRange}`;
  }
  if (entry.grantType === "equipment") {
    const tokens = equipmentStatTokens(entry.item);
    return tokens.length ? tokens.join(" · ") : entry.item.description;
  }
  return entry.item.description;
}

function masterySummary(model, entry) {
  if (!entry || entry.grantType !== "weapon") return "";
  const record = model.save.weaponMastery && model.save.weaponMastery[entry.id];
  const level = Math.max(1, Math.min(10, Math.floor(Number(record && record.level) || 1)));
  const next = nextMasteryReward(level);
  return next
    ? `精通 Lv.${level} · 下一奖励 Lv.${next.level}：${next.name}`
    : `精通 Lv.${level} · 已获得精通铭牌`;
}

function updatePortraitLook(renderer, actorX, actorY, areaW, areaH) {
  const pointer = renderer.pointerState || { x: -1000, y: -1000 };
  const pointerVisible = renderer.activeInputDevice === INPUT_DEVICES.KEYBOARD_MOUSE
    && pointer.x >= 0 && pointer.x <= renderer.width
    && pointer.y >= 0 && pointer.y <= renderer.height;
  const targetX = pointerVisible ? Math.max(-1, Math.min(1, (pointer.x - actorX) / Math.max(40, areaW * 0.46))) : 0;
  const targetY = pointerVisible ? Math.max(-1, Math.min(1, (pointer.y - actorY) / Math.max(40, areaH * 0.48))) : 0;
  if (!renderer.portraitLook) renderer.portraitLook = { x: 0, y: 0 };
  renderer.portraitLook.x += (targetX - renderer.portraitLook.x) * 0.18;
  renderer.portraitLook.y += (targetY - renderer.portraitLook.y) * 0.18;
  if (Math.abs(renderer.portraitLook.x) < 0.005) renderer.portraitLook.x = 0;
  if (Math.abs(renderer.portraitLook.y) < 0.005) renderer.portraitLook.y = 0;
  return renderer.portraitLook;
}

function drawSlot(renderer, grantType, item, x, y, w, h, label, compact, action = null) {
  const ctx = renderer.ctx;
  const accent = item
    ? grantType === "weapon" ? (RANGE_BANDS[item.rangeBand] || RANGE_BANDS.mid).color
      : grantType === "skin" ? item.accent
        : equipmentAccent(item)
    : UI_COLORS.iron;
  const pointer = renderer.pointerState || { x: -1000, y: -1000 };
  const hovered = Boolean(action) && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const focused = Boolean(action) && renderer.focusAction === action;
  drawFieldPlate(renderer, x, y, w, h, { accent, active: hovered || focused, raised: hovered || focused });
  ctx.fillStyle = accent;
  ctx.fillRect(x + 4, y + 4, compact ? 3 : 4, h - 8);
  renderer.fitText(label, x + 11, y + (compact ? 10 : 14), compact ? 10 : 12, w - 19, accent, "left", "900", 10);
  if (item) {
    const iconSize = Math.min(w * 0.68, h * (compact ? 0.46 : 0.52), compact ? 44 : 66);
    drawGrantIcon(renderer, grantType, item.id, x + w / 2 + 2, y + h * 0.52, iconSize, accent);
    if (h >= (compact ? 42 : 68)) {
      renderer.fitText(item.name, x + w / 2, y + h - (compact ? 9 : 12), compact ? 10 : 12, w - 12, UI_COLORS.white, "center", "900", 10);
    }
  } else {
    renderer.text("空", x + w / 2, y + h / 2 + 4, compact ? 9 : 12, "#746e5f", "center", "800");
  }
  if (action) {
    if (item && h >= 58) renderer.text("卸", x + w - 9, y + 12, 10, UI_COLORS.muted, "right", "900", "mono");
    if (focused) focusBrackets(renderer, x - 3, y - 3, w + 6, h + 6, UI_COLORS.gold, 2, 11);
    renderer.addRegion(action, x, y, w, h);
  }
}

function drawStatPlate(renderer, stats, mode, x, y, w, h, compact) {
  const primary = [
    ["生命", String(Math.round(stats.maxHp)), "#c97857"],
    ["护甲", `${Math.round(stats.armor * 100)}%`, "#a5a08e"],
    ["移动", String(Math.round(stats.speed)), UI_COLORS.green],
    ["增伤", `${Math.round(stats.damageMultiplier * 100)}%`, UI_COLORS.gold]
  ];
  const titleH = compact ? 27 : 36;
  drawFieldPlate(renderer, x, y, w, h, { accent: UI_COLORS.gold });
  renderer.text("生存参数", x + 12, y + titleH / 2 + 1, compact ? 11 : 14, UI_COLORS.paper, "left", "900", "display");
  renderer.fitText(`${mode.name}基准`, x + w - 12, y + titleH / 2 + 1, compact ? 10 : 12, w * 0.4, UI_COLORS.muted, "right", "700", 10);
  const gap = compact ? 3 : 6;
  const cellW = (w - (compact ? 16 : 24) - gap * 3) / 4;
  const statY = y + titleH;
  const statH = h - titleH - (compact ? 18 : 27);
  for (let index = 0; index < primary.length; index += 1) {
    const [label, value, color] = primary[index];
    const cellX = x + (compact ? 8 : 12) + index * (cellW + gap);
    statBlock(renderer, label, value, cellX, statY, cellW, statH, { accent: color, valueColor: color, fill: "#393528" });
  }
  const secondary = `射速 ${Math.round(stats.fireRateMultiplier * 100)}%  ·  拾取 ${Math.round(stats.pickupRadius)}  ·  锁定 ${Math.round(stats.lockRangeMultiplier * 100)}%`;
  renderer.fitText(secondary, x + 12, y + h - (compact ? 9 : 13), compact ? 10 : 14, w - 24, UI_COLORS.paper, "left", "700", 10, "mono");
}

function drawWardrobe(renderer, model, x, y, w, h, compact) {
  const ctx = renderer.ctx;
  const hero = renderer.content.get("heroes", model.selectedHero, renderer.content.defaults.hero);
  const skin = renderer.content.get("skins", model.selectedSkin, renderer.content.defaults.skin);
  const weapon = renderer.content.get("weapons", model.selectedWeapon, renderer.content.defaults.weapon);
  const equipment = equippedDefinitionMap(model.save, renderer.content);
  const mode = renderer.content.get("modes", model.selectedMode, renderer.content.defaults.mode);
  const composed = calculateLoadoutStats(createBasePlayerStats(mode), hero, model.save, renderer.content);

  const headerH = compact ? 34 : 54;
  drawFieldPlate(renderer, x, y, w, headerH, { accent: hero.accent, active: true });
  drawFieldButton(renderer, "heroPrev", "‹", x + 8, y + (compact ? 4 : 7), compact ? 28 : 40, compact ? 26 : 40, { accent: hero.accent, role: "display" });
  drawFieldButton(renderer, "heroNext", "›", x + w - (compact ? 36 : 48), y + (compact ? 4 : 7), compact ? 28 : 40, compact ? 26 : 40, { accent: hero.accent, role: "display" });
  renderer.fitText(hero.name, x + w / 2, y + (compact ? 13 : 19), compact ? 13 : 18, w - (compact ? 88 : 118), UI_COLORS.white, "center", "900", 11, "display");
  renderer.fitText(hero.passive, x + w / 2, y + (compact ? 27 : 39), compact ? 10 : 12, w - (compact ? 84 : 110), UI_COLORS.muted, "center", "700", 10);

  const statsH = compact ? Math.min(90, Math.max(67, h * 0.27)) : Math.min(132, Math.max(108, h * 0.24));
  const workY = y + headerH + (compact ? 4 : 7);
  const statsY = y + h - statsH - (compact ? 5 : 8);
  const workH = Math.max(92, statsY - workY - (compact ? 4 : 7));
  const slotW = compact ? Math.max(43, Math.min(60, w * 0.23)) : Math.max(74, Math.min(100, w * 0.21));
  const sideGap = compact ? 5 : 9;
  const slotX = x + (compact ? 7 : 11);
  const slotGap = compact ? 3 : 6;
  const armorSlotH = (workH - slotGap * 3) / 4;
  for (let index = 0; index < ARMOR_SLOTS.length; index += 1) {
    const slot = ARMOR_SLOTS[index];
    const item = equipment[slot];
    drawSlot(
      renderer,
      "equipment",
      item,
      slotX,
      workY + index * (armorSlotH + slotGap),
      slotW,
      armorSlotH,
      EQUIPMENT_SLOT_LABELS[slot],
      compact,
      item ? `unequip:${slot}` : null
    );
  }

  const rightX = x + w - slotW - (compact ? 7 : 11);
  const sideH = (workH - slotGap) / 2;
  drawSlot(renderer, "weapon", weapon, rightX, workY, slotW, sideH, "主武器", compact);
  drawSlot(renderer, "skin", skin, rightX, workY + sideH + slotGap, slotW, sideH, "行动服", compact);

  const alcoveX = slotX + slotW + sideGap;
  const alcoveW = Math.max(55, rightX - sideGap - alcoveX);
  drawTextScrim(renderer, alcoveX, workY, alcoveW, workH, { fill: "rgba(15,14,11,0.48)" });
  ctx.fillStyle = "#594a34";
  ctx.fillRect(alcoveX + 7, workY + workH - (compact ? 12 : 18), alcoveW - 14, compact ? 4 : 6);
  const actorX = alcoveX + alcoveW / 2;
  const actorY = workY + workH * (compact ? 0.57 : 0.59);
  const unit = Math.max(compact ? 0.92 : 1.55, Math.min(compact ? 1.9 : 3.75, Math.min(workH / 75, alcoveW / 49)));
  const look = updatePortraitLook(renderer, actorX, actorY, alcoveW, workH);
  drawSurvivorActor(ctx, {
    x: actorX,
    y: actorY,
    unit,
    skin,
    skinId: model.selectedSkin,
    heroId: model.selectedHero,
    weapon,
    aimX: 0.92,
    aimY: -0.22,
    lookX: look.x,
    lookY: look.y,
    elapsed: renderer.frame / 60,
    moving: false,
    portrait: true,
    equipment
  });
  if (!compact && alcoveW > 110) {
    renderer.text(hero.callsign, actorX, workY + 17, 11, hero.accent, "center", "900", "mono");
    renderer.text("头部随鼠标观察", actorX, workY + workH - 11, 11, UI_COLORS.muted, "center", "700");
  }

  drawStatPlate(renderer, composed.stats, mode, x + (compact ? 7 : 11), statsY, w - (compact ? 14 : 22), statsH, compact);
}

function drawInventoryCell(renderer, model, entry, x, y, w, h, index, compact) {
  const ctx = renderer.ctx;
  const pointer = renderer.pointerState || { x: -1000, y: -1000 };
  const hovered = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const focused = renderer.focusAction === entry.action;
  const equipped = entryIsEquipped(entry, model);
  const active = hovered || focused;
  const accent = entryAccent(entry);
  const lift = active ? (compact ? 2 : 4) : 0;
  const drawY = y - lift;
  drawFieldPlate(renderer, x, drawY, w, h, { accent, active: active || equipped, raised: active });
  renderer.text(String(index + 1).padStart(2, "0"), x + 6, drawY + (compact ? 11 : 14), compact ? 10 : 11, UI_COLORS.mutedDark, "left", "700", "mono");
  const showName = h >= 52;
  const iconSize = Math.min(w * 0.72, h * (showName ? 0.56 : 0.72), compact ? 46 : 70);
  drawGrantIcon(renderer, entry.grantType, entry.id, x + w / 2, drawY + h * (showName ? 0.46 : 0.56), iconSize, accent);
  if (showName) renderer.fitText(entry.item.name, x + w / 2, drawY + h - (compact ? 9 : 12), compact ? 10 : 12, w - 9, UI_COLORS.white, "center", "900", 10);
  if (equipped) renderer.text("E", x + w - 7, drawY + (compact ? 11 : 13), compact ? 10 : 11, accent, "right", "900", "mono");
  if (focused) focusBrackets(renderer, x - 3, drawY - 3, w + 6, h + 6, UI_COLORS.gold, 2, 10);
  renderer.addRegion(entry.action, x, y, w, h);
  return active;
}

function drawEmptyCell(renderer, x, y, w, h, index, compact) {
  const ctx = renderer.ctx;
  drawFieldPlate(renderer, x, y, w, h, { alpha: 0.26 });
  const inset = compact ? 5 : 8;
  ctx.fillStyle = "rgba(16,15,12,0.7)";
  ctx.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  ctx.fillStyle = "#37342c";
  ctx.fillRect(x + w * 0.37, y + h * 0.5, w * 0.26, 1);
  ctx.fillRect(x + w * 0.5, y + h * 0.37, 1, h * 0.26);
  renderer.text(String(index + 1).padStart(2, "0"), x + 5, y + (compact ? 9 : 12), compact ? 7 : 8, "#5d594f", "left", "700", "mono");
}

function drawEntryInfo(renderer, model, entry, x, y, w, h, compact) {
  drawFieldPlate(renderer, x, y, w, h, { accent: entry ? entryAccent(entry) : UI_COLORS.iron, active: Boolean(entry) });
  if (!entry) {
    renderer.text("背包为空", x + 12, y + h / 2, compact ? 10 : 14, UI_COLORS.muted, "left", "800");
    return;
  }
  const accent = entryAccent(entry);
  renderer.text(ENTRY_LABELS[entry.grantType], x + 12, y + (compact ? 13 : 20), compact ? 10 : 12, accent, "left", "900", "mono");
  renderer.fitText(entry.item.name, x + (compact ? 62 : 86), y + (compact ? 13 : 20), compact ? 13 : 18, w - (compact ? 74 : 102), UI_COLORS.white, "left", "900", 11, "display");
  if (!compact || h >= 66) renderer.fitText(entryMeta(entry), x + 12, y + (compact ? 31 : 39), compact ? 10 : 13, w - 24, UI_COLORS.paper, "left", "800", 10);
  const mastery = masterySummary(model, entry);
  if (mastery && !compact) {
    renderer.fitText(entryStats(entry), x + 12, y + 58, 13, w - 24, UI_COLORS.paper, "left", "700", 11);
    renderer.fitText(mastery, x + 12, y + 77, 13, w - 24, accent, "left", "900", 11);
  } else {
    renderer.fitText(mastery || entryStats(entry), x + 12, y + h - (compact ? 12 : 19), compact ? 10 : 12, w - 24, mastery ? accent : UI_COLORS.muted, "left", mastery ? "900" : "700", 10);
  }
}

function drawInventoryGrid(renderer, model, x, y, w, h, compact) {
  const entries = inventoryEntries(renderer, model);
  const pageCount = Math.max(1, Math.ceil(entries.length / INVENTORY_PAGE_SIZE));
  const currentPage = Math.min(pageCount - 1, Math.max(0, Number(model.inventoryPage) || 0));
  const pageEntries = entries.slice(currentPage * INVENTORY_PAGE_SIZE, (currentPage + 1) * INVENTORY_PAGE_SIZE);
  const headerH = compact ? 34 : 52;
  drawTextScrim(renderer, x, y, w, headerH, { fill: "rgba(14,13,10,0.9)", accent: UI_COLORS.gold });
  sectionTitle(renderer, "战利品格", `${entries.length} / ${INVENTORY_PAGE_SIZE * pageCount}`, x + 14, y + headerH / 2 - (compact ? 2 : 4), w - 28, {
    accent: UI_COLORS.gold,
    size: compact ? 15 : 21,
    role: "display"
  });
  if (pageCount > 1) {
    const previous = (currentPage - 1 + pageCount) % pageCount;
    const next = (currentPage + 1) % pageCount;
    renderer.button(`inventoryPage:${previous}`, "‹", x + w - (compact ? 85 : 112), y + (compact ? 4 : 7), compact ? 28 : 36, compact ? 26 : 36, "secondary");
    renderer.text(`${currentPage + 1}/${pageCount}`, x + w - (compact ? 43 : 56), y + headerH / 2, compact ? 8 : 10, UI_COLORS.white, "center", "900", "mono");
    renderer.button(`inventoryPage:${next}`, "›", x + w - (compact ? 30 : 42), y + (compact ? 4 : 7), compact ? 26 : 34, compact ? 26 : 36, "secondary");
  }

  const infoH = compact ? 50 : 88;
  const gap = compact ? 4 : 8;
  const gridX = x + (compact ? 7 : 11);
  const gridY = y + headerH;
  const gridW = w - (compact ? 14 : 22);
  const gridH = h - headerH - infoH - gap - (compact ? 7 : 11);
  const columns = 5;
  const rows = 4;
  const cellW = (gridW - gap * (columns - 1)) / columns;
  const cellH = (gridH - gap * (rows - 1)) / rows;
  let activeEntry = null;
  for (let index = 0; index < INVENTORY_PAGE_SIZE; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellX = gridX + column * (cellW + gap);
    const cellY = gridY + row * (cellH + gap);
    const entry = pageEntries[index];
    if (entry) {
      if (drawInventoryCell(renderer, model, entry, cellX, cellY, cellW, cellH, currentPage * INVENTORY_PAGE_SIZE + index, compact)) activeEntry = entry;
    } else {
      drawEmptyCell(renderer, cellX, cellY, cellW, cellH, currentPage * INVENTORY_PAGE_SIZE + index, compact);
    }
  }
  if (!activeEntry) activeEntry = pageEntries.find((entry) => entryIsEquipped(entry, model)) || pageEntries[0] || null;
  drawEntryInfo(renderer, model, activeEntry, gridX, y + h - infoH - (compact ? 6 : 10), gridW, infoH, compact);
}

function drawInventoryPage(renderer, model) {
  const compact = renderer.height < 600 || renderer.width < 980;
  const panelW = Math.min(1660, renderer.width - (compact ? 12 : 58));
  const panelH = Math.min(940, renderer.height - (compact ? 12 : 42));
  const x = (renderer.width - panelW) / 2;
  const y = (renderer.height - panelH) / 2;

  const headerH = compact ? 52 : 78;
  const headerW = Math.min(panelW * (compact ? 0.65 : 0.54), compact ? 440 : 720);
  drawTextScrim(renderer, x, y, headerW, headerH, { fill: "rgba(14,13,10,0.91)", accent: UI_COLORS.gold });
  drawEchoMark(renderer, x + (compact ? 16 : 25), y + (compact ? 12 : 17), UI_COLORS.gold, compact ? 0.7 : 0.95);
  renderer.displayText("行装与背包", x + (compact ? 56 : 78), y + headerH / 2 + 2, compact ? 25 : 40, UI_COLORS.white);
  if (!compact || panelW > 760) {
    renderer.text("人物、武器与四部位护具共用一套实战参数", x + (compact ? 220 : 330), y + headerH / 2 + 4, compact ? 11 : 14, UI_COLORS.paper, "left", "700");
  }
  drawFieldButton(renderer, "deployment", "返回部署", x + panelW - (compact ? 108 : 142), y + (compact ? 9 : 15), compact ? 100 : 134, compact ? 34 : 48, { accent: UI_COLORS.gold });

  const gap = compact ? 8 : 16;
  const bodyY = y + headerH;
  const bodyH = panelH - headerH - (compact ? 7 : 14);
  const leftW = compact
    ? Math.max(230, Math.min(370, panelW * 0.43))
    : Math.max(460, Math.min(570, panelW * 0.4));
  const leftX = x + (compact ? 7 : 14);
  drawWardrobe(renderer, model, leftX, bodyY, leftW, bodyH, compact);
  const gridX = leftX + leftW + gap;
  const gridW = x + panelW - gridX - (compact ? 7 : 14);
  drawInventoryGrid(renderer, model, gridX, bodyY, gridW, bodyH, compact);
}

module.exports = {
  INVENTORY_PAGE_SIZE,
  ARMOR_SLOTS,
  inventoryEntries,
  entryIsEquipped,
  entryStats,
  masterySummary,
  updatePortraitLook,
  drawInventoryPage
};
