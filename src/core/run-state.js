"use strict";

const { createMechanicState } = require("./mechanic-system");
const PLAYER_RADIUS = 10;

function createBasePlayerStats(mode) {
  const survival = mode.rule !== "extract";
  const playerHp = Number(mode.playerHp) || (survival ? 115 : 100);
  const playerSpeed = Number(mode.playerSpeed) || (survival ? 178 : 170);
  return {
    hp: playerHp,
    maxHp: playerHp,
    speed: playerSpeed,
    pickupRadius: 48,
    armor: 0,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    copperMultiplier: 1,
    lockRangeMultiplier: 1
  };
}

function createRunState({ duration, worldSize, weaponId, skinId, modeId, heroId = "ranger", mapId = "echo_district", stageId = "signal_dawn", difficulty = 1, seed = 0, mode }) {
  const survival = mode.rule !== "extract";
  const baseStats = createBasePlayerStats(mode);
  return {
    modeId,
    seed,
    heroId,
    mapId,
    stageId,
    rule: mode.rule,
    endless: mode.rule === "endless",
    spawnProfile: mode.spawnProfile,
    duration,
    difficulty: Number(difficulty) || 1,
    elapsed: 0,
    overtime: 0,
    kills: 0,
    eliteKills: 0,
    scrap: 0,
    hitCount: 0,
    shotsFired: 0,
    projectilesFired: 0,
    hits: 0,
    criticalHits: 0,
    damageDealt: 0,
    damageTaken: 0,
    damageTakenBySource: {},
    maxNoHitTime: 0,
    masteryGain: 0,
    masteryLevel: 1,
    masteryRewards: [],
    unlockRewards: [],
    accuracy: 0,
    tutorial: null,
    bossOneSpawned: false,
    bossTwoSpawned: false,
    nextEndlessBossAt: 180,
    endlessBossWave: 0,
    finalWaveAnnounced: false,
    spawnAccumulator: 0,
    spawnPhaseIndex: -1,
    result: null,
    advice: [],
    payout: null,
    equipmentIds: [],
    equipmentLoadout: {},
    upgrades: {},
    upgradeOrder: [],
    mechanicUpgrades: {},
    mechanics: createMechanicState(),
    upgradeOptions: [],
    extraction: {
      active: false,
      x: 1260,
      y: 1000,
      radius: 70,
      hold: 0,
      required: 2.5
    },
    input: { moveX: 0, moveY: 0, aimX: 1, aimY: 0, aimActive: false, firing: false },
    player: {
      x: worldSize / 2,
      y: worldSize / 2,
      radius: PLAYER_RADIUS,
      ...baseStats,
      invulnerable: 0,
      weaponId,
      skinId,
      heroId,
      weaponCooldown: 0,
      lastAimX: 1,
      lastAimY: 0,
      aimTargetId: null,
      xp: 0,
      level: 1,
      xpNext: 10,
      projectileBonus: 0,
      pierceBonus: 0,
      projectileSpeedMultiplier: 1,
      projectileRangeMultiplier: 1,
      projectileRadiusBonus: 0,
      knockbackMultiplier: 1,
      criticalChance: 0,
      criticalMultiplier: 2,
      regenPerSecond: 0,
      scrapChanceBonus: 0,
      scrapMultiplier: 1,
      invulnerabilityDuration: Number(mode.playerInvulnerability) || (survival ? 0.72 : 0.6),
      noHitTime: 0
    }
  };
}

module.exports = { PLAYER_RADIUS, createBasePlayerStats, createRunState };
