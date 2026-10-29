"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const { GameModel } = require("../src/core/game-model");
const { SaveManager, normalizeSave } = require("../src/core/save");
const { getSurvivalPressure } = require("../src/content/survival");
const { weaponModifiers } = require("../src/core/arsenal");
const { keyboardCommand, gamepadCommand } = require("../src/input/command-map");
const { normalizeKeyBindings } = require("../src/input/key-bindings");

function game(mapId = "echo_district") {
  const m = new GameModel(new SaveManager({ get: () => null, set() {} }));
  m.startRun({ mapId, seed: 1029, tutorial: false }); return m;
}
function market(m) { const s = m.interactives.find(i => i.type === "tradePost"); Object.assign(m.run.player, { x: s.x, y: s.y + 20 }); assert(m.fieldMarket.open()); m.run.scrap = 10000; }
function openGround() {
  const m = game(); m.releaseAllEntities(); m.obstacles = []; m.rebuildObstacleGrid(); m.navigationCache.clear();
  Object.assign(m.run.player, { x: 1000, y: 1000 }); m.setupNavigation(); m.run.turretKits = 1; m.run.turretKitHealth = [1]; return m;
}
function place(m) { assert(m.structures.begin()); assert(m.structures.confirm()); return m.run.structures[0]; }

test("all maps have an accessible reachable counter and start continuous survival directly", () => {
  for (const id of ["echo_district", "freight_nexus", "red_basin"]) {
    const m = game(id); assert.equal(m.run.endless, true); assert.equal(m.run.stageId, null); assert.equal(m.run.mapId, id);
    assert(m.mapLayout.blocksProjectiles); const station = m.interactives.find(i => i.type === "tradePost"); assert(station);
    const index = m.navigation.grid.worldIndex(station.x, station.y + 20);
    assert(m.navigation.grid.walkable[index]); assert(m.navigation.flow.distances[index] >= 0, id + " counter reachable from spawn");
    market(m); assert.equal(m.screen, "fieldShop");
  }
});

test("continuous runs exceed old timers and pressure continues growing without unlimited speed or entities", () => {
  const m = game(); m.run.elapsed = 1200; m.tick(1 / 60); assert.equal(m.screen, "running");
  const early = getSurvivalPressure(360), late = getSurvivalPressure(3600), extreme = getSurvivalPressure(1e12);
  assert(late.hp > early.hp * 5); assert(late.damage > early.damage); assert(late.price > early.price);
  assert(extreme.speed <= 1.5); assert(extreme.cap <= 104); assert(Number.isFinite(extreme.hp)); assert(extreme.interval > 0);
});

test("edge spawns stay outside the conservative combat viewport even at map corners", () => {
  const m = game();
  for (const [x, y] of [[34,34],[34,3038],[3038,34],[3038,3038],[1536,1536]]) {
    Object.assign(m.run.player, { x,y }); const cx = Math.max(0, Math.min(1792, x - 640)), cy = Math.max(0, Math.min(2352, y - 360));
    for (let i=0;i<20;i++) { const e = m.spawnAtEdge("drifter"); assert(e); assert(e.x < cx || e.x > cx+1280 || e.y < cy || e.y > cy+720); m.enemyPool.release(e); m.compactEntities(); }
  }
});

test("schema 9 migration preserves the wallet, equipment, manual preferences and old map history", () => {
  const source = { schemaVersion:9, currencies:{copper:871,gold:7}, selectedMode:"extraction", selectedMap:"red_basin", unlockedWeapons:["coil_cannon"], settings:{autoAim:false,autoFire:false}, runHistory:[{stageId:"dead_rail",result:"win",elapsed:550}] };
  const s = normalizeSave(source); assert.equal(s.schemaVersion,10); assert.equal(s.selectedMode,"endless"); assert.deepEqual(s.currencies,source.currencies);
  assert.equal(s.settings.autoAim,false); assert.equal(s.settings.autoFire,false); assert(s.unlockedWeapons.includes("coil_cannon"));
  assert.equal(s.runHistory[0].stageId,"dead_rail"); assert.equal(s.runHistory[0].mapId,"freight_nexus"); assert.equal(s.runHistory[0].result,"win");
  assert.equal(normalizeSave(s).currencies.copper,871);
});

test("retirement settles real elapsed time exactly once and retains its own result after reload", () => {
  const m = game("red_basin"); m.run.elapsed = 1324; m.run.scrap = 25; m.run.kills = 400; m.run.bossesDefeated = 3;
  m.finishRun("retire"); const wallet = { ...m.save.currencies }; m.finishRun("lose");
  assert.deepEqual(m.save.currencies,wallet); assert.equal(m.save.settledRuns,1); assert.equal(m.save.bestTime,1324);
  assert.equal(m.save.runHistory[0].result,"retire"); assert.equal(m.save.survivalRecords.red_basin.bestTime,1324);
  assert.equal(normalizeSave(m.save).runHistory[0].result,"retire"); assert.equal(normalizeSave(m.save).runHistory[0].stageId,null); assert.equal(m.run.advice.length,0);
  assert(m.save.unlockedBlueprints.includes("buy_needle_rifle")); assert(m.save.unlockedHeroes.includes("bulwark"));
});

