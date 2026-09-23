"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultSave } = require("../src/core/save");
const { DEFAULT_CONTENT } = require("../src/core/content-registry");
const { UnlockSystem } = require("../src/core/unlock-system");

test("fifteen data-driven rules expose deterministic progress", () => {
  const save = createDefaultSave();
  save.totalKills = 300;
  save.completedStages.push("dead_rail");
  const system = new UnlockSystem(DEFAULT_CONTENT);
  assert.equal(DEFAULT_CONTENT.ids("unlockRules").length, 15);
  const progress = system.progressForRule(save, null, "blueprint_needle");
  assert.equal(progress.completed, false);
  assert.equal(progress.completedConditions, 1);
  assert.equal(progress.conditions.find((condition) => condition.metric === "totalKills").ratio, 0.75);
});

test("rule evaluation grants blueprints, heroes and modifiers exactly once", () => {
  const save = createDefaultSave();
  save.totalKills = 500;
  save.eliteKills = 12;
  save.wins = 3;
  save.bestNoHitTime = 130;
  save.completedStages.push("dead_rail", "red_storm");
  save.weaponMastery.scrap_pistol = { kills: 500, runs: 8, experience: 1200, level: 7 };
  const system = new UnlockSystem(DEFAULT_CONTENT);
  const first = system.evaluate(save, { endlessBossWave: 3, maxNoHitTime: 130, player: { noHitTime: 130 } });
  assert.equal(first.length, 15);
  assert.equal(save.completedUnlockRules.length, 15);
  assert.equal(save.unlockedBlueprints.length, 10);
  assert.ok(save.unlockedBlueprints.includes("buy_coil_cannon"));
  assert.ok(save.unlockedHeroes.includes("bulwark"));
  assert.deepEqual(new Set(save.unlockedModifiers), new Set(["scarcity", "redline", "ironman", "boss_rush"]));
  assert.equal(system.evaluate(save, { endlessBossWave: 3 }).length, 0);
});

test("legacy ownership reconciles a blueprint without revoking the item", () => {
  const save = createDefaultSave();
  save.unlockedWeapons.push("breaker_shotgun");
  const system = new UnlockSystem(DEFAULT_CONTENT);
  system.reconcile(save);
  assert.ok(save.unlockedBlueprints.includes("buy_breaker_shotgun"));
  assert.ok(save.completedUnlockRules.includes("blueprint_breaker"));
});
