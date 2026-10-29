"use strict";

const { clamp } = require("./math");
const { buildSpawnStages, chooseSpawnType, getSpawnPhase } = require("./spawn-director");
const { getSurvivalPressure, SURVIVAL_MAPS } = require("../content/survival");

function assertSpawnHost(host) {
  const methods = ["spawnEnemy", "emit"];
  if (!host || typeof host !== "object") throw new TypeError("SpawnSystem requires a host");
  for (const method of methods) {
    if (typeof host[method] !== "function") throw new TypeError("SpawnSystem host." + method + " must be a function");
  }
  return host;
}

class SpawnSystem {
  constructor(host, content) {
    this.host = assertSpawnHost(host);
    this.content = content;
    this.stages = buildSpawnStages(content);
    this.mapStages = Object.fromEntries(Object.entries(SURVIVAL_MAPS).map(([id, profile]) => [id,
      [0,30,50,90,140,200].map((at, i) => ({ at, choices: Object.entries(profile.weights)
        .filter(([type]) => ["drifter", "runner", "crawler", "spitter", "brute", "screecher"].indexOf(type) <= i && content.has("enemies", type))
        .map(([id, weight]) => ({ id, weight })) }))]));
    for (const phases of Object.values(this.mapStages)) for (const phase of phases) {
      if (!phase.choices.length) phase.choices = [{ id: content.defaults.enemy, weight: 1 }];
    }
  }

  update(dt) {
    const host = this.host;
    const run = host.run;
    const mode = this.content.get("modes", run.modeId, this.content.defaults.mode);
    if (run.endless) { this.updateContinuous(dt, mode); return; }
    const progress = clamp(run.elapsed / host.duration, 0, 1);
    if (run.rule === "extract" && !run.extraction.active && run.elapsed >= Math.max(15, host.duration - 30)) {
      run.extraction.active = true;
      const angle = host.random.range(0, Math.PI * 2);
      run.extraction.x = clamp(run.player.x + Math.cos(angle) * 250, 120, host.worldSize - 120);
      run.extraction.y = clamp(run.player.y + Math.sin(angle) * 250, 120, host.worldSize - 120);
      host.emit("extraction", { x: run.extraction.x, y: run.extraction.y });
    } else if (run.rule === "survive" && !run.finalWaveAnnounced && run.elapsed >= Math.max(15, host.duration - 30)) {
      run.finalWaveAnnounced = true;
      host.emit("finalWave");
    }

    if (!run.bossOneSpawned && progress >= mode.bossOneAt) {
      const boss = this.spawnAtEdge("iron_colossus");
      if (boss) {
        run.bossOneSpawned = true;
        host.emit("boss", host.bossSystem.spawnEvent(boss, 1));
      }
    }
    if (mode.bossTwoAt !== null && !run.bossTwoSpawned && progress >= mode.bossTwoAt) {
      const boss = this.spawnAtEdge("warden");
      if (boss) {
        run.bossTwoSpawned = true;
        host.emit("boss", host.bossSystem.spawnEvent(boss, 2));
      }
    }

    const phase = getSpawnPhase(mode, progress);
    const phaseCap = Math.min(mode.enemyLimit, Number(phase.cap) || mode.enemyLimit);
    if (run.spawnPhaseIndex !== phase.index) {
      run.spawnPhaseIndex = phase.index;
      if (phase.index > 0) host.emit("spawnPhase", { phaseId: phase.id, label: phase.label, detail: phase.detail });
    }
    if (host.enemies.length >= phaseCap) return;
    const interval = Math.max(0.1, Number(phase.interval) || mode.spawnStart);
    run.spawnAccumulator += dt;
    while (run.spawnAccumulator >= interval && host.enemies.length < phaseCap) {
      run.spawnAccumulator -= interval;
      const type = this.chooseEnemyType(progress);
      this.spawnAtEdge(type);
      const swarmAdds = run.rule === "survive" ? 1 : 2;
      for (let extra = 0; type === "crawler" && extra < swarmAdds && host.enemies.length < phaseCap; extra += 1) {
        this.spawnAtEdge("crawler");
      }
    }
  }

