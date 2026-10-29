"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { GameModel } = require("../../src/core/game-model");
const { SaveManager } = require("../../src/core/save");
const { movementFor, chooseUpgrade } = require("../simulation-runner");

const seconds = Number(process.argv[2]) || 1800, results = [];
for (const mapId of ["echo_district", "freight_nexus", "red_basin"]) {
  const m = new GameModel(new SaveManager({ get: () => null, set() {} })); m.startRun({ mapId, seed: 1029, tutorial: false });
  m.run.player.hp = m.run.player.maxHp = 1e7; m.run.player.xpNext = 10;
  const peak = { enemies: 0, bullets: 0, pickups: 0, towers: 0, navigationCache: 0, upgradeOrder: 0 }, samples = [];
  const ids = m.content.ids("weapons"), started = performance.now(); let refits = 0, placements = 0, recoveries = 0;
  global.gc?.(); const initial = process.memoryUsage();
  function supply(phase) {
    const station = m.interactives.find(i => i.type === "tradePost");
    Object.assign(m.run.player, { x: station.x + 15, y: station.y + 20 }); m.run.scrap = Math.max(m.run.scrap, 10000);
    assert(m.fieldMarket.open()); const id = ids[phase % ids.length];
    if (!m.run.arsenal[id]) assert(m.arsenal.buy(id)); else assert(m.arsenal.equip(id));
    if (m.arsenal.state(id).canUpgrade) { assert(m.arsenal.improve(id)); refits++; }
    if (m.structures.ownedCount() < 4) assert(m.fieldMarket.purchase("turretKit").ok);
    m.fieldMarket.close();
    for (let y = 40; y <= 160 && m.run.turretKits; y += 40) {
      m.run.player.y = station.y + y; m.run.player.x = station.x + 140;
      for (const angle of [0, .8, 1.57, 2.4, 3.14]) {
        m.setInput({ aimX: Math.cos(angle), aimY: Math.sin(angle), aimActive: true });
        if (m.structures.begin() && m.structures.confirm()) { placements++; break; }
        m.structures.cancel();
      }
    }
    m.setInput({ aimActive: false });
  }
  supply(0); m.drainEvents();
  for (let frame = 0; frame < seconds * 60; frame++) {
    if (m.screen === "levelup") chooseUpgrade(m, "random-upgrade", 1029);
    const input = movementFor(m, "default", frame); m.setInput({ moveX: input.x, moveY: input.y }); m.tick(1 / 60); m.drainEvents();
    assert.equal(m.screen === "running" || m.screen === "levelup", true, "boosted-health stress fixture must keep simulating");
    peak.enemies = Math.max(peak.enemies, m.enemies.length); peak.bullets = Math.max(peak.bullets, m.projectiles.length + m.enemyShots.length);
    peak.pickups = Math.max(peak.pickups, m.pickups.length); peak.towers = Math.max(peak.towers, m.run.structures.length);
    peak.navigationCache = Math.max(peak.navigationCache, m.navigationCache.size); peak.upgradeOrder = Math.max(peak.upgradeOrder, m.run.upgradeOrder.length);
    if ((frame + 1) % 7200 === 0) {
      if (m.screen === "levelup") chooseUpgrade(m, "random-upgrade", 1029);
      const t = m.run.structures[0];
      if (t) { Object.assign(m.run.player, { x: t.x + 42, y: t.y }); if (m.structures.recover()) recoveries++; }
      supply(Math.floor(frame / 7200) + 1);
      global.gc?.(); const memory = process.memoryUsage(); samples.push({ time: Math.round(m.run.elapsed), heap: memory.heapUsed, external: memory.external, towers: m.run.structures.length, nav: m.navigationCache.size });
    }
  }
  assert(peak.enemies <= m.limits.enemies); assert(peak.bullets <= m.limits.projectiles + m.limits.enemyShots); assert(peak.pickups <= m.limits.pickups);
  assert(peak.towers <= 4); assert(peak.navigationCache <= 3); assert(peak.upgradeOrder <= 128); assert(m.run.elapsed >= seconds - .1);
  if (m.screen === "levelup") chooseUpgrade(m, "random-upgrade", 1029);
  m.finishRun("retire"); assert(m.save.bestTime >= seconds - .1); global.gc?.(); const memory = process.memoryUsage();
  results.push({ mapId, seconds: m.run.elapsed, kills: m.run.kills, bossesDefeated: m.run.bossesDefeated, level: m.run.player.level, placements, recoveries, refits,
    peak, samples, heapGrowthAfterGC: memory.heapUsed - initial.heapUsed, wallMs: performance.now() - started, pools: m.getStats().pools });
  console.log(JSON.stringify({ mapId, seconds: Math.round(m.run.elapsed), peak, placements, recoveries, heapGrowthAfterGC: memory.heapUsed - initial.heapUsed }));
}
const target = path.resolve(__dirname, "../../docs/qa/continuous-survival-long-run-2026-10-28.json");
fs.writeFileSync(target, JSON.stringify({ date: "2026-10-29", fixture: "Boosted HP and coins, periodic supply teleports; resource/lifecycle test, not human balance or native FPS proof", secondsPerMap: seconds, results }, null, 2) + "\n");
