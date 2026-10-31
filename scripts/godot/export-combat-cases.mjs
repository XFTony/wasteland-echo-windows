import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { GameModel } = require("../../src/core/game-model.js");
const { SaveManager } = require("../../src/core/save.js");
const { DEFAULT_CONTENT: content } = require("../../src/core/content-registry.js");
const target = path.resolve(import.meta.dirname, "../../godot/data/combat_cases.json");
const clone = value => JSON.parse(JSON.stringify(value, (_key, entry) =>
  entry instanceof Set ? [...entry] : ArrayBuffer.isView(entry) ? Array.from(entry) : entry));
const cases = [];

function snapshot(model) {
  const save = clone(model.save);
  for (const run of save.runHistory) run.completedAt = 0;
  return clone({ screen: model.screen, randomState: model.random.state >>> 0, entityId: model.entityId,
    run: model.run, enemies: model.enemies, projectiles: model.projectiles,
    enemyShots: model.enemyShots, pickups: model.pickups, interactives: model.interactives,
    obstacles: model.obstacles, save, events: model.drainEvents(), observations:model.qaObservations });
}

function apply(model, operation) {
  const p = model.run.player;
  switch (operation.kind) {
    case "clean":
      model.releaseAllEntities(); model.obstacles = []; model.interactives = [];
      model.rebuildObstacleGrid(); model.navigationCache.clear(); model.setupNavigation();
      model.updateSpawner = () => {}; break;
    case "settings": Object.assign(model.save.settings, operation.values); break;
    case "player": Object.assign(p, operation.values); break;
    case "run": Object.assign(model.run, operation.values); break;
    case "spawn": {
      const enemy = model.spawnEnemy(operation.type, p.x + operation.x, p.y + operation.y);
      Object.assign(enemy, operation.values || {}); model.rebuildEnemyGrid(); break;
    }
    case "obstacles":
      model.obstacles = operation.values.map(rect => ({ ...rect, x: p.x + rect.x, y: p.y + rect.y }));
      model.rebuildObstacleGrid(); model.setupNavigation(); break;
    case "fire": model.fireWeapon(operation.x, operation.y); break;
    case "pause": model.togglePause(); break;
    case "step":
      if (operation.input) model.setInput(operation.input);
      for (let i = 0; i < operation.count; i++) {
        if (operation.system === "weapons") { model.run.elapsed += 1 / 60; model.weaponActions.update(1 / 60); }
        else if (operation.system === "projectiles") model.updateProjectiles(1 / 60);
        else if (operation.system === "enemies") { model.run.elapsed += 1 / 60; model.updateEnemies(1 / 60); }
        else model.tick(1 / 60);
      }
      break;
    case "level": model.checkLevelUp(); break;
    case "settle": model.finishRun(operation.result); break;
    case "station": model.interactives.push({id:"qa-station",type:"tradePost",active:true,x:p.x+80,y:p.y,radius:160,pulse:0}); break;
    case "marketOpen": model.qaObservations.push(model.fieldMarket.open()); break;
    case "marketClose": model.qaObservations.push(model.fieldMarket.close()); break;
    case "marketBuy":
      if (!content.has("fieldGoods", operation.id)) throw new Error(`Invalid field-goods test ID: ${operation.id}`);
      model.qaObservations.push(clone(model.fieldMarket.purchase(operation.id))); break;
    case "arsenalBuy": model.qaObservations.push(model.arsenal.buy(operation.id)); break;
    case "arsenalImprove": model.qaObservations.push(model.arsenal.improve(operation.id)); break;
    case "deploy":
      model.setInput({aimX:90,aimY:0,aimActive:true});
      model.qaObservations.push(model.structures.begin()); model.qaObservations.push(model.structures.confirm()); break;
    case "offsetPlayer": p.x+=operation.x; p.y+=operation.y; break;
    case "recover": model.qaObservations.push(model.structures.recover()); break;
    case "choose": model.qaObservations.push(model.chooseUpgrade(model.run.upgradeOptions[0].id)); break;
    case "salvage": model.qaObservations.push(model.salvageUpgradeOptions()); break;
    case "extraction": Object.assign(model.run.extraction,{active:true,x:p.x,y:p.y,...operation.values}); break;
    case "damagePlayer": model.damagePlayer(operation.amount,p.x+operation.x,p.y+operation.y,operation.source||{}); break;
    case "hitEnemy": model.damageEnemy(model.enemies[operation.index||0],operation.amount,operation.source); break;
    case "mechState": Object.assign(model.run.mechanics,operation.values); break;
    case "pickup": model.spawnPickup(operation.type,p.x+operation.x,p.y+operation.y,operation.value); model.updatePickups(1/60); break;
    case "enemyShot": model.enemyShots.push(model.projectilePool.acquire({id:model.entityId++,x:p.x+operation.x,y:p.y+operation.y,...operation.values})); break;
    case "limits": model.limits={...model.limits,...operation.values}; break;
    case "manyPickups":
      for(let i=0;i<operation.count;i++)model.spawnPickup(operation.types[i%operation.types.length],p.x+i*2,p.y+70,1);break;
    case "restart": model.startRun({seed:88,tutorial:false,...operation.options}); break;
    case "invalidInput": model.setInput({moveX:"2",moveY:Infinity,aimX:NaN,aimY:undefined,firing:1}); break;
    case "poolReset": {
      const pool = operation.pool === "enemy" ? model.enemyPool : operation.pool === "pickup" ? model.pickupPool : model.projectilePool;
      const first = pool.acquire(operation.first); pool.release(first);
      const second = pool.acquire(operation.second); model.qaObservations.push(clone(second)); pool.release(second); break;
    }
    default: throw new Error(`Unknown operation ${operation.kind}`);
  }
}

