"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultSave } = require("../src/core/save");
const { DEFAULT_CONTENT } = require("../src/core/content-registry");
const { getShopItemState, purchaseShopItem } = require("../src/core/economy");
const { EQUIPMENT_SLOTS, equipItem, unequipItem, calculateLoadoutStats, applyHeroAndEquipment } = require("../src/core/equipment");
const { createBasePlayerStats, createRunState } = require("../src/core/run-state");

test("shop purchase validates progression and balance before mutating the wallet", () => {
  const save = createDefaultSave();
  const smg = DEFAULT_CONTENT.shopItems.buy_swarm_smg;
  const before = save.currencies.copper;
  const insufficient = purchaseShopItem(save, smg, 1);
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.status, "insufficient");
  assert.equal(save.currencies.copper, before);
  assert.deepEqual(save.unlockedWeapons, ["scrap_pistol"]);

  save.currencies.copper = 500;
  const bought = purchaseShopItem(save, smg, 1);
  assert.equal(bought.ok, true);
  assert.equal(save.currencies.copper, 80);
  assert.ok(save.unlockedWeapons.includes("swarm_smg"));
  const duplicate = purchaseShopItem(save, smg, 1);
  assert.equal(duplicate.status, "owned");
  assert.equal(save.currencies.copper, 80);
});

test("higher chapter merchandise stays locked even when the player has enough currency", () => {
  const save = createDefaultSave();
  save.currencies.gold = 99;
  const rifle = DEFAULT_CONTENT.shopItems.buy_needle_rifle;
  assert.equal(getShopItemState(save, rifle, 1).status, "ruleLocked");
  assert.equal(purchaseShopItem(save, rifle, 1).ok, false);
  assert.equal(save.currencies.gold, 99);
});

test("blueprint rules gate new purchases while legacy ownership stays authoritative", () => {
  const save = createDefaultSave();
  const shotgun = DEFAULT_CONTENT.shopItems.buy_breaker_shotgun;
  save.currencies.copper = 5000;
  assert.equal(getShopItemState(save, shotgun, 3).ruleLocked, true);
  save.unlockedBlueprints.push(shotgun.id);
  assert.equal(getShopItemState(save, shotgun, 3).status, "available");
  save.unlockedBlueprints.length = 0;
  save.unlockedWeapons.push(shotgun.grantId);
  assert.equal(getShopItemState(save, shotgun, 1).status, "owned");
});

test("equipped hero and item stats are composed once before combat", () => {
  const save = createDefaultSave();
  save.ownedEquipment.push("runner_boots");
  assert.equal(equipItem(save, "runner_boots", DEFAULT_CONTENT).ok, true);
  const run = createRunState({
    duration: 180,
    worldSize: 3072,
    weaponId: "scrap_pistol",
    skinId: "wanderer",
    heroId: "mechanic",
    modeId: "survival",
    mode: DEFAULT_CONTENT.modes.survival
  });
  const items = applyHeroAndEquipment(run.player, DEFAULT_CONTENT.heroes.mechanic, save, DEFAULT_CONTENT);
  assert.deepEqual(items.map((item) => item.id).sort(), ["field_vest", "runner_boots"]);
  assert.ok(run.player.speed > DEFAULT_CONTENT.modes.survival.playerSpeed);
  assert.ok(run.player.pickupRadius > 48);
  assert.ok(run.player.copperMultiplier > 1);
});

test("helmet, chest, legs and boots share one preview and combat stat calculation", () => {
  const save = createDefaultSave();
  save.ownedEquipment.push("signal_charm", "iron_plate", "ammo_rig", "runner_boots");
  for (const id of ["signal_charm", "iron_plate", "ammo_rig", "runner_boots"]) {
    assert.equal(equipItem(save, id, DEFAULT_CONTENT).ok, true);
  }
  assert.deepEqual(Object.keys(save.equippedEquipment), EQUIPMENT_SLOTS);

  const base = createBasePlayerStats(DEFAULT_CONTENT.modes.survival);
  const preview = calculateLoadoutStats(base, DEFAULT_CONTENT.heroes.ranger, save, DEFAULT_CONTENT);
  const player = { ...base };
  const equipped = applyHeroAndEquipment(player, DEFAULT_CONTENT.heroes.ranger, save, DEFAULT_CONTENT);
  for (const key of Object.keys(preview.stats)) assert.equal(player[key], preview.stats[key], key);
  assert.deepEqual(equipped.map((item) => item.slot), EQUIPMENT_SLOTS);
  assert.equal(player.maxHp, 145);
  assert.equal(Math.round(player.armor * 100), 13);
  assert.ok(player.speed > base.speed);
  assert.ok(player.damageMultiplier > 1);

  const removed = unequipItem(save, "helmet");
  assert.equal(removed.itemId, "signal_charm");
  assert.equal(save.equippedEquipment.helmet, null);
});

test("every armor slot offers at least two distinct build choices", () => {
  for (const slot of EQUIPMENT_SLOTS) {
    const items = Object.values(DEFAULT_CONTENT.equipment).filter((item) => item.slot === slot);
    assert.ok(items.length >= 2, `${slot} should have at least two equipment choices`);
    assert.equal(new Set(items.map((item) => item.visualId)).size, items.length);
  }
});

test("new leg and boot equipment compose into preview and combat stats", () => {
  const save = createDefaultSave();
  save.ownedEquipment.push("servo_greaves", "stormstep_boots");
  assert.equal(equipItem(save, "servo_greaves", DEFAULT_CONTENT).ok, true);
  assert.equal(equipItem(save, "stormstep_boots", DEFAULT_CONTENT).ok, true);
  const base = createBasePlayerStats(DEFAULT_CONTENT.modes.survival);
  const result = calculateLoadoutStats(base, DEFAULT_CONTENT.heroes.ranger, save, DEFAULT_CONTENT);
  assert.ok(result.stats.maxHp >= base.maxHp + 10);
  assert.ok(result.stats.speed > base.speed * 1.1);
  assert.ok(result.stats.lockRangeMultiplier > 1);
});
