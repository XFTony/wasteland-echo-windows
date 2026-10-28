"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sampleTravel } = require("../src/render/compact-actors");
const { compactShotPose, usesCompactPlayer } = require("../src/core/compact-weapon-pose");
const { SaveManager } = require("../src/core/save");
const { GameModel } = require("../src/core/game-model");
const { WEAPONS, ENEMIES } = require("../src/config");
const { ENEMY_SPRITES } = require("../src/content/compact-actors");
const { ART_ASSETS } = require("../src/render/art/asset-catalog");
const { InputManager } = require("../src/input/input-manager");

function modelFor(weaponId) {
  const model = new GameModel(new SaveManager({ get: () => null, set: () => {} }), { seed: 17 });
  model.startRun({ seed: 17, weaponId, tutorial: false });
  model.releaseAllEntities();
  model.obstacles.length = 0;
  model.interactives.length = 0;
  model.rebuildObstacleGrid();
  return model;
}

test("live enemy roster has a compact animated texture for every current enemy ID", () => {
  assert.deepEqual(Object.keys(ENEMY_SPRITES).sort(), Object.keys(ENEMIES).sort());
  for (const enemy of Object.values(ENEMY_SPRITES)) {
    assert.equal(ART_ASSETS[enemy.assetId].active, true);
    assert.equal(ART_ASSETS[enemy.assetId].eager, false);
    assert.equal(new Set(enemy.walkFrames).size, 8);
    assert.equal(enemy.root.length, 2);
  }
});

test("live walk sampling follows resolved travel and freezes through pause or collision", () => {
  const state = {}, actor = { id: 1, x: 20, y: 30 };
  sampleTravel(state, actor, 0, 50);
  actor.x += 10;
  sampleTravel(state, actor, 1, 50);
  assert.equal(state.phase, 0.2);
  assert.equal(state.walking, true);
  sampleTravel(state, actor, 1, 50);
  assert.equal(state.phase, 0.2);
  assert.equal(state.walking, true, "pause preserves the last pose");
  sampleTravel(state, actor, 2, 50);
  assert.equal(state.walking, false, "a blocked or stationary body does not keep running");
  actor.id = 2;
  actor.x = 400;
  sampleTravel(state, actor, 3, 50);
  assert.equal(state.phase, 0, "reused pooled enemies do not inherit a prior walk sample");
});

test("all seven live weapons use the same transformed muzzle for art, shot events and projectiles", () => {
  for (const weapon of Object.values(WEAPONS)) for (let direction = 0; direction < 8; direction++) {
    const model = modelFor(weapon.id), player = model.run.player;
    const angle = direction * Math.PI / 4;
    model.spawnEnemy("drifter", player.x + Math.cos(angle) * 180, player.y + Math.sin(angle) * 180);
    model.updatePlayer(0);
    const pose = compactShotPose(player, player.lastAimX, player.lastAimY);
    const event = model.drainEvents().find(event => event.type === "shot");
    assert.ok(event, weapon.id);
    assert.equal(model.projectiles.length, weapon.projectileCount);
    assert.ok(Math.abs(event.muzzleX - pose.muzzleX) < 1e-8);
    assert.ok(Math.abs(event.muzzleY - pose.muzzleY) < 1e-8);
    for (const shot of model.projectiles) {
      assert.equal(shot.x, event.muzzleX);
      assert.equal(shot.y, event.muzzleY);
    }
  }
});

test("new live muzzle positions do not create a point-blank dead zone", () => {
  for (const weapon of Object.values(WEAPONS)) {
    const model = modelFor(weapon.id), player = model.run.player;
    const target = model.spawnEnemy("brute", player.x + 24, player.y + 4);
    const hp = target.hp;
    model.updatePlayer(0);
    model.rebuildEnemyGrid();
    model.updateProjectiles(1 / 60);
    assert.ok(target.hp < hp, weapon.id + " must hit a target inside the visible barrel reach");
  }
});

test("the new ranger rig does not silently replace other hero or outfit identities", () => {
  assert.equal(usesCompactPlayer({ heroId: "ranger", skinId: "wanderer", weaponId: "scrap_pistol" }), true);
  assert.equal(usesCompactPlayer({ heroId: "mechanic", skinId: "wanderer", weaponId: "scrap_pistol" }), false);
  assert.equal(usesCompactPlayer({ heroId: "ranger", skinId: "nightwatch", weaponId: "scrap_pistol" }), false);
});

test("manual mouse rays pass through the cursor from the offset muzzle at every desktop scale", () => {
  for (const zoom of [1, 1.5, 2]) for (let direction = 0; direction < 8; direction++) {
    const model = modelFor("needle_rifle"), player = model.run.player, input = new InputManager();
    model.save.settings.autoAim = false;
    model.save.settings.autoFire = false;
    const dx = Math.cos(direction * Math.PI / 4) * 180, dy = Math.sin(direction * Math.PI / 4) * 180;
    const viewport = { width: 1280 * zoom, height: 720 * zoom, aimOriginX: 640 * zoom, aimOriginY: 360 * zoom, aimScale: zoom };
    input.mouseMove(viewport.aimOriginX + dx * zoom, viewport.aimOriginY + dy * zoom, viewport);
    input.update({ ...viewport, gamepads: [], settings: model.save.settings });
    model.setInput(input.gameplay);
    model.updatePlayer(0);
    const pose = compactShotPose(player, player.lastAimX, player.lastAimY);
    const x = player.x + dx - pose.muzzleX, y = player.y + dy - pose.muzzleY;
    assert.ok(Math.abs(x * player.lastAimY - y * player.lastAimX) < 0.001);
    assert.ok(x * player.lastAimX + y * player.lastAimY > 0);
  }
});
