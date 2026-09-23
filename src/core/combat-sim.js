"use strict";

const { clamp, distanceSq, circleRectPushOut } = require("./math");
const { profileFor, computeEnemySteering } = require("./enemy-brain");

const EPSILON = 0.00000001;
const ENEMY_SEPARATION_ITERATIONS = 2;
const ENEMY_SEPARATION_PADDING = 0.5;

function assertCombatHost(host) {
  const methods = ["emit", "progressTutorial", "checkLevelUp", "finishRun"];
  if (!host || typeof host !== "object") throw new TypeError("CombatSim requires a host");
  for (const method of methods) {
    if (typeof host[method] !== "function") throw new TypeError("CombatSim host." + method + " must be a function");
  }
  return host;
}

class CombatSim {
  constructor(host, content) {
    this.host = assertCombatHost(host);
    this.content = content;
  }

  fireWeapon(aimX, aimY) {
    const host = this.host;
    const run = host.run;
    const player = run.player;
    const weapon = this.content.get("weapons", player.weaponId, this.content.defaults.weapon);
    const target = player.aimTargetId === null ? null : host.enemies.find((enemy) => enemy.active && enemy.id === player.aimTargetId);
    const targetDistance = target ? Math.hypot(target.x - player.x, target.y - player.y) : Infinity;
    const mechanic = host.mechanicSystem.beforeShot(run, weapon, targetDistance);
    const count = weapon.projectileCount + player.projectileBonus;
    const baseAngle = Math.atan2(aimY, aimX);
    const spreadRadians = (weapon.spread * Math.PI) / 180;
    const projectileSpeed = weapon.projectileSpeed * player.projectileSpeedMultiplier * mechanic.projectileSpeedMultiplier;
    const projectileTtl = weapon.ttl * player.projectileRangeMultiplier;
    const baseRadius = player.weaponId === "needle_rifle" ? 3.5 : 2.7;
    let spawned = 0;
    for (let index = 0; index < count; index += 1) {
      if (host.projectiles.length >= host.limits.projectiles) break;
      const centered = count === 1 ? 0 : index / (count - 1) - 0.5;
      const jitter = weapon.spread > 0 ? host.random.range(-0.08, 0.08) : 0;
      const angle = baseAngle + centered * spreadRadians + jitter;
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const critical = mechanic.forceCritical || (player.criticalChance > 0 && host.random.next() < player.criticalChance);
      const projectile = host.projectilePool.acquire({
        id: host.entityId++,
        x: player.x + directionX * 14,
        y: player.y + directionY * 14,
        vx: directionX * projectileSpeed,
        vy: directionY * projectileSpeed,
        radius: baseRadius + player.projectileRadiusBonus + mechanic.radiusBonus,
        ttl: projectileTtl,
        damage: weapon.damage * player.damageMultiplier * mechanic.damageMultiplier * (critical ? player.criticalMultiplier : 1),
        pierce: weapon.pierce + player.pierceBonus + mechanic.pierceBonus,
        knockback: weapon.knockback * player.knockbackMultiplier * mechanic.knockbackMultiplier,
        color: weapon.color,
        owner: "player",
        critical
      });
      host.projectiles.push(projectile);
      spawned += 1;
    }
    run.shotsFired += 1;
    run.projectilesFired += spawned;
    host.progressTutorial("fire", 1);
    host.mechanicSystem.afterShot(run);
    player.weaponCooldown = weapon.interval / player.fireRateMultiplier;
    host.emit("shot", { weaponId: weapon.id, x: player.x, y: player.y, aimX, aimY });
    if (mechanic.procLabel) {
      host.emit("mechanicProc", { mechanicId: weapon.mechanicId, label: mechanic.procLabel, x: player.x, y: player.y, hits: 0 });
    }
  }

