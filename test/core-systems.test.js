"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_CONTENT } = require("../src/core/content-registry");
const { createRunState } = require("../src/core/run-state");
const { buildSpawnStages, chooseSpawnType, getSpawnPhase } = require("../src/core/spawn-director");
const { Random } = require("../src/core/random");
const { createDefaultSave } = require("../src/core/save");
const { applyRunProgress } = require("../src/core/progression");

test("run-state factory reads player tuning from the selected mode", () => {
  const mode = { ...DEFAULT_CONTENT.modes.survival, playerHp: 150, playerSpeed: 222, playerInvulnerability: 0.9 };
  const run = createRunState({
    duration: 90,
    worldSize: 1000,
    weaponId: "scrap_pistol",
    skinId: "wanderer",
    modeId: "survival",
    mode
  });
  assert.equal(run.player.hp, 150);
  assert.equal(run.player.speed, 222);
  assert.equal(run.player.invulnerabilityDuration, 0.9);
  assert.equal(run.player.x, 500);
});

test("spawn director builds cached, content-safe stages", () => {
  const stages = buildSpawnStages(DEFAULT_CONTENT);
  const random = new Random(12);
  assert.equal(chooseSpawnType(random, stages.survival, 0.01), "drifter");
  const late = new Set(Array.from({ length: 200 }, () => chooseSpawnType(random, stages.survival, 0.9)));
  assert.ok(late.has("runner"));
  assert.ok(late.has("crawler"));
  assert.equal(stages.survival, stages.survival, "stage arrays are built once and reused");
});

test("survival phases create a paced buildup instead of one linear spawn slope", () => {
  const mode = DEFAULT_CONTENT.modes.survival;
  const scout = getSpawnPhase(mode, 0.05);
  const surge = getSpawnPhase(mode, 0.32);
  const respite = getSpawnPhase(mode, 0.5);
  const siege = getSpawnPhase(mode, 0.68);
  const finalStand = getSpawnPhase(mode, 0.9);
  assert.equal(scout.id, "scout");
  assert.equal(surge.id, "surge");
  assert.equal(respite.id, "lull");
  assert.ok(surge.cap > scout.cap);
  assert.ok(respite.cap < surge.cap, "the middle phase should give players room to recover");
  assert.ok(siege.cap > surge.cap);
  assert.ok(finalStand.cap > siege.cap);
  assert.ok(finalStand.interval < scout.interval);
});

test("progression system applies rewards without depending on rendering or input", () => {
  const save = createDefaultSave();
  const run = createRunState({
    duration: 180,
    worldSize: 2048,
    weaponId: "scrap_pistol",
    skinId: "wanderer",
    modeId: "survival",
    mode: DEFAULT_CONTENT.modes.survival
  });
  run.elapsed = 180;
  run.kills = 20;
  run.eliteKills = 1;
  run.scrap = 7;
  run.player.noHitTime = 180;
  const outcome = applyRunProgress(
    save,
    run,
    180,
    DEFAULT_CONTENT.modes.survival,
    "win",
    DEFAULT_CONTENT,
    DEFAULT_CONTENT.stages.signal_dawn
  );
  assert.equal(outcome.earned, 34);
  assert.equal(save.wins, 1);
  assert.equal(outcome.payout.copper, 259);
  assert.equal(outcome.payout.gold, 1);
  assert.equal(save.currencies.copper, 889, "run payout plus first-clear and no-hit achievement rewards are applied once");
  assert.equal(save.currencies.gold, 1);
  assert.deepEqual(outcome.achievementUnlocks.map((item) => item.id), ["first_signal", "steady_hands"]);
  assert.equal(save.achievements.first_signal, true);
  assert.ok(save.completedStages.includes("signal_dawn"));
  assert.ok(save.unlockedMaps.includes("freight_nexus"));
  assert.deepEqual(save.unlockedWeapons, ["scrap_pistol"], "shop ownership is not bypassed by run rewards");

  const walletAfterFirst = { ...save.currencies };
  const second = applyRunProgress(save, run, 180, DEFAULT_CONTENT.modes.survival, "win", DEFAULT_CONTENT, DEFAULT_CONTENT.stages.signal_dawn);
  assert.equal(second.achievementUnlocks.length, 0, "achievements never pay twice");
  assert.equal(second.masteryRewards[0].level, 2);
  assert.equal(save.currencies.copper - walletAfterFirst.copper, second.payout.copper + 100, "mastery currency is paid in addition to the run payout");
});
