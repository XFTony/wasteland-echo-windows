"use strict";

function phase(definition) {
  return Object.freeze({
    ...definition,
    radial: definition.radial ? Object.freeze({ ...definition.radial }) : null,
    aimedShot: definition.aimedShot ? Object.freeze({ ...definition.aimedShot }) : null,
    summon: definition.summon ? Object.freeze({ ...definition.summon }) : null
  });
}

function boss(definition) {
  return Object.freeze({
    ...definition,
    phases: Object.freeze(definition.phases.map(phase)),
    drop: Object.freeze({ ...definition.drop })
  });
}

const BOSS_DEFINITIONS = Object.freeze({
  warden_protocol: boss({
    id: "warden_protocol",
    enemyId: "warden",
    name: "荒原看守",
    hudColor: "#bd6250",
    intro: "看守正在封锁行动区",
    tactic: "穿过环形弹幕的空隙，避免被逼入墙角",
    phases: [
      {
        id: "blockade",
        label: "封锁",
        minHealthRatio: 0.5,
        cooldown: 3.6,
        radial: { count: 8, speed: 135, damage: 9 },
        warning: "八向脉冲正在充能"
      },
      {
        id: "hunt",
        label: "猎杀",
        minHealthRatio: 0,
        cooldown: 2.55,
        radial: { count: 12, speed: 160, damage: 12 },
        aimedShot: { speed: 205, damage: 14, ttl: 2.8, color: "#df755b" },
        warning: "环形脉冲后追加定向重弹"
      }
    ],
    drop: { scrap: 18, healing: 24 }
  }),
  iron_colossus_protocol: boss({
    id: "iron_colossus_protocol",
    enemyId: "iron_colossus",
    name: "铁幕巨像",
    hudColor: "#d9674e",
    intro: "铁幕巨像逼近",
    tactic: "观察阶段预警，保持移动",
    phases: [
      {
        id: "alert",
        label: "警戒",
        minHealthRatio: 0.66,
        cooldown: 3.1,
        radial: { count: 12, speed: 160, damage: 11 },
        warning: "环形弹幕正在充能"
      },
      {
        id: "siege",
        label: "围城",
        minHealthRatio: 0.33,
        cooldown: 2.55,
        radial: { count: 16, speed: 175, damage: 13 },
        summon: { enemyId: "drifter", count: 2, cap: 75 },
        warning: "召集感染者并缩短攻击间隔"
      },
      {
        id: "frenzy",
        label: "狂暴",
        minHealthRatio: 0,
        cooldown: 1.95,
        radial: { count: 20, speed: 190, damage: 15 },
        aimedShot: { speed: 235, damage: 18, ttl: 2.6, color: "#ff8b62" },
        summon: { enemyId: "drifter", count: 2, cap: 75 },
        warning: "高密弹幕与追踪重炮已启动"
      }
    ],
    drop: { scrap: 36, healing: 36 }
  })
});

module.exports = { BOSS_DEFINITIONS };
