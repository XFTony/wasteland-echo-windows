"use strict";

const EMPTY_GAMEPADS = Object.freeze([]);

function createBrowserPlatform(windowObject, documentObject, canvas) {
  const win = windowObject;
  const doc = documentObject;
  return {
    profile: "windows-desktop",
    viewport: () => ({
      width: win.innerWidth,
      height: win.innerHeight,
      dpr: win.devicePixelRatio || 1
    }),
    raf: (callback) => win.requestAnimationFrame(callback),
    now: () => {
      const clock = win.performance || (typeof globalThis !== "undefined" && globalThis.performance);
      return clock && typeof clock.now === "function" ? clock.now() : Date.now();
    },
    gamepads: () => {
      try {
        return win.navigator && typeof win.navigator.getGamepads === "function"
          ? win.navigator.getGamepads() || EMPTY_GAMEPADS
          : EMPTY_GAMEPADS;
      } catch (_error) {
        return EMPTY_GAMEPADS;
      }
    },
    toggleFullscreen: () => {
      try {
        if (doc.fullscreenElement && typeof doc.exitFullscreen === "function") return doc.exitFullscreen();
        const target = canvas.parentElement || canvas;
        if (target && typeof target.requestFullscreen === "function") return target.requestFullscreen();
      } catch (_error) {
        return false;
      }
      return false;
    }
  };
}

module.exports = { EMPTY_GAMEPADS, createBrowserPlatform };
