"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const { GameModel } = require("../src/core/game-model");
const { SaveManager } = require("../src/core/save");
const { keyboardCommand, gamepadCommand } = require("../src/input/command-map");
const { pointInCard, cardBounds } = require("../src/render/ui/card-motion");
const { normalizeKeyBindings } = require("../src/input/key-bindings");

function create(mapId = "echo_district") {
  const m = new GameModel(new SaveManager({ get: () => null, set() {} }));
  m.startRun({ mapId, seed: 23, tutorial: false }); m.updateSpawner = () => {};
  return m;
}
function approach(m) {
  const station = m.interactives.find(item => item.type === "tradePost");
  m.run.player.x = station.x; m.run.player.y = station.y + 20; return station;
}

test("only an accessible counter can open the in-run market", () => {
  const m = create(), station = approach(m);
  m.run.player.y += 100; assert.equal(m.fieldMarket.open(), false);
  m.run.player.x = station.x; m.run.player.y = station.y - 62;
  assert.equal(m.fieldMarket.open(), false, "a nearby point across the booth wall is not an entrance");
  approach(m); assert.equal(m.fieldMarket.open(), true); assert.equal(m.screen, "fieldShop");
  assert.equal(m.fieldMarket.open(), false, "open command is not a toggle");
  for (const id of ["freight_nexus", "red_basin"]) assert.equal(create(id).fieldMarket.open(), false);
});

test("shopping freezes survival time, projectiles and enemy contact", () => {
  const m = create(); approach(m);
  const enemy = m.enemies[0], before = { x: enemy.x, y: enemy.y, hp: m.run.player.hp, elapsed: m.run.elapsed };
  assert(m.fieldMarket.open());
  for (let i = 0; i < 120; i++) m.tick(1 / 60);
  assert.deepEqual({ x: enemy.x, y: enemy.y, hp: m.run.player.hp, elapsed: m.run.elapsed }, before);
  assert(m.fieldMarket.close()); m.tick(1 / 60); assert(m.run.elapsed > before.elapsed);
});

test("field purchases are atomic, bounded and never spend permanent currencies", () => {
  const m = create(); approach(m); m.run.scrap = 100;
  const wallet = JSON.stringify(m.save.currencies), damage = m.run.player.damageMultiplier;
  assert.equal(m.fieldMarket.purchase("weaponCalibration").ok, false);
  m.fieldMarket.open();
  for (let i = 0; i < 3; i++) assert.equal(m.fieldMarket.purchase("weaponCalibration").ok, true);
  assert.equal(m.run.scrap, 44); assert.equal(m.run.fieldMarket.spent, 56);
  assert(Math.abs(m.run.player.damageMultiplier - damage * 1.12 ** 3) < 1e-9);
  assert.equal(m.fieldMarket.purchase("weaponCalibration").status, "soldOut");
  assert.equal(m.run.scrap, 44); assert.equal(JSON.stringify(m.save.currencies), wallet);
  assert.equal(m.fieldMarket.purchase("missing").ok, false);
});

test("full health and insufficient balance do not charge a coin", () => {
  const m = create(); approach(m); m.run.scrap = 6; m.fieldMarket.open();
  assert.equal(m.fieldMarket.purchase("fieldMedkit").status, "fullHealth");
  m.run.player.hp /= 2;
  assert.equal(m.fieldMarket.purchase("fieldMedkit").status, "insufficient"); assert.equal(m.run.scrap, 6);
  m.run.scrap = 7;
  assert(m.fieldMarket.purchase("fieldMedkit").ok); assert.equal(m.run.scrap, 0);
  assert(Math.abs(m.run.player.hp / m.run.player.maxHp - .8) < 1e-9);
  assert.equal(m.fieldMarket.purchase("runnerStrap").ok, false); assert.equal(m.run.scrap, 0);
});

test("leaving the counter, death and restart cannot retain or duplicate field purchases", () => {
  const m = create(); approach(m); m.run.scrap = 50; m.fieldMarket.open();
  m.run.player.x += 400; assert.equal(m.fieldMarket.purchase("runnerStrap").status, "closed");
  approach(m); m.fieldMarket.purchase("runnerStrap");
  m.fieldMarket.close(); assert.equal(m.fieldMarket.purchase("runnerStrap").ok, false);
  m.finishRun("lose"); assert.equal(m.fieldMarket.purchase("runnerStrap").ok, false);
  m.startRun({ seed: 23, mapId: "echo_district", tutorial: false });
  assert.deepEqual(m.run.fieldMarket.purchases, {}); assert.equal(m.run.fieldMarket.spent, 0);
  assert.equal(m.run.scrap, 0); assert.equal(m.run.fieldMarket.stationId, null);
});

