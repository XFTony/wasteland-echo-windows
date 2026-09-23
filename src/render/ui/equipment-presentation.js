"use strict";

const { UI_COLORS } = require("./theme");

const EQUIPMENT_SLOT_LABELS = Object.freeze({
  helmet: "头盔",
  chest: "身甲",
  legs: "腿甲",
  boots: "靴子"
});

const EQUIPMENT_RARITY_LABELS = Object.freeze({
  standard: "标准行装",
  advanced: "精制行装",
  prototype: "原型行装"
});

function equipmentAccent(item) {
  if (item && item.rarity === "prototype") return UI_COLORS.gold;
  if (item && item.rarity === "advanced") return "#8ba4a0";
  return UI_COLORS.green;
}

function signedPercent(multiplier) {
  const delta = Math.round((Number(multiplier) - 1) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}%`;
}

function equipmentStatTokens(item) {
  const stats = item && item.stats || {};
  const tokens = [];
  if (Number(stats.hp)) tokens.push(`生命 +${Math.round(Number(stats.hp))}`);
  if (Number(stats.armor)) tokens.push(`护甲 +${Math.round(Number(stats.armor) * 100)}%`);
  if (Number.isFinite(Number(stats.speedMultiplier))) tokens.push(`移动 ${signedPercent(stats.speedMultiplier)}`);
  if (Number.isFinite(Number(stats.damageMultiplier))) tokens.push(`增伤 ${signedPercent(stats.damageMultiplier)}`);
  if (Number.isFinite(Number(stats.fireRateMultiplier))) tokens.push(`射速 ${signedPercent(stats.fireRateMultiplier)}`);
  if (Number.isFinite(Number(stats.pickupMultiplier))) tokens.push(`拾取 ${signedPercent(stats.pickupMultiplier)}`);
  if (Number.isFinite(Number(stats.copperMultiplier))) tokens.push(`铜币 ${signedPercent(stats.copperMultiplier)}`);
  if (Number.isFinite(Number(stats.lockRangeMultiplier))) tokens.push(`锁定 ${signedPercent(stats.lockRangeMultiplier)}`);
  return tokens;
}

function equipmentMeta(item) {
  if (!item) return "未装备";
  return `${EQUIPMENT_SLOT_LABELS[item.slot] || item.slot} · ${EQUIPMENT_RARITY_LABELS[item.rarity] || item.rarity}`;
}

module.exports = {
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_RARITY_LABELS,
  equipmentAccent,
  equipmentStatTokens,
  equipmentMeta
};
