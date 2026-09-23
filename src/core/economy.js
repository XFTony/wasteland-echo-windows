"use strict";

const GRANT_LISTS = Object.freeze({
  weapon: "unlockedWeapons",
  skin: "unlockedSkins",
  equipment: "ownedEquipment"
});

function ensureWallet(save) {
  if (!save.currencies || typeof save.currencies !== "object") save.currencies = { copper: 0, gold: 0 };
  save.currencies.copper = Math.max(0, Math.floor(Number(save.currencies.copper) || 0));
  save.currencies.gold = Math.max(0, Math.floor(Number(save.currencies.gold) || 0));
  return save.currencies;
}

function ownsGrant(save, item) {
  const listName = item && GRANT_LISTS[item.grantType];
  return Boolean(listName && Array.isArray(save[listName]) && save[listName].includes(item.grantId));
}

function getShopItemState(save, item, highestStageOrder) {
  if (!item) return { status: "missing", owned: false, unlocked: false, affordable: false, ruleLocked: false };
  const wallet = ensureWallet(save);
  const owned = ownsGrant(save, item);
  const stageLocked = (Number(highestStageOrder) || 1) < (Number(item.unlockStage) || 1);
  const ruleLocked = Boolean(item.unlockRuleId)
    && !(Array.isArray(save.unlockedBlueprints) && save.unlockedBlueprints.includes(item.id));
  const unlocked = !stageLocked && !ruleLocked;
  const affordable = wallet[item.currency] >= item.price;
  return {
    status: owned ? "owned" : ruleLocked ? "ruleLocked" : stageLocked ? "locked" : affordable ? "available" : "insufficient",
    owned,
    unlocked,
    stageLocked,
    ruleLocked: owned ? false : ruleLocked,
    affordable,
    balance: wallet[item.currency]
  };
}

function purchaseShopItem(save, item, highestStageOrder) {
  const state = getShopItemState(save, item, highestStageOrder);
  if (state.status !== "available") return { ok: false, ...state };
  const listName = GRANT_LISTS[item.grantType];
  const wallet = ensureWallet(save);
  // Validation above makes the following mutation an atomic, all-or-nothing transaction.
  wallet[item.currency] -= item.price;
  if (!Array.isArray(save[listName])) save[listName] = [];
  save[listName].push(item.grantId);
  return { ok: true, status: "purchased", owned: true, itemId: item.id, balance: wallet[item.currency] };
}

function calculateRunPayout(run, stage, mode, result) {
  const legacyScrap = run.scrap + Math.floor(run.kills / 10) + (result === "win" ? Number(mode.winReward) || 0 : 0);
  const baseCopper = run.scrap * 12 + run.kills * 2 + run.eliteKills * 15 + (result === "win" ? 120 : 0);
  const stageMultiplier = Number(stage && stage.copperMultiplier) || 1;
  const characterMultiplier = Number(run.player && run.player.copperMultiplier) || 1;
  return {
    legacyScrap,
    copper: Math.max(0, Math.floor(baseCopper * stageMultiplier * characterMultiplier)),
    gold: result === "win" ? Math.max(0, Math.floor(Number(stage && stage.goldReward) || 0)) : 0
  };
}

module.exports = {
  GRANT_LISTS,
  ensureWallet,
  ownsGrant,
  getShopItemState,
  purchaseShopItem,
  calculateRunPayout
};
