"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SaveManager, createDefaultSave, normalizeSave, SAVE_KEY, SAVE_BACKUP_KEY, SAVE_DAMAGED_KEY, CURRENT_SCHEMA_VERSION } = require("../src/core/save");

test("default save contains required unlocks and settings", () => {
  const save = createDefaultSave();
  assert.deepEqual(save.unlockedWeapons, ["scrap_pistol"]);
  assert.deepEqual(save.unlockedSkins, ["wanderer"]);
  assert.deepEqual(save.unlockedHeroes, ["ranger", "mechanic"]);
  assert.deepEqual(save.ownedEquipment, ["field_vest"]);
  assert.deepEqual(save.equippedEquipment, { helmet: null, chest: "field_vest", legs: null, boots: null });
  assert.deepEqual(save.currencies, { copper: 250, gold: 0 });
  assert.equal(save.settings.autoAim, true);
  assert.equal(save.settings.gamepadEnabled, true);
  assert.equal(save.settings.gamepadDeadzone, 0.18);
  assert.equal(save.settings.musicMuted, false);
  assert.equal(save.settings.uiScale, 1);
  assert.equal(save.keyBindings.moveUp, "KeyW");
  assert.equal(save.selectedMode, "survival");
  assert.equal(save.tutorialCompleted, false);
  assert.equal(save.tutorialSkipped, false);
  assert.deepEqual(save.weaponMastery, {});
  assert.deepEqual(save.unlockedBlueprints, []);
  assert.deepEqual(save.unlockedModifiers, []);
  assert.deepEqual(save.completedUnlockRules, []);
  assert.deepEqual(save.claimedMasteryRewards, []);
  assert.deepEqual(save.unlockedEvolutions, []);
  assert.deepEqual(save.masteryBadges, []);
  assert.deepEqual(save.runHistory, []);
  assert.equal(save.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("schema v9 normalizes tutorial, mastery and bounded run-history data", () => {
  const history = Array.from({ length: 24 }, (_, index) => ({
    seed: index,
    modeId: "survival",
    stageId: "signal_dawn",
    weaponId: "scrap_pistol",
    result: index % 2 ? "win" : "lose",
    elapsed: index,
    kills: index,
    damageDealt: index * 10,
    accuracy: 9,
    maxNoHitTime: index,
    masteryGain: index,
    masteryLevel: 99,
    completedAt: index
  }));
  const save = normalizeSave({
    schemaVersion: 9,
    tutorialCompleted: true,
    weaponMastery: { scrap_pistol: { kills: 80, runs: 4, level: 2 } },
    runHistory: history
  });
  assert.equal(save.tutorialCompleted, true);
  assert.equal(save.weaponMastery.scrap_pistol.experience, 100);
  assert.equal(save.runHistory.length, 20);
  assert.equal(save.runHistory[0].accuracy, 1);
  assert.equal(save.runHistory[0].masteryLevel, 99);
});

test("schema v8 migrates and sanitizes rule and mastery reward state", () => {
  const save = normalizeSave({
    schemaVersion: 8,
    unlockedBlueprints: ["buy_breaker_shotgun", "buy_breaker_shotgun", 42],
    unlockedModifiers: "redline",
    completedUnlockRules: ["blueprint_breaker", null],
    claimedMasteryRewards: ["scrap_pistol:field_dividend", ""],
    unlockedEvolutions: ["kineticLoop", "kineticLoop"],
    masteryBadges: ["scrap_pistol", false],
    weaponMastery: { scrap_pistol: { kills: 1, runs: 1, experience: 999999, level: 99 } }
  });
  assert.equal(save.schemaVersion, 9);
  assert.deepEqual(save.unlockedBlueprints, ["buy_breaker_shotgun"]);
  assert.deepEqual(save.unlockedModifiers, []);
  assert.deepEqual(save.completedUnlockRules, ["blueprint_breaker"]);
  assert.deepEqual(save.claimedMasteryRewards, ["scrap_pistol:field_dividend"]);
  assert.deepEqual(save.unlockedEvolutions, ["kineticLoop"]);
  assert.deepEqual(save.masteryBadges, ["scrap_pistol"]);
  assert.equal(save.weaponMastery.scrap_pistol.level, 10);
});

test("normalization migrates partial saves without losing progress", () => {
  const save = normalizeSave({ schemaVersion: 1, scrap: 31, wins: 2, unlockedWeapons: ["swarm_smg"], settings: { music: 0, autoAim: true } });
  assert.equal(save.scrap, 31);
  assert.equal(save.currencies.copper, 310, "legacy scrap is converted to copper once");
  assert.equal(save.wins, 2);
  assert.deepEqual(save.unlockedWeapons.sort(), ["scrap_pistol", "swarm_smg"]);
  assert.equal(save.settings.music, 0);
  assert.equal(save.settings.autoAim, true, "an explicit legacy preference must be preserved");
  assert.equal(save.settings.autoFire, false);
  assert.equal(save.settings.gamepadVibration, true);
  assert.equal(save.selectedMode, "survival");
});

test("pre-v3 saves receive nearest-target lock without losing their progress", () => {
  const save = normalizeSave({ schemaVersion: 2, scrap: 14, settings: { autoAim: false } });
  assert.equal(save.scrap, 14);
  assert.equal(save.settings.autoAim, true);
});

test("v3 preferences survive the schema v6 equipment migration", () => {
  const save = normalizeSave({ schemaVersion: 3, scrap: 8, settings: { autoAim: false } });
  assert.equal(save.settings.autoAim, false);
  assert.equal(save.currencies.copper, 80);
  assert.equal(save.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("schema v5 utility slots migrate into the four-part armor loadout without losing ownership", () => {
  const save = normalizeSave({
    schemaVersion: 5,
    currencies: { copper: 900, gold: 8 },
    ownedEquipment: ["iron_plate", "runner_boots", "magnet_coil", "ammo_rig", "signal_charm"],
    equippedEquipment: {
      armor: "iron_plate",
      boots: "runner_boots",
      tool: "ammo_rig",
      charm: "signal_charm"
    }
  });
  assert.deepEqual(save.equippedEquipment, {
    helmet: "signal_charm",
    chest: "iron_plate",
    legs: "ammo_rig",
    boots: "runner_boots"
  });
  for (const id of ["magnet_coil", "ammo_rig", "signal_charm"]) assert.ok(save.ownedEquipment.includes(id));
});

test("legacy sensor gear maps to a helmet and schema v6 preserves deliberately empty slots", () => {
  const migrated = normalizeSave({
    schemaVersion: 5,
    currencies: { copper: 0, gold: 0 },
    ownedEquipment: ["magnet_coil"],
    equippedEquipment: { armor: null, tool: "magnet_coil", charm: null, boots: null }
  });
  assert.equal(migrated.equippedEquipment.helmet, "magnet_coil");
  assert.equal(migrated.equippedEquipment.chest, null);

  const empty = normalizeSave({
    schemaVersion: 6,
    ownedEquipment: [],
    equippedEquipment: { helmet: null, chest: null, legs: null, boots: null }
  });
  assert.deepEqual(empty.equippedEquipment, { helmet: null, chest: null, legs: null, boots: null });
});

test("normalization retains well-formed content IDs for a later registry to resolve", () => {
  const extraction = normalizeSave({ selectedMode: "extraction" });
  const endless = normalizeSave({ selectedMode: "endless" });
  const invalid = normalizeSave({ selectedMode: "unknown-mode" });
  assert.equal(extraction.selectedMode, "extraction");
  assert.equal(endless.selectedMode, "endless");
  assert.equal(invalid.selectedMode, "unknown-mode");
});

test("desktop settings are clamped and malformed booleans fall back safely", () => {
  const save = normalizeSave({ settings: {
    music: 9,
    sfx: -2,
    gamepadDeadzone: 0.99,
    gamepadEnabled: "false",
    musicMuted: true,
    uiScale: 8,
    screenShake: "extreme"
  } });
  assert.equal(save.settings.music, 1);
  assert.equal(save.settings.sfx, 0);
  assert.equal(save.settings.gamepadDeadzone, 0.5);
  assert.equal(save.settings.gamepadEnabled, true);
  assert.equal(save.settings.musicMuted, true);
  assert.equal(save.settings.uiScale, 1.2);
  assert.equal(save.settings.screenShake, "low");
});

test("a previous valid save survives a damaged primary save", () => {
  const previous = JSON.stringify({ schemaVersion: 9, wins: 4, currencies: { copper: 870, gold: 3 } });
  const memory = new Map([[SAVE_KEY, previous]]);
  const storage = { get: (key) => memory.get(key), set: (key, value) => memory.set(key, value) };
  const first = new SaveManager(storage);
  first.load();
  first.data.wins = 5;
  assert.equal(first.persist(), true);
  assert.equal(memory.get(SAVE_BACKUP_KEY), previous);

  memory.set(SAVE_KEY, "{bad json");
  const recovered = new SaveManager(storage);
  assert.equal(recovered.load().wins, 4);
  assert.equal(recovered.status, "recovered");
  assert.equal(memory.get(SAVE_DAMAGED_KEY), "{bad json");
  assert.equal(recovered.persist(), true);
  assert.equal(JSON.parse(memory.get(SAVE_KEY)).wins, 4);
  assert.equal(memory.get(SAVE_BACKUP_KEY), previous);
});

test("a damaged save without backup is preserved before starting a fresh save", () => {
  const memory = new Map([[SAVE_KEY, "{bad json"]]);
  const manager = new SaveManager({
    get: (key) => memory.get(key),
    set: (key, value) => memory.set(key, value)
  });
  const save = manager.load();
  assert.equal(save.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(save.selectedWeapon, "scrap_pistol");
  assert.equal(manager.status, "damaged");
  assert.equal(memory.get(SAVE_DAMAGED_KEY), "{bad json");
  assert.equal(manager.persist(), true);
  assert.doesNotThrow(() => JSON.parse(memory.get(SAVE_KEY)));
});

test("a full recovery slot prevents overwriting a different damaged save", () => {
  const memory = new Map([[SAVE_KEY, "{new damage"], [SAVE_DAMAGED_KEY, "{older damage"]]);
  const manager = new SaveManager({ get: (key) => memory.get(key), set: (key, value) => memory.set(key, value) });
  manager.load();
  assert.equal(manager.readOnly, true);
  assert.equal(manager.status, "write-failed");
  assert.equal(manager.persist(), false);
  assert.equal(memory.get(SAVE_KEY), "{new damage");
  assert.equal(memory.get(SAVE_DAMAGED_KEY), "{older damage");
});

test("backup write failure leaves the last valid primary unchanged", () => {
  const original = JSON.stringify({ schemaVersion: 9, wins: 7 });
  const memory = new Map([[SAVE_KEY, original]]);
  const manager = new SaveManager({
    get: (key) => memory.get(key),
    set: (key, value) => {
      if (key === SAVE_BACKUP_KEY) throw new Error("quota exceeded");
      memory.set(key, value);
    }
  });
  manager.load();
  manager.data.wins = 8;
  assert.equal(manager.persist(), false);
  assert.equal(manager.status, "write-failed");
  assert.equal(memory.get(SAVE_KEY), original);
});
