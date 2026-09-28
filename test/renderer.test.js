"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SaveManager } = require("../src/core/save");
const { GameModel } = require("../src/core/game-model");
const { CanvasRenderer } = require("../src/render/canvas-renderer");
const { ArtStore } = require("../src/render/art/art-store");
const { ART_IDS } = require("../src/render/art/asset-catalog");
const { FX_METHODS } = require("../src/render/fx-system");
const { HUD_METHODS } = require("../src/render/hud-view");
const { GAME_VERSION } = require("../src/version");

function createMockCanvas() {
  const calls = [];
  const gradient = { addColorStop: (...args) => calls.push(["addColorStop", ...args]) };
  const context = {
    setTransform: (...args) => calls.push(["setTransform", ...args]),
    clearRect: (...args) => calls.push(["clearRect", ...args]),
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    strokeRect: (...args) => calls.push(["strokeRect", ...args]),
    beginPath: () => calls.push(["beginPath"]),
    rect: (...args) => calls.push(["rect", ...args]),
    clip: () => calls.push(["clip"]),
    closePath: () => calls.push(["closePath"]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    quadraticCurveTo: (...args) => calls.push(["quadraticCurveTo", ...args]),
    arc: (...args) => calls.push(["arc", ...args]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"]),
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    translate: (...args) => calls.push(["translate", ...args]),
    rotate: (...args) => calls.push(["rotate", ...args]),
    scale: (...args) => calls.push(["scale", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    fillText: (...args) => calls.push(["fillText", ...args]),
    createLinearGradient: () => gradient,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "middle",
    globalAlpha: 1,
    imageSmoothingEnabled: false
  };
  return {
    canvas: {
      width: 0,
      height: 0,
      style: {},
      getContext: () => context
    },
    calls
  };
}

function createModel() {
  const manager = new SaveManager({ get: () => null, set: () => {} });
  return new GameModel(manager, { duration: 60, seed: 42 });
}

test("renderer delegates combat effects and HUD overlays to stable modules", () => {
  assert.equal(CanvasRenderer.prototype.handleEvents, FX_METHODS.handleEvents);
  assert.equal(CanvasRenderer.prototype.updateEffects, FX_METHODS.updateEffects);
  assert.equal(CanvasRenderer.prototype.drawHud, HUD_METHODS.drawHud);
  assert.equal(CanvasRenderer.prototype.drawPause, HUD_METHODS.drawPause);
  assert.equal(CanvasRenderer.prototype.drawResult, HUD_METHODS.drawResult);
});

test("main menu keeps the complete title art inside the viewport beside the menu", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.coverArt = { complete: true, naturalWidth: 1228, naturalHeight: 1228 };
  renderer.resize(1280, 720, 1);
  renderer.render(model, { focusAction: "start" });
  const artCall = calls.find((call) => call[0] === "drawImage");
  assert.ok(artCall, "the loaded title art should be drawn on the menu canvas");
  const [, , artX, artY, artW, artH] = artCall;
  const start = renderer.regions.find((region) => region.action === "start");
  assert.ok(artW >= 1280 * 0.45, "the complete art should still remain a primary visual");
  assert.ok(artH >= 720 * 0.9);
  assert.ok(artX >= 0 && artY >= 0, "contain framing must not crop the top or left edges");
  assert.ok(artX + artW <= 1280 && artY + artH <= 720, "contain framing must not crop the monster head or lower silhouettes");
  assert.ok(start.x + start.w < artX, "menu copy and complete art should keep a readable safety gap");
});

test("all primary screens render without exceptions and expose expected actions", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(960, 540, 1);

  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "start"), true);
  assert.equal(renderer.regions.some((region) => region.action === "settings"), true);
  assert.equal(renderer.regions.some((region) => region.action === "shop"), true);
  assert.equal(renderer.regions.some((region) => region.action === "modePrev"), false);

  model.setMenuPage("loadout");
  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "deploy"), true);
  assert.equal(renderer.regions.some((region) => region.action === "inventory"), true);
  assert.equal(renderer.regions.some((region) => region.action === "modePrev"), true);
  assert.equal(renderer.regions.some((region) => region.action === "modeNext"), true);
  assert.equal(renderer.regions.some((region) => region.action === "heroNext"), false);
  assert.equal(renderer.regions.some((region) => region.action === "weaponNext"), false);
  assert.equal(renderer.regions.some((region) => region.action === "skinNext"), false);
  assert.equal(renderer.regions.some((region) => region.action === "stageNext"), true);
  assert.equal(renderer.regions.some((region) => region.action === "mapNext"), true);

  model.setMenuPage("inventory");
  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "deployment"), true);
  assert.equal(renderer.regions.some((region) => region.action === "heroNext"), true);
  assert.equal(renderer.regions.some((region) => region.action === "selectWeapon:scrap_pistol"), true);
  assert.equal(renderer.regions.some((region) => region.action === "selectSkin:wanderer"), true);
  assert.equal(renderer.regions.some((region) => region.action === "equip:field_vest"), true);
  assert.equal(renderer.regions.some((region) => region.action === "unequip:chest"), true);

  model.setMenuPage("shop");
  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "shopCategoryNext"), true);
  assert.equal(renderer.regions.some((region) => region.action.startsWith("buy:")), true);
  assert.equal(renderer.regions.filter((region) => region.action.startsWith("buy:")).length, 6);

  model.setMenuPage("settings");
  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "toggle:autoAim"), true);
  assert.equal(renderer.regions.some((region) => region.action === "adjust:music:-1"), true);
  assert.equal(renderer.regions.some((region) => region.action === "toggle:musicMuted"), true);
  model.setSettingsSection("controls");
  renderer.render(model);
  assert.equal(renderer.regions.filter((region) => region.action.startsWith("bind:")).length, 13);
  assert.equal(renderer.regions.some((region) => region.action === "resetBindings"), true);

  model.startRun({ duration: 60, seed: 42 });
  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "pause"), true);
  assert.equal(renderer.regions.some((region) => region.action === "skipTutorial"), true);

  model.run.player.xp = model.run.player.xpNext;
  model.checkLevelUp();
  renderer.render(model);
  assert.equal(renderer.regions.filter((region) => region.action.startsWith("upgrade:")).length, 4);
  assert.equal(renderer.regions.some((region) => region.action === "upgradeSalvage"), true);

  model.chooseUpgrade(model.run.upgradeOptions[0].id);
  model.togglePause();
  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "resume"), true);
  assert.equal(renderer.regions.some((region) => region.action === "quit"), true);
  const quitRegion = renderer.regions.find((region) => region.action === "quit");
  assert.ok(quitRegion.w >= 200 && quitRegion.h >= 40, "pause quit control should be easy to tap");
  assert.equal(renderer.hitTest(quitRegion.x + quitRegion.w / 2, quitRegion.y + quitRegion.h / 2), "quit");

  model.togglePause();
  model.finishRun("lose");
  renderer.render(model);
  assert.equal(renderer.regions.some((region) => region.action === "restart"), true);
  assert.ok(calls.length > 500, "renderer should issue a substantial set of drawing commands");
});

