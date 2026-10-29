import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { runSimulation } = require("../simulation-runner.js");
const { NEW_WEAPONS } = require("../../src/content/weapon-expansion.js");
const root = path.resolve(import.meta.dirname, "../..");
const results = [];
const scenarios = [];
for (const weaponId of Object.keys(NEW_WEAPONS)) {
  for (const mapId of ["echo_district", "freight_nexus", "red_basin"]) {
    scenarios.push({ weaponId, mapId, duration: 180 });
  }
}
for (const weaponId of ["echo_blade", "shock_hammer"]) {
  scenarios.push({ weaponId, mapId: "echo_district", duration: 900 });
}
for (const scenario of scenarios) {
  const result = runSimulation({ ...scenario, modeId: "endless", healthProfile: "stress", seed: 20261029, strategy: "default" });
  assert(result.reachedTarget, JSON.stringify(scenario));
  assert(result.damageDealt > 0, "Weapon must actually attack: " + scenario.weaponId);
  assert(result.maxEnemies <= 128 && result.maxProjectiles <= 300 && result.maxPickups <= 140);
  results.push({ ...scenario, ...result });
  console.log(`${scenario.weaponId} / ${scenario.mapId} / ${scenario.duration}s: ${result.kills} kills, ${result.damageDealt} damage`);
}
const proof = { date: "2026-10-29", fixture: "Raised health, scripted movement and automatic upgrades; not human difficulty evidence", scenarios: results.length, results };
fs.writeFileSync(path.join(root, "docs/qa/weapon-expansion-simulation-2026-10-29.json"), JSON.stringify(proof, null, 2) + "\n");