test("trade interaction works through bindable keyboard and gamepad commands", () => {
  assert.deepEqual(keyboardCommand("KeyE", { screen: "running" }), { type: "interact" });
  assert.deepEqual(keyboardCommand("KeyL", { screen: "running", keyBindings: { interact: "KeyL" } }), { type: "interact" });
  assert.deepEqual(keyboardCommand("Escape", { screen: "fieldShop" }), { type: "back" });
  assert.deepEqual(gamepadCommand({ type: "confirm" }, { screen: "running" }), { type: "interact" });
  assert.deepEqual(gamepadCommand({ type: "cancel" }, { screen: "fieldShop" }), { type: "back" });
  assert.deepEqual(gamepadCommand({ type: "pause" }, { screen: "fieldShop" }), { type: "back" });
});

test("the new interaction default never steals an existing saved E binding", () => {
  const bindings = normalizeKeyBindings({ pause: "KeyE" });
  assert.equal(bindings.pause, "KeyE"); assert.notEqual(bindings.interact, "KeyE");
  assert.deepEqual(keyboardCommand("Enter", { screen: "running", keyBindings: bindings }), { type: "interact" });
});

test("sample-map cover stops both projectile owners and automatic lock ignores hidden enemies", () => {
  const m = create(), p = m.run.player; m.releaseAllEntities();
  m.obstacles = [{ x: p.x + 70, y: p.y - 100, w: 5, h: 200, kind: "wall" }]; m.rebuildObstacleGrid();
  const hidden = m.spawnEnemy("drifter", p.x + 130, p.y), visible = m.spawnEnemy("drifter", p.x - 150, p.y);
  assert.equal(m.findNearestEnemy(p.x, p.y, 400).id, visible.id);
  const hp = hidden.hp;
  m.projectiles.push(m.projectilePool.acquire({ id: 1000, x: p.x, y: p.y, vx: 18000, vy: 0, radius: 2, ttl: 1, damage: 10, pierce: 4, owner: "player" }));
  m.rebuildEnemyGrid(); m.updateProjectiles(1 / 60); assert.equal(hidden.hp, hp); assert.equal(m.projectiles[0].active, false);
  const playerHp = p.hp;
  m.enemyShots.push(m.projectilePool.acquire({ id: 1001, x: p.x + 200, y: p.y, vx: -18000, vy: 0, radius: 4, ttl: 1, damage: 20, owner: "enemy" }));
  m.updateProjectiles(1 / 60); assert.equal(p.hp, playerHp); assert.equal(m.enemyShots[0].active, false);
});

test("a coin behind solid cover is not magnetized through the wall", () => {
  const m = create(), p = m.run.player; m.releaseAllEntities(); p.pickupRadius = 200;
  m.obstacles = [{ x: p.x + 35, y: p.y - 70, w: 5, h: 140, kind: "wall" }];
  const coin = m.spawnPickup("scrap", p.x + 85, p.y, 3), x = coin.x;
  for (let i = 0; i < 10; i++) m.updatePickups(1 / 60);
  assert.equal(coin.x, x); assert.equal(m.run.scrap, 0);
  m.obstacles.length = 0;
  for (let i = 0; i < 60; i++) m.updatePickups(1 / 60);
  assert.equal(m.run.scrap, 3);
});

test("an unopened supply blocks automatic fire until its solid body is removed", () => {
  const m = create(); m.releaseAllEntities();
  const cache = m.interactives.find(item => item.type === "supplyCache"), p = m.run.player;
  p.x = cache.x - 80; p.y = cache.y;
  const enemy = m.spawnEnemy("drifter", cache.x + 80, cache.y);
  m.rebuildEnemyGrid(); assert.equal(m.findNearestEnemy(p.x, p.y, 300), null);
  m.triggerInteractive(cache); assert.equal(m.findNearestEnemy(p.x, p.y, 300), enemy);
});

test("consumed map props remove their actor blocker and rebuild navigation without stale restart grids", () => {
  const m = create(), original = m.navigation;
  const barrel = m.interactives.find(item => item.type === "explosiveBarrel");
  assert(m.obstacles.some(item => item.interactiveId === barrel.id));
  m.triggerInteractive(barrel);
  assert(!m.obstacles.some(item => item.interactiveId === barrel.id)); assert.notEqual(m.navigation, original);
  assert.equal(m.triggerInteractive(barrel), false);
  m.startRun({ mapId: "echo_district", seed: 23, tutorial: false });
  assert(m.obstacles.some(item => item.interactiveId === barrel.id)); assert.equal(m.navigation, original);
});

test("rotated and scaled cards use the actual shape rather than the empty bounding corners", () => {
  const shape = { cx: 180, cy: 200, w: 160, h: 260, angle: .12, scale: 1.04 };
  const bounds = cardBounds(shape);
  assert(pointInCard(shape, shape.cx, shape.cy));
  assert(!pointInCard(shape, bounds.x, bounds.y));
  const lx = 60, ly = 100;
  const x = shape.cx + (lx * Math.cos(shape.angle) - ly * Math.sin(shape.angle)) * shape.scale;
  const y = shape.cy + (lx * Math.sin(shape.angle) + ly * Math.cos(shape.angle)) * shape.scale;
  assert(pointInCard(shape, x, y));
});