function make(name, options, operations) {
  const recordedOperations = clone(operations);
  const model = new GameModel(new SaveManager({ get: () => null, set() {} }));
  model.qaObservations=[];
  const initialSave = clone(model.save);
  model.startRun({ seed: 88, tutorial: false, ...options });
  const checkpoints = [{ after: -1, expected: snapshot(model) }];
  for (const [index, operation] of operations.entries()) {
    // Runtime arrays such as turret inventory are consumed by the reference game.
    // Preserve replay inputs instead of serializing the already-mutated objects.
    apply(model, clone(operation));
    if (operation.checkpoint) checkpoints.push({ after: index, expected: snapshot(model) });
  }
  if (!operations.at(-1)?.checkpoint) checkpoints.push({ after: operations.length - 1, expected: snapshot(model) });
  cases.push({ name, options: { seed: 88, tutorial: false, ...options }, initialSave, operations:recordedOperations, checkpoints });
}

const clean = [ { kind: "clean" }, { kind: "settings", values: { autoAim: false, autoFire: false } } ];
const targets = [60, 100, 170, 240, 310, 380].map(x => ({kind:"spawn", type:"brute", x, y:-22, values:{hp:10000,maxHp:10000}}));
for (const id of content.ids("weapons")) {
  make(`${id}:attack-and-collision`, {weaponId:id}, [...clean, ...targets,
    {kind:"fire",x:1,y:0,checkpoint:true}, {kind:"step",system:"weapons",count:14,checkpoint:true},
    {kind:"step",system:"weapons",count:36}, {kind:"step",system:"projectiles",count:100,checkpoint:true}]);
  make(`${id}:fixed-step-movement`, {weaponId:id}, [{kind:"clean"},
    {kind:"player",values:{hp:10000,maxHp:10000}},
    ...["drifter","runner","crawler","spitter","brute","screecher"].map((type,index)=>({kind:"spawn",type,x:220+index*45,y:(index%2?1:-1)*100})),
    {kind:"step",count:1,input:{moveX:1,moveY:0},checkpoint:true},
    {kind:"step",count:59,checkpoint:true}, {kind:"step",count:120,input:{moveX:0,moveY:1},checkpoint:true}]);
}
for (const id of ["prism_laser","slag_launcher","saw_disc","echo_blade","shock_hammer"]) {
  make(`${id}:solid-cover`, {weaponId:id}, [...clean,...targets,
    {kind:"obstacles",values:[{x:35,y:-100,w:6,h:200}]},
    {kind:"fire",x:1,y:0}, {kind:"step",system:"weapons",count:45},
    {kind:"step",system:"projectiles",count:100,checkpoint:true}]);
}
for (const type of content.ids("enemies")) {
  make(`${type}:role-and-boss-ai`, {}, [...clean,{kind:"player",values:{hp:10000,maxHp:10000}},
    {kind:"spawn",type,x:240,y:-40}, {kind:"step",system:"enemies",count:180,checkpoint:true}]);
}
for (const mapId of content.ids("maps")) for (const elapsed of [0,140,200,600]) {
  make(`${mapId}:survival-at-${elapsed}`, {mapId}, [
    {kind:"player",values:{hp:10000,maxHp:10000}}, {kind:"run",values:{elapsed}},
    {kind:"step",count:1,input:{moveX:1,moveY:0},checkpoint:true},
    {kind:"step",count:179,checkpoint:true}]);
}
for (const id of ["scrap_pistol","echo_blade","shock_hammer"]) {
  make(`${id}:upgrade-draft`, {weaponId:id}, [...clean,{kind:"player",values:{xp:100}},
    {kind:"level",checkpoint:true},{kind:"choose",checkpoint:true}]);
}
make("pause-stops-timing", {}, [...clean,{kind:"pause"},{kind:"step",count:60,checkpoint:true},
  {kind:"pause"},{kind:"step",count:1,checkpoint:true}]);
