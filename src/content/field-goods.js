"use strict";

// Prototype prices and bonuses, owned by the project rather than copied from a reference.
const FIELD_GOODS = Object.freeze({
  weaponCalibration: Object.freeze({ id: "weaponCalibration", name: "当前武器调校", detail: "本武器伤害 +12% · 攻速 +3%", icon: "damage", family: "firepower", prices: [10, 18, 28], repeat: true, cap: 8, effect: "weapon" }),
  fieldMedkit: Object.freeze({ id: "fieldMedkit", name: "战地急救包", detail: "回复 30% 最大生命 · 战斗30秒后补货", icon: "vitality", family: "survival", prices: [7, 9, 12], repeat: true, cooldown: 30, effect: "heal" }),
  runnerStrap: Object.freeze({ id: "runnerStrap", name: "轻便绑带", detail: "移动速度 +6%", icon: "speed", family: "mobility", prices: [9, 14], effect: "speed" }),
  ballisticLining: Object.freeze({ id: "ballisticLining", name: "护甲衬层", detail: "护甲 +4个百分点 · 上限55%", icon: "armor", family: "survival", prices: [12, 20], effect: "armor" }),
  salvageMagnet: Object.freeze({ id: "salvageMagnet", name: "回收磁环", detail: "拾取范围 +15%", icon: "magnet", family: "utility", prices: [8, 14], effect: "magnet" }),
  turretKit: Object.freeze({ id: "turretKit", name: "守望塔台套件", detail: "T/Y部署 · 场上与库存合计最多4座", icon: "caliber", family: "utility", prices: [18, 26, 36, 48], repeat: true, effect: "turret", tab: "support" }),
  engineeringKit: Object.freeze({ id: "engineeringKit", name: "工程强化件", detail: "塔台伤害 +25%基础值 · 耐久 +15%基础值", icon: "armor", family: "utility", prices: [14, 22, 32, 44, 58, 74], effect: "engineering", tab: "support" })
});

module.exports = { FIELD_GOODS };