test("settings page exposes the build version and desktop save location", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  model.setMenuPage("settings");
  renderer.render(model);
  const copy = calls.filter((call) => call[0] === "fillText").map((call) => String(call[1])).join(" ");
  assert.match(copy, new RegExp(`v${GAME_VERSION.replaceAll(".", "\\.")}`));
  assert.match(copy, /LOCALAPPDATA/);
});

test("save recovery and write failures are visible on the game canvas", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  model.saveManager.status = "recovered";
  renderer.render(model);
  assert.ok(calls.some((call) => call[0] === "fillText" && String(call[1]).includes("已从备份恢复")));
  model.saveManager.status = "write-failed";
  model.startRun({ duration: 60, seed: 42 });
  renderer.render(model);
  assert.ok(calls.some((call) => call[0] === "fillText" && String(call[1]).includes("存档写入失败")));
});

test("inventory portrait follows the mouse and relaxes toward neutral for gamepad input", () => {
  const { canvas } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  model.setMenuPage("inventory");
  renderer.render(model, { activeDevice: "keyboardMouse", pointer: { x: 1180, y: 120, down: false } });
  assert.ok(renderer.portraitLook.x > 0);
  assert.ok(renderer.portraitLook.y < 0);
  const mouseMagnitude = Math.hypot(renderer.portraitLook.x, renderer.portraitLook.y);
  renderer.render(model, { activeDevice: "gamepad", gamepadConnected: true });
  assert.ok(Math.hypot(renderer.portraitLook.x, renderer.portraitLook.y) < mouseMagnitude);
});