  spawnEnemy(type, x, y) {
    const host = this.host;
    if (host.enemies.length >= host.limits.enemies) return null;
    const definition = this.content.get("enemies", type, this.content.defaults.enemy);
    const progress = host.run
      ? host.run.endless ? Math.min(2.5, host.run.elapsed / 360) : clamp(host.run.elapsed / host.duration, 0, 1)
      : 0;
    const mode = host.run
      ? this.content.get("modes", host.run.modeId, this.content.defaults.mode)
      : this.content.get("modes", this.content.defaults.mode);
    const difficulty = host.run ? host.run.difficulty : 1;
    const hpScale = (1 + progress * mode.hpGrowth) * difficulty;
    const bossDefinition = this.content.bossForEnemy(definition.id);
    const enemy = host.enemyPool.acquire({
      id: host.entityId++,
      type: definition.id,
      x,
      y,
      hp: definition.hp * hpScale,
      maxHp: definition.hp * hpScale,
      speed: definition.speed * (1 + progress * mode.speedGrowth) * Math.min(1.2, Math.sqrt(difficulty)),
      damage: definition.damage * Math.min(1.45, difficulty),
      radius: definition.radius,
      xp: definition.xp,
      scrapChance: definition.scrapChance,
      color: definition.color,
      role: definition.role,
      elite: Boolean(definition.elite),
      boss: Boolean(definition.boss || bossDefinition),
      bossDefinitionId: bossDefinition ? bossDefinition.id : null,
      knockbackResistance: definition.knockbackResistance || 0,
      actionCooldown: host.random.range(0.4, 1.4),
      heading: 0
    });
    this.resolveEnemyWorldCollision(enemy);
    host.enemies.push(enemy);
    return enemy;
  }

  updateEnemies(dt) {
    const host = this.host;
    const player = host.run.player;
    host.screamers.length = 0;
    for (let index = 0; index < host.enemies.length; index += 1) {
      const candidate = host.enemies[index];
      if (candidate.active && candidate.role === "buffer") host.screamers.push(candidate);
    }
    for (const enemy of host.enemies) {
      if (!enemy.active) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
      enemy.actionCooldown -= dt;
      enemy.navigationTime = Math.max(0, enemy.navigationTime - dt);

      const steering = computeEnemySteering(enemy, player, host.navigationForEnemy(enemy), host.enemySteering);
      const profile = profileFor(enemy.role);
      const distance = steering.distance;
      const towardX = steering.towardX;
      const towardY = steering.towardY;
      let speed = enemy.speed;
      const directionX = steering.directionX;
      const directionY = steering.directionY;
      const bossDefinition = this.content.bossForEnemy(enemy.type);

      if (enemy.role !== "buffer" && this.hasScreecherBuff(enemy)) speed *= 1.18;
      for (const interactive of host.interactives) {
        if (interactive.active && interactive.type === "electricField" && distanceSq(enemy.x, enemy.y, interactive.x, interactive.y) <= interactive.radius * interactive.radius) {
          speed *= Number(interactive.slow) || 0.6;
        }
      }
      if (profile.dash) {
        if (enemy.dashTime > 0) {
          enemy.dashTime -= dt;
          speed *= profile.dash.speedMultiplier;
        } else if (enemy.actionCooldown <= 0 && distance < profile.dash.triggerDistance) {
          enemy.dashTime = profile.dash.duration;
          enemy.actionCooldown = profile.dash.cooldown;
          host.emit("enemyAction", { action: profile.dash.action, x: enemy.x, y: enemy.y });
        }
      }

      if (profile.support && enemy.actionCooldown <= 0) {
        enemy.actionCooldown = profile.support.cooldown;
        host.emit("enemyAction", { action: profile.support.action, x: enemy.x, y: enemy.y });
      }

      if (profile.projectile && enemy.actionCooldown <= 0 && distance < profile.projectile.range) {
        this.spawnEnemyShot(
          enemy,
          towardX,
          towardY,
          profile.projectile.speed,
          profile.projectile.damage,
          profile.projectile.ttl,
          profile.projectile.color
        );
        enemy.actionCooldown = profile.projectile.cooldown;
      }

      if (!bossDefinition && profile.radial && enemy.actionCooldown <= 0) {
        this.radialAttack(enemy, profile.radial.count, profile.radial.speed, profile.radial.damage);
        enemy.actionCooldown = profile.radial.cooldown;
        host.emit("enemyAction", { action: "pulse", x: enemy.x, y: enemy.y });
      }

      if (bossDefinition) host.bossSystem.update(enemy, towardX, towardY);

      enemy.vx = directionX * speed;
      enemy.vy = directionY * speed;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.heading = Math.atan2(directionY, directionX);
      this.resolveEnemyWorldCollision(enemy);
    }

    this.resolveEnemySeparation();
    this.rebuildEnemyGrid();

    for (const enemy of host.enemies) {
      if (!enemy.active) continue;
      const contactRadius = enemy.radius + player.radius + 2;
      if (distanceSq(enemy.x, enemy.y, player.x, player.y) < contactRadius * contactRadius && enemy.hitCooldown <= 0) {
        enemy.hitCooldown = 0.7;
        this.damagePlayer(enemy.damage, enemy.x, enemy.y, enemy);
      }
    }
  }

