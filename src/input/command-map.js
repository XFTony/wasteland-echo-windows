"use strict";

const { SCREENS, UI_COMMANDS } = require("../core/contracts");
const { DEFAULT_KEY_BINDINGS } = require("./key-bindings");

function keyboardCommand(code, context = {}) {
  const screen = context.screen;
  const menuPage = context.menuPage;
  const bindings = context.keyBindings || DEFAULT_KEY_BINDINGS;
  if (code === bindings.fullscreen || code === "F11") return { type: UI_COMMANDS.FULLSCREEN };
  if (code === bindings.quit && screen === SCREENS.PAUSED) return { type: UI_COMMANDS.QUIT };
  if (code === bindings.restart && (screen === SCREENS.PAUSED || screen === SCREENS.RESULT_WIN || screen === SCREENS.RESULT_LOSE)) {
    return { type: UI_COMMANDS.RESTART };
  }
  if (code === bindings.pause) {
    if (screen === SCREENS.RUNNING || screen === SCREENS.PAUSED) return { type: UI_COMMANDS.PAUSE };
    return null;
  }
  if (code === "Escape" && bindings.pause !== "Escape") {
    if (screen === SCREENS.RUNNING || screen === SCREENS.PAUSED) return { type: UI_COMMANDS.PAUSE };
    if (screen === SCREENS.MENU && menuPage !== "main") return { type: UI_COMMANDS.BACK };
    if (screen === SCREENS.RESULT_WIN || screen === SCREENS.RESULT_LOSE) return { type: UI_COMMANDS.BACK };
    return null;
  }
  if (screen === SCREENS.LEVEL_UP) {
    for (let index = 0; index < 4; index += 1) {
      if (code === bindings[`upgrade${index + 1}`]) return { type: UI_COMMANDS.UPGRADE_INDEX, index };
    }
  }
  if (screen !== SCREENS.RUNNING) {
    if (code === "Enter" || code === "NumpadEnter" || code === "Space") return { type: UI_COMMANDS.ACTIVATE };
    if (code === "Tab") return { type: UI_COMMANDS.NAVIGATE, step: context.shiftKey ? -1 : 1 };
    if (code === "ArrowLeft") return { type: UI_COMMANDS.NAVIGATE, dx: -1, dy: 0 };
    if (code === "ArrowRight") return { type: UI_COMMANDS.NAVIGATE, dx: 1, dy: 0 };
    if (code === "ArrowUp") return { type: UI_COMMANDS.NAVIGATE, dx: 0, dy: -1 };
    if (code === "ArrowDown") return { type: UI_COMMANDS.NAVIGATE, dx: 0, dy: 1 };
  }
  return null;
}

function gamepadCommand(command, context = {}) {
  if (!command) return null;
  const screen = context.screen;
  if (command.type === "pause") {
    return screen === SCREENS.RUNNING || screen === SCREENS.PAUSED ? { type: UI_COMMANDS.PAUSE } : null;
  }
  if (command.type === "confirm") return screen === SCREENS.RUNNING ? null : { type: UI_COMMANDS.ACTIVATE };
  if (command.type === "navigate") return { type: UI_COMMANDS.NAVIGATE, dx: command.dx, dy: command.dy };
  if (command.type === "cancel") {
    if (screen === SCREENS.PAUSED) return { type: UI_COMMANDS.PAUSE };
    return { type: UI_COMMANDS.BACK };
  }
  if (command.type === "shoulderLeft") return { type: UI_COMMANDS.SHOULDER_LEFT };
  if (command.type === "shoulderRight") return { type: UI_COMMANDS.SHOULDER_RIGHT };
  return null;
}

module.exports = { keyboardCommand, gamepadCommand };
