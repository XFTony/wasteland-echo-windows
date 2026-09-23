"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultSave } = require("../src/core/save");
const {
  MasterySystem,
  masteryLevelForExperience,
  nextMasteryReward
} = require("../src/core/mastery-system");

test("mastery thresholds and reward preview remain stable", () => {
  assert.equal(masteryLevelForExperience(0), 1);
  assert.equal(masteryLevelForExperience(50), 2);
  assert.equal(masteryLevelForExperience(2800), 10);
  assert.equal(nextMasteryReward(1).level, 2);
  assert.equal(nextMasteryReward(9).level, 10);
  assert.equal(nextMasteryReward(10), null);
});

test("crossing mastery levels grants currency, evolution access and a badge once", () => {
  const save = createDefaultSave();
  const system = new MasterySystem();
  const rewards = system.grantRewards(save, "scrap_pistol", 1, 10);
  assert.deepEqual(rewards.map((reward) => reward.level), [2, 4, 6, 8, 10]);
  assert.equal(save.currencies.copper, 350);
  assert.equal(save.currencies.gold, 3);
  assert.ok(save.unlockedEvolutions.includes("kineticLoop"));
  assert.ok(save.masteryBadges.includes("scrap_pistol"));
  assert.equal(system.grantRewards(save, "scrap_pistol", 1, 10).length, 0);
});

test("claimed mastery perks compose onto the selected weapon only", () => {
  const save = createDefaultSave();
  const system = new MasterySystem();
  system.grantRewards(save, "scrap_pistol", 1, 10);
  const mastered = { copperMultiplier: 1, damageMultiplier: 1, criticalChance: 0, scrapMultiplier: 1 };
  const fresh = { copperMultiplier: 1, damageMultiplier: 1, criticalChance: 0, scrapMultiplier: 1 };
  system.applyPerks(mastered, save, "scrap_pistol");
  system.applyPerks(fresh, save, "swarm_smg");
  assert.equal(mastered.copperMultiplier, 1.05);
  assert.equal(mastered.damageMultiplier, 1.04);
  assert.equal(mastered.criticalChance, 0.03);
  assert.equal(mastered.scrapMultiplier, 1.1);
  assert.deepEqual(fresh, { copperMultiplier: 1, damageMultiplier: 1, criticalChance: 0, scrapMultiplier: 1 });
});

test("legacy mastery experience backfills a stale level and its missed rewards", () => {
  const save = createDefaultSave();
  save.weaponMastery.needle_rifle = { kills: 600, runs: 8, experience: 750, level: 1 };
  const system = new MasterySystem();
  const rewards = system.reconcile(save);
  assert.equal(save.weaponMastery.needle_rifle.level, 6);
  assert.deepEqual(rewards.map((reward) => reward.level), [2, 4, 6]);
  assert.ok(save.unlockedEvolutions.includes("penetratorDoctrine"));
});
