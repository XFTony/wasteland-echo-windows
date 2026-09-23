"use strict";

class BossSystem {
  constructor(host, content) {
    this.host = host;
    this.content = content;
  }

  definitionFor(enemy) {
    return enemy ? this.content.bossForEnemy(enemy.type) : null;
  }

  phaseFor(enemy, definition = this.definitionFor(enemy)) {
    if (!definition) return null;
    const healthRatio = enemy.maxHp > 0 ? Math.max(0, enemy.hp / enemy.maxHp) : 0;
    for (const phase of definition.phases) {
      if (healthRatio >= phase.minHealthRatio) return phase;
    }
    return definition.phases[definition.phases.length - 1];
  }

  spawnEvent(enemy, wave = 1) {
    const definition = this.definitionFor(enemy);
    return {
      phase: wave,
      enemyId: enemy.id,
      enemyType: enemy.type,
      bossId: definition ? definition.id : null,
      name: definition ? definition.name : enemy.type,
      intro: definition ? definition.intro : "高危目标逼近",
      detail: definition ? definition.tactic : "保持移动",
      hudColor: definition ? definition.hudColor : null
    };
  }

  update(enemy, towardX, towardY) {
    const definition = this.definitionFor(enemy);
    if (!definition) return false;
    const phase = this.phaseFor(enemy, definition);
    if (enemy.bossPhaseId !== phase.id) {
      enemy.bossPhaseId = phase.id;
      enemy.bossPhase = definition.phases.indexOf(phase) + 1;
      this.host.emit("bossPhase", {
        bossId: definition.id,
        name: definition.name,
        phase: enemy.bossPhase,
        phaseId: phase.id,
        phaseLabel: phase.label,
        warning: phase.warning,
        hudColor: definition.hudColor,
        enemyId: enemy.id,
        x: enemy.x,
        y: enemy.y
      });
    }
    if (enemy.actionCooldown > 0) return true;
    if (phase.radial) {
      this.host.radialAttack(enemy, phase.radial.count, phase.radial.speed, phase.radial.damage);
    }
    if (phase.aimedShot) {
      this.host.spawnEnemyShot(
        enemy,
        towardX,
        towardY,
        phase.aimedShot.speed,
        phase.aimedShot.damage,
        phase.aimedShot.ttl,
        phase.aimedShot.color
      );
    }
    if (phase.summon && this.host.enemies.length < phase.summon.cap) {
      for (let index = 0; index < phase.summon.count; index += 1) {
        const side = index % 2 === 0 ? 1 : -1;
        this.host.spawnEnemy(phase.summon.enemyId, enemy.x + side * (42 + index * 4), enemy.y + side * 22);
      }
    }
    enemy.actionCooldown = phase.cooldown;
    this.host.emit("enemyAction", { action: "pulse", bossId: definition.id, phaseId: phase.id, x: enemy.x, y: enemy.y });
    return true;
  }

  drop(enemy) {
    const definition = this.definitionFor(enemy);
    if (!definition) return [];
    const drops = [];
    if (Number(definition.drop.scrap) > 0) {
      drops.push(this.host.spawnPickup("scrap", enemy.x - 10, enemy.y, Number(definition.drop.scrap)));
    }
    if (Number(definition.drop.healing) > 0) {
      drops.push(this.host.spawnPickup("medkit", enemy.x + 12, enemy.y - 8, Number(definition.drop.healing)));
    }
    return drops.filter(Boolean);
  }
}

module.exports = { BossSystem };
