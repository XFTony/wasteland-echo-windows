"use strict";

const { SaveManager } = require("../src/core/save");
const { GameModel } = require("../src/core/game-model");
const { DEFAULT_RUN_DURATION } = require("../src/config");

const STRATEGIES = Object.freeze(["default", "kite", "facehug", "extract-only", "no-magnet", "random-upgrade"]);
const HEALTH_PROFILES = Object.freeze(["normal", "benchmark", "stress"]);

function finitePositive(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  return length > 0.000001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function chooseUpgrade(model, strategy, seed) {
  const options = model.run.upgradeOptions;
  if (!options.length) return false;
  let candidates = options;
  if (strategy === "no-magnet") {
    const filtered = options.filter((option) => option.id !== "magnet" && option.id !== "recoveryField");
    if (filtered.length) candidates = filtered;
  }
  let choice = candidates[0];
  if (strategy === "random-upgrade") {
    const level = model.run.player.level;
    const hash = (Math.imul(seed ^ level, 2654435761) ^ (level << 11)) >>> 0;
    choice = candidates[hash % candidates.length];
  }
  return model.chooseUpgrade(choice.id);
}

function movementFor(model, strategy, frame) {
  const player = model.run.player;
  const extraction = model.run.extraction;
  if (strategy === "extract-only" || extraction.active) {
    return normalize(extraction.x - player.x, extraction.y - player.y);
  }
  const nearest = model.findNearestEnemy(player.x, player.y, 520);
  const angle = frame / 150;
  if (strategy === "facehug" && nearest) return normalize(nearest.x - player.x, nearest.y - player.y);
  if (strategy === "kite" && nearest) {
    const away = normalize(player.x - nearest.x, player.y - nearest.y);
    return normalize(away.x - away.y * 0.34, away.y + away.x * 0.34);
  }
  if (strategy === "no-magnet") return normalize(Math.cos(angle * 0.74), Math.sin(angle * 1.17));
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function runSimulation(options = {}) {
  const duration = finitePositive(options.duration, DEFAULT_RUN_DURATION);
  const seed = Math.max(1, Math.floor(finitePositive(options.seed, 20260907)));
  const modeId = ["survival", "extraction", "endless"].includes(options.modeId) ? options.modeId : "survival";
  const strategy = STRATEGIES.includes(options.strategy) ? options.strategy : "default";
  const healthProfile = HEALTH_PROFILES.includes(options.healthProfile) ? options.healthProfile : "normal";
  let stored = null;
  const saveManager = new SaveManager({
    get: () => stored,
    set: (_key, value) => { stored = value; }
  });
  const model = new GameModel(saveManager, { duration, seed });
  model.startRun({
    duration,
    seed,
    modeId,
    weaponId: options.weaponId,
    heroId: options.heroId,
    mapId: options.mapId,
    stageId: options.stageId,
    tutorial: false
  });
  model.save.settings.autoAim = options.autoAim !== false;
  model.save.settings.autoFire = options.autoFire !== false;
  if (healthProfile !== "normal") {
    const benchmarkHp = healthProfile === "stress" ? 1000000 : 1000;
    model.run.player.maxHp = benchmarkHp;
    model.run.player.hp = benchmarkHp;
  }

  let maxEnemies = model.enemies.length;
  let maxProjectiles = 0;
  let maxPickups = 0;
  let frames = 0;
  let emittedEvents = 0;
  const phaseTimeline = [];
  const copperCurve = [];
  const bossStarts = new Map();
  const bossEncounters = [];
  const targetFrames = Math.ceil(duration * 60);
  const frameBudget = targetFrames + (modeId === "endless" ? 0 : 20 * 60);
  const startMemory = process.memoryUsage();
  let peakRss = startMemory.rss;
  let peakHeapUsed = startMemory.heapUsed;
  let peakExternal = startMemory.external;

  function sampleMemory() {
    const sample = process.memoryUsage();
    peakRss = Math.max(peakRss, sample.rss);
    peakHeapUsed = Math.max(peakHeapUsed, sample.heapUsed);
    peakExternal = Math.max(peakExternal, sample.external);
    return sample;
  }

  function consumeEvents(events) {
    emittedEvents += events.length;
    for (const event of events) {
      if (event.type === "spawnPhase") {
        phaseTimeline.push({ id: event.phaseId, elapsed: Number(model.run.elapsed.toFixed(2)) });
      } else if (event.type === "boss") {
        bossStarts.set(event.enemyId, { enemyId: event.enemyId, enemyType: event.enemyType, startedAt: model.run.elapsed });
      } else if (event.type === "kill" && bossStarts.has(event.enemyId)) {
        const encounter = bossStarts.get(event.enemyId);
        bossEncounters.push({
          enemyType: event.enemyType,
          startedAt: encounter ? Number(encounter.startedAt.toFixed(2)) : null,
          duration: encounter ? Number((model.run.elapsed - encounter.startedAt).toFixed(2)) : null
        });
        bossStarts.delete(event.enemyId);
      }
    }
  }

  consumeEvents(model.drainEvents());
  const start = process.hrtime.bigint();
  while (frames < frameBudget && model.screen !== "resultWin" && model.screen !== "resultLose") {
    if (model.screen === "levelup") chooseUpgrade(model, strategy, seed);
    const movement = movementFor(model, strategy, frames);
    model.setInput({
      moveX: movement.x,
      moveY: movement.y,
      aimX: movement.y === 0 && movement.x === 0 ? 1 : -movement.y,
      aimY: movement.x,
      firing: true
    });
    model.tick(1 / 60);
    consumeEvents(model.drainEvents());
    maxEnemies = Math.max(maxEnemies, model.enemies.length);
    maxProjectiles = Math.max(maxProjectiles, model.projectiles.length + model.enemyShots.length);
    maxPickups = Math.max(maxPickups, model.pickups.length);
    frames += 1;
    if (frames % (30 * 60) === 0 || frames === targetFrames) {
      copperCurve.push({ elapsed: Number((frames / 60).toFixed(2)), scrap: model.run.scrap });
    }
    if (frames % 60 === 0) sampleMemory();
  }
  const runtimeMs = Number(process.hrtime.bigint() - start) / 1e6;
  const endMemory = sampleMemory();
  for (const encounter of bossStarts.values()) {
    bossEncounters.push({
      enemyType: encounter.enemyType,
      startedAt: Number(encounter.startedAt.toFixed(2)),
      duration: null
    });
  }
  const toMiB = (bytes) => Number((bytes / (1024 * 1024)).toFixed(2));
  const run = model.run;
  return {
    targetSeconds: duration,
    simulatedSeconds: Number((frames / 60).toFixed(2)),
    reachedTarget: frames >= targetFrames,
    seed,
    mode: run.modeId,
    strategy,
    healthProfile,
    result: model.screen,
    finalHp: Number(run.player.hp.toFixed(2)),
    kills: run.kills,
    eliteKills: run.eliteKills,
    level: run.player.level,
    damageDealt: Number(run.damageDealt.toFixed(2)),
    damageTaken: Number(run.damageTaken.toFixed(2)),
    damageTakenBySource: Object.fromEntries(Object.entries(run.damageTakenBySource).sort((a, b) => b[1] - a[1]).map(([id, value]) => [id, Number(value.toFixed(2))])),
    accuracy: Number((run.projectilesFired > 0 ? Math.min(1, run.hits / run.projectilesFired) : 0).toFixed(4)),
    upgradeOrder: run.upgradeOrder.map((entry) => ({ id: entry.id, level: entry.level, elapsed: Number(entry.elapsed.toFixed(2)) })),
    phaseTimeline,
    bossEncounters,
    copperCurve,
    maxEnemies,
    maxProjectiles,
    maxPickups,
    bossWaves: run.endlessBossWave,
    emittedEvents,
    runtimeMs: Number(runtimeMs.toFixed(2)),
    memoryMiB: {
      baselineRss: toMiB(startMemory.rss),
      peakRss: toMiB(peakRss),
      finalRss: toMiB(endMemory.rss),
      baselineHeapUsed: toMiB(startMemory.heapUsed),
      peakHeapUsed: toMiB(peakHeapUsed),
      finalHeapUsed: toMiB(endMemory.heapUsed),
      peakHeapGrowth: toMiB(Math.max(0, peakHeapUsed - startMemory.heapUsed)),
      peakExternal: toMiB(peakExternal)
    },
    pools: model.getStats().pools
  };
}

module.exports = { STRATEGIES, HEALTH_PROFILES, chooseUpgrade, movementFor, runSimulation };