make("empty-retirement", {}, [...clean,{kind:"settle",result:"retire",checkpoint:true}]);
make("combat-retirement", {}, [...clean,...targets,{kind:"fire",x:1,y:0},
  {kind:"step",count:61},{kind:"settle",result:"retire",checkpoint:true}]);
make("field-market-and-all-weapons", {}, [...clean,{kind:"station"},
  {kind:"run",values:{scrap:1000}},{kind:"player",values:{hp:25,maxHp:100}},
  {kind:"marketOpen",checkpoint:true},
  ...["fieldMedkit","weaponCalibration","turretKit","engineeringKit"].map(id=>({kind:"marketBuy",id,checkpoint:true})),
  ...content.ids("weapons").filter(id=>id!=="scrap_pistol").flatMap(id=>[
    {kind:"arsenalBuy",id,checkpoint:true},{kind:"arsenalImprove",id,checkpoint:true}]),
  {kind:"marketClose"},{kind:"step",count:2,checkpoint:true}]);
make("turret-fire-and-recovery", {}, [...clean,{kind:"run",values:{turretKits:1,turretKitHealth:[.55]}},
  {kind:"deploy",checkpoint:true},{kind:"spawn",type:"brute",x:310,y:-20,values:{hp:10000,maxHp:10000}},
  {kind:"step",count:100,checkpoint:true},{kind:"offsetPlayer",x:60,y:0},{kind:"recover",checkpoint:true}]);
for(const ratio of [.65,.25]) for(const type of ["iron_colossus","warden"]){
  const hp=content.enemies[type].hp*ratio;
  make(`${type}:phase-${ratio}`,{},[...clean,{kind:"spawn",type,x:240,y:-40,values:{hp}},
    {kind:"step",system:"enemies",count:90,checkpoint:true}]);
}
make("field-market-failure-states", {}, [...clean,{kind:"station"},{kind:"marketOpen"},
  {kind:"marketBuy",id:"fieldMedkit",checkpoint:true},
  {kind:"player",values:{hp:20}},{kind:"marketBuy",id:"fieldMedkit",checkpoint:true},
  {kind:"run",values:{scrap:1000}},{kind:"marketBuy",id:"fieldMedkit",checkpoint:true},
  {kind:"marketBuy",id:"fieldMedkit",checkpoint:true},
  {kind:"run",values:{elapsed:31}},{kind:"marketBuy",id:"fieldMedkit",checkpoint:true},
  {kind:"player",values:{armor:.55,speed:360,pickupRadius:440}},
  ...["ballisticLining","runnerStrap","salvageMagnet"].map(id=>({kind:"marketBuy",id,checkpoint:true})),
  {kind:"run",values:{turretKits:4}},{kind:"marketBuy",id:"turretKit",checkpoint:true},
  {kind:"marketClose"},{kind:"marketBuy",id:"weaponCalibration",checkpoint:true}]);
make("turret-engineering-and-destruction", {}, [...clean,{kind:"run",values:{turretKits:1,turretKitHealth:[.5],engineering:2,turretRegen:2}},
  {kind:"deploy"},{kind:"step",count:600,checkpoint:true}]);
for(const modeId of ["survival","extraction"]){
  make(`${modeId}:legacy-start-and-finish`,{modeId,duration:20},[...clean,
    {kind:"run",values:{elapsed:19.99}},
    ...(modeId==="extraction"?[{kind:"extraction",values:{hold:2.49}}]:[]),
    {kind:"step",count:2,checkpoint:true}]);
}
make("extraction:hold-decays-and-overtime-loss",{modeId:"extraction",duration:20},[...clean,
  {kind:"run",values:{elapsed:19.99,overtime:14.99}},
  {kind:"extraction",values:{hold:1}},{kind:"offsetPlayer",x:100,y:0},{kind:"step",count:2,checkpoint:true}]);
