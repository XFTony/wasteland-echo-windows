"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { rangerMotionFrame } = require("../src/render/ranger-motion");
const { PART, EQUIPMENT_SLOTS, RIG_ANCHORS, solveTwoBone, footTarget, weaponSupportOffset } = require("../src/render/ranger-rig");

test("ranger gait advances with real travel and stops when blocked", () => {
  const renderer = {};
  const run = { elapsed: 0 };
  const player = { x: 100, y: 100, speed: 178 };
  assert.equal(rangerMotionFrame(renderer, run, player).blend, 0);
  for (let tick = 0; tick < 12; tick += 1) {
    player.x += 3;
    run.elapsed += 1 / 60;
    rangerMotionFrame(renderer, run, player);
  }
  assert.ok(renderer.rangerMotionState.phase > 0.4);
  assert.ok(rangerMotionFrame(renderer, run, player).blend > 0.9);
  for (let tick = 0; tick < 12; tick += 1) {
    run.elapsed += 1 / 60;
    rangerMotionFrame(renderer, run, player);
  }
  assert.equal(rangerMotionFrame(renderer, run, player).blend, 0);
});

test("ranger gait freezes on pause and resets across teleports and new runs", () => {
  const renderer = {};
  const run = { elapsed: 0 };
  const player = { x: 100, y: 100, speed: 178 };
  rangerMotionFrame(renderer, run, player);
  player.x -= 24;
  run.elapsed += 0.15;
  const moving = rangerMotionFrame(renderer, run, player);
  assert.ok(moving.directionX < 0);
  assert.equal(rangerMotionFrame(renderer, run, player).phase, moving.phase);
  player.x += 500;
  run.elapsed += 1 / 60;
  assert.equal(rangerMotionFrame(renderer, run, player).blend, 0);
  assert.equal(rangerMotionFrame(renderer, { elapsed: 0 }, player).phase, 0);
  assert.equal(renderer.rangerMotionState.phase, 0);
});

test("joint slots and two-bone lengths support independent clothing pieces", () => {
  assert.equal(Object.keys(PART).length, 11);
  assert.deepEqual(EQUIPMENT_SLOTS.boots, ["bootLeft", "bootRight"]);
  assert.deepEqual(EQUIPMENT_SLOTS.helmet, ["torso"]);
  assert.ok(RIG_ANCHORS.head.y < RIG_ANCHORS.shoulderLeft.y);
  const hip = { x: -6, y: -33 };
  const ankle = { x: -15, y: -5 };
  const knee = solveTwoBone(hip, ankle, 17, 18, -1);
  assert.ok(Math.abs(Math.hypot(knee.x - hip.x, knee.y - hip.y) - 17) < 0.001);
  assert.ok(Math.abs(Math.hypot(ankle.x - knee.x, ankle.y - knee.y) - 18) < 0.001);
  const planted = footTarget(-1, { blend: 1, phase: 0.15, directionX: 1, directionY: 0, speedRatio: 1 });
  const swinging = footTarget(-1, { blend: 1, phase: 0.8, directionX: 1, directionY: 0, speedRatio: 1 });
  assert.equal(planted.lift, 0);
  assert.ok(swinging.lift > 0);
});

test("every weapon support hand and running foot stays within joint reach", () => {
  for (const width of [39, 49, 56, 61, 40, 55, 64]) {
    const support = weaponSupportOffset(width);
    for (let step = 0; step < 32; step += 1) {
      const angle = -Math.PI + step * Math.PI / 16;
      const x = support * Math.cos(angle) + Math.sin(angle);
      const y = RIG_ANCHORS.weaponGrip.y + support * Math.sin(angle) - Math.cos(angle);
      assert.ok(Math.hypot(x - RIG_ANCHORS.shoulderLeft.x, y - RIG_ANCHORS.shoulderLeft.y) < 37);
    }
  }
  for (const side of [-1, 1]) {
    for (let step = 0; step < 64; step += 1) {
      const phase = step / 64;
      for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const foot = footTarget(side, { blend: 1, phase, directionX: Math.cos(angle), directionY: Math.sin(angle), speedRatio: 1.25 });
        const hip = side < 0 ? RIG_ANCHORS.hipLeft : RIG_ANCHORS.hipRight;
        assert.ok(Math.hypot(foot.x - hip.x, foot.y - hip.y) < 35);
      }
    }
  }
});