test("weapon feedback uses bounded shell and muzzle slots and decays recoil", () => {
  const { canvas } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(960, 540, 1);
  model.startRun({ seed: 8, weaponId: "breaker_shotgun" });
  const player = model.run.player;
  const shots = Array.from({ length: 40 }, () => ({
    type: "shot",
    weaponId: "breaker_shotgun",
    x: player.x,
    y: player.y,
    aimX: 1,
    aimY: 0
  }));

  renderer.handleEvents(shots, model);
  assert.equal(renderer.shells.length, 32);
  assert.equal(renderer.shells.filter((shell) => shell.active).length, 32);
  assert.equal(renderer.muzzleFlashes.length, 12);
  assert.equal(renderer.muzzleFlashes.filter((flash) => flash.active).length, 12);
  assert.ok(renderer.weaponKick > 0);
  assert.ok(renderer.cameraKick > 0);

  renderer.updateEffects(1);
  assert.equal(renderer.shells.some((shell) => shell.active), false);
  assert.equal(renderer.muzzleFlashes.some((flash) => flash.active), false);
  assert.ok(renderer.weaponKick < 0.01);
});

test("default ranger uses compact leg frames under a separate painted upper body", () => {
  const { canvas, calls } = createMockCanvas();
  const upper = { complete: true, naturalWidth: 160, naturalHeight: 160 };
  const legs = { complete: true, naturalWidth: 640, naturalHeight: 480 };
  const gun = { complete: true, naturalWidth: 128, naturalHeight: 48 };
  const store = new ArtStore({ images: {
    [ART_IDS.ACTOR_RANGER_WANDERER_UPPER]: upper,
    [ART_IDS.ACTOR_RANGER_WANDERER_WALK]: legs,
    [ART_IDS.WEAPON_SCRAP_PISTOL]: gun
  } });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  const model = createModel();
  model.startRun({ seed: 42, heroId: "ranger", skinId: "wanderer", weaponId: "scrap_pistol", tutorial: false });
  renderer.resize(1280, 720, 1);
  renderer.drawPlayer(model.run.player, model.run);
  model.run.player.x += 30;
  model.run.elapsed += 0.17;
  calls.length = 0;
  renderer.drawPlayer(model.run.player, model.run);
  const legDraw = calls.find((call) => call[0] === "drawImage" && call[1] === legs);
  assert.deepEqual(legDraw.slice(2, 6), [480, 0, 160, 160]);
  assert.ok(calls.some((call) => call[0] === "drawImage" && call[1] === upper));
  assert.ok(calls.some((call) => call[0] === "drawImage" && call[1] === gun));
});

test("default ranger keeps the static body available while motion art loads", () => {
  const { canvas, calls } = createMockCanvas();
  const body = { complete: true, naturalWidth: 353, naturalHeight: 512 };
  const gun = { complete: true, naturalWidth: 128, naturalHeight: 48 };
  const store = new ArtStore({ images: {
    [ART_IDS.ACTOR_RANGER]: body,
    [ART_IDS.WEAPON_SCRAP_PISTOL]: gun
  } });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  const model = createModel();
  model.startRun({ seed: 43, heroId: "ranger", skinId: "wanderer", weaponId: "scrap_pistol", tutorial: false });
  renderer.resize(1280, 720, 1);
  renderer.drawPlayer(model.run.player, model.run);
  assert.ok(calls.some((call) => call[0] === "drawImage" && call[1] === body));
});

