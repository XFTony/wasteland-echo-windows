"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { bindBrowserEvents } = require("../src/platform/browser-bindings");

function eventTarget(extra = {}) {
  const listeners = {};
  const removed = [];
  return {
    ...extra,
    listeners,
    removed,
    addEventListener(type, handler) { listeners[type] = handler; },
    removeEventListener(type, handler) { removed.push([type, handler]); }
  };
}

test("window blur pauses through the same lifecycle path as page hiding", () => {
  const windowObject = eventTarget();
  const documentObject = eventTarget({ hidden: false });
  const canvas = eventTarget({ focus() {}, setPointerCapture() {} });
  const calls = { hide: 0, show: 0 };
  const app = {
    mouseDown() {},
    mouseMove() {},
    mouseUp() {},
    keyDown() {},
    keyUp() {},
    resize() {},
    resetInput() {},
    stop() {},
    onHide() { calls.hide += 1; },
    onShow() { calls.show += 1; }
  };
  const dispose = bindBrowserEvents({ windowObject, documentObject, canvas, app });
  windowObject.listeners.blur();
  assert.equal(calls.hide, 1);
  documentObject.hidden = true;
  documentObject.listeners.visibilitychange();
  assert.equal(calls.hide, 2);
  documentObject.hidden = false;
  documentObject.listeners.visibilitychange();
  assert.equal(calls.show, 1);
  dispose();
  assert.ok(windowObject.removed.length > 0);
  assert.ok(documentObject.removed.length > 0);
});
