'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../art/characters/ranger/modular-grips-v3/metadata.json');
const G=require('../scripts/animation/modular-grip-compositor'),M=require('../scripts/animation/compact-ranger-motion');
const clone=x=>JSON.parse(JSON.stringify(x));
function setup(data=D,limit=8){
 const textures=Object.fromEntries(Object.entries(data.assets).map(([id,a])=>[id,{width:a.width,height:a.height}]));
 const cache=G.createCache(data,textures,{limit,canvasFactory:(width,height)=>({width,height,getContext:()=>({clearRect(){},drawImage(){}})})});
 return {cache,textures};
}
test('weapon geometry and character holding offsets have separate owners',()=>{
 for(const w of D.weapons){assert.equal(w.visual.chestY,undefined);assert(w.visual.primaryGrip&&w.visual.supportGrip);assert(D.characters[D.defaultCharacter].holdByWeapon[w.id]);}
 const original=require('../art/characters/ranger/compact-arsenal-v2/metadata.json');
 for(const w of G.definitionsForCharacter(D)){const old=original.weapons.find(o=>o.id===w.id);assert.deepEqual(w.rig,old.rig);}
});
test('same appearance reuses one cached image across repeated pose/angle changes',()=>{
 const {cache}=setup(),id=D.weapons[0].id,first=cache.get(id);
 for(let i=0;i<300;i++)assert.strictEqual(cache.get(id),first);
 assert.equal(cache.info().builds,1);assert.equal(cache.info().hits,300);
});
test('plated hand templates have larger native geometry, not only different colors',()=>{
 for(const [family,id]of [['pistol','scrap_pistol'],['longgun','needle_rifle'],['heavy','coil_cannon']]){
  if(!D.weapons.some(w=>w.id===id))continue;
  const old=D.handSets['ranger-cloth'].overrides[id].primary[0];
  const next=D.handSets['plated-test'].poses[family].primary;
  assert(next.some(p=>p.depth==='back')&&next.some(p=>p.depth==='front'));
  assert(next[0].rect[2]>old.rect[2]&&next[0].rect[3]>old.rect[3]);
 }
});
test('changing cuffs does not alter which hand source/pose is selected',()=>{
 const id=D.weapons[0].id,a=G.layout(D,id,'plated-test','ranger-coat'),b=G.layout(D,id,'plated-test','steel-test');
 assert.deepEqual(a.layers.filter(p=>p.kind==='hand'),b.layers.filter(p=>p.kind==='hand'));
 assert.equal(a.weapon.visual.asset,b.weapon.visual.asset);
});
test('appearance changes preserve live walk, cooldown, target and muzzle coordinates',()=>{
 const {cache}=setup();
 for(const w of D.weapons){
  const s=M.createState({x:400,y:330,weapons:G.definitionsForCharacter(D),weaponId:w.id,body:D.characters[D.defaultCharacter].body,angle:-1.1});
  s.phase=.37;s.fireCooldown=.17;s.aimTargetId='alive';s.recoil=.8;
  const before=M.pose(s).weapon;
  cache.apply(s,w.id,'plated-test','steel-test');const after=M.pose(s).weapon;
  assert.equal(s.phase,.37);assert.equal(s.fireCooldown,.17);assert.equal(s.aimTargetId,'alive');
  assert(Math.abs(before.muzzleX-after.muzzleX)<1e-8);assert(Math.abs(before.muzzleY-after.muzzleY)<1e-8);
 }
});
test('expanded left/top bounds adjust both pivot and muzzle without changing their vector',()=>{
 const data=clone(D),w=data.weapons[0],part=data.handSets['ranger-cloth'].overrides[w.id].primary[0];
 part.anchor=[w.visual.primaryGrip[0]+4,w.visual.primaryGrip[1]+3];
 const l=G.layout(data,w.id,'ranger-cloth','ranger-coat');
 assert(l.origin[0]<=-4&&l.origin[1]<=-3);
 assert.equal(l.muzzle[0]-l.pivot[0],w.visual.muzzle[0]-w.visual.pivot[0]);
 assert.equal(l.muzzle[1]-l.pivot[1],w.visual.muzzle[1]-w.visual.pivot[1]);
 const {cache}=setup(data);assert(cache.get(w.id).width>w.visual.width);
});
test('bounded cache evicts old entries without destroying a still-referenced image',()=>{
 const {cache}=setup(D,1),first=cache.get(D.weapons[0].id),width=first.image.width;
 cache.get(D.weapons[0].id,'plated-test','steel-test');assert.equal(cache.info().entries,1);assert.equal(cache.info().evictions,1);assert.equal(first.image.width,width);
});
test('appearance version changes invalidate the cached grip',()=>{
 const data=clone(D),{cache}=setup(data),a=cache.get(data.weapons[0].id);
 data.handSets['ranger-cloth'].version+='updated';const b=cache.get(data.weapons[0].id);
 assert.notStrictEqual(a,b);assert.equal(cache.info().builds,2);
});
test('different character holding offsets can reuse the same visual composition',()=>{
 const data=clone(D),other=clone(data.characters[data.defaultCharacter]);other.id='rig-test';
 for(const hold of Object.values(other.holdByWeapon))hold.chestY+=4;data.characters[other.id]=other;
 const {cache}=setup(data),wid=data.weapons[0].id,s=M.createState({weapons:G.definitionsForCharacter(data),weaponId:wid});
 const before=cache.apply(s,wid,data.defaultHands,data.defaultCuffs),y=M.pose(s).weapon.anchorY;
 const after=cache.apply(s,wid,data.defaultHands,data.defaultCuffs,other.id);
 assert.strictEqual(before,after);assert.equal(M.pose(s).weapon.anchorY-y,4*s.pixelScale);
});
test('unknown or missing hand poses fail explicitly instead of falling back to old gloves',()=>{
 const {cache}=setup();assert.throws(()=>cache.get(D.weapons[0].id,'missing','ranger-coat'),/Unknown/);
 const data=clone(D);delete data.handSets['ranger-cloth'].overrides[data.weapons[0].id];
 delete data.handSets['ranger-cloth'].poses[data.weapons[0].visual.family];
 assert.throws(()=>setup(data).cache.get(data.weapons[0].id),/Missing grip pose/);
});