test("ground texture draws only the camera-visible source region", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  renderer.resize(1280, 720, 1);
  renderer.groundTexture = { complete: true, naturalWidth: 2048, naturalHeight: 2048 };
  renderer.camera.x = 896;
  renderer.camera.y = 640;

  renderer.drawGroundTexture(4096);
  const draw = calls.find((call) => call[0] === "drawImage");
  assert.ok(draw);
  assert.equal(draw.length, 10, "cropped Canvas drawImage uses source and destination rectangles");
  const [, , sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight] = draw;
  assert.equal(sourceX, 448);
  assert.equal(sourceY, 320);
  assert.equal(sourceWidth, 640);
  assert.equal(sourceHeight, 360);
  assert.deepEqual([destX, destY, destWidth, destHeight], [0, 0, 1280, 720]);
});

test("critical hits receive a larger high-contrast damage label", () => {
  const { canvas } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  model.startRun({ seed: 21 });
  renderer.handleEvents([{ type: "hit", x: 10, y: 20, damage: 24, elite: false, critical: true }], model);
  const label = renderer.floatTexts.find((item) => item.active);
  assert.ok(label);
  assert.equal(label.critical, true);
  assert.equal(label.size, 16);
  assert.match(label.value, /24/);
});

test("automatic aim has no target line, LOCK badge, or enemy framing", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(960, 540, 1);
  model.startRun({ seed: 51 });
  const enemy = model.enemies[0];
  model.save.settings.autoAim = true;
  model.run.player.aimTargetId = enemy.id;

  const reticleStart = calls.length;
  renderer.drawAimReticle(model);
  assert.equal(calls.length, reticleStart, "automatic targeting should not draw a line or reticle");

  const enemyStart = calls.length;
  renderer.drawEnemy(enemy, model.run.elapsed);
  assert.equal(calls.slice(enemyStart).some((call) => call[0] === "strokeRect"), false, "target framing must not be drawn");
});

test("boss HUD exposes the active health phase without target framing", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  model.startRun({ seed: 511 });
  const boss = model.spawnEnemy("warden", model.run.player.x + 160, model.run.player.y);
  boss.bossPhase = 2;
  boss.hp = boss.maxHp * 0.3;
  renderer.render(model);
  assert.equal(calls.some((call) => call[0] === "fillText" && String(call[1]).includes("荒原看守")), true);
  assert.equal(calls.some((call) => call[0] === "fillText" && String(call[1]).includes("猎杀")), true);
});

test("shop, inventory and archive expose rule and mastery progression", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);

  model.setMenuPage("shop");
  renderer.render(model);
  let copy = calls.filter((call) => call[0] === "fillText").map((call) => String(call[1])).join(" ");
  assert.match(copy, /累计击败 120 名感染者/);
  assert.match(copy, /档案未达成/);

  calls.length = 0;
  model.save.weaponMastery.scrap_pistol = { kills: 200, runs: 4, experience: 300, level: 4 };
  model.setMenuPage("inventory");
  renderer.render(model);
  copy = calls.filter((call) => call[0] === "fillText").map((call) => String(call[1])).join(" ");
  assert.match(copy, /精通 Lv\.4/);
  assert.match(copy, /下一奖励 Lv\.6：终局许可/);

  calls.length = 0;
  model.save.totalKills = 60;
  model.save.weaponMastery = {};
  model.setMenuPage("credits");
  renderer.render(model);
  copy = calls.filter((call) => call[0] === "fillText").map((call) => String(call[1])).join(" ");
  assert.match(copy, /规则档案：0\/15/);
  assert.match(copy, /下一目标：破门许可/);
  assert.match(copy, /50%/);
});

test("result screen lists mastery and rule rewards earned in the run", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  model.save.totalKills = 119;
  model.save.weaponMastery.scrap_pistol = { kills: 49, runs: 1, experience: 49, level: 1 };
  model.startRun({ seed: 6021, tutorial: false });
  model.run.kills = 1;
  model.finishRun("win");
  renderer.render(model);
  const copy = calls.filter((call) => call[0] === "fillText").map((call) => String(call[1])).join(" ");
  assert.match(copy, /本局新增/);
  assert.match(copy, /战地分成/);
  assert.match(copy, /破门许可/);
});

