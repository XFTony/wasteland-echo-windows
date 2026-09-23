"use strict";

function isStageUnlocked(save, stage) {
  if (!stage) return false;
  return (Number(save && save.wins) || 0) >= (Number(stage.unlockWins) || 0);
}

function unlockedStageIds(save, content) {
  return content.ids("stages").filter((id) => isStageUnlocked(save, content.get("stages", id)));
}

function highestUnlockedStageOrder(save, content) {
  let highest = 1;
  for (const stageId of content.ids("stages")) {
    const stage = content.get("stages", stageId);
    if (isStageUnlocked(save, stage)) highest = Math.max(highest, Number(stage.order) || 1);
  }
  return highest;
}

function syncCampaignUnlocks(save, content) {
  const newMaps = [];
  const unlockedStages = unlockedStageIds(save, content);
  if (!Array.isArray(save.unlockedMaps)) save.unlockedMaps = [];
  for (const stageId of unlockedStages) {
    const stage = content.get("stages", stageId);
    if (stage && !save.unlockedMaps.includes(stage.mapId)) {
      save.unlockedMaps.push(stage.mapId);
      newMaps.push(stage.mapId);
    }
  }
  if (Array.isArray(save.completedStages) && save.completedStages.includes("dead_rail")) {
    if (!Array.isArray(save.unlockedHeroes)) save.unlockedHeroes = [content.defaults.hero];
    if (content.has("heroes", "bulwark") && !save.unlockedHeroes.includes("bulwark")) save.unlockedHeroes.push("bulwark");
  }
  return { unlockedStages, newMaps };
}

function markStageCompleted(save, stageId, content) {
  if (!content.has("stages", stageId)) return { firstClear: false, unlockedStages: [], newMaps: [] };
  if (!Array.isArray(save.completedStages)) save.completedStages = [];
  const firstClear = !save.completedStages.includes(stageId);
  if (firstClear) save.completedStages.push(stageId);
  return { firstClear, ...syncCampaignUnlocks(save, content) };
}

function resolveCampaignSelection(save, content) {
  const stageIds = unlockedStageIds(save, content);
  const selectedStage = stageIds.includes(save.selectedStage) ? save.selectedStage : (stageIds[0] || content.defaults.stage);
  const unlockedMaps = content.ids("maps").filter((id) => save.unlockedMaps.includes(id));
  const stage = content.get("stages", selectedStage, content.defaults.stage);
  const selectedMap = unlockedMaps.includes(save.selectedMap)
    ? save.selectedMap
    : stage && unlockedMaps.includes(stage.mapId) ? stage.mapId : (unlockedMaps[0] || content.defaults.map);
  return { selectedStage, selectedMap };
}

module.exports = {
  isStageUnlocked,
  unlockedStageIds,
  highestUnlockedStageOrder,
  syncCampaignUnlocks,
  markStageCompleted,
  resolveCampaignSelection
};

