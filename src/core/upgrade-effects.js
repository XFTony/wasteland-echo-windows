"use strict";

function enableMechanicUpgrade(id) {
  return (_player, run, model) => {
    const nextLevel = (Number(run.upgrades[id]) || 0) + 1;
    model.mechanicSystem.enableUpgrade(run, id, nextLevel);
  };
}

const DEFAULT_UPGRADE_EFFECTS = Object.freeze({
  damage(player) { player.damageMultiplier *= 1.15; },
  fireRate(player) { player.fireRateMultiplier *= 1.12; },
  projectile(player) { player.projectileBonus += 1; },
  pierce(player) { player.pierceBonus += 1; },
  velocity(player) {
    player.projectileSpeedMultiplier *= 1.16;
    player.projectileRangeMultiplier *= 1.08;
  },
  caliber(player) {
    player.projectileRadiusBonus += 0.6;
    player.knockbackMultiplier *= 1.18;
  },
  critical(player) { player.criticalChance = Math.min(0.42, player.criticalChance + 0.07); },
  speed(player) { player.speed *= 1.08; },
  vitality(player) {
    player.maxHp += 15;
    player.hp = Math.min(player.maxHp, player.hp + 15);
  },
  magnet(player) { player.pickupRadius *= 1.25; },
  armor(player) { player.armor = Math.min(0.45, player.armor + 0.08); },
  recovery(player) { player.regenPerSecond += 0.4; },
  scavenger(player) {
    player.scrapChanceBonus = Math.min(0.4, player.scrapChanceBonus + 0.08);
    player.scrapMultiplier *= 1.2;
  },
  phaseLining(player) { player.invulnerabilityDuration += 0.08; },
  executionCapacitor: enableMechanicUpgrade("executionCapacitor"),
  reactivePlating: enableMechanicUpgrade("reactivePlating"),
  salvageOverdrive: enableMechanicUpgrade("salvageOverdrive"),
  pointBlankRelay: enableMechanicUpgrade("pointBlankRelay"),
  focusProtocol: enableMechanicUpgrade("focusProtocol"),
  cascadeRounds: enableMechanicUpgrade("cascadeRounds"),
  penetratorDoctrine(player) {
    player.damageMultiplier *= 1.25;
    player.pierceBonus += 2;
    player.projectileRadiusBonus += 1;
  },
  swarmProtocol(player) {
    player.projectileBonus += 2;
    player.fireRateMultiplier *= 1.15;
    player.damageMultiplier *= 0.88;
  },
  recoveryField(player) {
    player.pickupRadius *= 1.8;
    player.regenPerSecond += 0.8;
  },
  phaseAegis(player) {
    player.armor = Math.min(0.55, player.armor + 0.1);
    player.invulnerabilityDuration += 0.12;
    player.speed *= 1.08;
  },
  kineticLoop(player) {
    player.speed *= 1.16;
    player.invulnerabilityDuration += 0.1;
    player.criticalChance = Math.min(0.5, player.criticalChance + 0.05);
  },
  arcNetwork(player) {
    player.projectileSpeedMultiplier *= 1.2;
    player.damageMultiplier *= 1.12;
    player.pierceBonus += 1;
  }
});

module.exports = { DEFAULT_UPGRADE_EFFECTS };