for(const id of content.ids("weapons")){
  make(`${id}:mechanic-upgrade-synergies`,{weaponId:id},[...clean,
    {kind:"player",values:{noHitTime:5,criticalChance:1}},
    {kind:"run",values:{mechanicUpgrades:{pointBlankRelay:2,focusProtocol:2,salvageOverdrive:2,executionCapacitor:2,cascadeRounds:2,reactivePlating:2}}},
    {kind:"mechState",values:{overdriveTime:5,chargedShots:2}},
    {kind:"spawn",type:"drifter",x:60,y:-20},{kind:"spawn",type:"drifter",x:85,y:-20},
    {kind:"fire",x:1,y:0},{kind:"step",system:"weapons",count:30},
    {kind:"step",system:"projectiles",count:30,checkpoint:true},
    {kind:"damagePlayer",amount:10,x:-20,y:0,source:{type:"spitter"},checkpoint:true}]);
}
for(const id of ["echo_blade","shock_hammer"]){
  make(`${id}:active-window-deflection`,{weaponId:id},[...clean,{kind:"fire",x:1,y:0},
    {kind:"step",system:"weapons",count:id==="echo_blade"?11:16},
    {kind:"enemyShot",x:150,y:-12,values:{vx:-15000,vy:0,radius:4,ttl:1,damage:50,owner:"enemy",knockback:0}},
    {kind:"step",system:"projectiles",count:1,checkpoint:true}]);
}
make("loss-advice-and-source-priority",{},[...clean,
  {kind:"run",values:{elapsed:61,projectilesFired:30,hits:6,damageTaken:50,damageTakenBySource:{spitter:25,runner:25}}},
  {kind:"settle",result:"lose",checkpoint:true}]);
make("loss-advice-unknown",{},[...clean,{kind:"damagePlayer",amount:10000,x:0,y:0,checkpoint:true}]);
make("pickup-capacity-and-restart",{},[...clean,{kind:"limits",values:{pickups:16}},
  {kind:"manyPickups",count:20,types:["xp","scrap"],checkpoint:true},
  {kind:"restart"},{kind:"clean"},{kind:"manyPickups",count:20,types:["scrap","xp"],checkpoint:true}]);
make("finite-input-and-clamping",{},[...clean,{kind:"step",count:1,input:{moveX:2,moveY:-2,aimX:3,aimY:4},checkpoint:true},
  {kind:"invalidInput",checkpoint:true}]);
make("numeric-duration-coercion",{duration:"20"},[...clean,{kind:"step",count:1,checkpoint:true}]);
make("payload-reset-after-reuse",{},[...clean,
  {kind:"poolReset",pool:"projectile",first:{id:10,x:1,y:2,vx:0,vy:0,radius:3,ttl:.2,damage:5,pierce:0,knockback:1,owner:"player",weaponId:"slag_launcher",critical:true,attackKind:"explosive",bounces:2,blastRadius:90,sourceType:"spitter",attackId:7,empowered:true},
    second:{id:11,x:3,y:4,vx:1,vy:0,radius:3,ttl:1,damage:3,pierce:0,knockback:1,color:"#fff",owner:"player",weaponId:"scrap_pistol",critical:false,hitX:5,hitY:6},checkpoint:true},
  {kind:"poolReset",pool:"enemy",first:{id:12,type:"runner",x:3,y:4,hp:20,maxHp:20,speed:2,damage:2,radius:3,xp:1,scrapChance:0,color:"#fff",role:"runner"},
    second:{id:13,type:"drifter",x:4,y:5,hp:10,maxHp:10,speed:1,damage:1,radius:2,xp:1,scrapChance:0,color:"#fff",role:"chaser",vx:22,vy:22,hitFlash:5,hitCooldown:5,knockbackVX:33},checkpoint:true},
  {kind:"poolReset",pool:"pickup",first:{id:14,type:"scrap",x:2,y:3,value:2,radius:5},second:{id:15,type:"xp",x:3,y:4,value:3,radius:5,age:99},checkpoint:true}]);
make("grenade-to-gun-reuses-payload",{weaponId:"slag_launcher"},[...clean,
  {kind:"fire",x:1,y:0},{kind:"step",system:"projectiles",count:100},{kind:"station"},
  {kind:"run",values:{scrap:1000}},{kind:"marketOpen"},{kind:"arsenalBuy",id:"scrap_pistol"},
  {kind:"marketClose"},{kind:"fire",x:1,y:0,checkpoint:true}]);

fs.writeFileSync(target, JSON.stringify({version:1,cases})+"\n");
console.log(JSON.stringify({cases:cases.length,checkpoints:cases.reduce((sum,c)=>sum+c.checkpoints.length,0),
  bytes:fs.statSync(target).size}));