test("mechanic upgrade cards and proc feedback use distinct visual branches", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(960, 540, 1);
  const signatures = new Set();
  for (const id of ["executionCapacitor", "reactivePlating", "salvageOverdrive", "pointBlankRelay", "focusProtocol", "cascadeRounds"]) {
    calls.length = 0;
    renderer.drawUpgradeIcon(id, 100, 100, 64, "#56d8c9");
    signatures.add(JSON.stringify(calls));
  }
  assert.equal(signatures.size, 6);
  renderer.handleEvents([{ type: "mechanicReady", label: "处决电容" }], model);
  assert.equal(renderer.banner.text, "处决电容");
  renderer.handleEvents([{ type: "mechanicProc", label: "电弧跳弹", x: 10, y: 20, hits: 3 }], model);
  assert.equal(renderer.upgradeFlashName, "电弧跳弹");
  assert.ok(renderer.upgradeFlash > 0);
});

test("result screen exposes the reproducible run seed", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  model.startRun({ seed: 20260921, tutorial: false });
  model.finishRun("lose");
  renderer.render(model);
  assert.equal(calls.some((call) => call[0] === "fillText" && String(call[1]).includes("SEED 20260921")), true);
  assert.equal(calls.some((call) => call[0] === "fillText" && String(call[1]).includes("复盘建议")), true);
});

test("568x320 desktop layout keeps compact controls navigable and on-screen", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(568, 320, 1);

  renderer.render(model);
  for (const action of ["start", "shop", "settings", "credits"]) {
    assert.equal(renderer.regions.some((region) => region.action === action), true, `${action} should be visible`);
  }

  model.setMenuPage("loadout");
  renderer.render(model);
  for (const action of ["deploy", "inventory", "modePrev", "modeNext", "stagePrev", "stageNext", "mapPrev", "mapNext", "back"]) {
    assert.equal(renderer.regions.some((region) => region.action === action), true, `${action} should be visible`);
  }

  model.setMenuPage("inventory");
  renderer.render(model);
  for (const action of ["deployment", "heroPrev", "heroNext", "selectWeapon:scrap_pistol", "selectSkin:wanderer", "equip:field_vest"]) {
    assert.equal(renderer.regions.some((region) => region.action === action), true, `${action} should be visible`);
  }
  assert.ok(renderer.regions.every((region) => region.x >= 0 && region.y >= 0 && region.x + region.w <= 568 && region.y + region.h <= 320));

  model.setMenuPage("settings");
  renderer.render(model);
  const toggles = renderer.regions.filter((region) => region.action.startsWith("toggle:"));
  assert.equal(toggles.length, 11);
  assert.ok(toggles.every((region) => region.h >= 31));
  assert.ok(toggles.every((region) => region.x >= 0 && region.y >= 0 && region.x + region.w <= 568 && region.y + region.h <= 320));
  assert.equal(renderer.regions.some((region) => region.action === "fullscreen"), true);
  model.setSettingsSection("controls");
  renderer.render(model);
  assert.equal(renderer.regions.filter((region) => region.action.startsWith("bind:")).length, 13);
  assert.ok(renderer.regions.every((region) => region.x >= 0 && region.y >= 0 && region.x + region.w <= 568 && region.y + region.h <= 320));

  model.setMenuPage("main");
  model.startRun({ seed: 31 });
  renderer.render(model, { activeDevice: "keyboardMouse" });
  assert.equal(renderer.regions.some((region) => region.action === "pause"), true);

  model.run.player.xp = model.run.player.xpNext;
  model.checkLevelUp();
  renderer.render(model);
  const upgrades = renderer.regions.filter((region) => region.action.startsWith("upgrade:"));
  assert.equal(upgrades.length, 4);
  assert.ok(upgrades.every((region) => region.w >= 120 && region.y + region.h <= 320));
});

test("adaptive quality uses hysteresis and recovers after frame time stabilizes", () => {
  const { canvas } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  renderer.resize(960, 540, 2);

  for (let frame = 0; frame < 120; frame += 1) renderer.updatePerformance(1 / 30);
  assert.equal(renderer.qualityLevel, 0);
  assert.equal(renderer.dpr, 2, "quality changes should not resize the canvas or churn DPR");

  for (let frame = 0; frame < 700; frame += 1) renderer.updatePerformance(1 / 60);
  assert.equal(renderer.qualityLevel, 2);
  assert.equal(renderer.dpr, 2);
});

