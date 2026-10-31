"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { runSimulation } = require("../simulation-runner");
const { DEFAULT_CONTENT } = require("../../src/core/content-registry");

const root = path.resolve(__dirname, "../..");
const out = path.join(root, "output/weapon-feel-2026-10-28");
// The optional baseline is a read-only archive extracted from 976e6a3.
const referencePath = path.join(out, "baseline-source/scripts/simulation-runner.js");
const reference = fs.existsSync(referencePath) ? require(referencePath).runSimulation : null;
const results = [];
for (const weaponId of DEFAULT_CONTENT.ids("weapons")) {
  for (const mapId of DEFAULT_CONTENT.ids("maps")) {
    const options = { duration: 180, seed: 20260907, weaponId, mapId,
      modeId: "survival", strategy: "default", healthProfile: "normal" };
    const current = runSimulation(options);
    const baseline = reference ? reference(options) : null;
    assert(["resultWin", "resultLose"].includes(current.result), weaponId + " failed to finish");
    assert(Number.isFinite(current.damageDealt) && current.damageDealt > 0);
    assert(current.maxEnemies <= 260 && current.maxProjectiles <= 512);
    results.push({ weaponId, mapId, current, baseline });
    console.log(`${weaponId} / ${mapId}: ${baseline?.result || "no baseline"} -> ${current.result}; kills ${baseline?.kills ?? "-"} -> ${current.kills}`);
  }
}
const proof = { date: "2026-10-28", reference: reference ? "976e6a3" : null,
  seed: 20260907, duration: 180, healthProfile: "normal", strategy: "default",
  cases: results.length, baselineWins: results.filter(row => row.baseline?.result === "resultWin").length,
  currentWins: results.filter(row => row.current.result === "resultWin").length, results,
  limits: "One deterministic movement/upgrade strategy and one seed per weapon/map. Not a human playtest, win-rate estimate, or automatic balance target. Swept collisions and smooth knockback intentionally change trajectories." };
fs.writeFileSync(path.join(root, "docs/qa/weapon-simulation-comparison-2026-10-28.json"), JSON.stringify(proof, null, 2) + "\n");
console.log(JSON.stringify({ cases: proof.cases, baselineWins: proof.baselineWins, currentWins: proof.currentWins }));
