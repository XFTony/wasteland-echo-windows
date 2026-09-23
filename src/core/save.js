"use strict";

const { DEFAULT_KEY_BINDINGS, normalizeKeyBindings } = require("../input/key-bindings");

const SAVE_KEY = "wasteland_echo_save_v1";
const SAVE_BACKUP_KEY = `${SAVE_KEY}_backup`;
const SAVE_DAMAGED_KEY = `${SAVE_KEY}_damaged`;
const CURRENT_SCHEMA_VERSION = 9;
const AUTO_AIM_SCHEMA_VERSION = 3;
const ARMOR_LOADOUT_SCHEMA_VERSION = 6;
const LEGACY_EQUIPMENT_TARGETS = Object.freeze({
  magnet_coil: "helmet",
  ammo_rig: "legs",
  signal_charm: "helmet"
});

const DEFAULT_SETTINGS = Object.freeze({
  music: 0.55,
  sfx: 0.75,
  musicMuted: false,
  sfxMuted: false,
  uiScale: 1,
  gamepadEnabled: true,
  gamepadVibration: true,
  gamepadDeadzone: 0.18,
  showControlHints: true,
  showFps: false,
  screenShake: "low",
  flashes: "low",
  autoAim: true,
  autoFire: false
});

function normalizeSettings(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const settings = { ...DEFAULT_SETTINGS, ...source };
  settings.music = Math.max(0, Math.min(1, Number(settings.music) || 0));
  settings.sfx = Math.max(0, Math.min(1, Number(settings.sfx) || 0));
  settings.gamepadDeadzone = Math.max(0.05, Math.min(0.5, Number(settings.gamepadDeadzone) || 0.18));
  settings.uiScale = Math.max(0.8, Math.min(1.2, Number(settings.uiScale) || 1));
  if (!["off", "low", "high"].includes(settings.screenShake)) settings.screenShake = DEFAULT_SETTINGS.screenShake;
  if (!["off", "low", "high"].includes(settings.flashes)) settings.flashes = DEFAULT_SETTINGS.flashes;
  for (const key of ["musicMuted", "sfxMuted", "gamepadEnabled", "gamepadVibration", "showControlHints", "showFps", "autoAim", "autoFire"]) {
    settings[key] = typeof source[key] === "boolean" ? source[key] : DEFAULT_SETTINGS[key];
  }
  return settings;
}

function createDefaultSave() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currencies: { copper: 250, gold: 0 },
    totalCopper: 250,
    totalGold: 0,
    // Kept as a v3 compatibility counter. New interfaces display copper/gold.
    scrap: 0,
    totalScrap: 0,
    totalKills: 0,
    eliteKills: 0,
    bestTime: 0,
    bestNoHitTime: 0,
    wins: 0,
    unlockedWeapons: ["scrap_pistol"],
    unlockedSkins: ["wanderer"],
    unlockedHeroes: ["ranger", "mechanic"],
    unlockedMaps: ["echo_district"],
    completedStages: [],
    ownedEquipment: ["field_vest"],
    equippedEquipment: { helmet: null, chest: "field_vest", legs: null, boots: null },
    selectedWeapon: "scrap_pistol",
    selectedSkin: "wanderer",
    selectedHero: "ranger",
    selectedMap: "echo_district",
    selectedStage: "signal_dawn",
    selectedMode: "survival",
    shopCategory: "weapon",
    settings: { ...DEFAULT_SETTINGS },
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    achievements: {},
    tutorialCompleted: false,
    tutorialSkipped: false,
    weaponMastery: {},
    unlockedBlueprints: [],
    unlockedModifiers: [],
    completedUnlockRules: [],
    claimedMasteryRewards: [],
    unlockedEvolutions: [],
    masteryBadges: [],
    runHistory: []
  };
}

function uniqueIds(value, required = []) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set([...required, ...source.filter((id) => typeof id === "string" && id)]));
}

function nonNegativeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

function optionalId(value, fallback) {
  return typeof value === "string" && value ? value : fallback;
}