test("Windows 720p and 1080p layouts keep every desktop action inside the viewport", () => {
  for (const [width, height] of [[1280, 720], [1920, 1080]]) {
    const { canvas } = createMockCanvas();
    const renderer = new CanvasRenderer(canvas);
    const model = createModel();
    renderer.resize(width, height, 1);
    renderer.render(model, { activeDevice: "keyboardMouse", focusAction: "start" });
    assert.ok(renderer.regions.length >= 3);
    for (const region of renderer.regions) {
      assert.ok(region.x >= 0 && region.y >= 0, `${region.action} starts inside ${width}x${height}`);
      assert.ok(region.x + region.w <= width && region.y + region.h <= height, `${region.action} ends inside ${width}x${height}`);
    }

    model.setMenuPage("loadout");
    renderer.render(model, { activeDevice: "gamepad", gamepadConnected: true, gamepadId: "Xbox Controller" });
    assert.ok(renderer.regions.length >= 8);
    assert.equal(renderer.regions.some((region) => region.action === "inventory"), true);
    for (const region of renderer.regions) {
      assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.w <= width && region.y + region.h <= height);
    }

    model.setMenuPage("inventory");
    renderer.render(model, { activeDevice: "gamepad", gamepadConnected: true, gamepadId: "Xbox Controller" });
    assert.equal(renderer.regions.some((region) => region.action === "deployment"), true);
    assert.equal(renderer.regions.some((region) => region.action.startsWith("selectWeapon:")), true);
    assert.equal(renderer.regions.some((region) => region.action.startsWith("selectSkin:")), true);
    assert.equal(renderer.regions.some((region) => region.action.startsWith("equip:")), true);
    for (const region of renderer.regions) {
      assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.w <= width && region.y + region.h <= height);
    }

    model.setMenuPage("settings");
    renderer.render(model, { activeDevice: "gamepad", gamepadConnected: true, gamepadId: "Xbox Controller" });
    const actions = renderer.regions;
    assert.equal(actions.filter((region) => region.action.startsWith("toggle:")).length, 11);
    assert.equal(actions.some((region) => region.action === "fullscreen"), true);
    assert.equal(actions.some((region) => region.action === "back"), true);
    for (const region of actions) {
      assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.w <= width && region.y + region.h <= height);
    }

    model.setSettingsSection("controls");
    renderer.render(model, { activeDevice: "gamepad", gamepadConnected: true, gamepadId: "Xbox Controller" });
    assert.equal(renderer.regions.filter((region) => region.action.startsWith("bind:")).length, 13);
    assert.equal(renderer.regions.some((region) => region.action === "resetBindings"), true);
    for (const region of renderer.regions) assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.w <= width && region.y + region.h <= height);

    model.setMenuPage("shop");
    for (const category of ["weapon", "outfit", "equipment"]) {
      model.shopCategory = category;
      renderer.render(model, { activeDevice: "gamepad", gamepadConnected: true, gamepadId: "Xbox Controller" });
      const shopActions = renderer.regions;
      assert.equal(shopActions.some((region) => region.action === "shopCategoryPrev"), true);
      assert.equal(shopActions.some((region) => region.action === "shopCategoryNext"), true);
      assert.equal(shopActions.some((region) => region.action === "back"), true);
      assert.equal(shopActions.some((region) => region.action.startsWith("buy:")), true);
      for (const region of shopActions) {
        assert.ok(region.w > 0 && region.h > 0, `${category}:${region.action} has a usable hit area`);
        assert.ok(
          region.x >= 0 && region.y >= 0 && region.x + region.w <= width && region.y + region.h <= height,
          `${category}:${region.action} stays inside ${width}x${height}`
        );
      }
    }
  }
});
test("menu art scales with desktop resolution while hit regions stay in physical coordinates", () => {
  const { canvas } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  renderer.render(model);
  const base = { ...renderer.regions.find((region) => region.action === "start") };
  renderer.resize(2560, 1440, 1);
  renderer.render(model);
  const scaled = renderer.regions.find((region) => region.action === "start");
  assert.ok(scaled);
  for (const key of ["x", "y", "w", "h"]) assert.ok(Math.abs(scaled[key] - base[key] * 2) < 2, `${key} should scale with the viewport`);
  assert.equal(renderer.hitTest(scaled.x + scaled.w / 2, scaled.y + scaled.h / 2), "start");
  assert.equal(renderer.width, 2560);
  assert.equal(renderer.height, 1440);
});

