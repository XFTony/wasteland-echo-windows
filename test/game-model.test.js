"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SaveManager } = require("../src/core/save");
const { GameModel, normalizeLimits } = require("../src/core/game-model");
const { DEFAULT_RUN_DURATION, WEAPONS, UPGRADES } = require("../src/config");

function createModel(options = {}) {
  let stored = null;
  const saveManager = new SaveManager({
    get: () => stored,
    set: (_key, value) => {
      stored = value;
    }
  });
  return new GameModel(saveManager, { seed: 7, duration: 60, ...options });
}

function circleOverlapsRect(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(rect.x + rect.w, circle.x));
  const nearestY = Math.max(rect.y, Math.min(rect.y + rect.h, circle.y));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.radius * circle.radius - 0.000001;
}

test("shotgun creates a visible multi-projectile spread", () => {
  const model = createModel();
  model.startRun({ weaponId: "breaker_shotgun", seed: 7 });
  model.projectiles.length = 0;
  model.fireWeapon(1, 0);
  assert.equal(model.projectiles.length, 6);
  const verticalVelocities = new Set(model.projectiles.map((projectile) => Math.round(projectile.vy)));
  assert.ok(verticalVelocities.size >= 4);
});

test("all weapons define range, unique visuals, recoil, muzzle and casing feedback", () => {
  assert.equal(Object.keys(WEAPONS).length, 7);
  const visualIds = new Set();
  const rangeBands = new Set();
  for (const weapon of Object.values(WEAPONS)) {
    assert.equal(visualIds.has(weapon.visualId), false, `${weapon.id} needs a unique visualId`);
    visualIds.add(weapon.visualId);
    rangeBands.add(weapon.rangeBand);
    assert.ok(weapon.recoil > 0, `${weapon.id} needs recoil`);
    assert.ok(weapon.muzzleLength > 0, `${weapon.id} needs a muzzle position`);
    assert.ok(weapon.muzzleFlashLength > 0 && weapon.muzzleFlashLife > 0 && weapon.muzzleParticles > 0, `${weapon.id} needs muzzle feedback`);
    assert.ok(weapon.lockRange > 0, `${weapon.id} needs a finite automatic-lock range`);
    assert.ok(weapon.shellLength > 0 && weapon.shellLife > 0, `${weapon.id} needs casing feedback`);
    assert.match(weapon.shellColor, /^#[0-9a-f]{6}$/i);
  }
  assert.deepEqual([...rangeBands].sort(), ["close", "long", "mid"]);
  assert.equal(Object.keys(UPGRADES).length, 26);
});

test("inventory selections accept unlocked IDs and reject locked IDs", () => {
  const model = createModel();
  model.save.unlockedWeapons.push("ember_carbine");
  model.save.unlockedSkins.push("mechanic");
  assert.equal(model.selectWeapon("ember_carbine"), true);
  assert.equal(model.selectedWeapon, "ember_carbine");
  assert.equal(model.save.selectedWeapon, "ember_carbine");
  assert.equal(model.selectWeapon("coil_cannon"), false);
  assert.equal(model.selectedWeapon, "ember_carbine");
  assert.equal(model.selectSkin("mechanic"), true);
  assert.equal(model.selectedSkin, "mechanic");
});

test("level-up offers four unique upgrades and applies one", () => {
  const model = createModel();
  model.startRun({ seed: 12 });
  model.run.player.xp = model.run.player.xpNext;
  model.checkLevelUp();
  assert.equal(model.screen, "levelup");
  assert.equal(model.run.upgradeOptions.length, 4);
  assert.equal(new Set(model.run.upgradeOptions.map((item) => item.id)).size, 4);
  const choice = model.run.upgradeOptions[0];
  assert.equal(model.chooseUpgrade(choice.id), true);
  assert.equal(model.run.upgrades[choice.id], 1);
  assert.equal(model.screen, "running");
});

test("level-up cards can be salvaged through an explicit model command", () => {
  const model = createModel();
  model.startRun({ seed: 120 });
  model.run.player.level = 4;
  model.screen = "levelup";
  model.run.upgradeOptions = model.createUpgradeOptions();
  const before = model.run.scrap;
  assert.equal(model.salvageUpgradeOptions(), true);
  assert.equal(model.run.scrap, before + 8);
  assert.equal(model.screen, "running");
  assert.deepEqual(model.run.upgradeOptions, []);
  assert.equal(model.run.upgradeOrder.at(-1).id, "salvage");
  assert.equal(model.salvageUpgradeOptions(), false);
});

test("evolutions remain hidden until prerequisites are met and then take priority", () => {
  const model = createModel();
  model.startRun({ seed: 121, weaponId: "needle_rifle" });
  assert.equal(model.createUpgradeOptions().some((item) => item.evolution), false);
  model.run.upgrades.damage = 3;
  model.run.upgrades.pierce = 2;
  assert.equal(model.createUpgradeOptions().some((item) => item.evolution), false, "level-six mastery clearance is also required");
  model.save.unlockedEvolutions.push("penetratorDoctrine");
  const options = model.createUpgradeOptions();
  assert.equal(options[0].id, "penetratorDoctrine");
  model.screen = "levelup";
  model.run.upgradeOptions = options;
  const beforeDamage = model.run.player.damageMultiplier;
  assert.equal(model.chooseUpgrade("penetratorDoctrine"), true);
  assert.ok(model.run.player.damageMultiplier > beforeDamage);
  assert.equal(model.run.upgrades.penetratorDoctrine, 1);
});

test("mobility and tactical evolutions use distinct prerequisite branches", () => {
  const mobility = createModel();
  mobility.startRun({ seed: 122, weaponId: "scrap_pistol" });
  Object.assign(mobility.run.upgrades, { speed: 3, phaseLining: 2 });
  mobility.save.unlockedEvolutions.push("kineticLoop");
  assert.ok(mobility.createUpgradeOptions().some((item) => item.id === "kineticLoop"));

  const tactical = createModel();
  tactical.startRun({ seed: 123, weaponId: "ember_carbine" });
  Object.assign(tactical.run.upgrades, { velocity: 3, critical: 2 });
  tactical.save.unlockedEvolutions.push("arcNetwork");
  assert.ok(tactical.createUpgradeOptions().some((item) => item.id === "arcNetwork"));
});

test("successful extraction ends the run and persists rewards", () => {
  const model = createModel({ duration: 1 });
  model.startRun({ seed: 99, duration: 1, modeId: "extraction" });
  model.updateSpawner = () => {};
  model.run.extraction.active = true;
  model.run.extraction.x = model.run.player.x;
  model.run.extraction.y = model.run.player.y;
  model.run.extraction.required = 0.1;
  model.run.kills = 20;
  for (let index = 0; index < 30 && model.screen === "running"; index += 1) model.tick(0.05);
  assert.equal(model.screen, "resultWin");
  assert.equal(model.save.wins, 1);
  assert.ok(model.save.scrap >= 27);
  assert.equal(model.save.currencies.gold, 1);
  assert.ok(model.save.completedStages.includes("signal_dawn"));
  assert.ok(model.save.unlockedMaps.includes("freight_nexus"));
});

test("survival mode wins immediately when its timer reaches zero", () => {
  const model = createModel({ duration: 1 });
  model.startRun({ seed: 101, duration: 1, modeId: "survival" });
  model.updateSpawner = () => {};
  model.run.player.hp = 999;
  model.run.player.maxHp = 999;
  for (let index = 0; index < 30 && model.screen === "running"; index += 1) model.tick(0.05);
  assert.equal(model.screen, "resultWin");
  assert.equal(model.run.extraction.active, false);
  assert.equal(model.save.wins, 1);
});

test("extraction mode does not win at the time limit before beacon sync", () => {
  const model = createModel({ duration: 1 });
  model.startRun({ seed: 102, duration: 1, modeId: "extraction" });
  model.updateSpawner = () => {};
  model.run.player.hp = 999;
  model.run.player.maxHp = 999;
  for (let index = 0; index < 22; index += 1) model.tick(0.05);
  assert.equal(model.screen, "running");
  assert.ok(model.run.overtime > 0);
  assert.equal(model.run.result, null);
});

test("survival mode starts with a gentler player and enemy setup", () => {
  const survival = createModel();
  survival.startRun({ seed: 13, modeId: "survival" });
  const extraction = createModel();
  extraction.startRun({ seed: 13, modeId: "extraction" });
  assert.equal(survival.run.player.hp, 123, "starter field vest is applied once during loadout composition");
  assert.equal(survival.run.equipmentLoadout.chest.id, "field_vest");
  assert.equal(survival.run.player.speed, 178);
  assert.equal(survival.enemies.length, 1);
  assert.equal(extraction.run.player.hp, 108, "equipped armor must compose consistently across game modes");
  assert.equal(extraction.enemies.length, 2);
});

test("pickup pressure stays inside its preallocated pool and merges value", () => {
  const model = createModel();
  model.startRun({ seed: 17 });
  for (let index = 0; index < 220; index += 1) model.spawnPickup("xp", 100 + index, 100, 1);
  assert.equal(model.pickups.length, 140);
  assert.equal(model.pickups.reduce((sum, pickup) => sum + pickup.value, 0), 220);
  assert.equal(model.getStats().pools.pickups.created, 140);
});

test("enemy roster changes as stage progress increases", () => {
  const model = createModel({ duration: 100 });
  model.startRun({ seed: 22, duration: 100 });
  const early = new Set(Array.from({ length: 25 }, () => model.chooseEnemyType(0.05)));
  assert.deepEqual([...early], ["drifter"]);
  const late = new Set(Array.from({ length: 200 }, () => model.chooseEnemyType(0.8)));
  assert.ok(late.has("runner"));
  assert.ok(late.has("spitter"));
  assert.ok(late.has("brute"));
  assert.ok(late.has("screecher"));
  assert.ok(late.has("crawler"));
});

test("player movement caps keyboard diagonals but preserves analog stick strength", () => {
  const model = createModel();
  model.startRun({ seed: 7 });
  model.save.settings.autoAim = false;
  model.save.settings.autoFire = false;
  model.enemies.length = 0;
  const player = model.run.player;

  const startX = player.x;
  model.setInput({ moveX: 0.25, moveY: 0 });
  model.updatePlayer(1);
  assert.equal(player.x, startX + player.speed * 0.25);

  const diagonalStartX = player.x;
  const diagonalStartY = player.y;
  model.setInput({ moveX: 1, moveY: 1 });
  model.updatePlayer(1);
  const traveled = Math.hypot(player.x - diagonalStartX, player.y - diagonalStartY);
  assert.ok(Math.abs(traveled - player.speed) < 0.0001);
});

test("nearest-target lock takes priority while automatic aim is enabled", () => {
  const model = createModel();
  model.startRun({ seed: 77 });
  model.save.settings.autoAim = true;
  model.save.settings.autoFire = false;
  model.enemies.length = 0;
  model.spawnEnemy("drifter", model.run.player.x + 100, model.run.player.y);
  model.setInput({ aimX: 0, aimY: -1, aimActive: true, firing: false });
  model.updatePlayer(0);
  assert.ok(model.run.player.lastAimX > 0.99);
  assert.ok(Math.abs(model.run.player.lastAimY) < 0.01);
  assert.equal(model.run.player.aimTargetId, model.enemies[0].id);

  model.setInput({ aimX: 0, aimY: -1, aimActive: false, firing: false });
  model.updatePlayer(0);
  assert.ok(model.run.player.lastAimX > 0.99);
  assert.ok(Math.abs(model.run.player.lastAimY) < 0.01);

  model.save.settings.autoAim = false;
  model.setInput({ aimX: 0, aimY: -1, aimActive: true, firing: false });
  model.updatePlayer(0);
  assert.equal(model.run.player.lastAimX, 0);
  assert.equal(model.run.player.lastAimY, -1);
  assert.equal(model.run.player.aimTargetId, null);
});

test("the desktop default run is three minutes", () => {
  const manager = new SaveManager({ get: () => null, set: () => {} });
  const model = new GameModel(manager, { seed: 79 });
  assert.equal(model.duration, DEFAULT_RUN_DURATION);
  assert.equal(DEFAULT_RUN_DURATION, 180);
});

test("automatic aim locks and fires only at the nearest enemy inside weapon range", () => {
  const model = createModel();
  model.startRun({ seed: 78 });
  model.save.settings.autoAim = true;
  model.save.settings.autoFire = true;
  model.enemies.length = 0;
  const player = model.run.player;
  const weapon = WEAPONS[player.weaponId];
  const effectiveRange = weapon.lockRange * player.lockRangeMultiplier;
  const outside = model.spawnEnemy("drifter", player.x + effectiveRange + 40, player.y);
  model.setInput({ aimX: 0, aimY: -1, aimActive: true, firing: false });
  model.updatePlayer(0);
  assert.equal(model.run.player.aimTargetId, null);
  assert.equal(model.projectiles.length, 0, "automatic fire must not shoot toward an out-of-range hostile");

  const nearest = model.spawnEnemy("drifter", player.x + 100, player.y + 22);
  model.updatePlayer(0);
  assert.equal(model.run.player.aimTargetId, nearest.id);
  assert.notEqual(model.run.player.aimTargetId, outside.id);
  assert.ok(model.run.player.lastAimX > 0.97);
  assert.ok(model.run.player.lastAimY > 0.17 && model.run.player.lastAimY < 0.25);
  assert.equal(model.projectiles.length, 1);
});

test("range upgrades expand the automatic lock distance with projectile reach", () => {
  const model = createModel();
  model.startRun({ seed: 82 });
  model.save.settings.autoAim = true;
  model.enemies.length = 0;
  model.run.player.projectileRangeMultiplier = 1.2;
  const weapon = WEAPONS[model.run.player.weaponId];
  const target = model.spawnEnemy("drifter", model.run.player.x + weapon.lockRange * model.run.player.lockRangeMultiplier * 1.1, model.run.player.y);
  model.setInput({ aimX: 0, aimY: -1, aimActive: true, firing: false });
  model.updatePlayer(0);
  assert.equal(model.run.player.aimTargetId, target.id);
});

test("endless mode never auto-resolves at the configured timer", () => {
  const model = createModel({ duration: 1 });
  model.startRun({ seed: 88, duration: 1, modeId: "endless" });
  model.updateSpawner = () => {};
  model.run.player.hp = 999;
  model.run.player.maxHp = 999;
  for (let index = 0; index < 60; index += 1) model.tick(0.05);
  assert.equal(model.screen, "running");
  assert.ok(model.run.elapsed > 1);
  assert.equal(model.run.endless, true);
});

test("hero, equipment and map selections are composed into a run", () => {
  const model = createModel();
  model.startRun({ seed: 93, heroId: "mechanic", mapId: "red_basin" });
  assert.equal(model.run.heroId, "mechanic");
  assert.equal(model.run.mapId, "red_basin");
  assert.equal(model.worldSize, 4096);
  assert.ok(model.run.player.pickupRadius > 48);
  assert.ok(model.run.player.copperMultiplier > 1);
  assert.deepEqual(model.run.equipmentIds, ["field_vest"]);
});

test("spawn phases build pressure, permit a brief respite, then escalate", () => {
  const model = createModel({ duration: 180 });
  model.startRun({ seed: 91, duration: 180 });
  model.drainEvents();
  model.run.elapsed = 180 * 0.61;
  model.updateSpawner(0);
  assert.equal(model.run.spawnPhaseIndex, 4);
  const phaseEvent = model.drainEvents().find((event) => event.type === "spawnPhase");
  assert.equal(phaseEvent.phaseId, "siege");
  assert.match(phaseEvent.label, /警报/);
});

test("endless boss waves advance once per successful threshold spawn", () => {
  const model = createModel({ duration: 60 });
  model.startRun({ seed: 95, duration: 60, modeId: "endless" });
  model.drainEvents();

  const spawnedTypes = [];
  for (let expectedWave = 1; expectedWave <= 7; expectedWave += 1) {
    model.run.elapsed = model.run.nextEndlessBossAt;
    model.updateSpawner(0);
    const waveEvents = model.drainEvents().filter((event) => event.type === "boss");
    assert.equal(waveEvents.length, 1, `wave ${expectedWave} should emit once`);
    assert.equal(waveEvents[0].phase, expectedWave);
    assert.equal(model.run.endlessBossWave, expectedWave);
    spawnedTypes.push(waveEvents[0].enemyType);

    model.updateSpawner(0);
    assert.equal(model.drainEvents().some((event) => event.type === "boss"), false, "the same threshold must not repeat");
  }

  assert.deepEqual(spawnedTypes, ["warden", "warden", "iron_colossus", "warden", "warden", "iron_colossus", "warden"]);
  assert.equal(model.screen, "running");
});

test("chapter boss state advances only after a successful spawn and emits identity", () => {
  const model = createModel({ duration: 60 });
  model.startRun({ seed: 950, duration: 60, modeId: "survival" });
  model.drainEvents();
  model.run.elapsed = 60 * 0.9;
  const originalSpawn = model.spawnSystem.spawnAtEdge.bind(model.spawnSystem);
  model.spawnSystem.spawnAtEdge = () => null;
  model.updateSpawner(0);
  assert.equal(model.run.bossOneSpawned, false);
  assert.equal(model.drainEvents().some((event) => event.type === "boss"), false);
  model.spawnSystem.spawnAtEdge = originalSpawn;
  model.updateSpawner(0);
  const bossEvent = model.drainEvents().find((event) => event.type === "boss");
  assert.equal(model.run.bossOneSpawned, true);
  assert.equal(bossEvent.enemyType, "iron_colossus");
  assert.ok(bossEvent.enemyId > 0);
});

test("boss health thresholds emit deterministic phases and escalate attacks", () => {
  const model = createModel();
  model.startRun({ seed: 951 });
  model.releaseAllEntities();
  model.updateSpawner = () => {};
  const boss = model.spawnEnemy("iron_colossus", model.run.player.x + 240, model.run.player.y);
  boss.actionCooldown = 0;
  model.updateEnemies(0);
  assert.equal(model.drainEvents().some((event) => event.type === "bossPhase" && event.phase === 1), true);
  const phaseOneShots = model.enemyShots.length;

  boss.hp = boss.maxHp * 0.3;
  boss.actionCooldown = 0;
  model.updateEnemies(0);
  const events = model.drainEvents();
  assert.equal(events.some((event) => event.type === "bossPhase" && event.phase === 3), true);
  assert.ok(model.enemyShots.length - phaseOneShots >= 21, "phase three adds dense radial fire and one aimed shot");
  assert.equal(boss.actionCooldown, 1.95);
});

test("tank and buffer roles emit distinct charge and scream actions", () => {
  const model = createModel();
  model.startRun({ seed: 954 });
  model.releaseAllEntities();
  model.updateSpawner = () => {};
  const brute = model.spawnEnemy("brute", model.run.player.x + 180, model.run.player.y);
  const screecher = model.spawnEnemy("screecher", model.run.player.x - 180, model.run.player.y);
  brute.actionCooldown = 0;
  screecher.actionCooldown = 0;
  model.updateEnemies(0);
  const actions = model.drainEvents().filter((event) => event.type === "enemyAction").map((event) => event.action);
  assert.ok(actions.includes("charge"));
  assert.ok(actions.includes("scream"));
  assert.ok(brute.dashTime > 0);
});

test("explosive barrels damage nearby enemies once and emit an environment event", () => {
  const model = createModel();
  model.startRun({ seed: 952 });
  model.releaseAllEntities();
  model.obstacles = [];
  model.rebuildObstacleGrid();
  const barrel = { id: "test-barrel", type: "explosiveBarrel", x: 800, y: 800, radius: 14, effectRadius: 120, damage: 40, active: true, pulse: 0 };
  model.interactives = [barrel];
  const enemy = model.spawnEnemy("brute", 840, 800);
  const hp = enemy.hp;
  assert.equal(model.triggerInteractive(barrel), true);
  assert.ok(enemy.hp < hp);
  assert.equal(barrel.active, false);
  assert.equal(model.triggerInteractive(barrel), false);
  assert.equal(model.drainEvents().some((event) => event.type === "environment" && event.action === "explode"), true);
});

test("supply caches drop resources and electric fields slow enemies", () => {
  const model = createModel();
  model.startRun({ seed: 953 });
  model.releaseAllEntities();
  model.obstacles = [];
  model.rebuildObstacleGrid();
  const supply = { id: "test-supply", type: "supplyCache", x: 900, y: 900, radius: 20, scrap: 7, healing: 30, active: true, pulse: 0 };
  const field = { id: "test-field", type: "electricField", x: 1200, y: 1200, radius: 100, slow: 0.5, active: true, pulse: 0 };
  model.interactives = [supply, field];
  model.run.player.x = supply.x;
  model.run.player.y = supply.y;
  model.updateInteractives(1 / 60);
  assert.equal(supply.active, false);
  assert.deepEqual(new Set(model.pickups.map((item) => item.type)), new Set(["scrap", "medkit"]));

  model.run.player.x = 1500;
  model.run.player.y = 1200;
  model.navigation = null;
  const enemy = model.spawnEnemy("drifter", 1200, 1200);
  const before = enemy.x;
  model.updateEnemies(1);
  assert.ok(Math.abs(enemy.x - before - enemy.speed * 0.5) < 0.001);
});

test("enemy creation remains inside the injected hard memory limit", () => {
  const model = createModel({ limits: { enemies: 24, enemyWarmup: 999 } });
  model.startRun({ seed: 96, modeId: "endless" });
  let rejected = 0;
  for (let index = 0; index < 80; index += 1) {
    if (!model.spawnEnemy("drifter", 200 + index, 200)) rejected += 1;
  }
  assert.equal(model.enemies.length, 24);
  assert.ok(rejected > 0);
  assert.equal(model.getStats().pools.enemies.created, 24);
  assert.equal(model.getStats().limits.enemies, 24);
});

test("enemies are pushed out when spawned inside a solid map obstacle", () => {
  const model = createModel();
  model.startRun({ seed: 97, mapId: "echo_district" });
  model.updateSpawner = () => {};
  model.releaseAllEntities();
  const obstacle = model.obstacles.find((item) => item.w > 100 && item.h > 100);
  const enemy = model.spawnEnemy("drifter", obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2);

  assert.equal(circleOverlapsRect(enemy, obstacle), false, "spawn resolution must handle a center deeply embedded in a rectangle");
  model.updateEnemies(1 / 60);
  assert.equal(model.obstacles.some((item) => circleOverlapsRect(enemy, item)), false);
});

test("enemy pursuit routes around a solid obstacle without crossing it", () => {
  const model = createModel();
  model.startRun({ seed: 971, mapId: "echo_district" });
  model.updateSpawner = () => {};
  model.releaseAllEntities();
  const obstacle = model.obstacles.find((item) => item.x > 150 && item.y > 200 && item.w > 180 && item.h > 100);
  const enemy = model.spawnEnemy("drifter", obstacle.x - 44, obstacle.y + obstacle.h / 2);
  model.run.player.x = obstacle.x + obstacle.w + 160;
  model.run.player.y = enemy.y;

  for (let frame = 0; frame < 900; frame += 1) {
    model.updateEnemies(1 / 60);
    assert.equal(circleOverlapsRect(enemy, obstacle), false, `enemy entered the obstacle on frame ${frame}`);
  }
  assert.ok(enemy.x >= obstacle.x + obstacle.w + enemy.radius, "flow guidance should eventually reach the far side instead of pressing against the obstacle face");
});

test("navigation flow rebuilds only after the player crosses a cell and reuses the baked grid", () => {
  const model = createModel();
  model.startRun({ seed: 972, mapId: "echo_district" });
  const firstNavigation = model.navigation;
  const firstProfiles = { ...model.navigations };
  const initialRebuilds = firstNavigation.flow.rebuildCount;
  assert.ok(firstNavigation.grid.cellCount > 0);
  assert.equal(model.getStats().navigationProfiles, 3);
  assert.ok(model.navigations.small.grid.clearance < model.navigations.large.grid.clearance);
  const smallWalkable = model.navigations.small.grid.walkable.reduce((sum, value) => sum + value, 0);
  const largeWalkable = model.navigations.large.grid.walkable.reduce((sum, value) => sum + value, 0);
  assert.ok(smallWalkable >= largeWalkable, "small enemies must not inherit boss clearance");
  model.updateNavigation(1);
  assert.equal(firstNavigation.flow.rebuildCount, initialRebuilds, "remaining inside one cell does not rebuild the BFS field");
  model.run.player.x += firstNavigation.grid.cellSize * 1.2;
  model.updateNavigation(1);
  assert.equal(firstNavigation.flow.rebuildCount, initialRebuilds + 1);

  model.startRun({ seed: 973, mapId: "echo_district" });
  assert.equal(model.navigation, firstNavigation, "static walkability and typed-array buffers are cached per layout");
  assert.equal(model.navigations.medium, firstProfiles.medium);
  assert.equal(model.navigations.large, firstProfiles.large);
});

test("enemy separation resolves identical centers without unbounded pair scans", () => {
  const model = createModel();
  model.startRun({ seed: 98 });
  model.updateSpawner = () => {};
  model.releaseAllEntities();
  model.obstacles = [];
  model.rebuildObstacleGrid();
  const x = model.worldSize / 2;
  const y = model.worldSize / 2;
  const first = model.spawnEnemy("drifter", x, y);
  const second = model.spawnEnemy("drifter", x, y);

  model.updateEnemies(0);
  const separation = Math.hypot(second.x - first.x, second.y - first.y);
  assert.ok(separation >= first.radius + second.radius, `expected separated centers, received ${separation}`);
  assert.ok(model.getStats().spatialCells > 0);
});

test("enemy separation gives knockback-resistant bosses less displacement", () => {
  const model = createModel();
  model.startRun({ seed: 99 });
  model.updateSpawner = () => {};
  model.releaseAllEntities();
  model.obstacles = [];
  model.rebuildObstacleGrid();
  const x = model.worldSize / 2;
  const y = model.worldSize / 2;
  const boss = model.spawnEnemy("iron_colossus", x, y);
  const drifter = model.spawnEnemy("drifter", x + 10, y);

  model.updateEnemies(0);
  const bossTravel = Math.hypot(boss.x - x, boss.y - y);
  const drifterTravel = Math.hypot(drifter.x - (x + 10), drifter.y - y);
  assert.ok(bossTravel < drifterTravel, "heavy enemies should anchor a crowd instead of being displaced like a crawler");
});

test("player collision queries only nearby obstacle-grid entries", () => {
  const model = createModel();
  model.startRun({ seed: 1001 });
  const player = model.run.player;
  const near = { id: "near", x: player.x - 30, y: player.y - 30, w: 60, h: 60 };
  const far = Array.from({ length: 240 }, (_, index) => ({
    id: "far-" + index,
    x: 80 + index % 20 * 110,
    y: 80 + Math.floor(index / 20) * 110,
    w: 28,
    h: 28
  })).filter((item) => Math.hypot(item.x - player.x, item.y - player.y) > 300);
  model.obstacles = [near, ...far];
  model.rebuildObstacleGrid();
  model.setInput({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, aimActive: false, firing: false });
  model.updatePlayer(0);
  assert.equal(circleOverlapsRect(player, near), false);
  assert.ok(model.getStats().playerObstacleChecks <= 2, "far map geometry must not be scanned by player collision");
});

test("pooled piercing projectiles track prior hits with a reusable Set", () => {
  const model = createModel();
  model.startRun({ seed: 1002 });
  model.releaseAllEntities();
  model.obstacles = [];
  model.rebuildObstacleGrid();
  const enemy = model.spawnEnemy("brute", model.run.player.x + 30, model.run.player.y);
  model.fireWeapon(1, 0);
  const projectile = model.projectiles[0];
  projectile.x = enemy.x;
  projectile.y = enemy.y;
  projectile.vx = 0;
  projectile.vy = 0;
  projectile.damage = 1;
  projectile.pierce = 4;
  projectile.ttl = 1;
  model.rebuildEnemyGrid();
  const before = enemy.hp;
  model.updateProjectiles(0);
  const afterFirst = enemy.hp;
  model.updateProjectiles(0);
  assert.equal(projectile.hitIds instanceof Set, true);
  assert.equal(afterFirst, before - 1);
  assert.equal(enemy.hp, afterFirst, "the same projectile cannot damage one enemy twice");
});

test("run telemetry records damage sources and ordered upgrades", () => {
  const model = createModel();
  model.startRun({ seed: 1003, tutorial: false });
  model.damagePlayer(10, model.run.player.x - 20, model.run.player.y, { type: "spitter", role: "ranged" });
  assert.ok(model.run.damageTaken > 0);
  assert.equal(model.run.damageTakenBySource.spitter, model.run.damageTaken);
  model.screen = "levelup";
  model.run.upgradeOptions = [model.content.upgrades.damage];
  assert.equal(model.chooseUpgrade("damage"), true);
  assert.deepEqual(model.run.upgradeOrder[0], { id: "damage", level: 1, elapsed: 0 });
});

test("runtime entity limits are bounded before allocating pools", () => {
  const limits = normalizeLimits({ enemies: -4, enemyWarmup: 9999, projectiles: -8, enemyShots: Infinity, pickups: 80, pickupWarmup: 9999, gridCellSize: 0 });
  assert.equal(limits.enemies, 16);
  assert.equal(limits.enemyWarmup, 16);
  assert.equal(limits.projectiles, 16);
  assert.equal(limits.enemyShots, 120);
  assert.equal(limits.pickups, 80);
  assert.equal(limits.pickupWarmup, 80);
  assert.equal(limits.gridCellSize, 32);
  assert.equal(Object.isFrozen(limits), true);
});

test("key rebinding persists swaps and supports cancellation", () => {
  const model = createModel();
  model.setMenuPage("settings");
  model.setSettingsSection("controls");
  assert.equal(model.beginKeyBinding("moveUp"), true);
  const result = model.applyKeyBinding("KeyS");
  assert.equal(result.status, "swapped");
  assert.equal(model.save.keyBindings.moveUp, "KeyS");
  assert.equal(model.save.keyBindings.moveDown, "KeyW");
  model.beginKeyBinding("fire");
  model.cancelKeyBinding();
  assert.equal(model.pendingBindingAction, null);
  assert.equal(model.save.keyBindings.fire, "Space");
});
