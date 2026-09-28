"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { FRAME_COUNT, rangerMotionFrame } = require("../src/render/ranger-motion");

test("ranger gait advances with real travel and stops when blocked", () => {
  const renderer = {};
  const run = { elapsed: 0 };
  const player = { x: 100, y: 100, speed: 178 };
  assert.equal(rangerMotionFrame(renderer, run, player).frame, 0);
  for (let tick = 0; tick < 12; tick += 1) {
    player.x += 3;
    run.elapsed += 1 / 60;
    rangerMotionFrame(renderer, run, player);
  }
  assert.ok(renderer.rangerMotionState.phase > 0.3);
  assert.ok(rangerMotionFrame(renderer, run, player).frame > 0);
  run.elapsed += 1 / 60;
  assert.equal(rangerMotionFrame(renderer, run, player).frame, 0);
});

test("ranger gait freezes on pause and resets across teleports and new runs", () => {
  const renderer = {};
  const run = { elapsed: 0 };
  const player = { x: 100, y: 100, speed: 178 };
  rangerMotionFrame(renderer, run, player);
  player.x -= 24;
  run.elapsed += 0.15;
  const moving = rangerMotionFrame(renderer, run, player);
  assert.equal(moving.mirror, true);
  assert.equal(rangerMotionFrame(renderer, run, player).frame, moving.frame);
  player.x += 500;
  run.elapsed += 1 / 60;
  assert.equal(rangerMotionFrame(renderer, run, player).frame, 0);
  assert.equal(rangerMotionFrame(renderer, { elapsed: 0 }, player).frame, 0);
  assert.ok(renderer.rangerMotionState.phase < 1 / FRAME_COUNT);
});
