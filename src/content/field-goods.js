"use strict";

// Prototype prices and bonuses, owned by the project rather than copied from a reference.
const FIELD_GOODS = Object.freeze({
  weaponCalibration: Object.freeze({ id: "weaponCalibration", name: "枪械校准", detail: "伤害 +12% · 射速 +3%", icon: "damage", family: "firepower", prices: [10, 18, 28], effect: "weapon" }),
  fieldMedkit: Object.freeze({ id: "fieldMedkit", name: "战地急救包", detail: "回复 30% 最大生命", icon: "vitality", family: "survival", prices: [7, 9, 12], effect: "heal" }),
  runnerStrap: Object.freeze({ id: "runnerStrap", name: "轻便绑带", detail: "移动速度 +6%", icon: "speed", family: "mobility", prices: [9, 14], effect: "speed" }),
  ballisticLining: Object.freeze({ id: "ballisticLining", name: "护甲衬层", detail: "护甲 +4个百分点 · 上限55%", icon: "armor", family: "survival", prices: [12, 20], effect: "armor" }),
  salvageMagnet: Object.freeze({ id: "salvageMagnet", name: "回收磁环", detail: "拾取范围 +15%", icon: "magnet", family: "utility", prices: [8, 14], effect: "magnet" })
});

module.exports = { FIELD_GOODS };
