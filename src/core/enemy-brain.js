"use strict";

const EPSILON = 0.00000001;

const NAVIGATION_ROLE_WEIGHTS = Object.freeze({
  runner: 0.92,
  swarm: 0.88,
  ranged: 0.8,
  buffer: 0.78,
  chaser: 0.78,
  elite: 0.62,
  tank: 0.46,
  boss: 0.42
});

const ENEMY_ROLE_PROFILES = Object.freeze({
  chaser: Object.freeze({}),
  swarm: Object.freeze({}),
  runner: Object.freeze({
    dash: Object.freeze({ action: "dash", triggerDistance: 270, duration: 0.32, cooldown: 2.4, speedMultiplier: 2.25 })
  }),
  tank: Object.freeze({
    dash: Object.freeze({ action: "charge", triggerDistance: 320, duration: 0.48, cooldown: 4.4, speedMultiplier: 2.05 })
  }),
  buffer: Object.freeze({
    support: Object.freeze({ action: "scream", cooldown: 3.25 })
  }),
  ranged: Object.freeze({
    spacing: Object.freeze({ retreatDistance: 140, strafeDistance: 230, strafeScale: 0.28 }),
    projectile: Object.freeze({ range: 420, speed: 155, damage: 10, ttl: 2.5, cooldown: 2.1, color: "#8ed37b" })
  }),
  elite: Object.freeze({
    radial: Object.freeze({ count: 8, speed: 135, damage: 9, cooldown: 3.6 })
  }),
  // Boss attacks and phases live exclusively in BossDefinition/BossSystem.
  // EnemyBrain only contributes shared movement steering for the boss role.
  boss: Object.freeze({})
});

function profileFor(role) {
  return ENEMY_ROLE_PROFILES[role] || ENEMY_ROLE_PROFILES.chaser;
}

function computeEnemySteering(enemy, player, navigation, output) {
  const deltaX = player.x - enemy.x;
  const deltaY = player.y - enemy.y;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;
  const distance = distanceSquared > EPSILON ? Math.sqrt(distanceSquared) : 0;
  const inverseDistance = distance > 0 ? 1 / distance : 0;
  const towardX = distance > 0 ? deltaX * inverseDistance : 1;
  const towardY = distance > 0 ? deltaY * inverseDistance : 0;
  let directionX = towardX;
  let directionY = towardY;

  if (distance > 96 && navigation) {
    const probeDistance = Math.max(navigation.grid.cellSize * 0.9, enemy.radius * 3);
    const pathAheadIsBlocked = !navigation.grid.isWorldWalkable(
      enemy.x + towardX * probeDistance,
      enemy.y + towardY * probeDistance
    );
    if (pathAheadIsBlocked) enemy.navigationTime = Math.max(enemy.navigationTime, 1.1);
    if (pathAheadIsBlocked || enemy.navigationTime > 0) {
      const navigationIndex = navigation.flow.sampleIndex(enemy.x, enemy.y);
      if (navigationIndex >= 0) {
        const flowX = navigation.flow.directionX[navigationIndex];
        const flowY = navigation.flow.directionY[navigationIndex];
        if (flowX !== 0 || flowY !== 0) {
          const weight = NAVIGATION_ROLE_WEIGHTS[enemy.role] || 0.72;
          const blendedX = towardX * (1 - weight) + flowX * weight;
          const blendedY = towardY * (1 - weight) + flowY * weight;
          const blendedLengthSq = blendedX * blendedX + blendedY * blendedY;
          if (blendedLengthSq > EPSILON) {
            const inverseBlendedLength = 1 / Math.sqrt(blendedLengthSq);
            directionX = blendedX * inverseBlendedLength;
            directionY = blendedY * inverseBlendedLength;
          }
        }
      }
    }
  }

  const spacing = profileFor(enemy.role).spacing;
  if (spacing) {
    if (distance < spacing.retreatDistance) {
      directionX = -towardX;
      directionY = -towardY;
    } else if (distance < spacing.strafeDistance) {
      directionX = -towardY * spacing.strafeScale;
      directionY = towardX * spacing.strafeScale;
    }
  }

  output.distance = distance;
  output.towardX = towardX;
  output.towardY = towardY;
  output.directionX = directionX;
  output.directionY = directionY;
  return output;
}

module.exports = {
  NAVIGATION_ROLE_WEIGHTS,
  ENEMY_ROLE_PROFILES,
  profileFor,
  computeEnemySteering
};
