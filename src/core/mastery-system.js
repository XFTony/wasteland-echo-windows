"use strict";

const { ensureWallet } = require("./economy");
const { WEAPON_EVOLUTION_REWARDS, MASTERY_REWARD_LEVELS } = require("../content/mastery-rewards");

const MASTERY_THRESHOLDS = Object.freeze([0, 50, 140, 280, 480, 750, 1100, 1550, 2100, 2800]);

function masteryLevelForExperience(experience) {
  const value = Math.max(0, Number(experience) || 0);
  let level = 1;
  for (let index = 1; index < MASTERY_THRESHOLDS.length; index += 1) {
    if (value < MASTERY_THRESHOLDS[index]) break;
    level = index + 1;
  }
  return level;
}

function ensureMasteryRewardState(save) {
  if (!Array.isArray(save.claimedMasteryRewards)) save.claimedMasteryRewards = [];
  if (!Array.isArray(save.unlockedEvolutions)) save.unlockedEvolutions = [];
  if (!Array.isArray(save.masteryBadges)) save.masteryBadges = [];
  return save;
}

function pushUnique(list, value) {
  if (!list.includes(value)) {
    list.push(value);
    return true;
  }
  return false;
}

function masteryClaimId(weaponId, rewardId) {
  return `${weaponId}:${rewardId}`;
}

function nextMasteryReward(level) {
  const current = Math.max(1, Math.floor(Number(level) || 1));
  return MASTERY_REWARD_LEVELS.find((reward) => reward.level > current) || null;
}

function grantMasteryRewards(save, weaponId, previousLevel, newLevel, evolutionRewards = WEAPON_EVOLUTION_REWARDS) {
  ensureMasteryRewardState(save);
  const from = Math.max(1, Math.floor(Number(previousLevel) || 1));
  const to = Math.max(from, Math.min(10, Math.floor(Number(newLevel) || from)));
  const wallet = ensureWallet(save);
  const granted = [];
  for (const reward of MASTERY_REWARD_LEVELS) {
    if (reward.level <= from || reward.level > to) continue;
    const claimId = masteryClaimId(weaponId, reward.id);
    if (save.claimedMasteryRewards.includes(claimId)) continue;
    pushUnique(save.claimedMasteryRewards, claimId);
    const copper = Math.max(0, Math.floor(Number(reward.copper) || 0));
    const gold = Math.max(0, Math.floor(Number(reward.gold) || 0));
    wallet.copper += copper;
    wallet.gold += gold;
    save.totalCopper = Math.max(0, Number(save.totalCopper) || 0) + copper;
    save.totalGold = Math.max(0, Number(save.totalGold) || 0) + gold;
    const evolutions = reward.evolutionAccess ? (evolutionRewards[weaponId] || []) : [];
    for (const evolutionId of evolutions) pushUnique(save.unlockedEvolutions, evolutionId);
    if (reward.badge) pushUnique(save.masteryBadges, weaponId);
    granted.push({
      weaponId,
      claimId,
      level: reward.level,
      id: reward.id,
      name: reward.name,
      description: reward.description,
      copper,
      gold,
      evolutions: [...evolutions],
      badge: Boolean(reward.badge)
    });
  }
  return granted;
}

function rewardClaimed(save, weaponId, reward) {
  return Array.isArray(save.claimedMasteryRewards)
    && save.claimedMasteryRewards.includes(masteryClaimId(weaponId, reward.id));
}

function applyMasteryPerks(player, save, weaponId) {
  ensureMasteryRewardState(save);
  const applied = [];
  for (const reward of MASTERY_REWARD_LEVELS) {
    if (!rewardClaimed(save, weaponId, reward)) continue;
    if (Number(reward.copperMultiplier)) player.copperMultiplier *= 1 + Number(reward.copperMultiplier);
    if (Number(reward.damageMultiplier)) player.damageMultiplier *= 1 + Number(reward.damageMultiplier);
    if (Number(reward.criticalChance)) player.criticalChance += Number(reward.criticalChance);
    if (Number(reward.scrapMultiplier)) player.scrapMultiplier *= 1 + Number(reward.scrapMultiplier);
    if (reward.copperMultiplier || reward.damageMultiplier || reward.criticalChance || reward.scrapMultiplier) applied.push(reward.id);
  }
  player.criticalChance = Math.max(0, Math.min(0.75, Number(player.criticalChance) || 0));
  return applied;
}

function reconcileMasteryRewards(save, evolutionRewards = WEAPON_EVOLUTION_REWARDS) {
  ensureMasteryRewardState(save);
  const granted = [];
  const records = save.weaponMastery && typeof save.weaponMastery === "object" && !Array.isArray(save.weaponMastery)
    ? save.weaponMastery
    : {};
  for (const [weaponId, record] of Object.entries(records)) {
    const storedLevel = Math.floor(Number(record && record.level) || 1);
    const level = Math.max(1, Math.min(10, Math.max(storedLevel, masteryLevelForExperience(record && record.experience))));
    record.level = level;
    granted.push(...grantMasteryRewards(save, weaponId, 1, level, evolutionRewards));
  }
  return granted;
}

class MasterySystem {
  constructor(contentOrRewards = null) {
    this.evolutionRewards = contentOrRewards && contentOrRewards.masteryEvolutionRewards
      ? contentOrRewards.masteryEvolutionRewards
      : contentOrRewards || WEAPON_EVOLUTION_REWARDS;
  }

  grantRewards(save, weaponId, previousLevel, newLevel) {
    return grantMasteryRewards(save, weaponId, previousLevel, newLevel, this.evolutionRewards);
  }

  applyPerks(player, save, weaponId) {
    return applyMasteryPerks(player, save, weaponId);
  }

  reconcile(save) {
    return reconcileMasteryRewards(save, this.evolutionRewards);
  }

  nextReward(level) {
    return nextMasteryReward(level);
  }
}

module.exports = {
  MASTERY_THRESHOLDS,
  masteryLevelForExperience,
  ensureMasteryRewardState,
  masteryClaimId,
  nextMasteryReward,
  grantMasteryRewards,
  applyMasteryPerks,
  reconcileMasteryRewards,
  MasterySystem
};
