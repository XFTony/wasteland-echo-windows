"use strict";

const { SCREENS, UI_COMMANDS } = require("../core/contracts");

function executeUiCommand(app, command) {
  if (!command) return;
  const regions = app.renderer.regions || [];
  app.navigator.sync(regions, app.contextKey());
  if (command.type === UI_COMMANDS.NAVIGATE) {
    if (command.step) app.navigator.step(regions, command.step);
    else app.navigator.move(regions, command.dx || 0, command.dy || 0);
    return;
  }
  if (command.type === UI_COMMANDS.ACTIVATE) {
    const action = app.navigator.activate(regions);
    if (action) dispatchAction(app, action);
    return;
  }
  if (command.type === UI_COMMANDS.BACK) {
    if (app.model.screen === SCREENS.MENU && app.model.menuPage !== "main") dispatchAction(app, "back");
    else if (app.model.screen === SCREENS.RESULT_WIN || app.model.screen === SCREENS.RESULT_LOSE) dispatchAction(app, "menu");
    return;
  }
  if (command.type === UI_COMMANDS.PAUSE) return dispatchAction(app, app.model.screen === SCREENS.PAUSED ? "resume" : "pause");
  if (command.type === UI_COMMANDS.QUIT) return dispatchAction(app, "quit");
  if (command.type === UI_COMMANDS.RESTART) return dispatchAction(app, "restart");
  if (command.type === UI_COMMANDS.FULLSCREEN) return dispatchAction(app, "fullscreen");
  if (command.type === UI_COMMANDS.UPGRADE_INDEX && app.model.run) {
    const upgrade = app.model.run.upgradeOptions[command.index];
    if (upgrade) dispatchAction(app, `upgrade:${upgrade.id}`);
    return;
  }
  if (command.type === UI_COMMANDS.SHOULDER_LEFT) {
    app.navigator.step(regions, -1);
    return;
  }
  if (command.type === UI_COMMANDS.SHOULDER_RIGHT) {
    app.navigator.step(regions, 1);
  }
}

const VALUE_ACTIONS = new Set([
  "settingsSection", "upgrade", "buy", "equip", "unequip",
  "selectWeapon", "selectSkin", "selectHero", "inventoryPage", "bind", "toggle"
]);

function parseAction(action) {
  if (action && typeof action === "object" && typeof action.type === "string") return action;
  if (typeof action !== "string" || !action) return null;
  const parts = action.split(":");
  const type = parts[0];
  if (type === "adjust" && parts.length === 3) {
    return { type, key: parts[1], direction: Number(parts[2]) };
  }
  if (VALUE_ACTIONS.has(type) && parts.length >= 2) {
    return { type, value: parts.slice(1).join(":") };
  }
  return parts.length === 1 ? { type } : null;
}

