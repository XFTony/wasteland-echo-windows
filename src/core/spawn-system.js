"use strict";

const { clamp } = require("./math");
const { buildSpawnStages, chooseSpawnType, getSpawnPhase } = require("./spawn-director");

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
  }

  update(dt) {
    const host = this.host;
    const run = host.run;
    const progress = run.endless ? clamp(run.elapsed / 360, 0, 1) : clamp(run.elapsed / host.duration, 0, 1);
    const mode = this.content.get("modes", run.modeId, this.content.defaults.mode);
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

    if (run.endless && run.elapsed >= run.nextEndlessBossAt) {
      const nextWave = run.endlessBossWave + 1;
      const bossType = nextWave % 3 === 0 ? "iron_colossus" : "warden";
      const boss = this.spawnAtEdge(bossType);
      if (boss) {
        run.endlessBossWave = nextWave;
        run.nextEndlessBossAt += Math.max(90, 180 - nextWave * 8);
        host.emit("boss", host.bossSystem.spawnEvent(boss, nextWave));
      }
    } else if (!run.endless && !run.bossOneSpawned && progress >= mode.bossOneAt) {
      const boss = this.spawnAtEdge("iron_colossus");
      if (boss) {
        run.bossOneSpawned = true;
        host.emit("boss", host.bossSystem.spawnEvent(boss, 1));
      }
    }
    if (!run.endless && mode.bossTwoAt !== null && !run.bossTwoSpawned && progress >= mode.bossTwoAt) {
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
    const endlessPressure = run.endless ? 1 + Math.floor(run.elapsed / 180) * 0.1 : 1;
    const interval = Math.max(0.1, (Number(phase.interval) || mode.spawnStart) / endlessPressure);
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
    const profile = this.host.run && this.stages[this.host.run.spawnProfile] ? this.host.run.spawnProfile : "survival";
    return chooseSpawnType(this.host.random, this.stages[profile], progress);
  }

  spawnAtEdge(type) {
    const host = this.host;
    const player = host.run.player;
    const angle = host.random.range(0, Math.PI * 2);
    const distance = host.random.range(360, 520);
    const x = clamp(player.x + Math.cos(angle) * distance, 32, host.worldSize - 32);
    const y = clamp(player.y + Math.sin(angle) * distance, 32, host.worldSize - 32);
    return host.spawnEnemy(type, x, y);
  }
}

module.exports = { assertSpawnHost, SpawnSystem };
