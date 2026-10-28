"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Motion = require("../scripts/animation/compact-ranger-motion");
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test("offline motion exposes CommonJS and browser UMD without DOM dependencies", () => {
  const context = { Math, Number, Object, Boolean, Infinity };
  vm.runInNewContext(fs.readFileSync(require.resolve("../src/shared/compact-ranger-motion"), "utf8"), context);
  assert.equal(Motion, require("../src/shared/compact-ranger-motion"));
  for (const name of ["createState", "step", "pose", "draw", "setAimAngle"]) assert.equal(typeof context.CompactRangerMotion[name], "function");
});

test("walk phase measures resolved travel, not held movement or collision pressure", () => {
  const state = Motion.createState({ x: 80, y: 120, world: { width: 400, height: 300,
    boxes: [{ x: 100, y: 70, w: 40, h: 100 }] } });
  Motion.step(state, { dx: 100, dy: 0 }, 1 / 60);
  near(state.x, 90); near(state.distance, 10);
  const phase = state.phase;
  for (let i = 0; i < 60; i++) Motion.step(state, { moveX: 1 }, 1 / 60);
  near(state.phase, phase); assert.equal(state.walking, false); assert.equal(Motion.pose(state).bodyFrame, 0);
  Motion.step(state, { moveY: 1 }, 1 / 60);
  assert.ok(state.phase > phase); assert.ok(Motion.pose(state).bodyFrame >= 1 && Motion.pose(state).bodyFrame <= 8);
  const edge = Motion.createState({ x: 10, y: 100 });
  Motion.step(edge, { moveX: -1 }, 1 / 60); near(edge.phase, 0); near(edge.distance, 0);
});

test("diagonal movement has the same travel speed and paused samples remain frozen", () => {
  const state = Motion.createState({ x: 120, y: 160, speed: 120 });
  Motion.step(state, { moveX: 1, moveY: 1, firing: true }, 1 / 60);
  near(state.distance, 2);
  const old = { x: state.x, y: state.y, phase: state.phase, recoil: state.recoil, elapsed: state.elapsed, shots: state.shotsFired };
  Motion.step(state, { paused: true, moveX: 1, firing: true, targetX: -100, targetY: 0 }, .05);
  for (const key of ["x", "y", "phase", "recoil", "elapsed"]) near(state[key], old[key]);
  assert.equal(state.shotsFired, old.shots);
});

test("repeated shots do not restart or alter the independent walk phase", () => {
  const armed = Motion.createState(), unarmed = Motion.createState();
  for (let i = 0; i < 90; i++) {
    Motion.step(armed, { moveX: 1, moveY: .2, firing: true }, 1 / 60);
    Motion.step(unarmed, { moveX: 1, moveY: .2 }, 1 / 60);
    near(armed.phase, unarmed.phase); assert.equal(Motion.pose(armed).bodyFrame, Motion.pose(unarmed).bodyFrame);
  }
  assert.ok(armed.shotsFired >= 5);
});

test("vertical aiming retains horizontal facing, and shoulder coordinates do not jump at the flip", () => {
  const state = Motion.createState();
  Motion.setAimAngle(state, -Math.PI / 2 + .02); assert.equal(state.facing, 1);
  Motion.setAimAngle(state, -Math.PI / 2 - .02); assert.equal(state.facing, 1);
  const threshold = Math.acos(-.15);
  Motion.setAimAngle(state, -threshold + 1e-6); const before = Motion.pose(state).weapon;
  Motion.setAimAngle(state, -threshold - 1e-6); const after = Motion.pose(state).weapon;
  assert.equal(state.facing, -1);
  assert.ok(Math.hypot(before.anchorX - after.anchorX, before.anchorY - after.anchorY) < .001);
  assert.ok(Math.hypot(before.muzzleX - after.muzzleX, before.muzzleY - after.muzzleY) < .001);
  Motion.setAimAngle(state, -Math.PI / 2);
  const up = Motion.pose(state); assert.equal(up.depth, "back");
  assert.ok(up.weapon.muzzleY < state.y - 44 * state.pixelScale, "upward muzzle must protrude above the large hood");
  Motion.setAimAngle(state, Math.PI / 2); assert.equal(Motion.pose(state).depth, "front");
});

