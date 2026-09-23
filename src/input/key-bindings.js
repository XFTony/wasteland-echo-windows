"use strict";

const BINDABLE_ACTIONS = Object.freeze([
  Object.freeze({ id: "moveUp", label: "向上移动" }),
  Object.freeze({ id: "moveDown", label: "向下移动" }),
  Object.freeze({ id: "moveLeft", label: "向左移动" }),
  Object.freeze({ id: "moveRight", label: "向右移动" }),
  Object.freeze({ id: "fire", label: "射击" }),
  Object.freeze({ id: "pause", label: "暂停" }),
  Object.freeze({ id: "fullscreen", label: "全屏" }),
  Object.freeze({ id: "restart", label: "重新开始" }),
  Object.freeze({ id: "quit", label: "退出本局" }),
  Object.freeze({ id: "upgrade1", label: "升级选项 1" }),
  Object.freeze({ id: "upgrade2", label: "升级选项 2" }),
  Object.freeze({ id: "upgrade3", label: "升级选项 3" }),
  Object.freeze({ id: "upgrade4", label: "升级选项 4" })
]);

const DEFAULT_KEY_BINDINGS = Object.freeze({
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  fire: "Space",
  pause: "KeyP",
  fullscreen: "KeyF",
  restart: "KeyR",
  quit: "KeyQ",
  upgrade1: "Digit1",
  upgrade2: "Digit2",
  upgrade3: "Digit3",
  upgrade4: "Digit4"
});

const RESERVED_MENU_CODES = new Set(["Enter", "NumpadEnter", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function isKeyboardCode(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{1,23}$/.test(value);
}

function normalizeKeyBindings(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const normalized = {};
  const used = new Set();
  for (const action of BINDABLE_ACTIONS) {
    const proposed = isKeyboardCode(source[action.id]) && !RESERVED_MENU_CODES.has(source[action.id]) ? source[action.id] : DEFAULT_KEY_BINDINGS[action.id];
    const code = used.has(proposed) ? DEFAULT_KEY_BINDINGS[action.id] : proposed;
    normalized[action.id] = used.has(code) ? `Unbound${action.id}` : code;
    used.add(normalized[action.id]);
  }
  return normalized;
}

function rebindKey(bindings, actionId, code) {
  if (!BINDABLE_ACTIONS.some((action) => action.id === actionId)) return { ok: false, status: "unknown", bindings };
  if (!isKeyboardCode(code) || RESERVED_MENU_CODES.has(code)) return { ok: false, status: "reserved", bindings };
  const next = normalizeKeyBindings(bindings);
  const previous = next[actionId];
  const conflictAction = BINDABLE_ACTIONS.find((action) => action.id !== actionId && next[action.id] === code);
  next[actionId] = code;
  if (conflictAction) next[conflictAction.id] = previous;
  return { ok: true, status: conflictAction ? "swapped" : "bound", conflictAction: conflictAction && conflictAction.id, bindings: next };
}

function keyLabel(code) {
  if (code === "Space") return "空格";
  if (code === "Escape") return "Esc";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `小键盘 ${code.slice(6)}`;
  return code.replace(/([a-z])([A-Z])/g, "$1 $2");
}

module.exports = { BINDABLE_ACTIONS, DEFAULT_KEY_BINDINGS, RESERVED_MENU_CODES, normalizeKeyBindings, rebindKey, keyLabel };
