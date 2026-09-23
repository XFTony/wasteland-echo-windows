"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Random } = require("../src/core/random");
const { DEFAULT_CONTENT } = require("../src/core/content-registry");
const { SpawnSystem } = require("../src/core/spawn-system");

test("spawn system owns stage selection and boss scheduling behind a narrow host", () => {
  const events = [];
  const enemies = [];
  const host = {
    duration: 60,
    worldSize: 1024,
    random: new Random(91),
    enemies,
    run: {
      elapsed: 54,
      endless: false,
      rule: "survive",
      modeId: "survival",
      spawnProfile: "survival",
      spawnAccumulator: 0,
      spawnPhaseIndex: -1,
      bossOneSpawned: false,
      bossTwoSpawned: false,
      finalWaveAnnounced: false,
      player: { x: 512, y: 512 },
      extraction: { active: false }
    },
    spawnEnemy(type, x, y) {
      const enemy = { id: enemies.length + 1, type, x, y, active: true };
      enemies.push(enemy);
      return enemy;
    },
    emit(type, data) { events.push({ type, ...data }); },
    bossSystem: {
      spawnEvent(enemy, wave) { return { phase: wave, enemyId: enemy.id, enemyType: enemy.type, name: enemy.type }; }
    }
  };
  const system = new SpawnSystem(host, DEFAULT_CONTENT);
  system.update(1);
  assert.equal(host.run.bossOneSpawned, true);
  assert.ok(events.some((event) => event.type === "boss" && event.enemyType === "iron_colossus"));
  assert.ok(events.some((event) => event.type === "spawnPhase"));
  assert.ok(system.stages.survival.length > 1);
});
