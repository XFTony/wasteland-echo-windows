"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_KEY_BINDINGS, normalizeKeyBindings, rebindKey, keyLabel } = require("../src/input/key-bindings");
const { InputManager } = require("../src/input/input-manager");

test("key bindings normalize malformed and duplicate entries", () => {
  const bindings = normalizeKeyBindings({ moveUp: "KeyI", moveDown: "KeyI", fire: "ArrowUp", pause: 42 });
  assert.equal(bindings.moveUp, "KeyI");
  assert.equal(bindings.moveDown, DEFAULT_KEY_BINDINGS.moveDown);
  assert.equal(bindings.fire, DEFAULT_KEY_BINDINGS.fire);
  assert.equal(bindings.pause, DEFAULT_KEY_BINDINGS.pause);
  assert.equal(new Set(Object.values(bindings)).size, Object.keys(bindings).length);
});

test("rebinding swaps conflicts and rejects menu-reserved keys", () => {
  const swapped = rebindKey(DEFAULT_KEY_BINDINGS, "moveUp", "KeyS");
  assert.equal(swapped.ok, true);
  assert.equal(swapped.status, "swapped");
  assert.equal(swapped.bindings.moveUp, "KeyS");
  assert.equal(swapped.bindings.moveDown, "KeyW");
  assert.equal(rebindKey(DEFAULT_KEY_BINDINGS, "fire", "ArrowLeft").status, "reserved");
});

test("keyboard labels remain compact for the Canvas settings page", () => {
  assert.equal(keyLabel("Space"), "空格");
  assert.equal(keyLabel("KeyQ"), "Q");
  assert.equal(keyLabel("Digit3"), "3");
});

test("input manager consumes the saved movement and fire bindings", () => {
  const input = new InputManager();
  const bindings = { ...DEFAULT_KEY_BINDINGS, moveUp: "KeyI", fire: "KeyK" };
  input.keyDown("KeyI");
  input.keyDown("KeyK");
  const frame = input.update({ settings: { gamepadEnabled: false }, keyBindings: bindings, screen: "running", width: 960, height: 540, gamepads: [] });
  assert.equal(frame.moveY, -1);
  assert.equal(frame.firing, true);
});
