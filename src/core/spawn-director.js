"use strict";

const SPAWN_STAGE_DEFINITIONS = Object.freeze({
  survival: Object.freeze([
    { at: 0, choices: [["drifter", 7]] },
    { at: 0.16, choices: [["drifter", 7], ["runner", 2.4]] },
    { at: 0.3, choices: [["drifter", 7], ["runner", 2.4], ["spitter", 1.7]] },
    { at: 0.52, choices: [["drifter", 7], ["runner", 2.4], ["spitter", 1.7], ["brute", 0.9]] },
    { at: 0.62, choices: [["drifter", 7], ["runner", 2.4], ["spitter", 1.7], ["brute", 0.9], ["screecher", 0.8]] },
    { at: 0.72, choices: [["drifter", 7], ["runner", 2.4], ["spitter", 1.7], ["brute", 0.9], ["screecher", 0.8], ["crawler", 2.1]] }
  ]),
  extraction: Object.freeze([
    { at: 0, choices: [["drifter", 7]] },
    { at: 0.08, choices: [["drifter", 7], ["runner", 3]] },
    { at: 0.2, choices: [["drifter", 7], ["runner", 3], ["spitter", 2.2]] },
    { at: 0.42, choices: [["drifter", 7], ["runner", 3], ["spitter", 2.2], ["brute", 1.3]] },
    { at: 0.5, choices: [["drifter", 7], ["runner", 3], ["spitter", 2.2], ["brute", 1.3], ["screecher", 1.2]] },
    { at: 0.62, choices: [["drifter", 7], ["runner", 3], ["spitter", 2.2], ["brute", 1.3], ["screecher", 1.2], ["crawler", 2.8]] }
  ]),
  endless: Object.freeze([
    { at: 0, choices: [["drifter", 7]] },
    { at: 0.1, choices: [["drifter", 7], ["runner", 2.6], ["crawler", 1.4]] },
    { at: 0.25, choices: [["drifter", 6], ["runner", 2.8], ["spitter", 2], ["crawler", 2.4]] },
    { at: 0.45, choices: [["drifter", 5], ["runner", 3], ["spitter", 2.3], ["brute", 1.3], ["crawler", 2.8]] },
    { at: 0.65, choices: [["drifter", 4], ["runner", 3.2], ["spitter", 2.4], ["brute", 1.6], ["screecher", 1.4], ["crawler", 3.2]] },
    { at: 0.82, choices: [["drifter", 3], ["runner", 3.5], ["spitter", 2.6], ["brute", 2], ["screecher", 1.7], ["crawler", 3.8]] }
  ])
});

function buildSpawnStages(content, definitions = SPAWN_STAGE_DEFINITIONS) {
  const result = {};
  for (const [modeId, stages] of Object.entries(definitions)) {
    result[modeId] = stages.map((stage) => {
      const choices = stage.choices
        .filter(([id]) => content.has("enemies", id))
        .map(([id, weight]) => ({ id, weight }));
      if (!choices.length) choices.push({ id: content.defaults.enemy, weight: 1 });
      return { at: stage.at, choices };
    });
  }
  return result;
}

function chooseSpawnType(random, stages, progress) {
  let selected = stages[0];
  for (let index = 1; index < stages.length && progress >= stages[index].at; index += 1) selected = stages[index];
  return random.weighted(selected.choices).id;
}

function getSpawnPhase(mode, progress) {
  const phases = Array.isArray(mode && mode.spawnPhases) ? mode.spawnPhases : [];
  if (!phases.length) {
    const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));
    const start = Number(mode && mode.spawnStart) || 1;
    const end = Number(mode && mode.spawnEnd) || start;
    return {
      id: "linear",
      index: 0,
      cap: Number(mode && mode.enemyLimit) || 48,
      interval: start + (end - start) * safeProgress,
      label: "敌群接近",
      detail: "保持机动并清理近处目标"
    };
  }
  const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  let index = 0;
  for (let phaseIndex = 1; phaseIndex < phases.length && safeProgress >= phases[phaseIndex].at; phaseIndex += 1) {
    index = phaseIndex;
  }
  const phase = phases[index];
  return Number.isInteger(phase.index) ? phase : { ...phase, index };
}

module.exports = { SPAWN_STAGE_DEFINITIONS, buildSpawnStages, chooseSpawnType, getSpawnPhase };
