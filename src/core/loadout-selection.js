"use strict";

const { unlockedStageIds, resolveCampaignSelection } = require("./campaign");

const LOADOUT_SELECTIONS = Object.freeze({
  selectedWeapon: Object.freeze({ catalog: "weapons", unlockList: "unlockedWeapons", defaultId: "weapon" }),
  selectedSkin: Object.freeze({ catalog: "skins", unlockList: "unlockedSkins", defaultId: "skin" }),
  selectedMode: Object.freeze({ catalog: "modes", unlockList: null, defaultId: "mode" }),
  selectedHero: Object.freeze({ catalog: "heroes", unlockList: "unlockedHeroes", defaultId: "hero" }),
  selectedMap: Object.freeze({ catalog: "maps", unlockList: "unlockedMaps", defaultId: "map" })
});

function availableIds(save, content, selection) {
  const ids = content.ids(selection.catalog);
  const unlocked = selection.unlockList && Array.isArray(save[selection.unlockList])
    ? ids.filter((id) => save[selection.unlockList].includes(id))
    : ids.slice();
  return unlocked.length ? unlocked : [content.defaults[selection.defaultId]];
}

function cycleId(ids, current, direction = 1) {
  if (!ids.length) return null;
  const index = Math.max(0, ids.indexOf(current));
  const offset = Number.isFinite(Number(direction)) ? Math.trunc(Number(direction)) : 1;
  return ids[(index + offset + ids.length * (Math.abs(offset) + 1)) % ids.length];
}

function resolveCatalogSelection(save, content, key) {
  const selection = LOADOUT_SELECTIONS[key];
  if (!selection) throw new Error(`Unknown loadout selection '${key}'`);
  const ids = availableIds(save, content, selection);
  return ids.includes(save[key]) ? save[key] : ids[0];
}

function shopCategories(content) {
  const categories = [];
  for (const itemId of content.ids("shopItems")) {
    const category = content.shopItems[itemId].category;
    if (typeof category === "string" && category && !categories.includes(category)) categories.push(category);
  }
  return categories;
}

function resolveShopCategory(current, content) {
  const categories = shopCategories(content);
  return categories.includes(current) ? current : categories[0];
}

function resolveLoadoutSelections(save, content) {
  const campaign = resolveCampaignSelection(save, content);
  return {
    selectedWeapon: resolveCatalogSelection(save, content, "selectedWeapon"),
    selectedSkin: resolveCatalogSelection(save, content, "selectedSkin"),
    selectedMode: resolveCatalogSelection(save, content, "selectedMode"),
    selectedHero: resolveCatalogSelection(save, content, "selectedHero"),
    selectedStage: campaign.selectedStage,
    selectedMap: campaign.selectedMap,
    shopCategory: resolveShopCategory(save.shopCategory, content)
  };
}

function persistLoadoutSelections(save, selections) {
  for (const key of Object.keys(LOADOUT_SELECTIONS)) save[key] = selections[key];
  save.selectedStage = selections.selectedStage;
  save.selectedMap = selections.selectedMap;
  save.shopCategory = selections.shopCategory;
}

function cycleLoadoutSelection(save, content, selections, key, direction = 1) {
  const next = { ...selections };
  if (key === "selectedStage") {
    const stages = unlockedStageIds(save, content);
    next.selectedStage = cycleId(stages.length ? stages : [content.defaults.stage], next.selectedStage, direction);
    const stage = content.get("stages", next.selectedStage, content.defaults.stage);
    if (stage && Array.isArray(save.unlockedMaps) && save.unlockedMaps.includes(stage.mapId)) {
      next.selectedMap = stage.mapId;
    }
    return next;
  }
  if (key === "shopCategory") {
    next.shopCategory = cycleId(shopCategories(content), next.shopCategory, direction);
    return next;
  }
  const selection = LOADOUT_SELECTIONS[key];
  if (!selection) throw new Error(`Unknown loadout selection '${key}'`);
  next[key] = cycleId(availableIds(save, content, selection), next[key], direction);
  return next;
}

function selectLoadoutSelection(save, content, selections, key, id) {
  const selection = LOADOUT_SELECTIONS[key];
  if (!selection) throw new Error(`Unknown loadout selection '${key}'`);
  if (typeof id !== "string" || !availableIds(save, content, selection).includes(id)) return null;
  return { ...selections, [key]: id };
}

module.exports = {
  LOADOUT_SELECTIONS,
  availableIds,
  cycleId,
  shopCategories,
  resolveShopCategory,
  resolveLoadoutSelections,
  persistLoadoutSelections,
  cycleLoadoutSelection,
  selectLoadoutSelection
};