function ownsKey(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function migrateEquipmentLoadout(candidateLoadout, sourceVersion, owned) {
  const modern = sourceVersion >= ARMOR_LOADOUT_SCHEMA_VERSION;
  const loadout = {
    helmet: ownsKey(candidateLoadout, "helmet") ? candidateLoadout.helmet : null,
    chest: ownsKey(candidateLoadout, "chest")
      ? candidateLoadout.chest
      : ownsKey(candidateLoadout, "armor") ? candidateLoadout.armor : modern ? null : "field_vest",
    legs: ownsKey(candidateLoadout, "legs") ? candidateLoadout.legs : null,
    boots: ownsKey(candidateLoadout, "boots") ? candidateLoadout.boots : null
  };

  if (!modern) {
    // Preserve stable legacy item IDs while moving the former utility slots into
    // the four visible armor locations. A collision only changes which item is
    // worn; every migrated item remains owned and selectable from the backpack.
    for (const itemId of [candidateLoadout.charm, candidateLoadout.tool]) {
      const target = LEGACY_EQUIPMENT_TARGETS[itemId];
      if (target && !loadout[target]) loadout[target] = itemId;
    }
  }

  for (const slot of Object.keys(loadout)) {
    const itemId = loadout[slot];
    if (itemId && !owned.includes(itemId)) loadout[slot] = null;
  }
  return loadout;
}

function normalizeSave(candidate) {
  const defaults = createDefaultSave();
  if (!candidate || typeof candidate !== "object") return defaults;
  const sourceVersion = Number(candidate.schemaVersion) || 0;
  const candidateSettings = candidate.settings && typeof candidate.settings === "object" ? candidate.settings : {};
  const normalized = {
    ...defaults,
    ...candidate,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: normalizeSettings(candidateSettings),
    keyBindings: normalizeKeyBindings(candidate.keyBindings)
  };
  // v0.4 introduced nearest-target lock. Only saves older than that migration
  // are changed; a v3 player's explicit preference remains intact in schema v4.
  if (sourceVersion < AUTO_AIM_SCHEMA_VERSION) normalized.settings.autoAim = true;
  const sourceWallet = candidate.currencies && typeof candidate.currencies === "object" ? candidate.currencies : null;
  const migratedCopper = sourceVersion < CURRENT_SCHEMA_VERSION && !sourceWallet
    ? nonNegativeInteger(candidate.scrap) * 10
    : 250;
  normalized.currencies = {
    copper: nonNegativeInteger(sourceWallet && sourceWallet.copper, migratedCopper),
    gold: nonNegativeInteger(sourceWallet && sourceWallet.gold, 0)
  };
  normalized.totalCopper = Math.max(normalized.currencies.copper, nonNegativeInteger(candidate.totalCopper, normalized.currencies.copper));
  normalized.totalGold = Math.max(normalized.currencies.gold, nonNegativeInteger(candidate.totalGold, normalized.currencies.gold));
  normalized.scrap = nonNegativeInteger(candidate.scrap);
  normalized.totalScrap = Math.max(normalized.scrap, nonNegativeInteger(candidate.totalScrap));
  normalized.totalKills = nonNegativeInteger(candidate.totalKills);
  normalized.eliteKills = nonNegativeInteger(candidate.eliteKills);
  normalized.wins = nonNegativeInteger(candidate.wins);
  normalized.unlockedWeapons = uniqueIds(candidate.unlockedWeapons, ["scrap_pistol"]);
  normalized.unlockedSkins = uniqueIds(candidate.unlockedSkins, ["wanderer"]);
  normalized.unlockedHeroes = uniqueIds(candidate.unlockedHeroes, ["ranger", "mechanic"]);
  normalized.unlockedMaps = uniqueIds(candidate.unlockedMaps, ["echo_district"]);
  normalized.completedStages = uniqueIds(candidate.completedStages);
  normalized.ownedEquipment = uniqueIds(candidate.ownedEquipment, ["field_vest"]);
  const candidateLoadout = candidate.equippedEquipment && typeof candidate.equippedEquipment === "object"
    ? candidate.equippedEquipment
    : {};
  normalized.equippedEquipment = migrateEquipmentLoadout(candidateLoadout, sourceVersion, normalized.ownedEquipment);
  // Content IDs are resolved against the active registry by GameModel. Keeping a
  // well-formed unknown ID here allows a later content update to restore a
  // previously selected item instead of permanently resetting it during load.
  normalized.selectedWeapon = optionalId(candidate.selectedWeapon, defaults.selectedWeapon);
  normalized.selectedSkin = optionalId(candidate.selectedSkin, defaults.selectedSkin);
  normalized.selectedHero = optionalId(candidate.selectedHero, defaults.selectedHero);
  normalized.selectedMap = optionalId(candidate.selectedMap, defaults.selectedMap);
  normalized.selectedStage = optionalId(candidate.selectedStage, defaults.selectedStage);
  normalized.selectedMode = optionalId(candidate.selectedMode, defaults.selectedMode);
  normalized.shopCategory = optionalId(candidate.shopCategory, defaults.shopCategory);
  normalized.achievements = candidate.achievements && typeof candidate.achievements === "object" && !Array.isArray(candidate.achievements)
    ? Object.fromEntries(Object.entries(candidate.achievements).filter(([id, unlocked]) => typeof id === "string" && id && unlocked === true))
    : {};
  normalized.tutorialCompleted = candidate.tutorialCompleted === true;
  normalized.tutorialSkipped = candidate.tutorialSkipped === true;
  normalized.unlockedBlueprints = uniqueIds(candidate.unlockedBlueprints);
  normalized.unlockedModifiers = uniqueIds(candidate.unlockedModifiers);
  normalized.completedUnlockRules = uniqueIds(candidate.completedUnlockRules);
  normalized.claimedMasteryRewards = uniqueIds(candidate.claimedMasteryRewards);
  normalized.unlockedEvolutions = uniqueIds(candidate.unlockedEvolutions);
  normalized.masteryBadges = uniqueIds(candidate.masteryBadges);
  normalized.weaponMastery = candidate.weaponMastery && typeof candidate.weaponMastery === "object" && !Array.isArray(candidate.weaponMastery)
    ? Object.fromEntries(Object.entries(candidate.weaponMastery).filter(([id, record]) => typeof id === "string" && record && typeof record === "object").map(([id, record]) => [id, {
      kills: nonNegativeInteger(record.kills),
      runs: nonNegativeInteger(record.runs),
      experience: nonNegativeInteger(record.experience, nonNegativeInteger(record.kills) + nonNegativeInteger(record.runs) * 5),
      level: Math.max(1, Math.min(10, nonNegativeInteger(record.level, 1)))
    }]))
    : {};
  normalized.runHistory = Array.isArray(candidate.runHistory)
    ? candidate.runHistory.slice(0, 20).filter((record) => record && typeof record === "object").map((record) => ({
      seed: nonNegativeInteger(record.seed),
      modeId: optionalId(record.modeId, defaults.selectedMode),
      stageId: optionalId(record.stageId, defaults.selectedStage),
      weaponId: optionalId(record.weaponId, defaults.selectedWeapon),
      result: record.result === "win" ? "win" : "lose",
      elapsed: Math.max(0, Number(record.elapsed) || 0),
      kills: nonNegativeInteger(record.kills),
      damageDealt: Math.max(0, Number(record.damageDealt) || 0),
      accuracy: Math.max(0, Math.min(1, Number(record.accuracy) || 0)),
      maxNoHitTime: Math.max(0, Number(record.maxNoHitTime) || 0),
      masteryGain: nonNegativeInteger(record.masteryGain),
      masteryLevel: Math.max(1, nonNegativeInteger(record.masteryLevel, 1)),
      completedAt: nonNegativeInteger(record.completedAt)
    }))
    : [];
  return normalized;
}

class SaveManager {
  constructor(storage) {
    this.storage = storage;
    this.data = createDefaultSave();
    this.status = "ok";
    this.readOnly = false;
  }

  load() {
    this.status = "ok";
    this.readOnly = false;
    if (!this.storage) return this.data;
    let primary;
    let backup;
    try {
      primary = this.storage.get(SAVE_KEY);
      backup = this.storage.get(SAVE_BACKUP_KEY);
    } catch (_error) {
      this.data = createDefaultSave();
      this.status = "write-failed";
      this.readOnly = true;
      return this.data;
    }
    const parse = (raw) => {
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid save root");
      return normalizeSave(value);
    };
    try {
      this.data = parse(primary) || parse(backup) || createDefaultSave();
      if (!primary && backup) this.status = "recovered";
      return this.data;
    } catch (_error) {
      // Keep the exact broken bytes before the constructor's migration write.
      // If there is no safe place to store them, never overwrite the only copy.
      if (primary) {
        try {
          const existing = this.storage.get(SAVE_DAMAGED_KEY);
          if (existing && existing !== primary) throw new Error("Recovery slot already occupied");
          if (!existing) this.storage.set(SAVE_DAMAGED_KEY, primary);
        } catch (_preservationError) {
          this.readOnly = true;
          this.status = "write-failed";
        }
      }
      try {
        this.data = parse(backup) || createDefaultSave();
        if (!this.readOnly) this.status = backup ? "recovered" : "damaged";
      } catch (_backupError) {
        this.data = createDefaultSave();
        if (!this.readOnly) this.status = "damaged";
      }
    }
    return this.data;
  }

  persist() {
    if (this.readOnly) return false;
    if (!this.storage) return true;
    try {
      const previous = this.storage.get(SAVE_KEY);
      if (previous) {
        let validPrevious = false;
        try {
          const parsed = JSON.parse(previous);
          validPrevious = Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
        } catch (_invalidPrevious) {
          // The damaged value was already preserved in load().
        }
        if (validPrevious) this.storage.set(SAVE_BACKUP_KEY, previous);
      }
      this.storage.set(SAVE_KEY, JSON.stringify(this.data));
      if (this.status === "write-failed") this.status = "ok";
      return true;
    } catch (_error) {
      this.status = "write-failed";
      return false;
    }
  }

  reset() {
    this.data = createDefaultSave();
    this.persist();
    return this.data;
  }
}

module.exports = {
  SAVE_KEY,
  SAVE_BACKUP_KEY,
  SAVE_DAMAGED_KEY,
  CURRENT_SCHEMA_VERSION,
  AUTO_AIM_SCHEMA_VERSION,
  ARMOR_LOADOUT_SCHEMA_VERSION,
  LEGACY_EQUIPMENT_TARGETS,
  DEFAULT_SETTINGS,
  normalizeSettings,
  createDefaultSave,
  migrateEquipmentLoadout,
  normalizeSave,
  SaveManager
};
