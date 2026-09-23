"use strict";

const { distanceSq } = require("./math");

function createMechanicState() {
  return {
    weaponShotCounter: 0,
    lastShotAt: -999,
    heat: 0,
    overdriveTime: 0,
    chargedShots: 0,
    killCharge: 0,
    reactiveCooldown: 0,
    cascadeCooldown: 0,
    procCount: 0
  };
}

class MechanicSystem {
  constructor(host, content) {
    this.host = host;
    this.content = content;
    this.modifiers = {
      damageMultiplier: 1,
      projectileSpeedMultiplier: 1,
      knockbackMultiplier: 1,
      radiusBonus: 0,
      pierceBonus: 0,
      forceCritical: false,
      procLabel: null
    };
    this.chainSource = {
      vx: 0,
      vy: 0,
      knockback: 18,
      critical: false,
      owner: "mechanic",
      mechanicChain: true
    };
    this.reactiveSource = {
      vx: 0,
      vy: 0,
      knockback: 32,
      critical: false,
      owner: "mechanic",
      mechanicChain: true
    };
  }

  enableUpgrade(run, id, level) {
    if (!run.mechanicUpgrades) run.mechanicUpgrades = {};
    run.mechanicUpgrades[id] = Math.max(Number(run.mechanicUpgrades[id]) || 0, Number(level) || 1);
  }

  tick(run, dt) {
    const state = run.mechanics;
    state.overdriveTime = Math.max(0, state.overdriveTime - dt);
    state.reactiveCooldown = Math.max(0, state.reactiveCooldown - dt);
    state.cascadeCooldown = Math.max(0, state.cascadeCooldown - dt);
    if (run.elapsed - state.lastShotAt > 0.28) state.heat = Math.max(0, state.heat - dt * 3.5);
  }

  beforeShot(run, weapon, targetDistance = Infinity) {
    const state = run.mechanics;
    const upgrades = run.mechanicUpgrades || {};
    const modifiers = this.modifiers;
    modifiers.damageMultiplier = 1;
    modifiers.projectileSpeedMultiplier = 1;
    modifiers.knockbackMultiplier = 1;
    modifiers.radiusBonus = 0;
    modifiers.pierceBonus = 0;
    modifiers.forceCritical = false;
    modifiers.procLabel = null;
    state.weaponShotCounter += 1;

    if (weapon.mechanicId === "steady_cycle" && state.weaponShotCounter % 4 === 0) {
      modifiers.damageMultiplier *= 1.45;
      modifiers.forceCritical = true;
      modifiers.procLabel = "四拍稳压";
    } else if (weapon.mechanicId === "heat_ramp") {
      state.heat = Math.min(10, state.heat + 1);
      modifiers.damageMultiplier *= 1 + state.heat * 0.015;
      if (state.heat >= 8) modifiers.procLabel = "热膛高压";
    } else if (weapon.mechanicId === "breach_cone" && targetDistance <= 150) {
      modifiers.damageMultiplier *= 1.35;
      modifiers.knockbackMultiplier *= 1.25;
      modifiers.procLabel = "破门距离";
    } else if (weapon.mechanicId === "focus_lance" && (run.elapsed - state.lastShotAt >= 1.1 || run.player.noHitTime >= 4)) {
      modifiers.damageMultiplier *= 1.5;
      modifiers.pierceBonus += 2;
      modifiers.procLabel = "静息聚焦";
    } else if (weapon.mechanicId === "sixth_chamber" && state.weaponShotCounter % 6 === 0) {
      modifiers.damageMultiplier *= 1.3;
      modifiers.forceCritical = true;
      modifiers.procLabel = "第六膛室";
    } else if (weapon.mechanicId === "momentum_feed") {
      const input = run.input;
      if (input.moveX * input.moveX + input.moveY * input.moveY >= 0.16) {
        modifiers.damageMultiplier *= 1.12;
        modifiers.projectileSpeedMultiplier *= 1.15;
        modifiers.procLabel = "动量供弹";
      }
    } else if (weapon.mechanicId === "arc_overload" && state.weaponShotCounter % 3 === 0) {
      modifiers.damageMultiplier *= 1.25;
      modifiers.pierceBonus += 2;
      modifiers.radiusBonus += 0.8;
      modifiers.procLabel = "三相过载";
    }

    const pointBlankRank = Number(upgrades.pointBlankRelay) || 0;
    if (pointBlankRank > 0 && targetDistance <= 180) {
      modifiers.damageMultiplier *= 1 + pointBlankRank * 0.12;
      modifiers.knockbackMultiplier *= 1 + pointBlankRank * 0.08;
      modifiers.procLabel = modifiers.procLabel || "近距继电";
    }
    const focusRank = Number(upgrades.focusProtocol) || 0;
    if (focusRank > 0 && run.player.noHitTime >= 4) {
      modifiers.damageMultiplier *= 1 + focusRank * 0.1;
      modifiers.forceCritical = true;
      modifiers.procLabel = modifiers.procLabel || "弱点协议";
    }
    const overdriveRank = Number(upgrades.salvageOverdrive) || 0;
    if (overdriveRank > 0 && state.overdriveTime > 0) {
      modifiers.damageMultiplier *= 1 + overdriveRank * 0.06;
      modifiers.projectileSpeedMultiplier *= 1 + overdriveRank * 0.08;
      modifiers.procLabel = modifiers.procLabel || "回收超频";
    }
    const capacitorRank = Number(upgrades.executionCapacitor) || 0;
    if (capacitorRank > 0 && state.chargedShots > 0) {
      state.chargedShots -= 1;
      modifiers.damageMultiplier *= 1.35 + capacitorRank * 0.15;
      modifiers.pierceBonus += capacitorRank;
      modifiers.procLabel = "处决电容";
    }
    if (modifiers.procLabel) state.procCount += 1;
    return modifiers;
  }