test("a scheduled boss wave cannot grant a defeated-boss unlock", () => {
  const m = game(); m.run.endlessBossWave = 8;
  assert.equal(m.getUnlockRuleProgress("blueprint_coil",m.run).completed,false);
  for(let i=0;i<3;i++) { const e=m.spawnEnemy("warden",m.run.player.x+220,m.run.player.y); m.killEnemy(e); }
  assert.equal(m.run.bossesDefeated,3); assert.equal(m.getUnlockRuleProgress("blueprint_coil",m.run).completed,true);
});

test("instant retirement cannot farm settlement rewards or weapon mastery", () => {
  const m=game(),before={...m.save.currencies};
  for(let i=0;i<4;i++){m.finishRun("retire");m.startRun({tutorial:false});}
  assert.deepEqual(m.save.currencies,before);assert.equal(m.save.settledRuns,0);assert.deepEqual(m.save.weaponMastery,{});
});

test("buying, equipping, tiers and calibrations remain local to each gun", () => {
  const m = game(); market(m); const permanent = JSON.stringify(m.save.currencies);
  assert(m.fieldMarket.purchase("weaponCalibration").ok); assert(m.arsenal.improve("scrap_pistol"));
  const pistol = weaponModifiers(m.run,"scrap_pistol"); assert(pistol.damage>1.4);
  assert(m.arsenal.buy("breaker_shotgun")); assert.equal(m.run.player.weaponId,"breaker_shotgun"); assert.equal(weaponModifiers(m.run).damage,1);
  assert(m.fieldMarket.purchase("weaponCalibration").ok); assert.equal(m.run.arsenal.breaker_shotgun.calibration,1);
  assert(m.arsenal.equip("scrap_pistol")); assert.deepEqual(weaponModifiers(m.run),pistol);
  assert.equal(JSON.stringify(m.save.currencies),permanent); m.fieldMarket.close(); assert.equal(m.arsenal.improve("scrap_pistol"),false);
});

test("mastery follows the weapons actually used and excludes support kills", () => {
  const m=game();m.run.elapsed=120;m.run.shotsFired=5;m.run.kills=10;m.run.turretKills=7;
  m.run.weaponStats={scrap_pistol:{shots:3,kills:2,damage:24,eliteKills:0},breaker_shotgun:{shots:2,kills:1,damage:36,eliteKills:0}};
  m.run.player.weaponId="coil_cannon";m.finishRun("retire");
  assert.equal(m.save.weaponMastery.scrap_pistol.kills,2);assert.equal(m.save.weaponMastery.breaker_shotgun.kills,1);assert.equal(m.save.weaponMastery.coil_cannon,undefined);
  assert.equal(m.save.totalKills,10);
});

test("switching guns moves mastery perks without copying or accumulating them", () => {
  const m=game();m.save.claimedMasteryRewards.push("scrap_pistol:calibrated_frame","scrap_pistol:weakpoint_memory");
  m.startRun({tutorial:false});assert.equal(m.run.player.damageMultiplier,1.04);assert.equal(m.run.player.criticalChance,.03);
  market(m);assert(m.arsenal.buy("swarm_smg"));assert.equal(m.run.player.damageMultiplier,1);assert.equal(m.run.player.criticalChance,0);
  m.run.player.damageMultiplier*=1.15;
  for(let i=0;i<10;i++){assert(m.arsenal.equip("scrap_pistol"));assert(m.arsenal.equip("swarm_smg"));}
  assert(Math.abs(m.run.player.damageMultiplier-1.15)<1e-10);assert.equal(m.run.player.criticalChance,0);
});

test("tower stock and deployed support share one four-unit cap", () => {
  const m=game();market(m);for(let i=0;i<4;i++)assert(m.fieldMarket.purchase("turretKit").ok);
  const balance=m.run.scrap;assert.equal(m.fieldMarket.purchase("turretKit").status,"capacity");assert.equal(m.run.scrap,balance);
});

test("medical restock uses battle time and cannot be waited out inside shopping", () => {
  const m = game(); market(m); m.run.player.hp=20; assert(m.fieldMarket.purchase("fieldMedkit").ok);
  m.run.player.hp=20; for(let i=0;i<3600;i++)m.tick(1/60);
  assert.equal(m.run.elapsed,0); assert.equal(m.fieldMarket.state("fieldMedkit").status,"cooldown");
  m.run.elapsed=30; assert(m.fieldMarket.purchase("fieldMedkit").ok);
});

