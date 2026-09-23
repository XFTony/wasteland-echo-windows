"use strict";

const { DEFAULT_RUN_DURATION } = require("../src/config");
const { STRATEGIES, runSimulation } = require("./simulation-runner");

const args = process.argv.slice(2);
const requestedDuration = Number(args[0]);
const duration = Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : DEFAULT_RUN_DURATION;
const explicitMode = args.find((argument) => ["survival", "extraction", "endless"].includes(argument));
const option = (name) => {
  const prefix = "--" + name + "=";
  const match = args.find((argument) => argument.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};
const requestedMode = option("mode");
const modeId = ["survival", "extraction", "endless"].includes(requestedMode) ? requestedMode : explicitMode || "survival";
const requestedStrategy = option("strategy");
const strategy = STRATEGIES.includes(requestedStrategy) ? requestedStrategy : "default";
const healthProfile = args.includes("--stress-health") ? "stress" : args.includes("--normal-health") ? "normal" : "benchmark";

const result = runSimulation({
  duration,
  modeId,
  strategy,
  healthProfile,
  seed: Number(option("seed")) || 20260907,
  weaponId: option("weapon"),
  heroId: option("hero"),
  mapId: option("map"),
  stageId: option("stage")
});

console.log(JSON.stringify(result, null, 2));
