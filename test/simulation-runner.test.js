"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { STRATEGIES, runSimulation } = require("../scripts/simulation-runner");

function deterministicView(result) {
  return {
    simulatedSeconds: result.simulatedSeconds,
    result: result.result,
    finalHp: result.finalHp,
    kills: result.kills,
    level: result.level,
    damageDealt: result.damageDealt,
    damageTaken: result.damageTaken,
    damageTakenBySource: result.damageTakenBySource,
    upgradeOrder: result.upgradeOrder,
    phaseTimeline: result.phaseTimeline,
    maxEnemies: result.maxEnemies,
    maxProjectiles: result.maxProjectiles,
    maxPickups: result.maxPickups
  };
}

test("simulation runner exposes the requested strategy matrix and telemetry", () => {
  assert.deepEqual(STRATEGIES, ["default", "kite", "facehug", "extract-only", "no-magnet", "random-upgrade"]);
  for (const strategy of STRATEGIES) {
    const result = runSimulation({ duration: 3, seed: 77, modeId: strategy === "extract-only" ? "extraction" : "survival", strategy, healthProfile: "normal" });
    assert.equal(result.strategy, strategy);
    assert.equal(result.healthProfile, "normal");
    assert.equal(result.seed, 77);
    assert.ok(result.simulatedSeconds > 0);
    assert.equal(Array.isArray(result.upgradeOrder), true);
    assert.equal(typeof result.damageTakenBySource, "object");
  }
});

test("random-upgrade simulation remains deterministic for gameplay metrics", () => {
  const options = { duration: 20, seed: 20260921, modeId: "survival", strategy: "random-upgrade", healthProfile: "normal" };
  const first = runSimulation(options);
  const second = runSimulation(options);
  assert.deepEqual(deterministicView(first), deterministicView(second));
});
