"use strict";

const SURVIVAL_MAPS = Object.freeze({
  echo_district: Object.freeze({ radioTitle: "余火电台 · 回声旧城", radioDetail: "在广播广场补给，沿街巷寻找生路。", weights: { drifter: 6, runner: 2.6, crawler: 2, spitter: 1.7, brute: 1.1, screecher: .9 } }),
  freight_nexus: Object.freeze({ radioTitle: "余火电台 · 锈轨枢纽", radioDetail: "列车之间留有通路，留意远程感染者。", weights: { drifter: 4.6, runner: 2.7, crawler: 1.5, spitter: 2.6, brute: 1.5, screecher: 1 } }),
  red_basin: Object.freeze({ radioTitle: "余火电台 · 赤砂沉降区", radioDetail: "利用开阔地带绕行，别在风暴里停步。", weights: { drifter: 4, runner: 3.1, crawler: 3, spitter: 1.9, brute: 1.8, screecher: 1.2 } })
});
const LEGACY_STAGE_MAPS = Object.freeze({ signal_dawn: "echo_district", dead_rail: "freight_nexus", red_storm: "red_basin" });
const GUN_PRICES = Object.freeze({ scrap_pistol: 12, swarm_smg: 16, breaker_shotgun: 20, needle_rifle: 26, rust_revolver: 22, ember_carbine: 24, coil_cannon: 36 });
const TURRET = Object.freeze({ radius: 13, maxCount: 4, maxHp: 110, range: 340, interval: .85, damage: 9, projectileSpeed: 610 });

function getSurvivalPressure(seconds) {
  const elapsed = Math.max(0, Number.isFinite(seconds) ? seconds : 0), minutes = elapsed / 60;
  const growth = Math.max(0, minutes - .5), cycle = Math.floor(elapsed / 60) % 3;
  return {
    level: 1 + Math.floor(minutes), minutes,
    hp: Math.min(1e8, (1 + growth * .18) * Math.exp(Math.min(18, growth * .055))),
    damage: Math.min(1e7, 1 + minutes * .08 + minutes * minutes * .0008),
    speed: Math.min(1.5, 1 + minutes * .012),
    cap: Math.min(104, 18 + Math.floor(minutes * 8)),
    interval: Math.max(.11, 1.25 / (1 + minutes * .28)) / [1.03, 1, 1.1][cycle],
    price: 1 + minutes * .06,
    reward: 1 + Math.floor(minutes / 5) * .25,
    xp: 1 + Math.min(3, minutes * .045)
  };
}

function survivalProfile(mapId) { return SURVIVAL_MAPS[mapId] || SURVIVAL_MAPS.echo_district; }
function clampSurvivorStats(p) {
  p.speed = Math.min(360, p.speed); p.fireRateMultiplier = Math.min(8, p.fireRateMultiplier);
  p.projectileBonus = Math.min(10, p.projectileBonus); p.pierceBonus = Math.min(16, p.pierceBonus);
  p.pickupRadius = Math.min(440, p.pickupRadius); p.projectileRangeMultiplier = Math.min(3, p.projectileRangeMultiplier);
  p.projectileSpeedMultiplier = Math.min(4, p.projectileSpeedMultiplier); p.projectileRadiusBonus = Math.min(12, p.projectileRadiusBonus);
  p.damageMultiplier = Math.min(1e6, p.damageMultiplier); p.maxHp = Math.min(1e7, p.maxHp); p.hp = Math.min(p.maxHp, p.hp);
  p.regenPerSecond = Math.min(50, p.regenPerSecond); p.invulnerabilityDuration = Math.min(1.2, p.invulnerabilityDuration);
}

module.exports = { SURVIVAL_MAPS, LEGACY_STAGE_MAPS, GUN_PRICES, TURRET, getSurvivalPressure, survivalProfile, clampSurvivorStats };
