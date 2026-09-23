"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { GAME_MODES, WEAPONS, ENEMIES, UPGRADES, SKINS, HEROES, MAPS, STAGES, EQUIPMENT, SHOP_ITEMS } = require("../src/config");
const { ContentRegistry, DEFAULT_CONTENT } = require("../src/core/content-registry");
const { SaveManager } = require("../src/core/save");
const { GameModel } = require("../src/core/game-model");

function registry(overrides = {}) {
  return new ContentRegistry({
    modes: overrides.modes || GAME_MODES,
    weapons: overrides.weapons || WEAPONS,
    enemies: overrides.enemies || ENEMIES,
    bosses: overrides.bosses,
    modifiers: overrides.modifiers,
    unlockRules: overrides.unlockRules,
    masteryEvolutionRewards: overrides.masteryEvolutionRewards,
    upgrades: overrides.upgrades || UPGRADES,
    skins: overrides.skins || SKINS,
    heroes: overrides.heroes || HEROES,
    maps: overrides.maps || MAPS,
    stages: overrides.stages || STAGES,
    equipment: overrides.equipment || EQUIPMENT,
    shopItems: overrides.shopItems || SHOP_ITEMS
  }, { world: overrides.world });
}

function saveManager(initial = null) {
  let serialized = initial ? JSON.stringify(initial) : null;
  return new SaveManager({
    get: () => serialized,
    set: (_key, value) => { serialized = value; }
  });
}

test("default content registry exposes stable IDs shared by model and renderer", () => {
  assert.equal(DEFAULT_CONTENT.get("weapons", "scrap_pistol").name, "废料手枪");
  assert.equal(DEFAULT_CONTENT.defaults.mode, "survival");
  assert.ok(DEFAULT_CONTENT.ids("upgrades").length >= 14);
  assert.equal(DEFAULT_CONTENT.ids("heroes").length, 3);
  assert.equal(DEFAULT_CONTENT.ids("maps").length, 3);
  assert.equal(DEFAULT_CONTENT.ids("stages").length, 3);
  assert.ok(DEFAULT_CONTENT.ids("weapons").length >= 7);
  assert.equal(DEFAULT_CONTENT.ids("mechanics").length, 7);
  assert.equal(DEFAULT_CONTENT.ids("bosses").length, 2);
  assert.equal(DEFAULT_CONTENT.ids("unlockRules").length, 15);
  assert.equal(DEFAULT_CONTENT.ids("modifiers").length, 4);
  assert.equal(DEFAULT_CONTENT.bossForEnemy("iron_colossus").name, "铁幕巨像");
  assert.deepEqual(DEFAULT_CONTENT.masteryEvolutionRewards.scrap_pistol, ["kineticLoop"]);
  assert.ok(DEFAULT_CONTENT.ids("shopItems").length >= 13);
  assert.equal(new Set(DEFAULT_CONTENT.ids("weapons").map((id) => DEFAULT_CONTENT.weapons[id].visualId)).size, DEFAULT_CONTENT.ids("weapons").length);
  assert.equal(Object.isFrozen(DEFAULT_CONTENT.ids("weapons")), true);
});

test("content registry rejects malformed extension data at startup", () => {
  const invalidWeapons = {
    ...WEAPONS,
    broken: { ...WEAPONS.scrap_pistol, id: "different" }
  };
  assert.throws(() => registry({ weapons: invalidWeapons }), /must match its catalog key/);
  const missingField = {
    ...ENEMIES,
    invalid: { id: "invalid", name: "Invalid" }
  };
  assert.throws(() => registry({ enemies: missingField }), /is required/);
  const duplicateVisual = {
    ...WEAPONS,
    duplicate: { ...WEAPONS.scrap_pistol, id: "duplicate", name: "重复视觉" }
  };
  assert.throws(() => registry({ weapons: duplicateVisual }), /visualId must be unique/);
  const invalidBand = {
    ...WEAPONS,
    invalid_band: { ...WEAPONS.scrap_pistol, id: "invalid_band", visualId: "invalid-band", rangeBand: "global" }
  };
  assert.throws(() => registry({ weapons: invalidBand }), /rangeBand/);
  const invalidEquipmentSlot = {
    ...EQUIPMENT,
    broken_gear: { ...EQUIPMENT.field_vest, id: "broken_gear", visualId: "broken-gear", slot: "trinket" }
  };
  assert.throws(() => registry({ equipment: invalidEquipmentSlot }), /slot must be one of/);
  const duplicateEquipmentVisual = {
    ...EQUIPMENT,
    duplicate_gear: { ...EQUIPMENT.field_vest, id: "duplicate_gear" }
  };
  assert.throws(() => registry({ equipment: duplicateEquipmentVisual }), /visualId must be unique/);
});

