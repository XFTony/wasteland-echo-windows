"use strict";

const { ensureWallet, calculateRunPayout } = require("./economy");
const { markStageCompleted, syncCampaignUnlocks } = require("./campaign");
const {
  MASTERY_THRESHOLDS,
  masteryLevelForExperience,
  MasterySystem
} = require("./mastery-system");
const { UnlockSystem } = require("./unlock-system");
const { UNLOCK_RULES } = require("../content/unlock-rules");

const ACHIEVEMENTS = Object.freeze([
  Object.freeze({ id: "first_signal", name: "第一束信号", description: "首次生存达到 3 分钟", reward: { copper: 200 }, meets: (save) => save.bestTime >= 180 || save.wins >= 1 }),
  Object.freeze({ id: "steady_hands", name: "稳住呼吸", description: "单局连续 120 秒未受伤", reward: { copper: 180 }, meets: (save) => save.bestNoHitTime >= 120 }),
  Object.freeze({ id: "three_returns", name: "三次归来", description: "结算3次有效生存（30秒或击败10名敌人）", reward: { copper: 400, gold: 1 }, meets: (save) => save.settledRuns >= 3 || save.wins >= 3 }),
  Object.freeze({ id: "scrap_hundred", name: "清道夫", description: "累计击败 100 名感染者", reward: { copper: 250 }, meets: (save) => save.totalKills >= 100 }),
  Object.freeze({ id: "scrap_five_hundred", name: "荒原收割者", description: "累计击败 500 名感染者", reward: { copper: 700, gold: 1 }, meets: (save) => save.totalKills >= 500 }),
  Object.freeze({ id: "elite_breaker", name: "破甲记录", description: "累计击败 25 名精英", reward: { copper: 500, gold: 1 }, meets: (save) => save.eliteKills >= 25 }),
  Object.freeze({ id: "endless_three", name: "第三声警报", description: "单局实际击败 3 名首领", reward: { copper: 650, gold: 2 }, meets: (_save, run) => run.bossesDefeated >= 3 }),
  Object.freeze({ id: "field_armory", name: "流动军械库", description: "解锁 5 把武器", reward: { copper: 450 }, meets: (save) => save.unlockedWeapons.length >= 5 })
]);
const DEFAULT_MASTERY_SYSTEM = new MasterySystem();

function calculateAccuracy(run) {
  const projectiles = Math.max(0, Number(run.projectilesFired) || 0);
  if (projectiles === 0) return 0;
  return Math.min(1, Math.max(0, (Number(run.hits) || 0) / projectiles));
}

function updateWeaponMastery(save, run, result, masterySystem = DEFAULT_MASTERY_SYSTEM) {
  if (result === "retire" && Number(run.elapsed) < 10 && !(run.shotsFired > 0)) {
    run.masteryGain = 0; run.masteryRewards = [];
    run.masteryLevel = save.weaponMastery?.[run.player.weaponId]?.level || 1;
    return save.weaponMastery?.[run.player.weaponId] || { kills: 0, runs: 0, experience: 0, level: 1 };
  }
  const used = Object.entries(run.weaponStats || {}).filter(([_id, stats]) => stats.shots > 0);
  if (used.length) {
    const rewards = []; let total = 0, selected = null;
    for (const [id, stats] of used) {
      const contribution = { player: { weaponId: id }, kills: stats.kills, damageDealt: stats.damage, eliteKills: stats.eliteKills || 0 };
      const record = updateWeaponMastery(save, contribution, result, masterySystem);
      total += contribution.masteryGain; rewards.push(...contribution.masteryRewards);
      if (id === run.player.weaponId) selected = record;
    }
    run.masteryGain = total; run.masteryRewards = rewards;
    run.masteryLevel = selected ? selected.level : (save.weaponMastery[run.player.weaponId]?.level || 1);
    return selected || save.weaponMastery[used[0][0]];
  }
  if (!save.weaponMastery || typeof save.weaponMastery !== "object" || Array.isArray(save.weaponMastery)) save.weaponMastery = {};
  const weaponId = run.player && run.player.weaponId || "scrap_pistol";
  const previous = save.weaponMastery[weaponId] || { kills: 0, runs: 0, experience: 0, level: 1 };
  const previousLevel = Math.max(1, Math.min(10, Number(previous.level) || masteryLevelForExperience(previous.experience)));
  const gain = Math.max(1,
    Math.max(0, Number(run.kills) || 0)
    + Math.max(0, Number(run.eliteKills) || 0) * 4
    + Math.floor(Math.max(0, Number(run.damageDealt) || 0) / 250)
    + (result === "win" ? 20 : 5)
  );
  const record = {
    kills: Math.max(0, Number(previous.kills) || 0) + Math.max(0, Number(run.kills) || 0),
    runs: Math.max(0, Number(previous.runs) || 0) + 1,
    experience: Math.max(0, Number(previous.experience) || 0) + gain,
    level: 1
  };
  record.level = masteryLevelForExperience(record.experience);
  save.weaponMastery[weaponId] = record;
  run.masteryGain = gain;
  run.masteryLevel = record.level;
  run.masteryRewards = masterySystem.grantRewards(save, weaponId, previousLevel, record.level);
  return record;
}