const ACTION_HANDLERS = Object.freeze({
  start(app) {
    app.resetInput({ resetAim: true });
    app.model.setMenuPage("loadout");
  },
  deploy(app) {
    app.resetInput({ resetAim: true });
    app.model.startRun();
  },
  weaponPrev: (app) => app.model.cycleWeapon(-1),
  weaponNext: (app) => app.model.cycleWeapon(1),
  skinPrev: (app) => app.model.cycleSkin(-1),
  skinNext: (app) => app.model.cycleSkin(1),
  heroPrev: (app) => app.model.cycleHero(-1),
  heroNext: (app) => app.model.cycleHero(1),
  stagePrev: (app) => app.model.cycleStage(-1),
  stageNext: (app) => app.model.cycleStage(1),
  mapPrev: (app) => app.model.cycleMap(-1),
  mapNext: (app) => app.model.cycleMap(1),
  modePrev: (app) => app.model.cycleMode(-1),
  modeNext: (app) => app.model.cycleMode(1),
  settings: (app) => app.model.setMenuPage("settings"),
  shop: (app) => app.model.setMenuPage("shop"),
  credits: (app) => app.model.setMenuPage("credits"),
  inventory: (app) => app.model.setMenuPage("inventory"),
  deployment: (app) => app.model.setMenuPage("loadout"),
  settingsSection: (app, command) => app.model.setSettingsSection(command.value),
  shopCategoryPrev: (app) => app.model.cycleShopCategory(-1),
  shopCategoryNext: (app) => app.model.cycleShopCategory(1),
  back: (app) => app.model.setMenuPage(app.model.menuPage === "inventory" ? "loadout" : "main"),
  pause: (app) => app.model.togglePause(),
  resume: (app) => app.model.togglePause(),
  skipTutorial: (app) => app.model.skipTutorial(),
  restart(app) {
    app.resetInput({ resetAim: true });
    app.model.startRun();
  },
  menu(app) {
    app.resetInput({ resetAim: true });
    app.model.goToMenu();
  },
  quit(app) {
    app.resetInput({ resetAim: true });
    app.model.goToMenu();
  },
  fullscreen(app) {
    if (typeof app.platform.toggleFullscreen === "function") app.platform.toggleFullscreen();
  },
  upgrade: (app, command) => app.model.chooseUpgrade(command.value),
  upgradeSalvage: (app) => app.model.salvageUpgradeOptions(),
  buy: (app, command) => app.model.buyShopItem(command.value),
  equip: (app, command) => app.model.equip(command.value),
  unequip: (app, command) => app.model.unequip(command.value),
  selectWeapon: (app, command) => app.model.selectWeapon(command.value),
  selectSkin: (app, command) => app.model.selectSkin(command.value),
  selectHero: (app, command) => app.model.selectHero(command.value),
  inventoryPage: (app, command) => app.model.setInventoryPage(command.value),
  adjust: (app, command) => adjustSetting(app, command.key, command.direction),
  bind: (app, command) => app.model.beginKeyBinding(command.value),
  resetBindings: (app) => app.model.resetKeyBindings(),
  toggle: (app, command) => toggleSetting(app, command.value)
});

function dispatchAction(app, action) {
  const command = parseAction(action);
  if (!command) return false;
  const handler = ACTION_HANDLERS[command.type];
  if (!handler) return false;
  const previousContext = app.contextKey();
  handler(app, command);
  if (previousContext !== app.contextKey()) app.navigator.invalidate();
  return true;
}

function toggleSetting(app, key) {
  const settings = app.model.save.settings;
  if (key === "screenShake") {
    const next = settings.screenShake === "off" ? "low" : settings.screenShake === "low" ? "high" : "off";
    app.model.updateSetting("screenShake", next);
  } else if (key === "flashes") {
    const next = settings.flashes === "off" ? "low" : settings.flashes === "low" ? "high" : "off";
    app.model.updateSetting("flashes", next);
  } else if (key === "gamepadDeadzone") {
    const value = Number(settings.gamepadDeadzone) || 0.18;
    const next = value < 0.15 ? 0.18 : value < 0.23 ? 0.28 : 0.12;
    app.model.updateSetting("gamepadDeadzone", next);
  } else if (key in settings && typeof settings[key] === "boolean") {
    app.model.updateSetting(key, !settings[key]);
  }
}

function adjustSetting(app, key, direction) {
  const settings = app.model.save.settings;
  const step = key === "uiScale" ? 0.1 : 0.1;
  if (!["music", "sfx", "uiScale"].includes(key) || !Number.isFinite(direction) || direction === 0) return;
  const minimum = key === "uiScale" ? 0.8 : 0;
  const maximum = key === "uiScale" ? 1.2 : 1;
  const current = Number(settings[key]);
  const next = Math.max(minimum, Math.min(maximum, Math.round((current + Math.sign(direction) * step) * 10) / 10));
  app.model.updateSetting(key, next);
  if (key === "music" && next > 0 && settings.musicMuted) app.model.updateSetting("musicMuted", false);
  if (key === "sfx" && next > 0 && settings.sfxMuted) app.model.updateSetting("sfxMuted", false);
}

module.exports = { ACTION_HANDLERS, parseAction, executeUiCommand, dispatchAction, toggleSetting, adjustSetting };
