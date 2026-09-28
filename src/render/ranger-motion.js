"use strict";

const STRIDE_DISTANCE = 72;

function rangerMotionFrame(renderer, run, player) {
  let state = renderer.rangerMotionState;
  if (!state || state.run !== run) {
    state = { run, x: player.x, y: player.y, elapsed: run.elapsed, phase: 0,
      blend: 0, directionX: 0, directionY: -1, speedRatio: 0 };
    renderer.rangerMotionState = state;
    return { phase: 0, blend: 0, directionX: 0, directionY: -1, speedRatio: 0, bob: 0 };
  }

  const dt = run.elapsed - state.elapsed;
  if (dt > 0) {
    const dx = player.x - state.x;
    const dy = player.y - state.y;
    const distance = Math.hypot(dx, dy);
    const plausible = dt <= 0.3 && distance <= Math.max(28, player.speed * dt * 2 + 4);
    if (plausible && distance > 0.15) {
      state.phase = (state.phase + distance / STRIDE_DISTANCE) % 1;
      const targetX = dx / distance;
      const targetY = dy / distance;
      const weight = Math.min(1, dt * 18);
      const directionX = state.directionX * (1 - weight) + targetX * weight;
      const directionY = state.directionY * (1 - weight) + targetY * weight;
      const directionLength = Math.hypot(directionX, directionY) || 1;
      state.directionX = directionX / directionLength;
      state.directionY = directionY / directionLength;
      state.blend = Math.min(1, state.blend + dt * 10);
      state.speedRatio = Math.min(1.25, distance / dt / 178);
    } else if (plausible) {
      state.blend = Math.max(0, state.blend - dt * 9);
      state.speedRatio = Math.max(0, state.speedRatio - dt * 10);
    } else {
      state.phase = 0;
      state.blend = 0;
      state.speedRatio = 0;
    }
    state.x = player.x;
    state.y = player.y;
    state.elapsed = run.elapsed;
  }

  return {
    phase: state.phase,
    blend: state.blend,
    directionX: state.directionX,
    directionY: state.directionY,
    speedRatio: state.speedRatio,
    bob: state.blend > 0.001 ? Math.abs(Math.sin(state.phase * Math.PI * 2)) * 1.5 * state.blend
      : Math.sin(run.elapsed * 2.2) * 0.35
  };
}

module.exports = { STRIDE_DISTANCE, rangerMotionFrame };
