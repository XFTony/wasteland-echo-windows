"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { keyboardCommand, gamepadCommand } = require("../src/input/command-map");

test("keyboard mappings separate gameplay movement from desktop UI navigation", () => {
  assert.equal(keyboardCommand("ArrowRight", { screen: "running" }), null);
  assert.deepEqual(keyboardCommand("ArrowRight", { screen: "menu", menuPage: "main" }), {
    type: "navigate", dx: 1, dy: 0
  });
  assert.deepEqual(keyboardCommand("Digit3", { screen: "levelup" }), {
    type: "upgradeIndex", index: 2
  });
  assert.deepEqual(keyboardCommand("KeyF", { screen: "running" }), { type: "fullscreen" });
});

test("gamepad confirmation is ignored during combat but active in Canvas menus", () => {
  assert.equal(gamepadCommand({ type: "confirm" }, { screen: "running" }), null);
  assert.deepEqual(gamepadCommand({ type: "confirm" }, { screen: "menu" }), { type: "activate" });
  assert.deepEqual(gamepadCommand({ type: "cancel" }, { screen: "paused" }), { type: "pause" });
  assert.deepEqual(gamepadCommand({ type: "pause" }, { screen: "running" }), { type: "pause" });
});

test("custom keyboard bindings drive commands without changing fixed menu navigation", () => {
  const keyBindings = { ...require("../src/input/key-bindings").DEFAULT_KEY_BINDINGS, pause: "KeyO", fullscreen: "KeyL", upgrade3: "KeyU" };
  assert.deepEqual(keyboardCommand("KeyO", { screen: "running", keyBindings }), { type: "pause" });
  assert.deepEqual(keyboardCommand("KeyL", { screen: "running", keyBindings }), { type: "fullscreen" });
  assert.deepEqual(keyboardCommand("KeyU", { screen: "levelup", keyBindings }), { type: "upgradeIndex", index: 2 });
  assert.deepEqual(keyboardCommand("ArrowRight", { screen: "menu", keyBindings }), { type: "navigate", dx: 1, dy: 0 });
});