  resolveEnemyWorldCollision(enemy) {
    const host = this.host;
    const boundary = enemy.radius + 20;
    enemy.x = clamp(enemy.x, boundary, host.worldSize - boundary);
    enemy.y = clamp(enemy.y, boundary, host.worldSize - boundary);
    const nearbyObstacles = host.obstacleGrid.queryCircleUnique(
      enemy.x,
      enemy.y,
      enemy.radius,
      host.obstacleCandidates,
      host.obstacleQuerySeen
    );
    for (let index = 0; index < nearbyObstacles.length; index += 1) circleRectPushOut(enemy, nearbyObstacles[index]);
    enemy.x = clamp(enemy.x, boundary, host.worldSize - boundary);
    enemy.y = clamp(enemy.y, boundary, host.worldSize - boundary);
  }

  resolveEnemySeparation() {
    const host = this.host;
    for (let iteration = 0; iteration < ENEMY_SEPARATION_ITERATIONS; iteration += 1) {
      this.rebuildEnemyGrid();
      let separatedAny = false;
      for (const enemy of host.enemies) {
        if (!enemy.active) continue;
        const searchRadius = enemy.radius + host.maximumEnemyRadius + ENEMY_SEPARATION_PADDING;
        const candidates = host.enemyGrid.queryCircle(enemy.x, enemy.y, searchRadius, host.separationCandidates);
        for (let index = 0; index < candidates.length; index += 1) {
          const other = candidates[index];
          if (!other.active || other.id <= enemy.id) continue;
          const minimumDistance = enemy.radius + other.radius + ENEMY_SEPARATION_PADDING;
          let deltaX = other.x - enemy.x;
          let deltaY = other.y - enemy.y;
          let centerDistanceSq = deltaX * deltaX + deltaY * deltaY;
          if (centerDistanceSq >= minimumDistance * minimumDistance) continue;

          let centerDistance = 0;
          if (centerDistanceSq > EPSILON) {
            centerDistance = Math.sqrt(centerDistanceSq);
            deltaX /= centerDistance;
            deltaY /= centerDistance;
          } else {
            const angle = ((enemy.id * 0.754877666 + other.id * 0.569840291) % 1) * Math.PI * 2;
            deltaX = Math.cos(angle);
            deltaY = Math.sin(angle);
            centerDistanceSq = 0;
          }

          const overlap = minimumDistance - centerDistance;
          const enemyMobility = Math.max(0.04, 1 - enemy.knockbackResistance);
          const otherMobility = Math.max(0.04, 1 - other.knockbackResistance);
          const mobilityTotal = enemyMobility + otherMobility;
          const enemyShare = enemyMobility / mobilityTotal;
          const otherShare = otherMobility / mobilityTotal;
          enemy.x -= deltaX * overlap * enemyShare;
          enemy.y -= deltaY * overlap * enemyShare;
          other.x += deltaX * overlap * otherShare;
          other.y += deltaY * overlap * otherShare;
          separatedAny = true;
        }
      }

      for (const enemy of host.enemies) {
        if (enemy.active) this.resolveEnemyWorldCollision(enemy);
      }
      if (!separatedAny) break;
    }
  }

