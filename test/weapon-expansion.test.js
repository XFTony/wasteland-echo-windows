"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {GameModel}=require("../src/core/game-model"),{SaveManager}=require("../src/core/save");
const {NEW_WEAPONS,NATIVE_WEAPONS}=require("../src/content/weapon-expansion");
const {sectorContains,segmentSectorTime,targetRange}=require("../src/core/weapon-geometry");
const {weaponModifiers}=require("../src/core/arsenal");
const Grip=require("../src/shared/modular-grip-compositor"),{MATERIALS}=require("../src/content/active-compact-actors");
const {compactShotPose}=require("../src/core/compact-weapon-pose");
function setup(id){const m=new GameModel(new SaveManager({get:()=>null,set(){}}));m.startRun({weaponId:id,seed:88,tutorial:false});m.releaseAllEntities();m.obstacles=[];m.interactives=[];m.rebuildObstacleGrid();m.navigationCache.clear();m.setupNavigation();m.updateSpawner=()=>{};m.save.settings.autoFire=false;m.save.settings.autoAim=false;return m;}
function enemy(m,x,y=0){const p=m.run.player,e=m.spawnEnemy("brute",p.x+x,p.y+y);e.hp=e.maxHp=10000;return e;}
function advance(m,seconds){for(let i=0;i<Math.ceil(seconds*60);i++){m.run.elapsed+=1/60;m.weaponActions.update(1/60);}}

