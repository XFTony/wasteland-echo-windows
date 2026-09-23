"use strict";

const {
  GAME_MODES,
  WEAPONS,
  ENEMIES,
  UPGRADES,
  SKINS,
  HEROES,
  MAPS,
  STAGES,
  EQUIPMENT,
  SHOP_ITEMS
} = require("../config");
const { DEFAULT_WORLD } = require("../world/world-registry");
const { EQUIPMENT_SLOTS } = require("./equipment");
const { WEAPON_MECHANICS } = require("../content/weapon-mechanics");
const { BOSS_DEFINITIONS } = require("../content/boss-definitions");
const { UNLOCK_RULES } = require("../content/unlock-rules");
const { RUN_MODIFIERS } = require("../content/run-modifiers");
const { WEAPON_EVOLUTION_REWARDS } = require("../content/mastery-rewards");
const { UNLOCK_METRICS } = require("./unlock-system");

const CONTENT_REQUIREMENTS = Object.freeze({
  modes: ["id", "name", "description", "rule", "spawnProfile", "enemyLimit", "spawnStart", "spawnEnd"],
  weapons: [
    "id", "name", "description", "visualId", "rangeBand", "weaponClass", "mechanicId",
    "damage", "interval", "projectileCount", "projectileSpeed", "ttl",
    "recoil", "muzzleLength", "muzzleFlashLength", "muzzleFlashLife", "muzzleParticles",
    "lockRange", "shellLength", "shellLife", "shellColor", "color"
  ],
  enemies: ["id", "name", "hp", "speed", "damage", "radius", "role"],
  mechanics: ["id", "name", "description"],
  bosses: ["id", "enemyId", "name", "hudColor", "intro", "tactic", "phases", "drop"],
  modifiers: ["id", "name", "description", "rewardMultiplier"],
  unlockRules: ["id", "name", "description", "conditions", "reward"],
  upgrades: ["id", "name", "detail", "family", "rarity", "max"],
  skins: ["id", "name", "body", "accent", "dark"],
  heroes: ["id", "name", "description", "passive", "hpMultiplier", "speedMultiplier", "portrait"],
  maps: ["id", "name", "description", "layoutId", "worldSize", "threat"],
  stages: ["id", "order", "name", "description", "radioTitle", "radioDetail", "mapId", "duration", "difficulty", "unlockWins"],
  equipment: ["id", "slot", "visualId", "name", "description", "rarity", "stats"],
  shopItems: ["id", "category", "name", "description", "grantType", "grantId", "currency", "price", "unlockStage"]
});

function validateCatalog(name, catalog, requiredFields) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new TypeError(`Content catalog '${name}' must be an object`);
  }
  const ids = Object.keys(catalog);
  if (ids.length === 0) throw new Error(`Content catalog '${name}' cannot be empty`);
  for (const id of ids) {
    const item = catalog[id];
    if (!item || typeof item !== "object") throw new TypeError(`${name}.${id} must be an object`);
    if (item.id !== id) throw new Error(`${name}.${id}.id must match its catalog key`);
    for (const field of requiredFields) {
      if (item[field] === undefined || item[field] === null || item[field] === "") {
        throw new Error(`${name}.${id}.${field} is required`);
      }
    }
  }
  return catalog;
}

