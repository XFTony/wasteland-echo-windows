"use strict";

function modifier(definition) {
  return Object.freeze({ ...definition });
}

// These definitions are deliberately data-only. The unlock layer can expose
// them now, while a later challenge-session module can consume their tuning
// without changing save data or the rule engine.
const RUN_MODIFIERS = Object.freeze({
  scarcity: modifier({
    id: "scarcity",
    name: "匮乏协议",
    description: "补给与恢复更稀少，结算收益提高。",
    rewardMultiplier: 1.2
  }),
  redline: modifier({
    id: "redline",
    name: "红线协议",
    description: "尸潮更早升压，精英出现频率提高。",
    rewardMultiplier: 1.25
  }),
  ironman: modifier({
    id: "ironman",
    name: "无伤协议",
    description: "降低容错，以连续无伤记录换取额外收益。",
    rewardMultiplier: 1.35
  }),
  boss_rush: modifier({
    id: "boss_rush",
    name: "巨像回声",
    description: "首领更频繁地进入战场，阶段奖励同步提高。",
    rewardMultiplier: 1.4
  })
});

module.exports = { RUN_MODIFIERS };
