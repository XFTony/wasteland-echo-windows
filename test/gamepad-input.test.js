"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { applyRadialDeadzone, GamepadSource } = require("../src/input/gamepad-source");
const { InputManager } = require("../src/input/input-manager");

function buttons(values = {}) {
  return Array.from({ length: 16 }, (_, index) => ({
    pressed: Number(values[index] || 0) > 0.5,
    value: Number(values[index] || 0)
  }));
}

function pad({ axes = [0, 0, 0, 0], buttonValues = {}, actuator = null } = {}) {
  return {
    id: "Xbox Wireless Controller",
    index: 0,
    connected: true,
    mapping: "standard",
    axes,
    buttons: buttons(buttonValues),
    vibrationActuator: actuator
  };
}

test("radial deadzone removes drift and rescales useful stick travel", () => {
  assert.deepEqual(applyRadialDeadzone(0.08, -0.04, 0.18), { x: 0, y: 0, magnitude: 0 });
  const value = applyRadialDeadzone(0.6, 0, 0.2);
  assert.ok(Math.abs(value.x - 0.5) < 0.0001);
  assert.equal(value.y, 0);
  assert.ok(Math.abs(value.magnitude - 0.5) < 0.0001);
});

test("gamepad maps left stick, right stick and trigger into the canonical input frame", () => {
  const input = new InputManager();
  input.update({
    gamepads: [pad({ axes: [0.6, -0.4, 0.9, 0.2], buttonValues: { 7: 0.8 } })],
    settings: { gamepadEnabled: true, gamepadDeadzone: 0.18 },
    screen: "running",
    width: 1280,
    height: 720,
    now: 10
  });
  assert.equal(input.activeDevice, "gamepad");
  assert.ok(input.gameplay.moveX > 0.4);
  assert.ok(input.gameplay.moveY < -0.2);
  assert.ok(input.gameplay.aimX > 0.8);
  assert.equal(input.gameplay.aimActive, true);
  assert.equal(input.gameplay.firing, true);
});

test("disconnecting a gamepad clears analog movement and firing without sticky state", () => {
  const input = new InputManager();
  const options = {
    settings: { gamepadEnabled: true, gamepadDeadzone: 0.18 },
    screen: "running",
    width: 1280,
    height: 720,
    now: 10
  };
  input.update({ ...options, gamepads: [pad({ axes: [1, 0, 0, 0], buttonValues: { 7: 1 } })] });
  assert.ok(input.gameplay.moveX > 0.9);
  input.update({ ...options, gamepads: [], now: 20 });
  assert.equal(input.gameplay.moveX, 0);
  assert.equal(input.gameplay.moveY, 0);
  assert.equal(input.gameplay.firing, false);
  assert.equal(input.gamepadState.connected, false);
  assert.equal(input.activeDevice, "keyboardMouse");
});

test("gamepad input can be disabled without affecting keyboard controls", () => {
  const input = new InputManager();
  input.keyDown("KeyW");
  input.update({
    gamepads: [pad({ axes: [1, 0, 1, 0], buttonValues: { 7: 1 } })],
    settings: { gamepadEnabled: false, gamepadDeadzone: 0.18 },
    screen: "running",
    width: 1280,
    height: 720,
    now: 10
  });
  assert.equal(input.gameplay.moveX, 0);
  assert.equal(input.gameplay.moveY, -1);
  assert.equal(input.gameplay.firing, false);
  assert.equal(input.gamepadState.connected, false);
});

test("menu buttons are edge-triggered and do not repeat every frame", () => {
  const source = new GamepadSource();
  const pressed = pad({ buttonValues: { 0: 1 } });
  const first = source.poll([pressed], { uiMode: true, now: 0 });
  assert.deepEqual(first.commands.map((command) => command.type), ["confirm"]);
  const held = source.poll([pressed], { uiMode: true, now: 16 });
  assert.equal(held.commands.some((command) => command.type === "confirm"), false);
  source.poll([pad()], { uiMode: true, now: 32 });
  const second = source.poll([pressed], { uiMode: true, now: 48 });
  assert.equal(second.commands.some((command) => command.type === "confirm"), true);
});

test("held d-pad navigation uses a controlled repeat delay", () => {
  const source = new GamepadSource();
  const right = pad({ buttonValues: { 15: 1 } });
  assert.equal(source.poll([right], { uiMode: true, now: 0 }).commands.some((command) => command.type === "navigate"), true);
  assert.equal(source.poll([right], { uiMode: true, now: 100 }).commands.some((command) => command.type === "navigate"), false);
  assert.equal(source.poll([right], { uiMode: true, now: 340 }).commands.some((command) => command.type === "navigate"), true);
});

test("gamepad rumble is optional, bounded and failure-safe", () => {
  const effects = [];
  const source = new GamepadSource();
  source.poll([pad({ actuator: { playEffect: (name, options) => { effects.push([name, options]); return Promise.resolve(); } } })], { now: 0 });
  assert.equal(source.rumble("medium", true, 100), true);
  assert.equal(source.rumble("short", true, 110), false, "rapid feedback should be throttled");
  assert.equal(effects.length, 1);
  assert.equal(effects[0][0], "dual-rumble");
  assert.ok(effects[0][1].strongMagnitude > 0.5);
});
