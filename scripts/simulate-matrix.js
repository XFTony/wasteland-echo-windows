"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { runSimulation } = require("./simulation-runner");
const { version } = require("../package.json");

const requestedDuration = Number(process.argv[2]);
const duration = Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : 180;
const seedOption = process.argv.find((argument) => argument.startsWith("--seed="));
const seed = seedOption ? Number(seedOption.slice(7)) || 20260907 : 20260907;
const scenarios = [
  { id: "survival-default", modeId: "survival", strategy: "default" },
  { id: "survival-kite", modeId: "survival", strategy: "kite" },
  { id: "survival-facehug", modeId: "survival", strategy: "facehug" },
  { id: "survival-random-upgrade", modeId: "survival", strategy: "random-upgrade" },
  { id: "survival-no-magnet", modeId: "survival", strategy: "no-magnet" },
  { id: "extraction-priority", modeId: "extraction", strategy: "extract-only" }
];

const results = scenarios.map((scenario) => ({
  id: scenario.id,
  ...runSimulation({
    duration,
    seed,
    modeId: scenario.modeId,
    strategy: scenario.strategy,
    healthProfile: "normal"
  })
}));

const output = {
  seed,
  duration,
  healthProfile: "normal",
  scenarios: results.length,
  completed: results.filter((result) => result.result === "resultWin").length,
  results
};
if (process.argv.includes("--write")) {
  const target = path.resolve(__dirname, "..", "docs", "simulation-matrix-" + version + ".json");
  fs.writeFileSync(target, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log("Wrote " + path.relative(path.resolve(__dirname, ".."), target));
}
console.log(JSON.stringify(output, null, 2));
