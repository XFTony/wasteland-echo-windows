"use strict";

const { INPUT_DEVICES, SCREENS, createGameplayInput } = require("../core/contracts");
const { GamepadSource } = require("./gamepad-source");
const { DEFAULT_KEY_BINDINGS } = require("./key-bindings");

function vectorLengthSq(x, y) {
  return x * x + y * y;
}

class InputManager {
  constructor(options = {}) {
    this.gamepad = options.gamepad || new GamepadSource();
    this.keyboard = new Set();
    this.pointer = { x: 0, y: 0, down: false, type: "mouse" };
    this.mouseAimX = 1;
    this.mouseAimY = 0;
    this.mouseAimActive = false;
    this.viewport = { width: 960, height: 540, aimOriginX: 480, aimOriginY: 270 };
    this.gameplay = createGameplayInput();
    this.activeDevice = INPUT_DEVICES.KEYBOARD_MOUSE;
    this.gamepadState = this.gamepad.snapshot;
    this.presentation = {
      pointer: this.pointer,
      activeDevice: this.activeDevice,
      gamepadConnected: false,
      gamepadId: "",
      focusAction: null,
      metrics: null
    };
  }

  keyDown(code) {
    const alreadyPressed = this.keyboard.has(code);
    this.keyboard.add(code);
    this.activeDevice = INPUT_DEVICES.KEYBOARD_MOUSE;
    return { alreadyPressed };
  }

  keyUp(code) {
    this.keyboard.delete(code);
    this.activeDevice = INPUT_DEVICES.KEYBOARD_MOUSE;
  }

  mouseDown(x, y, viewport) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = true;
    this.pointer.type = "mouse";
    this.activeDevice = INPUT_DEVICES.KEYBOARD_MOUSE;
    this.updateMouseAim(x, y, viewport);
  }

  mouseMove(x, y, viewport) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.activeDevice = INPUT_DEVICES.KEYBOARD_MOUSE;
    this.updateMouseAim(x, y, viewport);
  }

  mouseUp() {
    this.pointer.down = false;
  }

  updateMouseAim(x, y, viewport) {
    const originX = Number.isFinite(viewport.aimOriginX) ? viewport.aimOriginX : viewport.width / 2;
    const originY = Number.isFinite(viewport.aimOriginY) ? viewport.aimOriginY : viewport.height / 2;
    const dx = x - originX;
    const dy = y - originY;
    if (vectorLengthSq(dx, dy) > 16) {
      this.mouseAimX = dx;
      this.mouseAimY = dy;
      this.mouseAimActive = true;
    }
  }

  update(options = {}) {
    const settings = options.settings || {};
    const bindings = options.keyBindings || DEFAULT_KEY_BINDINGS;
    const viewport = this.viewport;
    viewport.width = options.width || 960;
    viewport.height = options.height || 540;
    viewport.aimOriginX = options.aimOriginX;
    viewport.aimOriginY = options.aimOriginY;
    if (this.mouseAimActive) this.updateMouseAim(this.pointer.x, this.pointer.y, viewport);
    const gamepad = options.gamepads === undefined
      ? this.gamepadState
      : this.gamepad.poll(options.gamepads || [], {
        enabled: settings.gamepadEnabled !== false,
        deadzone: settings.gamepadDeadzone,
        uiMode: options.screen !== SCREENS.RUNNING,
        now: options.now
      });
    this.gamepadState = gamepad;
    if (gamepad.activity) this.activeDevice = INPUT_DEVICES.GAMEPAD;
    else if (!gamepad.connected && this.activeDevice === INPUT_DEVICES.GAMEPAD) this.activeDevice = INPUT_DEVICES.KEYBOARD_MOUSE;

    const keyboardX = Number(this.keyboard.has(bindings.moveRight) || this.keyboard.has("ArrowRight"))
      - Number(this.keyboard.has(bindings.moveLeft) || this.keyboard.has("ArrowLeft"));
    const keyboardY = Number(this.keyboard.has(bindings.moveDown) || this.keyboard.has("ArrowDown"))
      - Number(this.keyboard.has(bindings.moveUp) || this.keyboard.has("ArrowUp"));
    let moveX = keyboardX;
    let moveY = keyboardY;
    if (gamepad.connected && vectorLengthSq(gamepad.moveX, gamepad.moveY) > 0) {
      moveX = gamepad.moveX;
      moveY = gamepad.moveY;
    }

    let aimX = this.mouseAimX;
    let aimY = this.mouseAimY;
    if (gamepad.aimActive) {
      aimX = gamepad.aimX;
      aimY = gamepad.aimY;
    }

    this.gameplay.moveX = moveX;
    this.gameplay.moveY = moveY;
    this.gameplay.aimX = aimX;
    this.gameplay.aimY = aimY;
    this.gameplay.aimActive = Boolean(gamepad.aimActive || this.mouseAimActive);
    this.gameplay.firing = Boolean(
      this.keyboard.has(bindings.fire)
      || this.pointer.down
      || gamepad.firing
    );

    this.presentation.activeDevice = this.activeDevice;
    this.presentation.gamepadConnected = gamepad.connected;
    this.presentation.gamepadId = gamepad.id;
    return this.gameplay;
  }

  getPresentationState() {
    return this.presentation;
  }

  drainGamepadCommands() {
    return this.gamepadState && this.gamepadState.commands ? this.gamepadState.commands : [];
  }

  handleFeedback(events, settings, now = Date.now()) {
    if (!this.gamepadState || !this.gamepadState.connected) return;
    for (const event of events) {
      if (event.type === "playerHit" || event.type === "boss" || event.type === "finalWave") {
        this.gamepad.rumble("medium", settings.gamepadVibration !== false, now);
        return;
      }
      if (event.type === "shot") {
        this.gamepad.rumble("short", settings.gamepadVibration !== false, now);
        return;
      }
    }
  }

  reset(options = {}) {
    this.keyboard.clear();
    this.pointer.down = false;
    this.gameplay.moveX = 0;
    this.gameplay.moveY = 0;
    this.gameplay.firing = false;
    if (options.resetAim) {
      this.mouseAimX = 1;
      this.mouseAimY = 0;
      this.mouseAimActive = false;
      this.gameplay.aimX = 1;
      this.gameplay.aimY = 0;
      this.gameplay.aimActive = false;
    }
  }
}

module.exports = { InputManager };