  hasScreecherBuff(enemy) {
    const screamers = this.host.screamers;
    for (let index = 0; index < screamers.length; index += 1) {
      const candidate = screamers[index];
      if (candidate.id !== enemy.id && distanceSq(candidate.x, candidate.y, enemy.x, enemy.y) < 145 * 145) return true;
    }
    return false;
  }

  rebuildEnemyGrid() {
    const host = this.host;
    host.enemyGrid.clear();
    for (let index = 0; index < host.enemies.length; index += 1) {
      const enemy = host.enemies[index];
      if (enemy.active) host.enemyGrid.insert(enemy);
    }
    host.enemyGridCount = host.enemies.length;
    host.enemyGridFirstId = host.enemies.length ? host.enemies[0].id : null;
    host.enemyGridLastId = host.enemies.length ? host.enemies[host.enemies.length - 1].id : null;
  }

  radialAttack(enemy, count, speed, damage) {
    const host = this.host;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + host.run.elapsed * 0.25;
      this.spawnEnemyShot(enemy, Math.cos(angle), Math.sin(angle), speed, damage, 3.1, "#d87055");
    }
  }

  spawnEnemyShot(enemy, dx, dy, speed, damage, ttl, color) {
    const host = this.host;
    if (host.enemyShots.length >= host.limits.enemyShots) return;
    const shot = host.projectilePool.acquire({
      id: host.entityId++,
      x: enemy.x,
      y: enemy.y,
      vx: dx * speed,
      vy: dy * speed,
      radius: 4,
      ttl,
      damage,
      pierce: 0,
      knockback: 0,
      color,
      owner: "enemy",
      sourceType: enemy.type,
      sourceRole: enemy.role
    });
    host.enemyShots.push(shot);
  }

  updateProjectiles(dt) {
    const host = this.host;
    for (const projectile of host.projectiles) {
      if (!projectile.active) continue;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) {
        host.projectilePool.release(projectile);
        continue;
      }
      if (this.hitExplosiveInteractive(projectile)) {
        host.projectilePool.release(projectile);
        continue;
      }
      const candidates = host.enemyGrid.queryCircle(projectile.x, projectile.y, 40, host.collisionCandidates);
      for (let index = 0; index < candidates.length; index += 1) {
        const enemy = candidates[index];
        if (!enemy.active || projectile.hitIds.has(enemy.id)) continue;
        const hitRadius = projectile.radius + enemy.radius;
        if (distanceSq(projectile.x, projectile.y, enemy.x, enemy.y) <= hitRadius * hitRadius) {
          projectile.hitIds.add(enemy.id);
          this.damageEnemy(enemy, projectile.damage, projectile);
          if (projectile.pierce <= 0) {
            host.projectilePool.release(projectile);
            break;
          }
          projectile.pierce -= 1;
        }
      }
    }

    const player = host.run.player;
    for (const shot of host.enemyShots) {
      if (!shot.active) continue;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.ttl -= dt;
      if (shot.ttl <= 0) {
        host.projectilePool.release(shot);
        continue;
      }
      const hitRadius = shot.radius + player.radius;
      if (distanceSq(shot.x, shot.y, player.x, player.y) <= hitRadius * hitRadius) {
        host.projectilePool.release(shot);
        this.damagePlayer(shot.damage, shot.x, shot.y, shot);
      }
    }
  }

  hitExplosiveInteractive(projectile) {
    const host = this.host;
    for (const interactive of host.interactives) {
      if (!interactive.active || interactive.type !== "explosiveBarrel") continue;
      const hitRadius = projectile.radius + interactive.radius;
      if (distanceSq(projectile.x, projectile.y, interactive.x, interactive.y) > hitRadius * hitRadius) continue;
      this.triggerInteractive(interactive);
      return true;
    }
    return false;
  }

  triggerInteractive(interactive) {
    const host = this.host;
    if (!interactive || !interactive.active) return false;
    if (interactive.type === "explosiveBarrel") {
      interactive.active = false;
      const radius = Number(interactive.effectRadius) || 120;
      const damage = Number(interactive.damage) || 60;
      for (const enemy of host.enemies) {
        if (!enemy.active || distanceSq(enemy.x, enemy.y, interactive.x, interactive.y) > radius * radius) continue;
        const dx = enemy.x - interactive.x;
        const dy = enemy.y - interactive.y;
        const length = Math.hypot(dx, dy) || 1;
        host.environmentHit.vx = dx / length * 220;
        host.environmentHit.vy = dy / length * 220;
        this.damageEnemy(enemy, damage, host.environmentHit);
      }
      host.emit("environment", { action: "explode", x: interactive.x, y: interactive.y, radius });
      return true;
    }
    if (interactive.type === "supplyCache") {
      interactive.active = false;
      this.spawnPickup("scrap", interactive.x - 8, interactive.y, Number(interactive.scrap) || 6);
      this.spawnPickup("medkit", interactive.x + 10, interactive.y, Number(interactive.healing) || 24);
      host.emit("environment", { action: "supply", x: interactive.x, y: interactive.y });
      return true;
    }
    return false;
  }

  updateInteractives(dt) {
    const host = this.host;
    const player = host.run.player;
    for (const interactive of host.interactives) {
      if (!interactive.active) continue;
      interactive.pulse = (interactive.pulse + dt) % 1;
      if (interactive.type !== "supplyCache") continue;
      const collectRadius = interactive.radius + player.radius + 8;
      if (distanceSq(player.x, player.y, interactive.x, interactive.y) <= collectRadius * collectRadius) this.triggerInteractive(interactive);
    }
  }

  damageEnemy(enemy, amount, projectile) {
    const host = this.host;
    const requestedDamage = Math.max(0, Number(amount) || 0);
    const appliedDamage = Math.min(Math.max(0, Number(enemy.hp) || 0), requestedDamage);
    enemy.hp -= requestedDamage;
    enemy.hitFlash = 0.09;
    const source = projectile || host.environmentHit;
    const push = (Number(source.knockback) || 0) * (1 - enemy.knockbackResistance);
    const velocityLengthSq = source.vx * source.vx + source.vy * source.vy;
    if (velocityLengthSq > EPSILON) {
      const pushScale = (push * 0.18) / Math.sqrt(velocityLengthSq);
      enemy.x += source.vx * pushScale;
      enemy.y += source.vy * pushScale;
    }
    host.run.damageDealt += appliedDamage;
    if (source.owner === "player") {
      host.run.hits += 1;
      if (source.critical) host.run.criticalHits += 1;
    }
    host.emit("hit", { x: enemy.x, y: enemy.y, damage: appliedDamage, elite: enemy.elite, critical: source.critical });
    if (source.owner === "player" && source.critical) host.mechanicSystem.onCriticalHit(host.run, enemy, source, appliedDamage);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  damagePlayer(amount, sourceX, sourceY, source = null) {
    const host = this.host;
    const player = host.run.player;
    if (player.invulnerable > 0 || host.screen !== "running") return;
    const reduced = Math.max(1, amount * (1 - player.armor));
    player.hp -= reduced;
    host.run.damageTaken += reduced;
    const sourceKey = source && (source.sourceType || source.type || source.sourceRole || source.role) || "unknown";
    host.run.damageTakenBySource[sourceKey] = (Number(host.run.damageTakenBySource[sourceKey]) || 0) + reduced;
    player.invulnerable = player.invulnerabilityDuration;
    player.noHitTime = 0;
    host.run.hitCount += 1;
    const awayX = player.x - sourceX;
    const awayY = player.y - sourceY;
    const awayLengthSq = awayX * awayX + awayY * awayY;
    if (awayLengthSq > EPSILON) {
      const pushScale = 18 / Math.sqrt(awayLengthSq);
      player.x += awayX * pushScale;
      player.y += awayY * pushScale;
    } else {
      player.x += 18;
    }
    host.emit("playerHit", { damage: reduced, sourceType: sourceKey });
    host.mechanicSystem.onPlayerHit(host.run, sourceX, sourceY);
    if (player.hp <= 0) host.finishRun("lose");
  }

  killEnemy(enemy) {
    const host = this.host;
    if (!enemy.active) return;
    host.run.kills += 1;
    if (enemy.elite) host.run.eliteKills += 1;
    host.mechanicSystem.onKill(host.run);
    this.spawnPickup("xp", enemy.x, enemy.y, enemy.xp);
    if (enemy.bossDefinitionId) host.bossSystem.drop(enemy);
    if (host.random.next() < Math.min(1, enemy.scrapChance + host.run.player.scrapChanceBonus)) {
      const baseScrap = enemy.elite ? 8 : 1;
      const value = Math.max(1, Math.round(baseScrap * host.run.player.scrapMultiplier));
      this.spawnPickup("scrap", enemy.x + host.random.range(-8, 8), enemy.y + host.random.range(-8, 8), value);
    }
    if (enemy.elite && host.random.next() < 0.55) {
      this.spawnPickup("medkit", enemy.x + 12, enemy.y - 10, 22);
    }
    host.emit("kill", { enemyId: enemy.id, enemyType: enemy.type, x: enemy.x, y: enemy.y, elite: enemy.elite, boss: enemy.boss });
    host.enemyPool.release(enemy);
  }

  spawnPickup(type, x, y, value) {
    const host = this.host;
    if (host.pickups.length >= host.limits.pickups) {
      for (let offset = 0; offset < host.pickups.length; offset += 1) {
        const index = (host.pickupMergeCursor + offset) % host.pickups.length;
        const existing = host.pickups[index];
        if (existing.active && existing.type === type) {
          existing.value += value;
          existing.x = x;
          existing.y = y;
          existing.age = 0;
          host.pickupMergeCursor = (index + 1) % host.pickups.length;
          return existing;
        }
      }
      return null;
    }
    const pickup = host.pickupPool.acquire({
      id: host.entityId++,
      type,
      x,
      y,
      value,
      radius: type === "medkit" ? 7 : 5
    });
    host.pickups.push(pickup);
    return pickup;
  }

  updatePickups(dt) {
    const host = this.host;
    const player = host.run.player;
    const pickupRadiusSquared = player.pickupRadius * player.pickupRadius;
    for (const pickup of host.pickups) {
      if (!pickup.active) continue;
      pickup.age += dt;
      const deltaX = player.x - pickup.x;
      const deltaY = player.y - pickup.y;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared < pickupRadiusSquared) {
        const distance = Math.sqrt(distanceSquared);
        if (distance > 0) {
          const speedScale = ((150 + (player.pickupRadius - distance) * 5) * dt) / distance;
          pickup.x += deltaX * speedScale;
          pickup.y += deltaY * speedScale;
        }
        const collectRadius = player.radius + pickup.radius + 3;
        if (distanceSquared <= collectRadius * collectRadius) this.collectPickup(pickup);
      }
    }
  }

  collectPickup(pickup) {
    const host = this.host;
    if (pickup.type === "xp") {
      host.run.player.xp += pickup.value;
      host.checkLevelUp();
    } else if (pickup.type === "scrap") {
      host.run.scrap += pickup.value;
    } else if (pickup.type === "medkit") {
      host.run.player.hp = Math.min(host.run.player.maxHp, host.run.player.hp + pickup.value);
    }
    host.progressTutorial("pickup", 1);
    host.mechanicSystem.onPickup(host.run, pickup.type);
    host.emit("pickup", { pickupType: pickup.type });
    host.pickupPool.release(pickup);
  }
}

module.exports = { assertCombatHost, CombatSim };
