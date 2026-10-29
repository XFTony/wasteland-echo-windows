'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const data=require('../art/characters/ranger/compact-arsenal-v2/metadata.json');
const {WEAPONS}=require('../src/config');
const M=require('../scripts/animation/compact-ranger-motion');
const create=options=>M.createState({x:300,y:300,weapons:data.weapons,autoCombat:true,...options});
const run=(s,count=60,input={})=>{for(let i=0;i<count;i++)M.step(s,input,1/60);return s;};

test('compact arsenal covers exactly the existing seven weapons without changing their base combat data',()=>{
 assert.deepEqual(data.weapons.map(w=>w.id).sort(),Object.values(WEAPONS).filter(w=>!w.attackType).map(w=>w.id).sort());
 for(const w of data.weapons)for(const key of ['damage','interval','projectileCount','projectileSpeed','spread','ttl','pierce','lockRange','color'])assert.equal(w[key],WEAPONS[w.id][key],`${w.id}.${key}`);
});
test('automatic combat ignores cursor/fire input and aims at a nearby living target',()=>{
 const s=create({targets:[{id:'left',x:190,y:300,hp:10000},{id:'right',x:460,y:300,hp:10000}]});
 run(s,45,{targetX:900,targetY:300,firing:false});
 assert.equal(s.aimTargetId,'left');assert(s.shotsFired>0);assert(s.lastShot.aimX<0);
});
test('empty, dead, inactive and out-of-range targets cannot trigger automatic fire',()=>{
 for(const kind of ['empty','dead','inactive','range']){
  const s=create({targets:kind==='empty'?[]:[{id:1,x:400,y:300,hp:100}]});
  if(kind==='dead')s.targets[0].hp=0;if(kind==='inactive')s.targets[0].active=false;if(kind==='range')s.targets[0].x=300+s.config.lockRange+1;
  run(s,90,{firing:true});assert.equal(s.shotsFired,0,kind);assert.equal(s.aimTargetId,null,kind);
 }
});
test('automatic target selection rejects cover and switches immediately when a target dies or leaves range',()=>{
 const s=create({world:{width:1200,height:800,boxes:[{x:350,y:275,w:30,h:50}]},targets:[{id:'blocked',x:430,y:300,hp:10000},{id:'open',x:300,y:440,hp:10000},{id:'next',x:200,y:470,hp:10000}]});
 run(s,10);assert.equal(s.aimTargetId,'open');s.targets[1].hp=0;M.step(s,{},1/60);assert.equal(s.aimTargetId,'next');
 s.targets[2].x=1100;M.step(s,{},1/60);assert.equal(s.aimTargetId,null);
});
test('close target ties retain their lock until the competing target is meaningfully closer',()=>{
 const s=create({targets:[{id:'a',x:400,y:300,hp:10000},{id:'b',x:410,y:300,hp:10000}]});
 M.step(s,{},1/60);assert.equal(s.aimTargetId,'a');s.targets[1].x=395;M.step(s,{},1/60);assert.equal(s.aimTargetId,'a');
 s.targets[1].x=370;M.step(s,{},1/60);assert.equal(s.aimTargetId,'b');
});
test('every weapon emits its configured pellet count and shotgun keeps its fan spread',()=>{
 for(const w of data.weapons){
  const s=create({weaponId:w.id,targets:[{id:1,x:500,y:300,hp:10000}]});s.fireCooldown=0;M.step(s,{},1/60);
  assert.equal(s.bullets.length,w.projectileCount,w.id);assert.equal(s.config.shotInterval,w.interval);
  for(const b of s.bullets){assert.equal(b.damage,w.damage);assert.equal(b.pierce,w.pierce);assert.equal(b.weaponId,w.id);}
  if(w.projectileCount>1){const a=s.bullets.map(b=>Math.atan2(b.vy,b.vx));assert(Math.abs((a.at(-1)-a[0])*180/Math.PI-w.spread)<1e-8);}
 }
});
test('point-blank targets inside the visible barrel reach can still be hit by all seven guns',()=>{
 for(const w of data.weapons){const s=create({weaponId:w.id,targets:[{id:1,x:310,y:268,radius:6,hp:10000}]});s.fireCooldown=0;M.step(s,{},1/60);M.step(s,{},1/60);assert(s.targets[0].hp<10000,w.id);}
});
test('weapon changes preserve movement phase and active bullets keep their own source/color',()=>{
 const s=create({targets:[{id:1,x:500,y:300,hp:10000}]});s.fireCooldown=0;M.step(s,{moveX:1},1/60);
 const phase=s.phase,bullet=s.bullets[0];M.setWeapon(s,'coil_cannon');assert.equal(s.phase,phase);assert.equal(bullet.weaponId,'scrap_pistol');assert.equal(bullet.color,WEAPONS.scrap_pistol.color);
 assert.equal(s.config.weapon.width,data.weapons.find(w=>w.id==='coil_cannon').rig.width);
});
test('piercing shots hit each target once and stop at a wall before the next target',()=>{
 const s=create({autoCombat:false,weaponId:'needle_rifle',world:{width:1200,height:800,boxes:[{x:575,y:230,w:10,h:80}]},targets:[{id:1,x:500,y:268,hp:120},{id:2,x:550,y:268,hp:120},{id:3,x:640,y:268,hp:120}]});
 s.fireCooldown=0;M.step(s,{firing:true,angle:0},1/60);run(s,40);assert.equal(s.targets[0].hp,92);assert.equal(s.targets[1].hp,92);assert.equal(s.targets[2].hp,120);assert.equal(s.hits,2);
});
test('a thin wall between actor and muzzle cannot be bypassed by a long gun spawn',()=>{
 const s=create({autoCombat:false,weaponId:'needle_rifle',world:{boxes:[{x:330,y:250,w:8,h:45}]},targets:[{id:1,x:440,y:268,hp:120}]});s.fireCooldown=0;M.step(s,{firing:true,angle:0},1/60);run(s,30);assert.equal(s.targets[0].hp,120);assert.equal(s.bullets.length,0);
});
