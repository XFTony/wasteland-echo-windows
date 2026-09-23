"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { GameApp } = require("../src/app");

function createApp() {
  const model = {
    screen: "running",
    menuPage: "main",
    save: { settings: {} },
    setInput() {},
    tick() {},
    drainEvents: () => [],
    togglePause() { this.screen = this.screen === "running" ? "paused" : "running"; },
    goToMenu() { this.screen = "menu"; },
    startRun() { this.screen = "running"; },
    setMenuPage(page) { this.menuPage = page; },
    setInventoryPage(page) { this.inventoryPage = Number(page); },
    cycleWeapon() {}, cycleSkin() {}, cycleMode() {}, cycleHero() {}, cycleStage() {}, cycleMap() {},
    selectWeapon(id) { this.selectedWeapon = id; },
    selectSkin(id) { this.selectedSkin = id; },
    selectHero(id) { this.selectedHero = id; },
    equip(id) { this.equippedItem = id; },
    unequip(slot) { this.unequippedSlot = slot; },
    chooseUpgrade() {}, updateSetting() {}
  };
  const renderer = {
    width: 960,
    height: 540,
    resize() {}, render() {}, hitTest: () => null
  };
  const audio = { setSettings() {}, handle() {}, update() {}, unlock() {}, suspend() {} };
  const platform = { now: () => 0, raf() {}, viewport: () => ({ width: 960, height: 540, dpr: 1 }) };
  return new GameApp({ model, renderer, audio, platform });
}

test("releasing the final WASD key resets movement to zero", () => {
  const app = createApp();
  app.keyDown("KeyW");
  app.updateKeyboard();
  assert.equal(app.input.moveY, -1);
  app.keyUp("KeyW");
  assert.equal(app.input.moveX, 0);
  assert.equal(app.input.moveY, 0);
});

test("opposite movement keys cancel and releasing one resumes the other direction", () => {
  const app = createApp();
  app.keyDown("KeyA");
  app.keyDown("KeyD");
  app.updateKeyboard();
  assert.equal(app.input.moveX, 0);
  app.keyUp("KeyD");
  assert.equal(app.input.moveX, -1);
  app.keyUp("KeyA");
  assert.equal(app.input.moveX, 0);
});

test("pause quit action returns to menu and clears stale input", () => {
  const app = createApp();
  app.keyDown("KeyW");
  app.model.screen = "paused";
  app.handleAction("quit");
  assert.equal(app.model.screen, "menu");
  assert.equal(app.input.moveY, 0);
  assert.equal(app.keyboard.size, 0);
});

test("held pause key does not toggle repeatedly from keyboard auto-repeat", () => {
  const app = createApp();
  app.keyDown("KeyP");
  assert.equal(app.model.screen, "paused");
  app.keyDown("KeyP");
  assert.equal(app.model.screen, "paused");
  app.keyUp("KeyP");
  app.keyDown("KeyP");
  assert.equal(app.model.screen, "running");
});

test("fixed timestep caps catch-up work after a slow frame", () => {
  const app = createApp();
  const steps = [];
  app.model.tick = (dt) => steps.push(dt);
  app.running = true;
  app.lastTime = 0;
  app.frame(100);

  assert.equal(steps.length, app.maxCatchUpSteps);
  assert.ok(steps.every((dt) => dt === app.fixedStep));
  assert.equal(app.accumulator, 0, "excess backlog should be discarded instead of causing a catch-up spiral");
});

test("mouse aim and firing remain independent from keyboard movement", () => {
  const app = createApp();
  app.keyDown("KeyW");
  app.mouseDown(820, 270);
  assert.equal(app.input.moveY, -1);
  assert.equal(app.input.aimActive, true);
  assert.equal(app.input.firing, true);
  app.mouseUp();
  assert.equal(app.input.firing, false);
  assert.equal(app.input.moveY, -1);
});

test("mouse movement updates aim without disturbing held keyboard input", () => {
  const app = createApp();
  app.keyDown("KeyW");
  app.mouseMove(900, 120);
  assert.equal(app.input.moveX, 0);
  assert.equal(app.input.moveY, -1);
  assert.equal(app.input.aimActive, true);
});

test("starting or restarting clears stale menu aim and fire state", () => {
  const app = createApp();
  app.mouseMove(900, 120);
  assert.equal(app.input.aimActive, true);
  app.keyDown("Space");
  assert.equal(app.input.firing, true);
  app.handleAction("start");
  assert.equal(app.input.aimActive, false);
  assert.equal(app.input.firing, false);
  assert.equal(app.keyboard.size, 0);
});

test("start opens deployment and deploy begins the run", () => {
  const app = createApp();
  app.model.screen = "menu";
  app.model.menuPage = "main";
  app.handleAction("start");
  assert.equal(app.model.screen, "menu");
  assert.equal(app.model.menuPage, "loadout");
  app.handleAction("deploy");
  assert.equal(app.model.screen, "running");
});

test("deployment opens inventory, direct selections route to the model, and back returns to deployment", () => {
  const app = createApp();
  app.model.screen = "menu";
  app.model.menuPage = "loadout";
  app.handleAction("inventory");
  assert.equal(app.model.menuPage, "inventory");
  app.handleAction("selectWeapon:ember_carbine");
  app.handleAction("selectSkin:mechanic");
  app.handleAction("selectHero:ranger");
  assert.equal(app.model.selectedWeapon, "ember_carbine");
  assert.equal(app.model.selectedSkin, "mechanic");
  assert.equal(app.model.selectedHero, "ranger");
  app.handleAction("equip:iron_plate");
  app.handleAction("unequip:chest");
  assert.equal(app.model.equippedItem, "iron_plate");
  assert.equal(app.model.unequippedSlot, "chest");
  app.handleAction("inventoryPage:2");
  assert.equal(app.model.inventoryPage, 2);
  app.handleAction("back");
  assert.equal(app.model.menuPage, "loadout");
});