test("combat HUD scales with the viewport and preserves the pause hit target", () => {
  const { canvas } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  model.startRun({ seed: 20260924, tutorial: false });
  renderer.resize(1280, 720, 1);
  renderer.render(model);
  const base = { ...renderer.regions.find((region) => region.action === "pause") };
  renderer.resize(2560, 1440, 1);
  renderer.render(model);
  const scaled = renderer.regions.find((region) => region.action === "pause");
  assert.ok(scaled);
  for (const key of ["x", "y", "w", "h"]) assert.ok(Math.abs(scaled[key] - base[key] * 2) < 2, `${key} should scale with the viewport`);
  assert.equal(renderer.hitTest(scaled.x + scaled.w / 2, scaled.y + scaled.h / 2), "pause");
  assert.deepEqual([renderer.visibleWorldWidth, renderer.visibleWorldHeight], [1280, 720]);
});

test("painted apothecary roof stays inside its registered obstacle footprint", () => {
  const { canvas, calls } = createMockCanvas();
  const roof = { complete: true, naturalWidth: 512, naturalHeight: 341 };
  const store = new ArtStore({ images: { [ART_IDS.PROP_ECHO_APOTHECARY]: roof } });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  renderer.resize(1280, 720, 1);
  calls.length = 0;
  renderer.drawObstacles([{ x: 174, y: 250, w: 202, h: 130, kind: "shop", sign: "药房" }]);
  const painted = calls.find((call) => call[0] === "drawImage" && call[1] === roof);
  assert.ok(painted);
  assert.deepEqual(painted.slice(2), [174, 250, 202, 130]);
});

test("shared shop roof follows each shop's collision dimensions", () => {
  const { canvas, calls } = createMockCanvas();
  const roof = { complete: true, naturalWidth: 512, naturalHeight: 341 };
  const store = new ArtStore({ images: { [ART_IDS.PROP_ECHO_SHOP]: roof } });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  renderer.resize(1280, 720, 1);
  calls.length = 0;
  renderer.drawObstacles([{ x: 438, y: 184, w: 190, h: 145, kind: "shop", sign: "机件" }]);
  const painted = calls.find((call) => call[0] === "drawImage" && call[1] === roof);
  assert.ok(painted);
  assert.deepEqual(painted.slice(-2), [190, 145]);
});

test("painted warehouse roof uses obstacle dimensions across warehouse sizes", () => {
  const { canvas, calls } = createMockCanvas();
  const roof = { complete: true, naturalWidth: 512, naturalHeight: 352 };
  const store = new ArtStore({ images: { [ART_IDS.PROP_ECHO_WAREHOUSE]: roof } });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  renderer.resize(1280, 720, 1);
  calls.length = 0;
  renderer.drawObstacles([
    { x: 120, y: 160, w: 168, h: 116, kind: "warehouse", sign: "DEPOT" },
    { x: 420, y: 160, w: 310, h: 150, kind: "warehouse", sign: "RADIO" }
  ]);
  const painted = calls.filter((call) => call[0] === "drawImage" && call[1] === roof);
  assert.deepEqual(painted.map((call) => call.slice(2)), [
    [120, 160, 168, 116],
    [420, 160, 310, 150]
  ]);
});