test("all five new weapons have original pixel parts and independent valid hand/cuff layouts",()=>{
  assert.equal(Object.keys(NEW_WEAPONS).length,5);
  for(const [id,spec]of Object.entries(NATIVE_WEAPONS)){
    assert(spec.shapes.length>=16);for(const[x,y,w,h]of spec.shapes)assert(x>=0&&y>=0&&x+w<=spec.width&&y+h<=spec.height,id);
    const layout=Grip.layout(MATERIALS,id,MATERIALS.defaultHands,MATERIALS.defaultCuffs);assert(layout.width<=96&&layout.height<=64);
    assert(layout.layers.every(p=>p.asset.startsWith("hands.")||p.asset.startsWith("cuffs.")));
    const m=setup(id);for(let i=0;i<8;i++){const a=i*Math.PI/4,pose=compactShotPose(m.run.player,Math.cos(a),Math.sin(a));assert(Number.isFinite(pose.muzzleX)&&Number.isFinite(pose.muzzleY));}
  }
});
test("beam hits immediately, obeys penetration count and ends before the next target",()=>{
  const m=setup("prism_laser"),p=m.run.player,targets=[100,170,240,310,380].map(x=>enemy(m,x,-22));
  m.fireWeapon(1,0);assert.equal(m.projectiles.length,0);assert.equal(targets.filter(e=>e.hp<e.maxHp).length,4);
  assert.equal(targets[4].hp,10000);const fx=m.run.attackEffects.find(f=>f.active);assert(fx.endX<targets[4].x);assert.equal(m.run.weaponStats.prism_laser.damage,88);
});
test("beam cannot bypass thin cover between the body and the visible muzzle",()=>{
  const m=setup("prism_laser"),p=m.run.player,e=enemy(m,120,-22);m.obstacles=[{x:p.x+18,y:p.y-80,w:3,h:130}];
  m.fireWeapon(1,0);assert.equal(e.hp,10000);const fx=m.run.attackEffects.find(f=>f.active);assert(fx.endX<=p.x+21);
});
test("beam split and range remain bounded with extreme upgrades",()=>{
  const m=setup("prism_laser"),p=m.run.player;p.projectileBonus=100;p.projectileRangeMultiplier=100;
  m.fireWeapon(1,0);assert.equal(m.run.projectilesFired,3);assert.equal(m.run.attackEffects.filter(f=>f.active).length,3);assert(targetRange(NEW_WEAPONS.prism_laser,p)<=1100);
});
test("grenades damage groups with falloff and cannot explode through walls",()=>{
  const m=setup("slag_launcher"),p=m.run.player,a=enemy(m,100),b=enemy(m,145),blocked=enemy(m,110,70);
  m.obstacles=[{x:p.x+70,y:p.y+30,w:100,h:6}];
  m.weaponActions.detonate({damage:38,blastRadius:90,vx:1,vy:0,knockback:60,owner:"player",weaponId:"slag_launcher",attackId:1},a.x,a.y);
  assert.equal(a.hp,9962);assert(b.hp>a.hp&&b.hp<10000);assert.equal(blocked.hp,10000);assert.equal(m.run.explosions,1);assert.equal(p.hp,p.maxHp);
});
test("a grenade's last lifetime segment and fuse detonate exactly once",()=>{
  const m=setup("slag_launcher"),p=m.run.player,e=enemy(m,24);const shot=m.projectilePool.acquire({id:100,x:e.x,y:e.y,vx:0,vy:0,radius:5,ttl:.001,damage:38,pierce:0,owner:"player",weaponId:"slag_launcher",attackKind:"explosive",blastRadius:90});m.projectiles.push(shot);m.rebuildEnemyGrid();m.updateProjectiles(1/60);
  assert.equal(shot.active,false);assert.equal(m.run.explosions,1);m.updateProjectiles(1/60);assert.equal(m.run.explosions,1);assert(e.hp<10000);
});
test("discs bounce to new visible enemies, decay and never damage the same one twice",()=>{
  const m=setup("saw_disc"),p=m.run.player,a=enemy(m,100,-21),b=enemy(m,170,60),c=enemy(m,210,-50);
  m.fireWeapon(1,0);m.rebuildEnemyGrid();for(let i=0;i<100;i++)m.updateProjectiles(1/60);
  const damages=[10000-a.hp,10000-b.hp,10000-c.hp].sort((a,b)=>b-a);assert(Math.abs(damages[0]-16)<1e-8);assert(Math.abs(damages[1]-16*.78)<1e-8);assert(Math.abs(damages[2]-16*.78*.78)<1e-8);
});
test("disc bounces do not select an enemy across solid cover",()=>{
  const m=setup("saw_disc"),p=m.run.player,a=enemy(m,100),b=enemy(m,200);m.obstacles=[{x:p.x+150,y:p.y-100,w:6,h:200}];
  assert.equal(m.weaponActions.bounce({weaponId:"saw_disc",bounces:2,hitIds:new Set([a.id]),vx:430,vy:0},a),false);
});
test("swept sector geometry accepts grazing circles and rejects targets behind the actor",()=>{
  assert(sectorContains(0,0,80,0,Math.PI/2,{x:78,y:6,radius:8}));assert(!sectorContains(0,0,80,0,Math.PI/2,{x:-50,y:0,radius:8}));
  assert(Number.isFinite(segmentSectorTime(140,0,-220,0,0,0,80,0,Math.PI/2,4)));
  assert.equal(segmentSectorTime(-140,0,40,0,0,0,80,0,Math.PI/2,4),Infinity);
});
test("blade damage happens in the swing window, with one hit per target and a separate sword wave",()=>{
  const m=setup("echo_blade"),p=m.run.player,a=enemy(m,60,-12),behind=enemy(m,-60,-12);m.fireWeapon(1,0);
  advance(m,.05);assert.equal(a.hp,10000);assert.equal(m.run.meleeHits,0);
  advance(m,.20);assert.equal(a.hp,9976);assert.equal(behind.hp,10000);assert.equal(m.run.meleeHits,1);assert.equal(m.projectiles.filter(p=>p.attackKind==="swordWave").length,1);
  advance(m,.30);assert.equal(a.hp,9976);assert.equal(m.run.attack,null);
});
test("blade and hammer attacks cannot damage an enemy through a wall",()=>{
  for(const id of ["echo_blade","shock_hammer"]){const m=setup(id),p=m.run.player,e=enemy(m,65,-12);m.obstacles=[{x:p.x+35,y:p.y-100,w:6,h:200}];m.fireWeapon(1,0);advance(m,.7);assert.equal(e.hp,10000,id);}
});
test("hammer front-loads no damage and creates one expanding ground impact",()=>{
  const m=setup("shock_hammer"),p=m.run.player,a=enemy(m,75),far=enemy(m,160);m.fireWeapon(1,0);
  advance(m,.18);assert.equal(a.hp,10000);advance(m,.25);assert.equal(a.hp,9954);assert.equal(far.hp,10000);
  assert.equal(m.drainEvents().filter(e=>e.type==="weaponImpact"&&e.kind==="slam").length,1);advance(m,.4);assert.equal(a.hp,9954);
});
test("melee has no passive shield: deflection only occurs inside the visible effective sweep",()=>{
  const m=setup("echo_blade"),p=m.run.player; m.fireWeapon(1,0);
  const shot={radius:4};assert.equal(m.weaponActions.blockTime(shot,p.x+160,p.y-12,-200,0),Infinity);
  advance(m,.18);assert(Number.isFinite(m.weaponActions.blockTime(shot,p.x+160,p.y-12,-200,0)));
  advance(m,.2);assert.equal(m.weaponActions.blockTime(shot,p.x+160,p.y-12,-200,0),Infinity);
});
test("a fast enemy bullet intersects the active blade before reaching the player",()=>{
  const m=setup("echo_blade"),p=m.run.player;m.fireWeapon(1,0);advance(m,.18);const hp=p.hp;
  m.enemyShots.push(m.projectilePool.acquire({id:999,x:p.x+150,y:p.y-12,vx:-15000,vy:0,radius:4,ttl:1,damage:50,owner:"enemy"}));m.updateProjectiles(1/60);assert.equal(p.hp,hp);assert.equal(m.enemyShots[0].active,false);
});
test("melee timing and movement survive pause, and switching cancels an unfinished swing",()=>{
  const m=setup("echo_blade"),p=m.run.player;m.fireWeapon(1,0);m.togglePause();const age=m.run.elapsed;for(let i=0;i<60;i++)m.tick(1/60);assert.equal(m.run.elapsed,age);
  m.togglePause();m.setInput({moveX:1,moveY:0});const x=p.x;m.tick(1/60);assert(p.x>x);assert(m.run.attack);
  const station=m.mapLayout.interactives.find(i=>i.type==="tradePost");m.interactives=[{...station,active:true}];Object.assign(p,{x:station.x,y:station.y+20});assert(m.fieldMarket.open());assert.equal(m.run.attack,null);
  m.run.scrap=1000;assert(m.arsenal.buy("shock_hammer"));assert.equal(weaponModifiers(m.run).damage,1);
});
test("melee upgrade choices include reach and exclude pure bullet upgrades",()=>{
  const m=setup("echo_blade");for(const id of ["projectile","pierce","velocity","caliber"])assert(!m.upgradeRequirementsMet(m.content.upgrades[id]));assert(m.upgradeRequirementsMet(m.content.upgrades.meleeReach));
  m.run.player.weaponId="shock_hammer";assert(m.upgradeRequirementsMet(m.content.upgrades.blastRadius));
});
test("new projectile payload fields reset when pooled into an ordinary bullet",()=>{
  const m=setup("slag_launcher");const a=m.projectilePool.acquire({attackKind:"explosive",blastRadius:90,bounces:3});m.projectilePool.release(a);const b=m.projectilePool.acquire({owner:"player",ttl:1});assert.equal(b.attackKind,null);assert.equal(b.blastRadius,0);assert.equal(b.bounces,0);
});