test('a future weapon can use the selected hand/cuff family without copying combined gun art',()=>{
 const data=clone(D),newWeapon=clone(data.weapons[0]);newWeapon.id='future-prop';newWeapon.version='future1';data.weapons.push(newWeapon);
 const {cache}=setup(data),entry=cache.get(newWeapon.id);
 assert.equal(entry.handId,data.defaultHands);assert(entry.image.width>0);
 assert(G.definitionsForCharacter(data).some(w=>w.id==='future-prop'));
});

test('a new character resolves its own default hands and cuffs instead of inheriting the ranger gloves',()=>{
 const data=clone(D),other=clone(data.characters[data.defaultCharacter]);other.id='other-rig';other.defaultHands='plated-test';other.defaultCuffs='steel-test';data.characters[other.id]=other;
 const {cache}=setup(data),wid=data.weapons[0].id,s=M.createState({weapons:G.definitionsForCharacter(data,other.id),weaponId:wid});
 const entry=cache.apply(s,wid,undefined,undefined,other.id);
 assert.equal(entry.handId,'plated-test');assert.equal(entry.cuffId,'steel-test');
});

test('a character with no hand binding cannot silently inherit the default ranger gloves',()=>{
 const data=clone(D),other=clone(data.characters[data.defaultCharacter]);other.id='unbound-rig';delete other.defaultHands;data.characters[other.id]=other;
 const {cache}=setup(data),wid=data.weapons[0].id,s=M.createState({weapons:G.definitionsForCharacter(data,other.id),weaponId:wid});
 assert.throws(()=>cache.apply(s,wid,undefined,undefined,other.id),/explicit hand\/cuff binding/);
 assert(cache.apply(s,wid,'plated-test','steel-test',other.id));
});
