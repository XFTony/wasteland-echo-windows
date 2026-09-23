"use strict";

const SCREENS = Object.freeze({
  MENU: "menu",
  RUNNING: "running",
  LEVEL_UP: "levelup",
  PAUSED: "paused",
  RESULT_WIN: "resultWin",
  RESULT_LOSE: "resultLose"
});

const INPUT_DEVICES = Object.freeze({
  KEYBOARD_MOUSE: "keyboardMouse",
  GAMEPAD: "gamepad"
});

const UI_COMMANDS = Object.freeze({
  ACTIVATE: "activate",
  BACK: "back",
  NAVIGATE: "navigate",
  PAUSE: "pause",
  QUIT: "quit",
  RESTART: "restart",
  FULLSCREEN: "fullscreen",
  UPGRADE_INDEX: "upgradeIndex",
  SHOULDER_LEFT: "shoulderLeft",
  SHOULDER_RIGHT: "shoulderRight"
});

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, finiteNumber(value)));
}

function createGameplayInput() {
  return { moveX: 0, moveY: 0, aimX: 1, aimY: 0, aimActive: false, firing: false };
}

function copyGameplayInput(target, source) {
  const next = source || {};
  target.moveX = clampUnit(next.moveX);
  target.moveY = clampUnit(next.moveY);
  target.aimX = finiteNumber(next.aimX, target.aimX || 1);
  target.aimY = finiteNumber(next.aimY, target.aimY || 0);
  target.aimActive = Boolean(next.aimActive);
  target.firing = Boolean(next.firing);
  return target;
}

function assertPort(name, port, methods) {
  if (!port || typeof port !== "object") throw new TypeError(`${name} port is required`);
  for (const method of methods) {
    if (typeof port[method] !== "function") throw new TypeError(`${name}.${method} must be a function`);
  }
  return port;
}

module.exports = {
  SCREENS,
  INPUT_DEVICES,
  UI_COMMANDS,
  finiteNumber,
  clampUnit,
  createGameplayInput,
  copyGameplayInput,
  assertPort
};