test("painted container fills its Echo District collision size without replacing other maps", () => {
  const { canvas, calls } = createMockCanvas();
  const container = { complete: true, naturalWidth: 512, naturalHeight: 201 };
  const store = new ArtStore({ images: { [ART_IDS.PROP_ECHO_CONTAINER]: container } });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  renderer.resize(1280, 720, 1);
  const obstacle = { x: 150, y: 170, w: 126, h: 72, kind: "container" };
  calls.length = 0;
  renderer.drawObstacles([obstacle]);
  const painted = calls.find((call) => call[0] === "drawImage" && call[1] === container);
  assert.deepEqual(painted.slice(2), [150, 170, 126, 72]);
  renderer.mapLayout = renderer.resolveMapLayout("freight_nexus");
  calls.length = 0;
  renderer.drawObstacles([obstacle]);
  assert.equal(calls.some((call) => call[0] === "drawImage" && call[1] === container), false);
});

test("one painted railcar fits horizontal and rotated vertical collision rectangles", () => {
  const { canvas, calls } = createMockCanvas();
  const railcar = { complete: true, naturalWidth: 512, naturalHeight: 129 };
  const store = new ArtStore({ images: { [ART_IDS.PROP_ECHO_RAILCAR]: railcar } });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  renderer.resize(1280, 720, 1);
  calls.length = 0;
  renderer.drawObstacles([
    { x: 100, y: 140, w: 232, h: 76, kind: "railcar" },
    { x: 480, y: 140, w: 92, h: 190, kind: "railcar" }
  ]);
  const painted = calls.filter((call) => call[0] === "drawImage" && call[1] === railcar);
  assert.deepEqual(painted.map((call) => call.slice(2)), [
    [100, 140, 232, 76],
    [0, 0, 190, 92]
  ]);
  assert.ok(calls.some((call) => call[0] === "translate" && call[1] === 572 && call[2] === 140));
  assert.ok(calls.some((call) => call[0] === "rotate" && call[1] === Math.PI / 2));
});

test("switching maps and returning to menu releases unused decoded art", () => {
  class LoadedImage {
    constructor() {
      this.complete = true;
      this.naturalWidth = 1200;
      this.naturalHeight = 900;
      this.src = "";
    }
  }
  const { canvas } = createMockCanvas();
  const store = new ArtStore({ ImageCtor: LoadedImage });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  const model = createModel();
  renderer.resize(1280, 720, 1);
  renderer.render(model);
  assert.ok(store.get(ART_IDS.BACKDROP_MAIN));
  store.request(ART_IDS.PROP_ECHO_APOTHECARY);
  model.startRun({ seed: 31, mapId: "freight_nexus", tutorial: false });
  renderer.render(model);
  assert.equal(store.get(ART_IDS.BACKDROP_MAIN), null);
  assert.equal(store.get(ART_IDS.PROP_ECHO_APOTHECARY), null);
  assert.ok(store.get(ART_IDS.GROUND_FREIGHT));
  model.startRun({ seed: 32, mapId: "red_basin", tutorial: false });
  renderer.render(model);
  assert.equal(store.get(ART_IDS.GROUND_FREIGHT), null);
  assert.ok(store.get(ART_IDS.GROUND_RED_BASIN));
  assert.ok(store.get(ART_IDS.GROUND));
  model.goToMenu();
  renderer.render(model);
  assert.equal(store.get(ART_IDS.GROUND_RED_BASIN), null);
  assert.equal(store.get(ART_IDS.ACTOR_DRIFTER), null);
  assert.ok(store.get(ART_IDS.BACKDROP_MAIN));
});

test("world framing stays fixed across desktop resolutions", () => {
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas);
  const model = createModel();
  renderer.resize(1280, 720, 1);
  assert.equal(renderer.camera.zoom, 1);
  assert.deepEqual([renderer.visibleWorldWidth, renderer.visibleWorldHeight], [1280, 720]);
  renderer.resize(1920, 1080, 1);
  assert.equal(renderer.camera.zoom, 1.5);
  assert.deepEqual([renderer.visibleWorldWidth, renderer.visibleWorldHeight], [1280, 720]);
  renderer.resize(2560, 1440, 1);
  assert.equal(renderer.camera.zoom, 2);
  assert.deepEqual([renderer.visibleWorldWidth, renderer.visibleWorldHeight], [1280, 720]);
  model.startRun({ seed: 77 });
  renderer.render(model);
  assert.ok(calls.some((call) => call[0] === "setTransform" && call[1] === 2 && call[4] === 2));
});
