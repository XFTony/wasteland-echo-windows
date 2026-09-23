"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { UiNavigator } = require("../src/input/ui-navigator");
const { UI_COMMANDS } = require("../src/core/contracts");
const { executeUiCommand } = require("../src/runtime/action-router");

const regions = [
  { action: "start", x: 20, y: 20, w: 160, h: 48 },
  { action: "settings", x: 20, y: 90, w: 75, h: 40 },
  { action: "credits", x: 105, y: 90, w: 75, h: 40 },
  { action: "weaponNext", x: 300, y: 20, w: 44, h: 44 }
];

test("UI navigator selects a stable default and moves spatially", () => {
  const navigator = new UiNavigator();
  assert.equal(navigator.sync(regions, "menu:main"), "start");
  assert.equal(navigator.move(regions, 0, 1), "settings");
  assert.equal(navigator.move(regions, 1, 0), "credits");
  assert.equal(navigator.activate(regions), "credits");
});

test("UI navigator invalidates focus when the screen contract changes", () => {
  const navigator = new UiNavigator();
  navigator.sync(regions, "menu:main");
  navigator.set("credits", regions);
  const pauseRegions = [{ action: "resume", x: 0, y: 0, w: 100, h: 40 }];
  assert.equal(navigator.sync(pauseRegions, "paused:main"), "resume");
  navigator.invalidate();
  assert.equal(navigator.focusedAction, null);
});

test("tab stepping wraps without relying on DOM elements", () => {
  const navigator = new UiNavigator();
  navigator.sync(regions, "menu:main");
  assert.equal(navigator.step(regions, -1), "weaponNext");
  assert.equal(navigator.step(regions, 1), "start");
});

test("deployment shoulder buttons move visible focus without changing a hidden weapon", () => {
  let weaponCycles = 0;
  const navigator = new UiNavigator();
  const deploymentRegions = [
    { action: "back", x: 10, y: 10, w: 80, h: 36 },
    { action: "inventory", x: 10, y: 60, w: 180, h: 160 },
    { action: "deploy", x: 220, y: 170, w: 220, h: 48 }
  ];
  const app = {
    renderer: { regions: deploymentRegions },
    navigator,
    contextKey: () => "menu:loadout",
    model: { screen: "menu", menuPage: "loadout", cycleWeapon() { weaponCycles += 1; } }
  };
  navigator.sync(deploymentRegions, app.contextKey());
  assert.equal(navigator.focusedAction, "deploy");
  executeUiCommand(app, { type: UI_COMMANDS.SHOULDER_LEFT });
  assert.equal(navigator.focusedAction, "inventory");
  assert.equal(weaponCycles, 0);
});