test("all eight aims spawn bullets at the same transformed muzzle used by the held weapon", () => {
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const state = Motion.createState({ x: 300, y: 300, angle });
    Motion.step(state, { firing: true }, 1 / 60);
    const weapon = Motion.pose(state).weapon, bullet = state.bullets[0];
    near(bullet.x, weapon.muzzleX); near(bullet.y, weapon.muzzleY);
    near(bullet.vx, Math.cos(angle) * state.config.bulletSpeed);
    near(bullet.vy, Math.sin(angle) * state.config.bulletSpeed);
    near(state.lastShot.x, weapon.muzzleX); near(state.lastShot.y, weapon.muzzleY);
  }
});

test("swept bullet impacts hit targets but cannot hit a target through an intervening box", () => {
  const options = { x: 100, y: 100, targets: [{ id: "plate", x: 210, y: 68, radius: 12, hp: 3 }] };
  const open = Motion.createState(options);
  Motion.step(open, { firing: true }, 1 / 60);
  for (let i = 0; i < 20; i++) Motion.step(open, {}, 1 / 60);
  assert.equal(open.targets[0].hp, 2); assert.equal(open.hits, 1); assert.equal(open.bullets.length, 0);
  const blocked = Motion.createState({ ...options, world: { boxes: [{ x: 175, y: 40, w: 10, h: 50 }] } });
  Motion.step(blocked, { firing: true }, 1 / 60);
  for (let i = 0; i < 20; i++) Motion.step(blocked, {}, 1 / 60);
  assert.equal(blocked.targets[0].hp, 3); assert.equal(blocked.hits, 0); assert.equal(blocked.bullets.length, 0);
});

test("cursor aiming uses the offset grip so every outgoing ray passes through its target", () => {
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI / 16;
    const state = Motion.createState({ x: 450, y: 330 });
    const targetX = state.x + Math.cos(angle) * 220;
    const targetY = state.y - 32 + Math.sin(angle) * 220;
    Motion.step(state, { targetX, targetY, firing: true }, 1 / 60);
    const shot = state.lastShot;
    const perpendicularError = Math.abs((targetX - shot.x) * shot.aimY - (targetY - shot.y) * shot.aimX);
    assert.ok(perpendicularError < .01, `cursor ray missed by ${perpendicularError}px at ${i}`);
    assert.ok((targetX - shot.x) * shot.aimX + (targetY - shot.y) * shot.aimY > 0);
  }
});

function recordingContext() {
  let matrix = [1, 0, 0, 1, 0, 0]; const stack = [], images = [];
  const multiply = b => { const [a, c, e, f, g, h] = matrix;
    matrix = [a * b[0] + e * b[1], c * b[0] + f * b[1], a * b[2] + e * b[3], c * b[2] + f * b[3], a * b[4] + e * b[5] + g, c * b[4] + f * b[5] + h]; };
  return { images, save() { stack.push(matrix.slice()); }, restore() { matrix = stack.pop(); },
    translate(x, y) { multiply([1, 0, 0, 1, x, y]); }, rotate(a) { multiply([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    scale(x, y) { multiply([x, 0, 0, y, 0, 0]); }, drawImage(...args) { images.push({ matrix: matrix.slice(), args }); } };
}

test("draw transform agrees with the configured muzzle and keeps left-facing weapons upright", () => {
  const state = Motion.createState({ x: 200, y: 240, angle: Math.PI,
    weapon: { pivot: [4, 5], muzzle: [20, 5], width: 28, height: 18 } });
  const body = { width: 576, height: 64 }, weapon = { width: 28, height: 18 }, ctx = recordingContext();
  const result = Motion.draw(ctx, state, { body, weapon }, { drawShadow: false, drawTargets: false,
    drawProjectiles: false, drawImpacts: false, drawFlash: false });
  assert.equal(result.drawn, true); assert.equal(ctx.images.length, 2);
  const call = ctx.images.find(entry => entry.args[0] === weapon), m = call.matrix;
  const x = 20 - 4, y = 5 - 5;
  near(m[0] * x + m[2] * y + m[4], result.weapon.muzzleX);
  near(m[1] * x + m[3] * y + m[5], result.weapon.muzzleY);
  near(m[3], state.pixelScale, 1e-8); // Left-facing sprite's local down stays screen-down.
});
