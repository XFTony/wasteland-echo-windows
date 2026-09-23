"use strict";

const PREVENT_DEFAULT_KEYS = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab", "F11"
]);

function bindBrowserEvents({ windowObject, documentObject, canvas, app }) {
  const win = windowObject;
  const doc = documentObject;
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push([target, type, handler, options]);
  };

  listen(canvas, "pointerdown", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (event.button !== undefined && event.button !== 0) return;
    if (typeof canvas.focus === "function") canvas.focus({ preventScroll: true });
    if (typeof canvas.setPointerCapture === "function") canvas.setPointerCapture(event.pointerId);
    app.mouseDown(event.clientX, event.clientY);
    event.preventDefault();
  });
  listen(canvas, "pointermove", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    app.mouseMove(event.clientX, event.clientY);
  });
  listen(canvas, "pointerup", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    app.mouseUp();
    event.preventDefault();
  });
  listen(canvas, "pointercancel", (event) => {
    if (!event.pointerType || event.pointerType === "mouse") app.mouseUp();
  });
  listen(canvas, "contextmenu", (event) => event.preventDefault());

  listen(win, "keydown", (event) => {
    app.keyDown(event.code, event);
    if (PREVENT_DEFAULT_KEYS.has(event.code)) event.preventDefault();
  });
  listen(win, "keyup", (event) => app.keyUp(event.code));
  listen(win, "resize", () => app.resize());
  listen(win, "blur", () => app.onHide());
  listen(win, "gamepadconnected", () => {
    if (typeof canvas.focus === "function") canvas.focus({ preventScroll: true });
  });
  listen(doc, "fullscreenchange", () => app.resize());
  listen(doc, "visibilitychange", () => {
    if (doc.hidden) app.onHide();
    else app.onShow();
  });
  listen(win, "beforeunload", () => app.stop());

  return () => {
    for (const [target, type, handler, options] of listeners) {
      if (typeof target.removeEventListener === "function") target.removeEventListener(type, handler, options);
    }
  };
}

module.exports = { PREVENT_DEFAULT_KEYS, bindBrowserEvents };
