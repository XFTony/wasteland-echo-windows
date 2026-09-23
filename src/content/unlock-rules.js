"use strict";

function rule(definition) {
  return Object.freeze({
    ...definition,
    conditions: Object.freeze(definition.conditions.map((condition) => Object.freeze({ ...condition }))),
    reward: Object.freeze({ ...definition.reward })
  });
}

const UNLOCK_RULES = Object.freeze({
  blueprint_breaker: rule({
    id: "blueprint_breaker",
    name: "破门许可",
    description: "累计击败 120 名感染者",
    conditions: [{ metric: "totalKills", gte: 120 }],
    reward: { kind: "shopBlueprint", id: "buy_breaker_shotgun" }
  }),
  blueprint_ember: rule({
    id: "blueprint_ember",
    name: "余烬许可",
    description: "完成 2 次章节",
    conditions: [{ metric: "wins", gte: 2 }],
    reward: { kind: "shopBlueprint", id: "buy_ember_carbine" }
  }),
  blueprint_needle: rule({
    id: "blueprint_needle",
    name: "针刺许可",
    description: "完成第二章并累计击败 400 名感染者",
    conditions: [{ metric: "completedStage", id: "dead_rail" }, { metric: "totalKills", gte: 400 }],
    reward: { kind: "shopBlueprint", id: "buy_needle_rifle" }
  }),
  blueprint_coil: rule({
    id: "blueprint_coil",
    name: "荒雷许可",
    description: "单局击退 3 波无尽 Boss",
    conditions: [{ metric: "endlessBossWave", gte: 3 }],
    reward: { kind: "shopBlueprint", id: "buy_coil_cannon" }
  }),
  blueprint_nightwatch: rule({
    id: "blueprint_nightwatch",
    name: "夜巡档案",
    description: "单局最长无伤达到 90 秒",
    conditions: [{ metric: "bestNoHitTime", gte: 90 }],
    reward: { kind: "shopBlueprint", id: "buy_nightwatch_outfit" }
  }),
  blueprint_magnet: rule({
    id: "blueprint_magnet",
    name: "回收许可",
    description: "累计击败 200 名感染者",
    conditions: [{ metric: "totalKills", gte: 200 }],
    reward: { kind: "shopBlueprint", id: "buy_magnet_coil" }
  }),
  blueprint_ammo: rule({
    id: "blueprint_ammo",
    name: "速装许可",
    description: "完成 2 次章节",
    conditions: [{ metric: "wins", gte: 2 }],
    reward: { kind: "shopBlueprint", id: "buy_ammo_rig" }
  }),
  blueprint_signal: rule({
    id: "blueprint_signal",
    name: "远讯许可",
    description: "完成第三章",
    conditions: [{ metric: "completedStage", id: "red_storm" }],
    reward: { kind: "shopBlueprint", id: "buy_signal_charm" }
  }),
  blueprint_servo: rule({
    id: "blueprint_servo",
    name: "助力许可",
    description: "累计击败 350 名感染者",
    conditions: [{ metric: "totalKills", gte: 350 }],
    reward: { kind: "shopBlueprint", id: "buy_servo_greaves" }
  }),
  blueprint_stormstep: rule({
    id: "blueprint_stormstep",
    name: "踏雷许可",
    description: "任意武器精通达到 Lv4",
    conditions: [{ metric: "masteryAny", gte: 4 }],
    reward: { kind: "shopBlueprint", id: "buy_stormstep_boots" }
  }),
  hero_bulwark: rule({
    id: "hero_bulwark",
    name: "铁卫归队",
    description: "完成第二章“死亡铁轨”",
    conditions: [{ metric: "completedStage", id: "dead_rail" }],
    reward: { kind: "hero", id: "bulwark" }
  }),
  modifier_scarcity: rule({
    id: "modifier_scarcity",
    name: "匮乏协议",
    description: "完成 3 次章节",
    conditions: [{ metric: "wins", gte: 3 }],
    reward: { kind: "modifier", id: "scarcity" }
  }),
  modifier_redline: rule({
    id: "modifier_redline",
    name: "红线协议",
    description: "累计击败 10 名精英",
    conditions: [{ metric: "eliteKills", gte: 10 }],
    reward: { kind: "modifier", id: "redline" }
  }),
  modifier_ironman: rule({
    id: "modifier_ironman",
    name: "无伤协议",
    description: "最长无伤达到 120 秒",
    conditions: [{ metric: "bestNoHitTime", gte: 120 }],
    reward: { kind: "modifier", id: "ironman" }
  }),
  modifier_boss_rush: rule({
    id: "modifier_boss_rush",
    name: "巨像回声",
    description: "完成第三章且任意武器精通达到 Lv6",
    conditions: [{ metric: "completedStage", id: "red_storm" }, { metric: "masteryAny", gte: 6 }],
    reward: { kind: "modifier", id: "boss_rush" }
  })
});

module.exports = { UNLOCK_RULES };
