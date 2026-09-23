"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createContext() {
  const drawCalls = [];
  const gradient = { addColorStop: () => {} };
  const canvasContext = {
    setTransform: () => {}, clearRect: () => {}, fillRect: (...args) => drawCalls.push(args),
    strokeRect: () => {}, beginPath: () => {}, closePath: () => {}, moveTo: () => {},
    lineTo: () => {}, quadraticCurveTo: () => {}, arc: () => {}, fill: () => {}, stroke: () => {},
    save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
    fillText: () => {}, createLinearGradient: () => gradient,
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left",
    textBaseline: "middle", globalAlpha: 1, imageSmoothingEnabled: false
  };
  const canvasListeners = {};
  const canvas = {
    width: 0, height: 0, style: {},
    getContext: () => canvasContext,
    addEventListener: (type, listener) => { canvasListeners[type] = listener; },
    setPointerCapture: () => {}
  };
  const rafCallbacks = [];
  const localStore = new Map();
  const gamepads = [];
  const windowListeners = {};
  const windowObject = {
    innerWidth: 960,
    innerHeight: 540,
    devicePixelRatio: 1,
    location: { search: "?duration=60&seed=17" },
    localStorage: {
      getItem: (key) => localStore.get(key) || null,
      setItem: (key, value) => localStore.set(key, value)
    },
    navigator: { getGamepads: () => gamepads },
    requestAnimationFrame: (callback) => { rafCallbacks.push(callback); return rafCallbacks.length; },
    addEventListener: (type, listener) => { windowListeners[type] = listener; }
  };
  const documentListeners = {};
  const documentObject = {
    hidden: false,
    getElementById: (id) => id === "game" ? canvas : null,
    addEventListener: (type, listener) => { documentListeners[type] = listener; }
  };
  const context = vm.createContext({
    window: windowObject,
    document: documentObject,
    navigator: {},
    performance: { now: () => 0 },
    URLSearchParams,
    Date,
    Math,
    console,
    setTimeout,
    clearTimeout
  });
  context.globalThis = context;
  return { context, windowObject, rafCallbacks, drawCalls, windowListeners, canvasListeners, gamepads };
}

test("generated browser bundle boots, renders menu, and starts a run", () => {
  const root = path.resolve(__dirname, "..");
  const bundle = fs.readFileSync(path.join(root, "web", "game.bundle.js"), "utf8");
  const harness = createContext();
  vm.runInContext(bundle, harness.context, { filename: "game.bundle.js", timeout: 2000 });
  assert.ok(harness.windowObject.__WASTELAND_GAME__);
  assert.equal(harness.rafCallbacks.length, 1);
  harness.rafCallbacks.shift()(16);
  const game = harness.windowObject.__WASTELAND_GAME__;
  assert.equal(game.model.screen, "menu");
  assert.ok(game.renderer.regions.some((region) => region.action === "start"));
  game.app.handleAction("start");
  harness.rafCallbacks.shift()(32);
  assert.equal(game.model.screen, "menu");
  assert.equal(game.model.menuPage, "loadout");
  assert.ok(game.renderer.regions.some((region) => region.action === "deploy"));
  assert.ok(game.renderer.regions.some((region) => region.action === "inventory"));
  game.app.handleAction("inventory");
  harness.rafCallbacks.shift()(40);
  assert.equal(game.model.menuPage, "inventory");
  assert.ok(game.renderer.regions.some((region) => region.action === "selectWeapon:scrap_pistol"));
  game.app.handleAction("back");
  harness.rafCallbacks.shift()(44);
  assert.equal(game.model.menuPage, "loadout");
  game.app.handleAction("deploy");
  harness.rafCallbacks.shift()(48);
  assert.equal(game.model.screen, "running");
  assert.ok(harness.drawCalls.length > 100);

  const keyboardEvent = (code) => ({ code, preventDefault() {} });
  harness.windowListeners.keydown(keyboardEvent("KeyW"));
  assert.equal(game.app.input.moveY, -1);
  harness.windowListeners.keyup(keyboardEvent("KeyW"));
  assert.equal(game.app.input.moveY, 0);

  harness.windowListeners.keydown(keyboardEvent("KeyP"));
  harness.windowListeners.keyup(keyboardEvent("KeyP"));
  harness.rafCallbacks.shift()(64);
  assert.equal(game.model.screen, "paused");
  const quit = game.renderer.regions.find((region) => region.action === "quit");
  assert.ok(quit);
  harness.canvasListeners.pointerdown({
    pointerId: 7,
    pointerType: "mouse",
    clientX: quit.x + quit.w / 2,
    clientY: quit.y + quit.h / 2,
    preventDefault() {}
  });
  assert.equal(game.model.screen, "menu");
});

test("generated desktop bundle can start from a standard gamepad", () => {
  const root = path.resolve(__dirname, "..");
  const bundle = fs.readFileSync(path.join(root, "web", "game.bundle.js"), "utf8");
  const harness = createContext();
  vm.runInContext(bundle, harness.context, { filename: "game.bundle.js", timeout: 2000 });
  harness.rafCallbacks.shift()(16);
  const gamepad = {
    id: "Xbox Controller",
    index: 0,
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: index === 0, value: index === 0 ? 1 : 0 }))
  };
  harness.gamepads.push(gamepad);
  harness.rafCallbacks.shift()(32);
  const game = harness.windowObject.__WASTELAND_GAME__;
  assert.equal(game.input.activeDevice, "gamepad");
  assert.equal(game.model.screen, "menu");
  assert.equal(game.model.menuPage, "loadout");
  gamepad.buttons[0] = { pressed: false, value: 0 };
  harness.rafCallbacks.shift()(48);
  gamepad.buttons[0] = { pressed: true, value: 1 };
  harness.rafCallbacks.shift()(64);
  assert.equal(game.model.screen, "running");
});
