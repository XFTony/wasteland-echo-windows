"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAction, dispatchAction } = require("../src/runtime/action-router");

function createApp() {
  const calls = [];
  const model = {
    screen: "menu",
    menuPage: "main",
    save: { settings: { music: 0.5, sfx: 0.5, uiScale: 1, autoAim: true } },
    setMenuPage(page) { calls.push(["page", page]); this.menuPage = page; },
    setSettingsSection(value) { calls.push(["settingsSection", value]); },
    startRun() { calls.push(["startRun"]); this.screen = "running"; },
    cycleWeapon(value) { calls.push(["cycleWeapon", value]); },
    cycleSkin(value) { calls.push(["cycleSkin", value]); },
    cycleHero(value) { calls.push(["cycleHero", value]); },
    cycleStage(value) { calls.push(["cycleStage", value]); },
    cycleMap(value) { calls.push(["cycleMap", value]); },
    cycleMode(value) { calls.push(["cycleMode", value]); },
    cycleShopCategory(value) { calls.push(["cycleShopCategory", value]); },
    togglePause() { calls.push(["togglePause"]); },
    skipTutorial() { calls.push(["skipTutorial"]); },
    goToMenu() { calls.push(["goToMenu"]); this.screen = "menu"; },
    chooseUpgrade(value) { calls.push(["upgrade", value]); },
    salvageUpgradeOptions() { calls.push(["upgradeSalvage"]); },
    buyShopItem(value) { calls.push(["buy", value]); },
    equip(value) { calls.push(["equip", value]); },
    unequip(value) { calls.push(["unequip", value]); },
    selectWeapon(value) { calls.push(["selectWeapon", value]); },
    selectSkin(value) { calls.push(["selectSkin", value]); },
    selectHero(value) { calls.push(["selectHero", value]); },
    setInventoryPage(value) { calls.push(["inventoryPage", value]); },
    beginKeyBinding(value) { calls.push(["bind", value]); },
    resetKeyBindings() { calls.push(["resetBindings"]); },
    updateSetting(key, value) { calls.push(["setting", key, value]); this.save.settings[key] = value; }
  };
  return {
    model,
    calls,
    resetInput(options) { calls.push(["resetInput", options]); },
    platform: { toggleFullscreen() { calls.push(["fullscreen"]); } },
    navigator: { invalidate() { calls.push(["invalidate"]); } },
    contextKey() { return this.model.screen + ":" + this.model.menuPage; }
  };
}

test("action strings are parsed once into explicit commands", () => {
  assert.deepEqual(parseAction("buy:buy_coil_cannon"), { type: "buy", value: "buy_coil_cannon" });
  assert.deepEqual(parseAction("adjust:music:-1"), { type: "adjust", key: "music", direction: -1 });
  assert.deepEqual(parseAction({ type: "equip", value: "field_vest" }), { type: "equip", value: "field_vest" });
  assert.equal(parseAction("unknown:too:many"), null);
  assert.equal(parseAction(null), null);
});

test("handler table routes payload actions without prefix condition chains", () => {
  const app = createApp();
  assert.equal(dispatchAction(app, "buy:buy_coil_cannon"), true);
  assert.equal(dispatchAction(app, { type: "selectWeapon", value: "coil_cannon" }), true);
  assert.equal(dispatchAction(app, "settingsSection:controls"), true);
  assert.equal(dispatchAction(app, "adjust:music:1"), true);
  assert.equal(dispatchAction(app, "upgradeSalvage"), true);
  assert.equal(dispatchAction(app, "missingAction"), false);
  assert.deepEqual(app.calls.filter((call) => ["buy", "selectWeapon", "settingsSection", "setting", "upgradeSalvage"].includes(call[0])), [
    ["buy", "buy_coil_cannon"],
    ["selectWeapon", "coil_cannon"],
    ["settingsSection", "controls"],
    ["setting", "music", 0.6],
    ["upgradeSalvage"]
  ]);
});
