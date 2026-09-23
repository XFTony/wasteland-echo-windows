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
  Object.freeze({ id: "first_signal", name: "第一束信号", description: "首次完成章节", reward: { copper: 200 }, meets: (save) => save.wins >= 1 }),
  Object.freeze({ id: "steady_hands", name: "稳住呼吸", description: "单局连续 120 秒未受伤", reward: { copper: 180 }, meets: (save) => save.bestNoHitTime >= 120 }),
  Object.freeze({ id: "three_returns", name: "三次归来", description: "完成 3 次章节", reward: { copper: 400, gold: 1 }, meets: (save) => save.wins >= 3 }),
  Object.freeze({ id: "scrap_hundred", name: "清道夫", description: "累计击败 100 名感染者", reward: { copper: 250 }, meets: (save) => save.totalKills >= 100 }),
  Object.freeze({ id: "scrap_five_hundred", name: "荒原收割者", description: "累计击败 500 名感染者", reward: { copper: 700, gold: 1 }, meets: (save) => save.totalKills >= 500 }),
  Object.freeze({ id: "elite_breaker", name: "破甲记录", description: "累计击败 25 名精英", reward: { copper: 500, gold: 1 }, meets: (save) => save.eliteKills >= 25 }),
  Object.freeze({ id: "endless_three", name: "第三声警报", description: "无尽模式击退 3 波 Boss", reward: { copper: 650, gold: 2 }, meets: (_save, run) => run.endlessBossWave >= 3 }),
  Object.freeze({ id: "field_armory", name: "流动军械库", description: "解锁 5 把武器", reward: { copper: 450 }, meets: (save) => save.unlockedWeapons.length >= 5 })
]);
const DEFAULT_MASTERY_SYSTEM = new MasterySystem();

function calculateAccuracy(run) {
  const projectiles = Math.max(0, Number(run.projectilesFired) || 0);
  if (projectiles === 0) return 0;
  return Math.min(1, Math.max(0, (Number(run.hits) || 0) / projectiles));
}

function updateWeaponMastery(save, run, result, masterySystem = DEFAULT_MASTERY_SYSTEM) {
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
    weaponId: run.player && run.player.weaponId,
    result: result === "win" ? "win" : "lose",
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
  save.bestTime = Math.max(save.bestTime, Math.min(run.elapsed, duration));
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