function recordRunHistory(save, run, result) {
  if (!Array.isArray(save.runHistory)) save.runHistory = [];
  run.accuracy = calculateAccuracy(run);
  save.runHistory.unshift({
    seed: Math.max(0, Math.floor(Number(run.seed) || 0)),
    modeId: run.modeId,
    stageId: run.stageId,
    mapId: run.mapId,
    weaponId: run.player && run.player.weaponId,
    result,
    bossesDefeated: run.bossesDefeated || 0,
    elapsed: Math.max(0, Number(run.elapsed) || 0),
    kills: Math.max(0, Math.floor(Number(run.kills) || 0)),
    damageDealt: Math.max(0, Number(run.damageDealt) || 0),
    accuracy: run.accuracy,
    maxNoHitTime: Math.max(0, Number(run.maxNoHitTime) || 0),
    masteryGain: Math.max(0, Math.floor(Number(run.masteryGain) || 0)),
    masteryLevel: Math.max(1, Math.floor(Number(run.masteryLevel) || 1)),
    completedAt: Date.now()
  });
  if (save.runHistory.length > 20) save.runHistory.length = 20;
}

function calculateRunReward(run, mode, result) {
  return run.scrap + Math.floor(run.kills / 10) + (result === "win" ? Number(mode.winReward) || 0 : 0);
}

function applyRunProgress(save, run, duration, mode, result, content, stage = null, systems = {}) {
  const masterySystem = systems.masterySystem || DEFAULT_MASTERY_SYSTEM;
  const unlockSystem = systems.unlockSystem || new UnlockSystem(content);
  const beforeMaps = new Set(save.unlockedMaps || []);
  const beforeHeroes = new Set(save.unlockedHeroes || []);
  const earned = calculateRunReward(run, mode, result);
  save.scrap += earned;
  save.totalScrap += earned;
  save.totalKills += run.kills;
  save.eliteKills += run.eliteKills;
  save.bestTime = Math.max(save.bestTime, run.elapsed);
  if (run.elapsed >= 30 || run.kills >= 10) save.settledRuns = (save.settledRuns || 0) + 1;
  save.bossesDefeated = (save.bossesDefeated || 0) + (run.bossesDefeated || 0);
  if (!save.survivalRecords) save.survivalRecords = {};
  const previous = save.survivalRecords[run.mapId] || { bestTime: 0, bestKills: 0, runs: 0 };
  save.survivalRecords[run.mapId] = { bestTime: Math.max(previous.bestTime, run.elapsed), bestKills: Math.max(previous.bestKills, run.kills), runs: previous.runs + 1 };
  save.bestNoHitTime = Math.max(save.bestNoHitTime, Number(run.maxNoHitTime) || Number(run.player.noHitTime) || 0);
  if (result === "win") save.wins += 1;

  const campaign = result === "win"
    ? markStageCompleted(save, run.stageId || (stage && stage.id), content)
    : { firstClear: false, ...syncCampaignUnlocks(save, content) };
  const payout = calculateRunPayout(run, stage, mode, result);
  if (!campaign.firstClear) payout.gold = 0;
  const wallet = ensureWallet(save);
  wallet.copper += payout.copper;
  wallet.gold += payout.gold;
  save.totalCopper = (Number(save.totalCopper) || 0) + payout.copper;
  save.totalGold = (Number(save.totalGold) || 0) + payout.gold;

  if (!save.achievements || typeof save.achievements !== "object" || Array.isArray(save.achievements)) save.achievements = {};
  const achievementUnlocks = [];
  for (const achievement of ACHIEVEMENTS) {
    if (save.achievements[achievement.id] || !achievement.meets(save, run, result)) continue;
    save.achievements[achievement.id] = true;
    const copper = Number(achievement.reward.copper) || 0;
    const gold = Number(achievement.reward.gold) || 0;
    wallet.copper += copper;
    wallet.gold += gold;
    save.totalCopper += copper;
    save.totalGold += gold;
    achievementUnlocks.push({ id: achievement.id, name: achievement.name, copper, gold });
  }

  const masteryRecord = updateWeaponMastery(save, run, result, masterySystem);
  const ruleUnlocks = unlockSystem.evaluate(save, run);
  run.unlockRewards = ruleUnlocks;
  const unlocked = [];
  for (const mapId of save.unlockedMaps || []) {
    if (!beforeMaps.has(mapId)) {
      const map = content.get("maps", mapId);
      if (map) unlocked.push(`地图：${map.name}`);
    }
  }
  for (const heroId of save.unlockedHeroes || []) {
    if (!beforeHeroes.has(heroId)) {
      const hero = content.get("heroes", heroId);
      if (hero) unlocked.push(`角色：${hero.name}`);
    }
  }
  for (const achievement of achievementUnlocks) unlocked.push(`成就：${achievement.name}`);
  for (const unlock of ruleUnlocks) unlocked.push(`规则：${unlock.name} · ${unlock.reward.name}`);
  for (const reward of run.masteryRewards) unlocked.push(`精通 Lv.${reward.level}：${reward.name}`);
  recordRunHistory(save, run, result);
  return {
    earned,
    unlocked,
    payout,
    campaign,
    achievementUnlocks,
    masteryRecord,
    masteryRewards: run.masteryRewards,
    ruleUnlocks
  };
}

module.exports = {
  UNLOCK_RULES,
  ACHIEVEMENTS,
  MASTERY_THRESHOLDS,
  masteryLevelForExperience,
  calculateAccuracy,
  updateWeaponMastery,
  recordRunHistory,
  calculateRunReward,
  applyRunProgress
};
