"use strict";

const BUTTON = Object.freeze({
  CONFIRM: 0,
  CANCEL: 1,
  ALT_FIRE: 2,
  LEFT_SHOULDER: 4,
  RIGHT_SHOULDER: 5,
  LEFT_TRIGGER: 6,
  RIGHT_TRIGGER: 7,
  BACK: 8,
  START: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15
});

function axisValue(axes, index) {
  const value = axes && Number(axes[index]);
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function buttonValue(buttons, index) {
  const button = buttons && buttons[index];
  if (typeof button === "number") return Math.max(0, Math.min(1, button));
  if (!button) return 0;
  const value = Number(button.value);
  if (Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  return button.pressed ? 1 : 0;
}

function applyRadialDeadzone(x, y, deadzone = 0.18, output = null) {
  const result = output || { x: 0, y: 0, magnitude: 0 };
  const length = Math.hypot(x, y);
  if (length <= deadzone) {
    result.x = 0;
    result.y = 0;
    result.magnitude = 0;
    return result;
  }
  const normalizedLength = Math.min(1, (length - deadzone) / Math.max(0.001, 1 - deadzone));
  const scale = normalizedLength / Math.max(length, 0.00001);
  result.x = x * scale;
  result.y = y * scale;
  result.magnitude = normalizedLength;
  return result;
}

class GamepadSource {
  constructor() {
    this.activeIndex = -1;
    this.id = "";
    this.connected = false;
    this.previousButtons = [];
    this.previousNavX = 0;
    this.previousNavY = 0;
    this.nextNavRepeatAt = 0;
    this.lastPad = null;
    this.lastRumbleAt = -Infinity;
    this.commands = [];
    this.moveVector = { x: 0, y: 0, magnitude: 0 };
    this.aimVector = { x: 0, y: 0, magnitude: 0 };
    this.snapshot = {
      connected: false,
      id: "",
      index: -1,
      moveX: 0,
      moveY: 0,
      aimX: 0,
      aimY: 0,
      aimActive: false,
      firing: false,
      activity: false,
      commands: this.commands
    };
  }

  selectPad(gamepads) {
    const pads = gamepads || [];
    if (this.activeIndex >= 0) {
      const current = pads[this.activeIndex];
      if (current && current.connected !== false) return current;
    }
    for (let index = 0; index < pads.length; index += 1) {
      const pad = pads[index];
      if (pad && pad.connected !== false) return pad;
    }
    return null;
  }

  edge(buttons, index, threshold = 0.55) {
    const pressed = buttonValue(buttons, index) >= threshold;
    const previous = Boolean(this.previousButtons[index]);
    this.previousButtons[index] = pressed;
    return pressed && !previous;
  }

  resetTransient() {
    this.previousButtons.length = 0;
    this.previousNavX = 0;
    this.previousNavY = 0;
    this.nextNavRepeatAt = 0;
  }

  disconnect() {
    this.activeIndex = -1;
    this.id = "";
    this.connected = false;
    this.lastPad = null;
    this.resetTransient();
  }

  poll(gamepads, options = {}) {
    const result = this.snapshot;
    this.commands.length = 0;
    const enabled = options.enabled !== false;
    const pad = enabled ? this.selectPad(gamepads) : null;
    if (!pad) {
      this.disconnect();
      Object.assign(result, {
        connected: false, id: "", index: -1,
        moveX: 0, moveY: 0, aimX: 0, aimY: 0,
        aimActive: false, firing: false, activity: false
      });
      return result;
    }

    const changedPad = this.activeIndex !== pad.index || this.id !== String(pad.id || "Gamepad");
    this.activeIndex = Number.isInteger(pad.index) ? pad.index : 0;
    this.id = String(pad.id || "Gamepad");
    this.connected = true;
    this.lastPad = pad;
    if (changedPad) this.resetTransient();

    const deadzone = Math.max(0.05, Math.min(0.5, Number(options.deadzone) || 0.18));
    const move = applyRadialDeadzone(axisValue(pad.axes, 0), axisValue(pad.axes, 1), deadzone, this.moveVector);
    const aim = applyRadialDeadzone(axisValue(pad.axes, 2), axisValue(pad.axes, 3), deadzone, this.aimVector);
    const buttons = pad.buttons || [];
    const firing = buttonValue(buttons, BUTTON.RIGHT_TRIGGER) > 0.28
      || buttonValue(buttons, BUTTON.RIGHT_SHOULDER) > 0.55
      || buttonValue(buttons, BUTTON.ALT_FIRE) > 0.55;

    const confirm = this.edge(buttons, BUTTON.CONFIRM);
    const cancel = this.edge(buttons, BUTTON.CANCEL);
    const pause = this.edge(buttons, BUTTON.START);
    const back = this.edge(buttons, BUTTON.BACK);
    const shoulderLeft = this.edge(buttons, BUTTON.LEFT_SHOULDER);
    const shoulderRight = this.edge(buttons, BUTTON.RIGHT_SHOULDER);
    this.edge(buttons, BUTTON.LEFT_TRIGGER, 0.28);
    this.edge(buttons, BUTTON.RIGHT_TRIGGER, 0.28);
    this.edge(buttons, BUTTON.DPAD_UP);
    this.edge(buttons, BUTTON.DPAD_DOWN);
    this.edge(buttons, BUTTON.DPAD_LEFT);
    this.edge(buttons, BUTTON.DPAD_RIGHT);
    const dpadUp = buttonValue(buttons, BUTTON.DPAD_UP) >= 0.55;
    const dpadDown = buttonValue(buttons, BUTTON.DPAD_DOWN) >= 0.55;
    const dpadLeft = buttonValue(buttons, BUTTON.DPAD_LEFT) >= 0.55;
    const dpadRight = buttonValue(buttons, BUTTON.DPAD_RIGHT) >= 0.55;

    if (confirm) this.commands.push({ type: "confirm" });
    if (cancel || back) this.commands.push({ type: "cancel" });
    if (pause) this.commands.push({ type: "pause" });
    if (options.uiMode && shoulderLeft) this.commands.push({ type: "shoulderLeft" });
    if (options.uiMode && shoulderRight) this.commands.push({ type: "shoulderRight" });

    if (options.uiMode) {
      const now = Number(options.now) || 0;
      const navX = dpadLeft ? -1 : dpadRight ? 1 : move.x < -0.62 ? -1 : move.x > 0.62 ? 1 : 0;
      const navY = dpadUp ? -1 : dpadDown ? 1 : move.y < -0.62 ? -1 : move.y > 0.62 ? 1 : 0;
      const changedDirection = navX !== this.previousNavX || navY !== this.previousNavY;
      const shouldRepeat = (navX !== 0 || navY !== 0) && now >= this.nextNavRepeatAt;
      if ((changedDirection || shouldRepeat) && (navX !== 0 || navY !== 0)) {
        this.commands.push({ type: "navigate", dx: navX, dy: navY });
        this.nextNavRepeatAt = now + (changedDirection ? 330 : 115);
      }
      this.previousNavX = navX;
      this.previousNavY = navY;
      if (navX === 0 && navY === 0) this.nextNavRepeatAt = 0;
    } else {
      this.previousNavX = 0;
      this.previousNavY = 0;
      this.nextNavRepeatAt = 0;
    }

    let anyButton = false;
    for (let index = 0; index < buttons.length && !anyButton; index += 1) {
      const button = buttons[index];
      anyButton = typeof button === "number"
        ? button > 0.18
        : Boolean(button && (button.pressed || Number(button.value) > 0.18));
    }
    Object.assign(result, {
      connected: true,
      id: this.id,
      index: this.activeIndex,
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      aimActive: aim.magnitude > 0,
      firing,
      activity: anyButton || move.magnitude > 0.08 || aim.magnitude > 0.08
    });
    return result;
  }

  rumble(kind = "short", enabled = true, now = Date.now()) {
    if (!enabled || !this.lastPad || now - this.lastRumbleAt < 35) return false;
    const actuator = this.lastPad.vibrationActuator
      || (Array.isArray(this.lastPad.hapticActuators) && this.lastPad.hapticActuators[0]);
    if (!actuator || typeof actuator.playEffect !== "function") return false;
    const strong = kind === "medium";
    this.lastRumbleAt = now;
    try {
      const result = actuator.playEffect("dual-rumble", {
        duration: strong ? 150 : 55,
        startDelay: 0,
        strongMagnitude: strong ? 0.72 : 0.22,
        weakMagnitude: strong ? 0.48 : 0.34
      });
      if (result && typeof result.catch === "function") result.catch(() => {});
      return true;
    } catch (_error) {
      return false;
    }
  }
}

module.exports = { BUTTON, axisValue, buttonValue, applyRadialDeadzone, GamepadSource };