test("maxed upgrades still yield four distinct actionable repeatable choices", () => {
  const m = game(); for(const id of m.content.ids("upgrades")) if(!m.content.upgrades[id].repeatable)m.run.upgrades[id]=m.content.upgrades[id].max;
  m.run.upgradeOptions=m.createUpgradeOptions(); assert.equal(m.run.upgradeOptions.length,4); assert.equal(new Set(m.run.upgradeOptions.map(o=>o.id)).size,4);
  assert(m.run.upgradeOptions.every(o=>o.repeatable)); m.screen="levelup"; assert(m.chooseUpgrade("endlessSupplies")); assert.equal(m.run.scrap,10);
});

test("failed or cancelled deployment spends no kit and valid deployment rebuilds collision", () => {
  const m = openGround(); m.obstacles=[{x:1060,y:970,w:50,h:50}]; m.rebuildObstacleGrid(); assert(m.structures.begin());
  assert.equal(m.structures.confirm(),false); assert.equal(m.run.turretKits,1); m.structures.cancel(); assert.equal(m.run.placement,null);
  m.obstacles=[]; m.navigationCache.clear(); m.setupNavigation(); const t=place(m);
  assert.equal(m.run.turretKits,0); assert(m.obstacles.some(o=>o.structureId===t.id)); assert.equal(m.run.structuresBuilt,1);
});

test("turret independently damages enemies and its shots do not inherit main-gun upgrades", () => {
  const m=openGround(), t=place(m); m.run.player.damageMultiplier=1000; m.run.player.projectileBonus=10;
  const enemy=m.spawnEnemy("drifter",t.x+150,t.y-20), hp=enemy.hp; m.rebuildEnemyGrid(); t.cooldown=0; m.structures.update(1/60);
  assert.equal(m.projectiles.length,1); assert.equal(m.projectiles[0].owner,"turret"); assert.equal(m.projectiles[0].damage,9);
  for(let i=0;i<20;i++)m.updateProjectiles(1/60); assert(enemy.hp<hp); assert(m.run.turretDamage>0); assert.equal(m.run.hits,0);
});

test("turrets cannot shoot enemies through a wall", () => {
  const m=openGround(),t=place(m); m.spawnEnemy("drifter",t.x+180,t.y-20);
  m.obstacles.push({x:t.x+90,y:t.y-100,w:12,h:180}); t.cooldown=0; m.structures.update(1/60); assert.equal(m.projectiles.length,0);
});

test("enemy contact and swept enemy bullets damage structures before the player", () => {
  const m=openGround(), t=place(m); const e=m.spawnEnemy("drifter",t.x+26,t.y); const hp=t.hp; m.updateEnemies(1/60); assert(t.hp<hp);
  const after=t.hp; m.run.player.x=t.x-100;
  m.enemyShots.push(m.projectilePool.acquire({id:9000,x:t.x+100,y:t.y,vx:-12000,vy:0,radius:4,ttl:1,damage:10,owner:"enemy"}));
  const playerHp=m.run.player.hp; m.updateProjectiles(1/60); assert.equal(t.hp,after-10); assert.equal(m.run.player.hp,playerHp);
});

test("recovery retains damage and destruction removes navigation and collision blockers", () => {
  const m=openGround(),t=place(m); m.structures.damage(t,55); m.run.player.x=t.x+50; assert(m.structures.recover());
  assert.equal(m.run.turretKitHealth[0],.5); assert.equal(m.run.structures.length,0); assert(!m.obstacles.some(o=>o.structureId===t.id));
  m.run.player.lastAimX=1; const next=place(m); assert.equal(next.hp,next.maxHp*.5);
  m.structures.damage(next,1e6); assert.equal(m.run.structures.length,0); assert(!m.obstacles.some(o=>o.kind==="turretBody"));
  assert.equal(m.navigationCache.size,3);
});

test("new deployment controls preserve old T bindings and support cancel", () => {
  const bindings=normalizeKeyBindings({pause:"KeyT"}); assert.equal(bindings.pause,"KeyT"); assert.notEqual(bindings.deployTurret,"KeyT");
  assert.equal(keyboardCommand("KeyT",{screen:"running"}).type,"deploy");
  assert.equal(keyboardCommand("Escape",{screen:"running",placement:true}).type,"back");
  assert.equal(gamepadCommand({type:"deploy"},{screen:"running"}).type,"deploy");
});

test("new runs and consumed map props cannot reuse grids containing retired towers", () => {
  const m = game(); m.run.turretKits = 1; m.run.turretKitHealth = [1];
  Object.assign(m.run.player,{x:1500,y:1450,lastAimX:1,lastAimY:0}); const t=place(m);
  const old=m.navigation, occupied=old.grid.worldIndex(t.x,t.y); assert.equal(old.grid.walkable[occupied],0);
  m.startRun({seed:1029,tutorial:false}); assert.notEqual(m.navigation,old); assert.equal(m.navigation.grid.walkable[occupied],1);
  const item=m.interactives.find(i=>i.type==='supplyCache');m.triggerInteractive(item);assert.equal(m.navigationCache.size,3);
});