test("content registry rejects evolution prerequisites that cannot resolve", () => {
  const broken = {
    ...UPGRADES,
    impossibleEvolution: {
      id: "impossibleEvolution",
      name: "错误进化",
      detail: "测试",
      family: "firepower",
      rarity: "evolution",
      max: 1,
      evolution: true,
      requires: { upgrades: { missingUpgrade: 1 } }
    }
  };
  assert.throws(() => registry({ upgrades: broken }), /unknown upgrade/);
});

test("content registry rejects unlock rules with unresolved rewards or metrics", () => {
  const badMetric = {
    bad_rule: {
      id: "bad_rule",
      name: "错误规则",
      description: "测试",
      conditions: [{ metric: "unknown", gte: 1 }],
      reward: { kind: "hero", id: "ranger" }
    }
  };
  assert.throws(() => registry({ unlockRules: badMetric }), /unknown condition metric/);
  const badReward = {
    bad_rule: {
      id: "bad_rule",
      name: "错误规则",
      description: "测试",
      conditions: [{ metric: "wins", gte: 1 }],
      reward: { kind: "hero", id: "missing" }
    }
  };
  assert.throws(() => registry({ unlockRules: badReward }), /unknown hero/);
});

test("content registry validates mastery evolution mappings and complete boss phases", () => {
  assert.throws(() => registry({ masteryEvolutionRewards: { missing_weapon: ["kineticLoop"] } }), /unknown weapon/);
  const brokenBoss = {
    broken: {
      id: "broken",
      enemyId: "warden",
      name: "错误首领",
      hudColor: "#fff",
      intro: "测试",
      tactic: "测试",
      phases: [
        { id: "one", label: "阶段一", minHealthRatio: 0.5, cooldown: 1, warning: "测试", radial: { count: 1 } },
        { id: "two", label: "阶段二", minHealthRatio: 0, cooldown: 1, warning: "测试" }
      ],
      drop: { scrap: 0, healing: 0 }
    }
  };
  assert.throws(() => registry({ bosses: brokenBoss }), /at least one attack/);
});

test("a new weapon can be injected without editing the game model", () => {
  const customWeapon = {
    ...WEAPONS.scrap_pistol,
    id: "test_carbine",
    name: "测试卡宾枪",
    visualId: "test-carbine",
    damage: 19
  };
  const content = registry({ weapons: { ...WEAPONS, test_carbine: customWeapon } });
  const model = new GameModel(saveManager(), { duration: 60, seed: 3, content });
  model.startRun({ weaponId: "test_carbine", seed: 3 });
  model.enemies.length = 0;
  model.spawnEnemy("drifter", model.run.player.x + 120, model.run.player.y);
  model.fireWeapon(1, 0);
  assert.equal(model.run.player.weaponId, "test_carbine");
  assert.equal(model.projectiles[0].damage, 19);
});

test("a new upgrade effect can be injected through the extension contract", () => {
  const customUpgrade = {
    id: "desktop_boost",
    name: "桌面增压",
    detail: "速度提升",
    flavor: "扩展契约测试",
    family: "mobility",
    rarity: "standard",
    max: 1
  };
  const content = registry({ upgrades: { ...UPGRADES, desktop_boost: customUpgrade } });
  const model = new GameModel(saveManager(), {
    duration: 60,
    seed: 5,
    content,
    upgradeEffects: { desktop_boost: (player) => { player.speed += 25; } }
  });
  model.startRun({ seed: 5 });
  const before = model.run.player.speed;
  model.screen = "levelup";
  model.run.upgradeOptions = [customUpgrade];
  assert.equal(model.chooseUpgrade("desktop_boost"), true);
  assert.equal(model.run.player.speed, before + 25);
});

test("save IDs are resolved by the active registry instead of a hard-coded save allowlist", () => {
  const fallback = new GameModel(saveManager({ selectedMode: "retired-mode" }), { duration: 60, seed: 9 });
  assert.equal(fallback.selectedMode, "survival");

  const patrol = {
    ...GAME_MODES.survival,
    id: "patrol",
    name: "巡逻",
    description: "用于验证可扩展存档选择"
  };
  const content = registry({ modes: { ...GAME_MODES, patrol } });
  const restored = new GameModel(saveManager({ selectedMode: "patrol" }), { duration: 60, seed: 9, content });
  assert.equal(restored.selectedMode, "patrol");
});