  chooseEnemyType(progress) {
    const run = this.host.run;
    if (run?.endless) return chooseSpawnType(this.host.random, this.mapStages[run.mapId] || this.mapStages.echo_district, run.elapsed);
    const profile = this.host.run && this.stages[this.host.run.spawnProfile] ? this.host.run.spawnProfile : "survival";
    return chooseSpawnType(this.host.random, this.stages[profile], progress);
  }

  spawnAtEdge(type) {
    const host = this.host;
    const player = host.run.player;
    if (host.run.endless && host.worldSize >= 1600) {
      const cx = clamp(player.x - 640, 0, host.worldSize - 1280), cy = clamp(player.y - 360, 0, host.worldSize - 720);
      for (let tries = 0; tries < 16; tries++) {
        const side = host.random.int(0, 3), padding = host.random.range(32, 96);
        const x = side === 0 ? cx - padding : side === 1 ? cx + 1280 + padding : cx + host.random.range(0, 1280);
        const y = side === 2 ? cy - padding : side === 3 ? cy + 720 + padding : cy + host.random.range(0, 720);
        if (x < 32 || y < 32 || x > host.worldSize - 32 || y > host.worldSize - 32) continue;
        return host.spawnEnemy(type, x, y);
      }
      const x = player.x < host.worldSize / 2 ? Math.min(host.worldSize - 32, cx + 1320) : Math.max(32, cx - 40);
      return host.spawnEnemy(type, x, clamp(player.y, 32, host.worldSize - 32));
    }
    const angle = host.random.range(0, Math.PI * 2);
    const distance = host.run.endless
      ? 1 / Math.max(Math.abs(Math.cos(angle)) / 700, Math.abs(Math.sin(angle)) / 430) + host.random.range(20, 100)
      : host.random.range(360, 520);
    const x = clamp(player.x + Math.cos(angle) * distance, 32, host.worldSize - 32);
    const y = clamp(player.y + Math.sin(angle) * distance, 32, host.worldSize - 32);
    return host.spawnEnemy(type, x, y);
  }

  updateContinuous(dt, mode) {
    const host = this.host, run = host.run, pressure = getSurvivalPressure(run.elapsed);
    for (const enemy of host.enemies) if (enemy.active && !enemy.boss && Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y) > 1450) host.enemyPool.release(enemy);
    if (run.spawnPhaseIndex !== pressure.level) {
      run.spawnPhaseIndex = pressure.level;
      if (pressure.level > 1) host.emit("spawnPhase", { phaseId: "threat-" + pressure.level, label: `威胁等级 ${pressure.level}`, detail: "感染者正在增强，调整走位与构筑" });
    }
    if (run.elapsed >= run.nextEndlessBossAt) {
      if (run.activeBosses >= 2) run.nextEndlessBossAt = run.elapsed + 30;
      else {
        const wave = run.endlessBossWave + 1, boss = this.spawnAtEdge(wave % 3 === 0 ? "iron_colossus" : "warden");
        if (boss) { run.endlessBossWave = wave; run.nextEndlessBossAt = run.elapsed + Math.max(120, 180 - wave * 5); host.emit("boss", host.bossSystem.spawnEvent(boss, wave)); }
      }
    }
    const cap = Math.min(mode.enemyLimit, pressure.cap);
    if (host.enemies.length >= cap) { run.spawnAccumulator = Math.min(run.spawnAccumulator, pressure.interval); return; }
    run.spawnAccumulator += dt;
    let attempts = 0;
    while (run.spawnAccumulator >= pressure.interval && host.enemies.length < cap && attempts++ < 4) {
      run.spawnAccumulator -= pressure.interval;
      const type = this.chooseEnemyType(); this.spawnAtEdge(type);
      if (type === "crawler" && host.enemies.length < cap) this.spawnAtEdge(type);
    }
  }
}

module.exports = { assertSpawnHost, SpawnSystem };
