"use strict";

const DAMPING = 15;
const IMPULSE_SCALE = 2.4;
const MAX_SPEED = 360;

function addKnockback(enemy, source) {
  const length = Math.hypot(Number(source.vx) || 0, Number(source.vy) || 0);
  const strength = Math.max(0, Number(source.knockback) || 0) * (1 - Math.max(0, Math.min(1, Number(enemy.knockbackResistance) || 0)));
  if (!Number.isFinite(length) || length < 1e-8 || strength <= 0) return 0;
  let allowed = strength;
  if (Number.isInteger(source.attackId) && source.attackId > 0 && enemy.knockbackAttackIds) {
    let index = enemy.knockbackAttackIds.indexOf(source.attackId);
    if (index < 0) {
      index = enemy.knockbackAttackCursor;
      enemy.knockbackAttackCursor = (index + 1) % enemy.knockbackAttackIds.length;
      enemy.knockbackAttackIds[index] = source.attackId;
      enemy.knockbackAttackAmounts[index] = 0;
    }
    // A shotgun volley may add a small extra shove, never six full impulses.
    allowed = Math.max(0, Math.min(strength, strength * 1.15 - enemy.knockbackAttackAmounts[index]));
    enemy.knockbackAttackAmounts[index] += allowed;
  }
  enemy.knockbackVX = (Number(enemy.knockbackVX) || 0) + source.vx / length * allowed * IMPULSE_SCALE;
  enemy.knockbackVY = (Number(enemy.knockbackVY) || 0) + source.vy / length * allowed * IMPULSE_SCALE;
  const speed = Math.hypot(enemy.knockbackVX || 0, enemy.knockbackVY || 0);
  if (speed > MAX_SPEED) {
    enemy.knockbackVX *= MAX_SPEED / speed;
    enemy.knockbackVY *= MAX_SPEED / speed;
  }
  return allowed;
}

function advanceKnockback(enemy, dt, resolveCollision) {
  const speed = Math.hypot(enemy.knockbackVX, enemy.knockbackVY);
  if (speed < 0.5) { enemy.knockbackVX = 0; enemy.knockbackVY = 0; return; }
  const decay = Math.exp(-DAMPING * dt);
  // Integrate exponential recovery so travel is consistent across frame sizes.
  const dx = enemy.knockbackVX * (1 - decay) / DAMPING;
  const dy = enemy.knockbackVY * (1 - decay) / DAMPING;
  const steps = Math.max(1, Math.min(8, Math.ceil(Math.hypot(dx, dy) / Math.max(3, enemy.radius * 0.65))));
  for (let i = 0; i < steps; i++) {
    const wantedX = enemy.x + dx / steps, wantedY = enemy.y + dy / steps;
    enemy.x = wantedX; enemy.y = wantedY;
    resolveCollision(enemy);
    if (Math.abs(enemy.x - wantedX) > 0.001) enemy.knockbackVX = 0;
    if (Math.abs(enemy.y - wantedY) > 0.001) enemy.knockbackVY = 0;
  }
  enemy.knockbackVX *= decay;
  enemy.knockbackVY *= decay;
}

module.exports = { addKnockback, advanceKnockback, DAMPING, IMPULSE_SCALE, MAX_SPEED };
