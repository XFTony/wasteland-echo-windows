"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ENEMY_ROLE_PROFILES,
  profileFor,
  computeEnemySteering
} = require("../src/core/enemy-brain");

function enemy(overrides = {}) {
  return {
    x: 0,
    y: 0,
    radius: 10,
    role: "chaser",
    navigationTime: 0,
    hp: 100,
    maxHp: 100,
    ...overrides
  };
}

test("enemy role behavior is data-driven and immutable", () => {
  assert.equal(Object.isFrozen(ENEMY_ROLE_PROFILES), true);
  assert.equal(Object.isFrozen(ENEMY_ROLE_PROFILES.runner.dash), true);
  assert.equal(profileFor("runner").dash.action, "dash");
  assert.equal(profileFor("tank").dash.action, "charge");
  assert.deepEqual(profileFor("boss"), {}, "BossDefinition is the only owner of boss attacks and phases");
  assert.equal(profileFor("unknown"), ENEMY_ROLE_PROFILES.chaser);
});

test("ranged steering retreats, strafes and otherwise approaches", () => {
  const output = {};
  const ranged = enemy({ role: "ranged" });
  computeEnemySteering(ranged, { x: 100, y: 0 }, null, output);
  assert.equal(output.directionX, -1);
  computeEnemySteering(ranged, { x: 180, y: 0 }, null, output);
  assert.equal(Math.abs(output.directionX), 0);
  assert.equal(output.directionY, 0.28);
  computeEnemySteering(ranged, { x: 300, y: 0 }, null, output);
  assert.equal(output.directionX, 1);
  assert.equal(output.directionY, 0);
});

test("blocked pursuit blends toward the reusable flow field", () => {
  const output = {};
  const candidate = enemy({ role: "runner" });
  const navigation = {
    grid: {
      cellSize: 64,
      isWorldWalkable: () => false
    },
    flow: {
      sampleIndex: () => 0,
      directionX: new Float32Array([0]),
      directionY: new Float32Array([1])
    }
  };
  computeEnemySteering(candidate, { x: 300, y: 0 }, navigation, output);
  assert.ok(output.directionY > 0.98);
  assert.ok(output.directionX > 0);
  assert.equal(candidate.navigationTime, 1.1);
});