test("beam follows the muzzle ray and tests the barrel separately without double hits",()=>{
  const m=setup("prism_laser"),p=m.run.player,actual=enemy(m,110,-20),phantom=enemy(m,90,-90/7),close=enemy(m,35,-17.5);
  actual.radius=phantom.radius=close.radius=.1;
  const source=m.weaponActions.source(NEW_WEAPONS.prism_laser,1,1,0,22,false);
  m.weaponActions.traceBeam(p,{x:p.x+40,y:p.y-20},1,0,100,source,4,2);
  assert.equal(actual.hp,9978);assert.equal(phantom.hp,10000);assert.equal(close.hp,9978);
  assert.equal(m.run.hits,2);
});

test("laser and melee can ignite barrels in their effective range but never across walls",()=>{
  for(const id of ["prism_laser","echo_blade","shock_hammer"])for(const blocked of [false,true]){
    const m=setup(id),p=m.run.player,item={id:"test-barrel",type:"explosiveBarrel",active:true,x:p.x+55,y:p.y-12,radius:8,effectRadius:20,damage:10};
    if(id==="prism_laser")item.y=compactShotPose(p,1,0).muzzleY;
    m.interactives=[item];if(blocked)m.obstacles=[{x:p.x+30,y:p.y-90,w:5,h:180}];
    m.fireWeapon(1,0);advance(m,.6);assert.equal(item.active,blocked,`${id}, wall=${blocked}`);
    assert.equal(m.drainEvents().filter(e=>e.type==="environment"&&e.action==="explode").length,blocked?0:1);
  }
});

test("barrel explosion respects cover after being ignited by a new weapon",()=>{
  const m=setup("prism_laser"),p=m.run.player,e=enemy(m,140,-21),item={id:"barrel",type:"explosiveBarrel",active:true,x:p.x+75,y:p.y-21,radius:10,effectRadius:120,damage:60};
  m.interactives=[item];m.obstacles=[{x:p.x+105,y:p.y-90,w:5,h:180}];m.fireWeapon(1,0);
  assert.equal(item.active,false);assert.equal(e.hp,10000);
});

test("cancelled melee cannot send a delayed wave or damage after a weapon switch",()=>{
  const m=setup("echo_blade");m.fireWeapon(1,0);m.run.attack=null;m.run.player.weaponId="scrap_pistol";
  const e=enemy(m,60,-12);advance(m,1);assert.equal(e.hp,10000);assert.equal(m.projectiles.length,0);
});

test("casing families differ, rebound only once, and freeze when paused",()=>{
  const {initializeFx,FX_METHODS}=require("../src/render/fx-system"),{casingFor}=require("../src/render/weapon-feedback");
  const m=setup("scrap_pistol"),r={...FX_METHODS,frame:0};initializeFx(r);
  assert.notDeepEqual(casingFor("scrap_pistol"),casingFor("breaker_shotgun"));
  assert.notDeepEqual(casingFor("needle_rifle"),casingFor("slag_launcher"));
  r.spawnShell(10,20,m.content.weapons.breaker_shotgun,1,0);const shell=r.shells[0];
  for(let i=0;i<96;i++)r.updateEffects(1/120,m);
  assert(shell.bounced);assert.equal(shell.z,0);assert.equal(shell.vz,0);
  const snapshot={...shell};m.screen="paused";r.updateEffects(.5,m);assert.deepEqual(shell,snapshot);
});
