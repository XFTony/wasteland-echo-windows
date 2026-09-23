"use strict";

const DEFAULT_LIMITS = Object.freeze({
  enemies: 128,
  projectiles: 180,
  enemyShots: 120,
  pickups: 140,
  projectileWarmup: 96,
  enemyWarmup: 88,
  pickupWarmup: 140,
  gridCellSize: 96
});

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function normalizeLimits(candidate = {}) {
  const enemies = boundedInteger(candidate.enemies, DEFAULT_LIMITS.enemies, 16, 512);
  const projectiles = boundedInteger(candidate.projectiles, DEFAULT_LIMITS.projectiles, 16, 1000);
  const enemyShots = boundedInteger(candidate.enemyShots, DEFAULT_LIMITS.enemyShots, 16, 1000);
  const pickups = boundedInteger(candidate.pickups, DEFAULT_LIMITS.pickups, 16, 2000);
  return Object.freeze({
    enemies,
    projectiles,
    enemyShots,
    pickups,
    projectileWarmup: boundedInteger(candidate.projectileWarmup, DEFAULT_LIMITS.projectileWarmup, 0, projectiles + enemyShots),
    enemyWarmup: boundedInteger(candidate.enemyWarmup, DEFAULT_LIMITS.enemyWarmup, 0, enemies),
    pickupWarmup: boundedInteger(candidate.pickupWarmup, DEFAULT_LIMITS.pickupWarmup, 0, pickups),
    gridCellSize: boundedInteger(candidate.gridCellSize, DEFAULT_LIMITS.gridCellSize, 32, 256)
  });
}

function makeProjectile() {
  return {
    active: false,
    id: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 3,
    ttl: 0,
    damage: 0,
    pierce: 0,
    knockback: 0,
    color: "#fff",
    owner: "player",
    sourceType: null,
    sourceRole: null,
    critical: false,
    hitIds: new Set()
  };
}

function resetProjectile(item, values) {
  Object.assign(item, values);
  item.critical = Boolean(values.critical);
  item.sourceType = values.sourceType || null;
  item.sourceRole = values.sourceRole || null;
  item.hitIds.clear();
}

function makeEnemy() {
  return {
    active: false,
    id: 0,
    type: "drifter",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 1,
    maxHp: 1,
    speed: 1,
    damage: 1,
    radius: 8,
    xp: 1,
    scrapChance: 0,
    color: "#fff",
    role: "chaser",
    elite: false,
    boss: false,
    bossDefinitionId: null,
    bossPhaseId: null,
    hitFlash: 0,
    hitCooldown: 0,
    actionCooldown: 0,
    dashTime: 0,
    navigationTime: 0,
    bossPhase: 0,
    knockbackResistance: 0,
    heading: 0
  };
}

function resetEnemy(item, values) {
  Object.assign(item, values);
  item.vx = 0;
  item.vy = 0;
  item.hitFlash = 0;
  item.hitCooldown = 0;
  item.actionCooldown = values.actionCooldown || 0;
  item.dashTime = 0;
  item.navigationTime = 0;
  item.bossPhase = 0;
  item.bossDefinitionId = values.bossDefinitionId || null;
  item.bossPhaseId = null;
}

function makePickup() {
  return {
    active: false,
    id: 0,
    type: "xp",
    x: 0,
    y: 0,
    value: 1,
    radius: 5,
    age: 0
  };
}

function resetPickup(item, values) {
  Object.assign(item, values);
  item.age = 0;
}

module.exports = {
  DEFAULT_LIMITS,
  normalizeLimits,
  makeProjectile,
  resetProjectile,
  makeEnemy,
  resetEnemy,
  makePickup,
  resetPickup
};