  afterShot(run) {
    run.mechanics.lastShotAt = run.elapsed;
  }

  onKill(run) {
    const rank = Number(run.mechanicUpgrades && run.mechanicUpgrades.executionCapacitor) || 0;
    if (rank <= 0) return;
    const state = run.mechanics;
    state.killCharge += 1;
    const required = Math.max(6, 12 - rank * 2);
    if (state.killCharge >= required) {
      state.killCharge = 0;
      state.chargedShots = Math.min(3, state.chargedShots + 1);
      this.host.emit("mechanicReady", { mechanicId: "executionCapacitor", label: "处决电容已充能" });
    }
  }

  onPickup(run, type) {
    const rank = Number(run.mechanicUpgrades && run.mechanicUpgrades.salvageOverdrive) || 0;
    if (rank > 0 && (type === "xp" || type === "scrap")) {
      run.mechanics.overdriveTime = Math.max(run.mechanics.overdriveTime, 2.5 + rank * 0.75);
    }
  }

  onPlayerHit(run, sourceX, sourceY) {
    const rank = Number(run.mechanicUpgrades && run.mechanicUpgrades.reactivePlating) || 0;
    const state = run.mechanics;
    if (rank <= 0 || state.reactiveCooldown > 0) return;
    state.reactiveCooldown = Math.max(0.9, 2.2 - rank * 0.35);
    const player = run.player;
    const radius = 90 + rank * 24;
    const radiusSquared = radius * radius;
    let hits = 0;
    for (const enemy of this.host.enemies) {
      if (!enemy.active || distanceSq(player.x, player.y, enemy.x, enemy.y) > radiusSquared) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const length = Math.hypot(dx, dy) || 1;
      this.reactiveSource.vx = dx / length * 180;
      this.reactiveSource.vy = dy / length * 180;
      this.host.damageEnemy(enemy, 10 + rank * 8, this.reactiveSource);
      hits += 1;
    }
    if (hits > 0) this.host.emit("mechanicProc", { mechanicId: "reactivePlating", label: "反应装甲", x: player.x, y: player.y, hits, sourceX, sourceY });
  }

  onCriticalHit(run, enemy, source, damage) {
    const rank = Number(run.mechanicUpgrades && run.mechanicUpgrades.cascadeRounds) || 0;
    const state = run.mechanics;
    if (rank <= 0 || state.cascadeCooldown > 0 || source.mechanicChain) return;
    let nearest = null;
    let best = Math.pow(110 + rank * 30, 2);
    for (const candidate of this.host.enemies) {
      if (!candidate.active || candidate.id === enemy.id) continue;
      const distance = distanceSq(enemy.x, enemy.y, candidate.x, candidate.y);
      if (distance < best) {
        best = distance;
        nearest = candidate;
      }
    }
    if (!nearest) return;
    state.cascadeCooldown = Math.max(0.18, 0.5 - rank * 0.08);
    const dx = nearest.x - enemy.x;
    const dy = nearest.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    this.chainSource.vx = dx / length * 120;
    this.chainSource.vy = dy / length * 120;
    this.host.damageEnemy(nearest, damage * (0.28 + rank * 0.12), this.chainSource);
    this.host.emit("mechanicProc", { mechanicId: "cascadeRounds", label: "电弧跳弹", x: nearest.x, y: nearest.y, hits: 1 });
  }

  status(run, weapon) {
    const state = run.mechanics;
    if (weapon.mechanicId === "heat_ramp") return { label: "热量", value: state.heat / 10 };
    if (weapon.mechanicId === "steady_cycle") return { label: "稳压", value: state.weaponShotCounter % 4 / 4 };
    if (weapon.mechanicId === "sixth_chamber") return { label: "膛室", value: state.weaponShotCounter % 6 / 6 };
    if (weapon.mechanicId === "arc_overload") return { label: "过载", value: state.weaponShotCounter % 3 / 3 };
    if (state.chargedShots > 0) return { label: "充能", value: 1 };
    return null;
  }
}

module.exports = { createMechanicState, MechanicSystem };
