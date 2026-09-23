"use strict";

const DEFAULT_ACTIONS = Object.freeze(["start", "deploy", "inventory", "shop", "resume", "restart", "back", "menu"]);

function center(region) {
  return { x: region.x + region.w / 2, y: region.y + region.h / 2 };
}

class UiNavigator {
  constructor() {
    this.focusedAction = null;
    this.contextKey = "";
  }

  invalidate() {
    this.contextKey = "";
    this.focusedAction = null;
  }

  sync(regions, contextKey = "") {
    const list = Array.isArray(regions) ? regions : [];
    const contextChanged = contextKey !== this.contextKey;
    this.contextKey = contextKey;
    if (!contextChanged && this.focusedAction && list.some((region) => region.action === this.focusedAction)) {
      return this.focusedAction;
    }
    const contextDefault = contextKey === "menu:settings" ? "toggle:music"
      : contextKey === "menu:loadout" ? "deploy"
        : contextKey === "menu:inventory" ? (list.find((region) => region.action.startsWith("selectWeapon:") || region.action.startsWith("selectSkin:") || region.action.startsWith("equip:")) || {}).action
        : contextKey === "menu:shop" ? (list.find((region) => region.action.startsWith("buy:") || region.action.startsWith("equip:")) || {}).action
        : contextKey === "menu:credits" ? "back"
        : null;
    const preferred = (contextDefault && list.some((region) => region.action === contextDefault) ? contextDefault : null)
      || DEFAULT_ACTIONS.find((action) => list.some((region) => region.action === action));
    this.focusedAction = preferred || (list[0] && list[0].action) || null;
    return this.focusedAction;
  }

  set(action, regions) {
    if (Array.isArray(regions) && regions.some((region) => region.action === action)) {
      this.focusedAction = action;
    }
    return this.focusedAction;
  }

  step(regions, direction = 1) {
    const list = Array.isArray(regions) ? regions : [];
    if (!list.length) return null;
    const index = Math.max(0, list.findIndex((region) => region.action === this.focusedAction));
    const next = (index + direction + list.length) % list.length;
    this.focusedAction = list[next].action;
    return this.focusedAction;
  }

  move(regions, dx, dy) {
    const list = Array.isArray(regions) ? regions : [];
    if (!list.length) return null;
    const current = list.find((region) => region.action === this.focusedAction) || list[0];
    const origin = center(current);
    let winner = null;
    let winnerScore = Infinity;
    for (const candidate of list) {
      if (candidate === current) continue;
      const point = center(candidate);
      const offsetX = point.x - origin.x;
      const offsetY = point.y - origin.y;
      const forward = offsetX * dx + offsetY * dy;
      if (forward <= 1) continue;
      const cross = Math.abs(offsetX * dy - offsetY * dx);
      const score = forward + cross * 2.4;
      if (score < winnerScore) {
        winner = candidate;
        winnerScore = score;
      }
    }
    if (winner) this.focusedAction = winner.action;
    return this.focusedAction;
  }

  activate(regions) {
    const list = Array.isArray(regions) ? regions : [];
    const region = list.find((item) => item.action === this.focusedAction);
    return region ? region.action : null;
  }
}

module.exports = { UiNavigator };
