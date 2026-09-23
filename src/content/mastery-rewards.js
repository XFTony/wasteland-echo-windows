"use strict";

const WEAPON_EVOLUTION_REWARDS = Object.freeze({
  scrap_pistol: Object.freeze(["kineticLoop"]),
  swarm_smg: Object.freeze(["swarmProtocol"]),
  breaker_shotgun: Object.freeze(["phaseAegis"]),
  needle_rifle: Object.freeze(["penetratorDoctrine"]),
  rust_revolver: Object.freeze(["recoveryField"]),
  ember_carbine: Object.freeze(["arcNetwork"]),
  coil_cannon: Object.freeze(["penetratorDoctrine", "arcNetwork"])
});

const MASTERY_REWARD_LEVELS = Object.freeze([
  Object.freeze({ level: 2, id: "field_dividend", name: "战地分成", description: "该武器铜币收益 +5% · 立即获得 100 铜币", copper: 100, copperMultiplier: 0.05 }),
  Object.freeze({ level: 4, id: "calibrated_frame", name: "校准枪身", description: "该武器永久伤害 +4%", damageMultiplier: 0.04 }),
  Object.freeze({ level: 6, id: "evolution_clearance", name: "终局许可", description: "解锁该武器的专属终局进化", evolutionAccess: true }),
  Object.freeze({ level: 8, id: "weakpoint_memory", name: "弱点记忆", description: "该武器永久暴击率 +3% · 获得 1 金币", criticalChance: 0.03, gold: 1 }),
  Object.freeze({ level: 10, id: "master_badge", name: "精通铭牌", description: "获得精通铭牌、废料收益 +10% 和 2 金币", scrapMultiplier: 0.1, gold: 2, badge: true })
]);

module.exports = { WEAPON_EVOLUTION_REWARDS, MASTERY_REWARD_LEVELS };