class ContentRegistry {
  constructor(catalogs, options = {}) {
    const source = catalogs || {};
    this.world = options.world || DEFAULT_WORLD;
    if (!this.world || typeof this.world.has !== "function" || typeof this.world.get !== "function") {
      throw new TypeError("ContentRegistry requires a world registry with has() and get()");
    }
    this.modes = validateCatalog("modes", source.modes || GAME_MODES, CONTENT_REQUIREMENTS.modes);
    this.weapons = validateCatalog("weapons", source.weapons || WEAPONS, CONTENT_REQUIREMENTS.weapons);
    this.enemies = validateCatalog("enemies", source.enemies || ENEMIES, CONTENT_REQUIREMENTS.enemies);
    this.mechanics = validateCatalog("mechanics", source.mechanics || WEAPON_MECHANICS, CONTENT_REQUIREMENTS.mechanics);
    this.bosses = validateCatalog("bosses", source.bosses || BOSS_DEFINITIONS, CONTENT_REQUIREMENTS.bosses);
    this.modifiers = validateCatalog("modifiers", source.modifiers || RUN_MODIFIERS, CONTENT_REQUIREMENTS.modifiers);
    this.unlockRules = validateCatalog("unlockRules", source.unlockRules || UNLOCK_RULES, CONTENT_REQUIREMENTS.unlockRules);
    this.upgrades = validateCatalog("upgrades", source.upgrades || UPGRADES, CONTENT_REQUIREMENTS.upgrades);
    this.skins = validateCatalog("skins", source.skins || SKINS, CONTENT_REQUIREMENTS.skins);
    this.heroes = validateCatalog("heroes", source.heroes || HEROES, CONTENT_REQUIREMENTS.heroes);
    this.maps = validateCatalog("maps", source.maps || MAPS, CONTENT_REQUIREMENTS.maps);
    this.stages = validateCatalog("stages", source.stages || STAGES, CONTENT_REQUIREMENTS.stages);
    this.equipment = validateCatalog("equipment", source.equipment || EQUIPMENT, CONTENT_REQUIREMENTS.equipment);
    this.shopItems = validateCatalog("shopItems", source.shopItems || SHOP_ITEMS, CONTENT_REQUIREMENTS.shopItems);
    for (const upgrade of Object.values(this.upgrades)) {
      if (!upgrade.requires) continue;
      const requirements = upgrade.requires.upgrades || {};
      for (const [requiredId, requiredLevel] of Object.entries(requirements)) {
        if (!this.upgrades[requiredId]) throw new Error(`upgrades.${upgrade.id}.requires references unknown upgrade '${requiredId}'`);
        if (!(Number(requiredLevel) > 0 && Number(requiredLevel) <= Number(this.upgrades[requiredId].max))) {
          throw new Error(`upgrades.${upgrade.id}.requires.${requiredId} must be inside the required upgrade max`);
        }
      }
      for (const weaponId of upgrade.requires.weaponIds || []) {
        if (!this.weapons[weaponId]) throw new Error(`upgrades.${upgrade.id}.requires references unknown weapon '${weaponId}'`);
      }
      const knownClasses = new Set(Object.values(this.weapons).map((weapon) => weapon.weaponClass));
      for (const weaponClass of upgrade.requires.weaponClasses || []) {
        if (!knownClasses.has(weaponClass)) throw new Error(`upgrades.${upgrade.id}.requires references unknown weapon class '${weaponClass}'`);
      }
      for (const rangeBand of upgrade.requires.rangeBands || []) {
        if (!["close", "mid", "long"].includes(rangeBand)) throw new Error(`upgrades.${upgrade.id}.requires has invalid range band '${rangeBand}'`);
      }
    }
    for (const mode of Object.values(this.modes)) {
      if (!["survive", "extract", "endless"].includes(mode.rule)) {
        throw new Error(`modes.${mode.id}.rule must be 'survive', 'extract', or 'endless'`);
      }
    }
    const weaponVisualIds = new Set();
    for (const weapon of Object.values(this.weapons)) {
      if (!["close", "mid", "long"].includes(weapon.rangeBand)) {
        throw new Error(`weapons.${weapon.id}.rangeBand must be 'close', 'mid', or 'long'`);
      }
      if (weaponVisualIds.has(weapon.visualId)) {
        throw new Error(`weapons.${weapon.id}.visualId must be unique`);
      }
      if (!this.mechanics[weapon.mechanicId]) {
        throw new Error(`weapons.${weapon.id}.mechanicId must reference a known mechanic`);
      }
      weaponVisualIds.add(weapon.visualId);
      for (const field of [
        "damage", "interval", "projectileCount", "projectileSpeed", "ttl", "recoil",
        "muzzleLength", "muzzleFlashLength", "muzzleFlashLife", "muzzleParticles",
        "lockRange", "shellLength", "shellLife"
      ]) {
        if (!(Number(weapon[field]) > 0)) throw new Error(`weapons.${weapon.id}.${field} must be greater than zero`);
      }
    }
    const bossEnemyIds = new Set();
    for (const definition of Object.values(this.bosses)) {
      if (!this.enemies[definition.enemyId]) throw new Error(`bosses.${definition.id}.enemyId must reference a known enemy`);
      if (bossEnemyIds.has(definition.enemyId)) throw new Error(`bosses.${definition.id}.enemyId must be unique`);
      bossEnemyIds.add(definition.enemyId);
      if (!Array.isArray(definition.phases) || definition.phases.length < 2) {
        throw new Error(`bosses.${definition.id}.phases must contain at least two phases`);
      }
      let previousThreshold = Infinity;
      for (const phase of definition.phases) {
        if (!phase.id || !phase.label || !phase.warning || !(Number(phase.cooldown) > 0)) {
          throw new Error(`bosses.${definition.id}.phases require id, label, warning, and positive cooldown`);
        }
        if (!(Number(phase.minHealthRatio) >= 0 && Number(phase.minHealthRatio) <= 1)) {
          throw new Error(`bosses.${definition.id}.phase minHealthRatio must be inside 0..1`);
        }
        if (Number(phase.minHealthRatio) >= previousThreshold) {
          throw new Error(`bosses.${definition.id}.phases must be ordered from high to low health`);
        }
        if (!phase.radial && !phase.aimedShot && !phase.summon) {
          throw new Error(`bosses.${definition.id}.${phase.id} must define at least one attack`);
        }
        previousThreshold = Number(phase.minHealthRatio);
      }
      if (Number(definition.phases[definition.phases.length - 1].minHealthRatio) !== 0) {
        throw new Error(`bosses.${definition.id}.final phase must start at zero health ratio`);
      }
    }
    this.bossByEnemy = Object.freeze(Object.fromEntries(
      Object.values(this.bosses).map((definition) => [definition.enemyId, definition])
    ));
    for (const stage of Object.values(this.stages)) {
      if (!this.maps[stage.mapId]) throw new Error(`stages.${stage.id}.mapId must reference a known map`);
    }
    for (const map of Object.values(this.maps)) {
      const layout = this.world.get(map.layoutId);
      if (!layout) throw new Error(`maps.${map.id}.layoutId must reference a known world layout`);
      if (Number(map.worldSize) !== Number(layout.worldSize)) {
        throw new Error(`maps.${map.id}.worldSize must match world layout '${map.layoutId}'`);
      }
    }
    const equipmentVisualIds = new Set();
    for (const item of Object.values(this.equipment)) {
      if (!EQUIPMENT_SLOTS.includes(item.slot)) {
        throw new Error(`equipment.${item.id}.slot must be one of ${EQUIPMENT_SLOTS.join(", ")}`);
      }
      if (equipmentVisualIds.has(item.visualId)) {
        throw new Error(`equipment.${item.id}.visualId must be unique`);
      }
      equipmentVisualIds.add(item.visualId);
    }
    const grantCatalogs = { weapon: "weapons", skin: "skins", equipment: "equipment" };
    for (const item of Object.values(this.shopItems)) {
      const catalogName = grantCatalogs[item.grantType];
      if (!catalogName || !this[catalogName][item.grantId]) {
        throw new Error(`shopItems.${item.id} must reference a known grant target`);
      }
      if (!["copper", "gold"].includes(item.currency)) {
        throw new Error(`shopItems.${item.id}.currency must be 'copper' or 'gold'`);
      }
    }
    const evolutionRewardSource = source.masteryEvolutionRewards || WEAPON_EVOLUTION_REWARDS;
    const masteryEvolutionRewards = {};
    for (const [weaponId, evolutionIds] of Object.entries(evolutionRewardSource)) {
      if (!this.weapons[weaponId]) throw new Error(`masteryEvolutionRewards references unknown weapon '${weaponId}'`);
      if (!Array.isArray(evolutionIds) || evolutionIds.length === 0) {
        throw new Error(`masteryEvolutionRewards.${weaponId} must contain at least one evolution`);
      }
      for (const evolutionId of evolutionIds) {
        const upgrade = this.upgrades[evolutionId];
        if (!upgrade || !upgrade.evolution || !upgrade.requires || upgrade.requires.masteryUnlock !== true) {
          throw new Error(`masteryEvolutionRewards.${weaponId} references invalid evolution '${evolutionId}'`);
        }
      }
      masteryEvolutionRewards[weaponId] = Object.freeze(Array.from(new Set(evolutionIds)));
    }
    for (const upgrade of Object.values(this.upgrades)) {
      if (!upgrade.requires || upgrade.requires.masteryUnlock !== true) continue;
      if (!Object.values(masteryEvolutionRewards).some((ids) => ids.includes(upgrade.id))) {
        throw new Error(`upgrades.${upgrade.id} requires mastery but has no weapon reward mapping`);
      }
    }
    this.masteryEvolutionRewards = Object.freeze(masteryEvolutionRewards);
    const knownUnlockMetrics = new Set(UNLOCK_METRICS);
    for (const rule of Object.values(this.unlockRules)) {
      if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
        throw new Error(`unlockRules.${rule.id}.conditions must contain at least one condition`);
      }
      for (const condition of rule.conditions) {
        if (!condition || !knownUnlockMetrics.has(condition.metric)) {
          throw new Error(`unlockRules.${rule.id} references an unknown condition metric`);
        }
        if (condition.metric === "completedStage") {
          if (!this.stages[condition.id]) throw new Error(`unlockRules.${rule.id} references unknown stage '${condition.id}'`);
        } else if (!(Number(condition.gte) > 0)) {
          throw new Error(`unlockRules.${rule.id}.${condition.metric}.gte must be greater than zero`);
        }
      }
      const reward = rule.reward || {};
      if (reward.kind === "shopBlueprint") {
        if (!this.shopItems[reward.id]) throw new Error(`unlockRules.${rule.id} references unknown shop item '${reward.id}'`);
      } else if (reward.kind === "hero") {
        if (!this.heroes[reward.id]) throw new Error(`unlockRules.${rule.id} references unknown hero '${reward.id}'`);
      } else if (reward.kind === "modifier") {
        if (!this.modifiers[reward.id]) throw new Error(`unlockRules.${rule.id} references unknown modifier '${reward.id}'`);
      } else {
        throw new Error(`unlockRules.${rule.id}.reward.kind is invalid`);
      }
    }
    for (const item of Object.values(this.shopItems)) {
      if (!item.unlockRuleId) continue;
      const rule = this.unlockRules[item.unlockRuleId];
      if (!rule || rule.reward.kind !== "shopBlueprint" || rule.reward.id !== item.id) {
        throw new Error(`shopItems.${item.id}.unlockRuleId must reference its own blueprint rule`);
      }
    }
    this.defaults = Object.freeze({
      mode: this.modes.survival ? "survival" : Object.keys(this.modes)[0],
      weapon: this.weapons.scrap_pistol ? "scrap_pistol" : Object.keys(this.weapons)[0],
      skin: this.skins.wanderer ? "wanderer" : Object.keys(this.skins)[0],
      enemy: this.enemies.drifter ? "drifter" : Object.keys(this.enemies)[0],
      hero: this.heroes.ranger ? "ranger" : Object.keys(this.heroes)[0],
      map: this.maps.echo_district ? "echo_district" : Object.keys(this.maps)[0],
      stage: this.stages.signal_dawn ? "signal_dawn" : Object.keys(this.stages)[0],
      equipment: this.equipment.field_vest ? "field_vest" : Object.keys(this.equipment)[0]
    });
    this.catalogIds = Object.freeze(Object.fromEntries(
      Object.keys(CONTENT_REQUIREMENTS).map((name) => [name, Object.freeze(Object.keys(this[name]))])
    ));
    Object.freeze(this);
  }

  has(type, id) {
    return Boolean(this[type] && this[type][id]);
  }

  get(type, id, fallbackId = null) {
    const catalog = this[type];
    if (!catalog) return null;
    return catalog[id] || (fallbackId ? catalog[fallbackId] : null) || null;
  }

  ids(type) {
    return this.catalogIds[type] || [];
  }

  bossForEnemy(enemyId) {
    return this.bossByEnemy[enemyId] || null;
  }
}

const DEFAULT_CONTENT = new ContentRegistry({
  modes: GAME_MODES,
  weapons: WEAPONS,
  enemies: ENEMIES,
  mechanics: WEAPON_MECHANICS,
  bosses: BOSS_DEFINITIONS,
  modifiers: RUN_MODIFIERS,
  unlockRules: UNLOCK_RULES,
  masteryEvolutionRewards: WEAPON_EVOLUTION_REWARDS,
  upgrades: UPGRADES,
  skins: SKINS,
  heroes: HEROES,
  maps: MAPS,
  stages: STAGES,
  equipment: EQUIPMENT,
  shopItems: SHOP_ITEMS
}, { world: DEFAULT_WORLD });

module.exports = { CONTENT_REQUIREMENTS, validateCatalog, ContentRegistry, DEFAULT_CONTENT };
