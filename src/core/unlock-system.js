"use strict";

const { ownsGrant } = require("./economy");

const UNLOCK_METRICS = Object.freeze([
  "totalKills",
  "eliteKills",
  "wins",
  "bestNoHitTime",
  "completedStage",
  "endlessBossWave",
  "masteryAny"
]);

function ensureUnlockState(save) {
  if (!Array.isArray(save.unlockedBlueprints)) save.unlockedBlueprints = [];
  if (!Array.isArray(save.unlockedModifiers)) save.unlockedModifiers = [];
  if (!Array.isArray(save.completedUnlockRules)) save.completedUnlockRules = [];
  return save;
}

function pushUnique(list, id) {
  if (!list.includes(id)) {
    list.push(id);
    return true;
  }
  return false;
}

function conditionValue(save, run, condition) {
  const source = save || {};
  switch (condition && condition.metric) {
    case "totalKills": return Math.max(0, Number(source.totalKills) || 0);
    case "eliteKills": return Math.max(0, Number(source.eliteKills) || 0);
    case "wins": return Math.max(0, Number(source.wins) || 0);
    case "bestNoHitTime": {
      const runValue = run ? Math.max(Number(run.maxNoHitTime) || 0, Number(run.player && run.player.noHitTime) || 0) : 0;
      return Math.max(0, Number(source.bestNoHitTime) || 0, runValue);
    }
    case "completedStage": return Array.isArray(source.completedStages) && source.completedStages.includes(condition.id) ? 1 : 0;
    case "endlessBossWave": return Math.max(0, Number(run && run.endlessBossWave) || 0);
    case "masteryAny": {
      const records = source.weaponMastery && typeof source.weaponMastery === "object" ? Object.values(source.weaponMastery) : [];
      return records.reduce((highest, record) => Math.max(highest, Number(record && record.level) || 1), 1);
    }
    default: return 0;
  }
}

function progressForRule(save, run, rule) {
  const conditions = Array.isArray(rule && rule.conditions) ? rule.conditions : [];
  const details = conditions.map((condition) => {
    const current = conditionValue(save, run, condition);
    const target = condition.metric === "completedStage" ? 1 : Math.max(1, Number(condition.gte) || 1);
    return {
      metric: condition.metric,
      id: condition.id || null,
      current,
      target,
      ratio: Math.max(0, Math.min(1, current / target)),
      completed: current >= target
    };
  });
  const completed = details.length > 0 && details.every((detail) => detail.completed);
  return {
    ruleId: rule ? rule.id : null,
    completed,
    completedConditions: details.filter((detail) => detail.completed).length,
    totalConditions: details.length,
    ratio: details.length ? Math.min(...details.map((detail) => detail.ratio)) : 0,
    conditions: details
  };
}

function rewardName(rule, content) {
  const reward = rule && rule.reward;
  if (!reward) return "未知奖励";
  if (reward.kind === "shopBlueprint") {
    const item = content.get("shopItems", reward.id);
    return item ? `${item.name}蓝图` : reward.id;
  }
  if (reward.kind === "hero") {
    const hero = content.get("heroes", reward.id);
    return hero ? `角色：${hero.name}` : reward.id;
  }
  if (reward.kind === "modifier") {
    const modifier = content.get("modifiers", reward.id);
    return modifier ? `协议：${modifier.name}` : reward.id;
  }
  return reward.id;
}

function applyUnlockReward(save, rule, content) {
  ensureUnlockState(save);
  const reward = rule && rule.reward;
  if (!reward) return { changed: false, kind: null, id: null, name: "未知奖励" };
  let changed = false;
  if (reward.kind === "shopBlueprint") changed = pushUnique(save.unlockedBlueprints, reward.id);
  else if (reward.kind === "hero") {
    if (!Array.isArray(save.unlockedHeroes)) save.unlockedHeroes = [];
    changed = pushUnique(save.unlockedHeroes, reward.id);
  } else if (reward.kind === "modifier") changed = pushUnique(save.unlockedModifiers, reward.id);
  return { changed, kind: reward.kind, id: reward.id, name: rewardName(rule, content) };
}

function reconcileOwnedUnlocks(save, content) {
  ensureUnlockState(save);
  for (const ruleId of content.ids("unlockRules")) {
    const rule = content.unlockRules[ruleId];
    const reward = rule.reward;
    let alreadyOwned = false;
    if (reward.kind === "shopBlueprint") {
      const item = content.get("shopItems", reward.id);
      alreadyOwned = Boolean(item && ownsGrant(save, item));
      if (alreadyOwned) pushUnique(save.unlockedBlueprints, reward.id);
    } else if (reward.kind === "hero") {
      alreadyOwned = Array.isArray(save.unlockedHeroes) && save.unlockedHeroes.includes(reward.id);
    } else if (reward.kind === "modifier") {
      alreadyOwned = save.unlockedModifiers.includes(reward.id);
    }
    if (alreadyOwned) pushUnique(save.completedUnlockRules, rule.id);
  }
  return save;
}

function evaluateUnlockRules(save, run, content) {
  ensureUnlockState(save);
  reconcileOwnedUnlocks(save, content);
  const unlocked = [];
  for (const ruleId of content.ids("unlockRules")) {
    const rule = content.unlockRules[ruleId];
    if (save.completedUnlockRules.includes(rule.id)) continue;
    const progress = progressForRule(save, run, rule);
    if (!progress.completed) continue;
    const reward = applyUnlockReward(save, rule, content);
    pushUnique(save.completedUnlockRules, rule.id);
    unlocked.push({
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      reward,
      progress
    });
  }
  return unlocked;
}

class UnlockSystem {
  constructor(content) {
    if (!content || typeof content.ids !== "function" || typeof content.get !== "function") {
      throw new TypeError("UnlockSystem requires a content registry");
    }
    this.content = content;
  }

  conditionValue(save, run, condition) {
    return conditionValue(save, run, condition);
  }

  progressForRule(save, run, ruleOrId) {
    const rule = typeof ruleOrId === "string" ? this.content.get("unlockRules", ruleOrId) : ruleOrId;
    return progressForRule(save, run, rule);
  }

  reconcile(save) {
    return reconcileOwnedUnlocks(save, this.content);
  }

  evaluate(save, run = null) {
    return evaluateUnlockRules(save, run, this.content);
  }
}

module.exports = {
  UNLOCK_METRICS,
  ensureUnlockState,
  conditionValue,
  progressForRule,
  rewardName,
  applyUnlockReward,
  reconcileOwnedUnlocks,
  evaluateUnlockRules,
  UnlockSystem
};
