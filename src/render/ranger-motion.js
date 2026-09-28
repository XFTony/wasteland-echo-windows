"use strict";

const FRAME_COUNT = 12;
const FRAME_SIZE = 160;
const STRIDE_DISTANCE = 96;

function rangerMotionFrame(renderer, run, player) {
  let state = renderer.rangerMotionState;
  if (!state || state.run !== run) {
    state = { run, x: player.x, y: player.y, elapsed: run.elapsed, phase: 0, moving: false, mirror: false };
    renderer.rangerMotionState = state;
    return { frame: 0, bob: 0, mirror: false };
  }

  const dt = run.elapsed - state.elapsed;
  if (dt > 0) {
    const dx = player.x - state.x;
    const dy = player.y - state.y;
    const distance = Math.hypot(dx, dy);
    const plausible = dt <= 0.3 && distance <= Math.max(28, player.speed * dt * 2 + 4);
    state.moving = plausible && distance > 0.15;
    if (state.moving) {
      state.phase = (state.phase + distance / STRIDE_DISTANCE) % 1;
      if (Math.abs(dx) > Math.abs(dy) * 0.25) state.mirror = dx < 0;
    } else if (!plausible) {
      state.phase = 0;
    }
    state.x = player.x;
    state.y = player.y;
    state.elapsed = run.elapsed;
  }

  return {
    frame: state.moving ? Math.floor(state.phase * FRAME_COUNT) % FRAME_COUNT : 0,
    bob: state.moving ? Math.abs(Math.sin(state.phase * Math.PI * 2)) * 1.2 : Math.sin(run.elapsed * 2.2) * 0.35,
    mirror: state.mirror
  };
}

module.exports = { FRAME_COUNT, FRAME_SIZE, STRIDE_DISTANCE, rangerMotionFrame };
