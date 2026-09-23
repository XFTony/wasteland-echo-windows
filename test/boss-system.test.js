"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_CONTENT } = require("../src/core/content-registry");
const { BossSystem } = require("../src/core/boss-system");

function harness() {
  const calls = [];
  const host = {
    enemies: [],
    emit(type, data) { calls.push(["emit", type, data]); },
    radialAttack(enemy, count, speed, damage) { calls.push(["radial", enemy.id, count, speed, damage]); },
    spawnEnemyShot(enemy, x, y, speed, damage) { calls.push(["shot", enemy.id, x, y, speed, damage]); },
    spawnEnemy(type, x, y) { calls.push(["spawn", type, x, y]); return { id: 90, type, active: true }; },
    spawnPickup(type, x, y, value) { calls.push(["pickup", type, value]); return { type, x, y, value }; }
  };
  return { host, calls, system: new BossSystem(host, DEFAULT_CONTENT) };
}

test("boss definitions drive phases, attacks, warnings and drops", () => {
  const { host, calls, system } = harness();
  const enemy = {
    id: 7,
    type: "iron_colossus",
    hp: 120,
    maxHp: 430,
    x: 10,
    y: 20,
    actionCooldown: 0,
    bossPhase: 0,
    bossPhaseId: null
  };
  host.enemies.push(enemy);
  assert.equal(system.phaseFor(enemy).id, "frenzy");
  assert.equal(system.update(enemy, 1, 0), true);
  assert.equal(enemy.bossPhase, 3);
  assert.equal(enemy.actionCooldown, 1.95);
  assert.ok(calls.some((call) => call[0] === "radial" && call[2] === 20));
  assert.ok(calls.some((call) => call[0] === "shot"));
  assert.ok(calls.some((call) => call[0] === "spawn" && call[1] === "drifter"));
  assert.ok(calls.some((call) => call[0] === "emit" && call[1] === "bossPhase" && call[2].warning));
  const drops = system.drop(enemy);
  assert.equal(drops.length, 2);
  assert.ok(calls.some((call) => call[0] === "pickup" && call[1] === "scrap" && call[2] === 36));
});

test("warden is a complete two-phase boss rather than a numeric elite", () => {
  const { system } = harness();
  const definition = DEFAULT_CONTENT.bossForEnemy("warden");
  assert.equal(definition.phases.length, 2);
  assert.equal(definition.phases[1].aimedShot.damage, 14);
  const event = system.spawnEvent({ id: 3, type: "warden" }, 2);
  assert.equal(event.name, "荒原看守");
  assert.equal(event.bossId, "warden_protocol");
});
