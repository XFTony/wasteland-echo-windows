"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultSave } = require("../src/core/save");
const { MenuSession } = require("../src/core/menu-session");

test("menu session owns transient settings and inventory state", () => {
  const save = createDefaultSave();
  let persists = 0;
  const session = new MenuSession(save, { persist() { persists += 1; } });
  session.setSettingsSection("controls");
  session.setInventoryPage(3.8);
  assert.equal(session.settingsSection, "controls");
  assert.equal(session.inventoryPage, 3);
  assert.equal(session.beginKeyBinding("moveUp"), true);
  assert.equal(session.applyKeyBinding("KeyI").ok, true);
  assert.equal(save.keyBindings.moveUp, "KeyI");
  assert.equal(persists, 1);
  session.leaveSettings();
  assert.equal(session.pendingBindingAction, null);
});
