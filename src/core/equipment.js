"use strict";

const EQUIPMENT_SLOTS = Object.freeze(["helmet", "chest", "legs", "boots"]);
const LOADOUT_STAT_KEYS = Object.freeze([
  "maxHp",
  "armor",
  "speed",
  "damageMultiplier",
  "fireRateMultiplier",
  "pickupRadius",
  "copperMultiplier",
  "lockRangeMultiplier"
]);

function ownedEquipment(save) {
  return Array.isArray(save && save.ownedEquipment) ? save.ownedEquipment : [];
}

function equippedDefinitions(save, content) {
  const loadout = save && save.equippedEquipment || {};
  const owned = ownedEquipment(save);
  const result = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const item = content.get("equipment", loadout[slot]);
    if (item && item.slot === slot && owned.includes(item.id)) result.push(item);
  }
  return result;
}

function equippedDefinitionMap(save, content) {
  const result = { helmet: null, chest: null, legs: null, boots: null };
  for (const item of equippedDefinitions(save, content)) result[item.slot] = item;
  return result;
}

function equipItem(save, itemId, content) {
  const item = content.get("equipment", itemId);
  if (!item) return { ok: false, status: "missing" };
  if (!ownedEquipment(save).includes(itemId)) {
    return { ok: false, status: "not-owned" };
  }
  if (!EQUIPMENT_SLOTS.includes(item.slot)) return { ok: false, status: "invalid-slot" };
  if (!save.equippedEquipment || typeof save.equippedEquipment !== "object") save.equippedEquipment = {};
  save.equippedEquipment[item.slot] = itemId;
  return { ok: true, status: "equipped", slot: item.slot, itemId };
}

function unequipItem(save, slot) {
  if (!EQUIPMENT_SLOTS.includes(slot)) return { ok: false, status: "invalid-slot" };
  if (!save.equippedEquipment || typeof save.equippedEquipment !== "object") save.equippedEquipment = {};
  const itemId = save.equippedEquipment[slot] || null;
  save.equippedEquipment[slot] = null;
  return { ok: true, status: itemId ? "unequipped" : "empty", slot, itemId };
}

function applyMultiplier(target, key, value) {
  if (Number.isFinite(Number(value))) target[key] *= Number(value);
}

function calculateLoadoutStats(basePlayer, hero, save, content) {
  const stats = {};
  for (const key of LOADOUT_STAT_KEYS) {
    const fallback = ["maxHp", "speed", "pickupRadius"].includes(key) ? 0 : key === "armor" ? 0 : 1;
    const value = Number(basePlayer && basePlayer[key]);
    stats[key] = Number.isFinite(value) ? value : fallback;
  }
  const hpMultiplier = Number(hero && hero.hpMultiplier) || 1;
  stats.maxHp *= hpMultiplier;
  stats.speed *= Number(hero && hero.speedMultiplier) || 1;
  stats.pickupRadius *= Number(hero && hero.pickupMultiplier) || 1;
  stats.damageMultiplier *= Number(hero && hero.damageMultiplier) || 1;
  stats.armor += Number(hero && hero.armorBonus) || 0;
  stats.copperMultiplier *= Number(hero && hero.copperMultiplier) || 1;
  stats.lockRangeMultiplier *= Number(hero && hero.lockRangeMultiplier) || 1;

  const items = equippedDefinitions(save, content);
  for (const item of items) {
    const itemStats = item.stats || {};
    stats.maxHp += Number(itemStats.hp) || 0;
    stats.armor += Number(itemStats.armor) || 0;
    applyMultiplier(stats, "speed", itemStats.speedMultiplier);
    applyMultiplier(stats, "pickupRadius", itemStats.pickupMultiplier);
    applyMultiplier(stats, "damageMultiplier", itemStats.damageMultiplier);
    applyMultiplier(stats, "fireRateMultiplier", itemStats.fireRateMultiplier);
    applyMultiplier(stats, "copperMultiplier", itemStats.copperMultiplier);
    applyMultiplier(stats, "lockRangeMultiplier", itemStats.lockRangeMultiplier);
  }
  stats.armor = Math.max(0, Math.min(0.65, stats.armor));
  stats.maxHp = Math.round(stats.maxHp);
  return { stats, items };
}

function applyHeroAndEquipment(player, hero, save, content) {
  const result = calculateLoadoutStats(player, hero, save, content);
  for (const key of LOADOUT_STAT_KEYS) player[key] = result.stats[key];
  player.hp = player.maxHp;
  return result.items;
}

module.exports = {
  EQUIPMENT_SLOTS,
  LOADOUT_STAT_KEYS,
  equippedDefinitions,
  equippedDefinitionMap,
  equipItem,
  unequipItem,
  calculateLoadoutStats,
  applyHeroAndEquipment
};
