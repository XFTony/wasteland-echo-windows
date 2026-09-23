"use strict";

const { createGameRuntime } = require("./runtime/create-game-runtime");
const { createBrowserPlatform } = require("./platform/browser-platform");
const { bindBrowserEvents } = require("./platform/browser-bindings");

const canvas = document.getElementById("game");
if (!canvas) throw new Error("The desktop canvas '#game' is required.");

const storage = {
  get(key) {
    return window.localStorage.getItem(key);
  },
  set(key, value) {
    window.localStorage.setItem(key, value);
  }
};

const params = new URLSearchParams(window.location.search);
const requestedDuration = Number(params.get("duration"));
const requestedSeed = Number(params.get("seed"));
const requestedMenu = params.get("menu");
const seed = Number.isFinite(requestedSeed) && requestedSeed > 0 ? requestedSeed : Date.now();
const modelOptions = { seed };
if (Number.isFinite(requestedDuration) && requestedDuration >= 15) modelOptions.duration = requestedDuration;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const platform = createBrowserPlatform(window, document, canvas);
const runtime = createGameRuntime({
  canvas,
  storage,
  platform,
  modelOptions,
  audioContextFactory: () => (AudioContextClass ? new AudioContextClass() : null)
});

runtime.disposeBindings = bindBrowserEvents({
  windowObject: window,
  documentObject: document,
  canvas,
  app: runtime.app
});

window.__WASTELAND_GAME__ = runtime;
if (["main", "loadout", "inventory", "shop", "settings", "credits"].includes(requestedMenu)) {
  runtime.model.setMenuPage(requestedMenu);
}
if (document.fonts && typeof document.fonts.load === "function") {
  Promise.all([
    document.fonts.load('12px "Fusion Pixel 12"'),
    document.fonts.load('900 24px "Fusion Pixel 12"')
  ]).catch(() => {}).finally(() => runtime.app.start());
} else {
  runtime.app.start();
}
