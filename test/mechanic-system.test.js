"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_CONTENT } = require("../src/core/content-registry");
const { createMechanicState, MechanicSystem } = require("../src/core/mechanic-system");

function createHarness() {
  const events = [];
  const damage = [];
  const host = {
    enemies: [],
    emit(type, data) { events.push({ type, ...data }); },
    damageEnemy(enemy, amount, source) { damage.push({ enemy, amount, source }); }
  };
  const system = new MechanicSystem(host, DEFAULT_CONTENT);
  const run = {
    elapsed: 0,
    player: { noHitTime: 0 },
    input: { moveX: 0, moveY: 0 },
    mechanics: createMechanicState(),
    mechanicUpgrades: {}
  };
  return { host, system, run, events, damage };
}

test("all seven weapons resolve to a distinct built-in mechanic", () => {
  const ids = DEFAULT_CONTENT.ids("weapons").map((id) => DEFAULT_CONTENT.weapons[id].mechanicId);
  assert.equal(ids.length, 7);
  assert.equal(new Set(ids).size, 7);
  for (const id of ids) assert.ok(DEFAULT_CONTENT.mechanics[id]);
});

test("cadence mechanics trigger on their documented shot counts", () => {
  const { system, run } = createHarness();
  const pistol = DEFAULT_CONTENT.weapons.scrap_pistol;
  for (let index = 0; index < 3; index += 1) assert.equal(system.beforeShot(run, pistol).forceCritical, false);
  const fourth = system.beforeShot(run, pistol);
  assert.equal(fourth.forceCritical, true);
  assert.equal(fourth.procLabel, "四拍稳压");

  run.mechanics = createMechanicState();
  const revolver = DEFAULT_CONTENT.weapons.rust_revolver;
  for (let index = 0; index < 5; index += 1) system.beforeShot(run, revolver);
  assert.equal(system.beforeShot(run, revolver).forceCritical, true);
});

test("mechanic upgrades respond to kill, pickup, hit and critical events", () => {
  const { host, system, run, events, damage } = createHarness();
  for (const id of ["executionCapacitor", "salvageOverdrive", "reactivePlating", "cascadeRounds"]) {
    system.enableUpgrade(run, id, 3);
  }
  for (let index = 0; index < 6; index += 1) system.onKill(run);
  assert.equal(run.mechanics.chargedShots, 1);
  system.onPickup(run, "xp");
  assert.ok(run.mechanics.overdriveTime > 0);

  const near = { id: 1, active: true, x: 20, y: 0 };
  const chain = { id: 2, active: true, x: 40, y: 0 };
  host.enemies.push(near, chain);
  run.player.x = 0;
  run.player.y = 0;
  system.onPlayerHit(run, -10, 0);
  assert.equal(damage.length, 2);
  system.onCriticalHit(run, near, { critical: true, mechanicChain: false }, 100);
  assert.equal(damage.length, 3);
  assert.ok(events.some((event) => event.type === "mechanicReady"));
  assert.ok(events.some((event) => event.type === "mechanicProc"));
});
