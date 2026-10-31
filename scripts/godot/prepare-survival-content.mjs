import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const base = { projectileCount:1, spread:0, pierce:0, recoil:1, muzzleLength:32,
  muzzleFlashLength:10, muzzleFlashLife:0.06, muzzleParticles:2, shellLength:0,
  shellLife:0, shellColor:"#b18b50", ttl:0.9 };
const weapons = [
  {...base,id:"ratchet_crossbow",name:"棘轮连弩",description:"机械弩矢穿透2次；每第四次射击强化，无普通抛壳",
    weaponClass:"crossbow",rangeBand:"long",visualId:"ratchet-crossbow",mechanicId:"steady_cycle",
    damage:28,interval:0.68,projectileSpeed:640,lockRange:560,pierce:2,knockback:35,recoil:1.5,color:"#c6b47d"},
  {...base,id:"frost_projector",name:"霜凝喷射器",description:"命中减速30%持续1.2秒；首领减速10%且时长减半",
    weaponClass:"elemental",rangeBand:"mid",visualId:"frost-projector",mechanicId:"cryogenic",
    damage:11,interval:0.46,projectileSpeed:520,lockRange:430,knockback:14,recoil:1,color:"#90cddd",slowFactor:0.7,slowDuration:1.2},
  {...base,id:"breach_spear",name:"破阵长矛",description:"126范围、24度窄扇刺击；无剑气，不消除敌弹",
    attackType:"slash",weaponClass:"spear",rangeBand:"close",visualId:"breach-spear",mechanicId:"slash",
    damage:28,interval:0.64,projectileSpeed:1,lockRange:126,reach:126,arc:24*Math.PI/180,
    windup:0.12,activeTime:0.12,recovery:0.16,attackStyle:"thrust",waveDamage:0,blocksProjectiles:false,restTipReach:91.5,
    knockback:38,recoil:0.3,color:"#b8c0ad"},
  {...base,id:"rust_cleaver",name:"锈刃战斧",description:"88范围、145度重挥；仅有效挥击段消弹，无剑气",
    attackType:"slash",weaponClass:"axe",rangeBand:"close",visualId:"rust-cleaver",mechanicId:"slash",
    damage:34,interval:0.86,projectileSpeed:1,lockRange:88,reach:88,arc:145*Math.PI/180,
    windup:0.18,activeTime:0.20,recovery:0.24,waveDamage:0,blocksProjectiles:true,
    knockback:66,recoil:0.3,color:"#c4ae86"}
];
const visuals = {
 ratchet_crossbow:{width:64,height:32,pivot:[13,16],muzzle:[61,16],primaryGrip:[13,18],supportGrip:[29,18],family:"crossbow",shapes:[
  [2,13,41,8,"ink"],[4,15,32,4,"wood"],[9,14,4,6,"brass"],[18,13,3,8,"brass"],
  [37,2,7,28,"ink"],[39,4,3,24,"steel"],[42,5,5,5,"ink"],[43,7,3,4,"light"],
  [46,9,4,5,"ink"],[47,11,3,4,"brass"],[42,22,5,6,"ink"],[43,22,3,4,"steel"],
  [46,19,5,5,"ink"],[47,19,3,3,"light"],[32,7,2,18,"light"],[26,15,35,2,"dark"],
  [29,15,31,1,"light"],[56,14,5,4,"steel"],[60,15,2,2,"light"],[6,20,10,5,"ink"],[8,20,5,3,"wood"]]},
 frost_projector:{width:58,height:30,pivot:[12,16],muzzle:[56,15],primaryGrip:[12,18],supportGrip:[29,18],family:"cryo",shapes:[
  [3,12,46,11,"ink"],[6,14,38,7,"olive"],[17,8,22,6,"ink"],[20,4,15,9,"dark"],
  [22,5,11,8,"teal"],[24,6,6,5,"glow"],[20,3,15,3,"steel"],[20,12,15,3,"brass"],
  [10,21,7,7,"ink"],[11,22,4,4,"wood"],[26,20,14,7,"ink"],[28,21,10,4,"teal"],
  [43,10,9,14,"ink"],[45,12,7,10,"steel"],[49,13,5,8,"teal"],[53,12,4,11,"ink"],
  [54,14,3,7,"glow"],[8,14,5,2,"light"],[36,15,5,2,"brass"]]},
 breach_spear:{width:86,height:20,pivot:[23,10],muzzle:[84,10],primaryGrip:[23,11],supportGrip:[43,11],family:"spear",shapes:[
  [1,8,65,5,"ink"],[3,9,62,3,"wood"],[5,9,55,1,"light"],[18,8,3,5,"brass"],
  [24,8,2,5,"dark"],[35,8,3,5,"brass"],[43,8,2,5,"dark"],[58,7,7,7,"ink"],
  [60,8,4,5,"steel"],[64,5,9,11,"ink"],[66,6,9,9,"steel"],[69,5,7,3,"light"],
  [73,6,5,8,"ink"],[74,7,5,6,"steel"],[78,7,3,6,"ink"],[79,8,3,4,"light"],
  [82,9,3,2,"steel"],[85,9,1,1,"light"],[68,12,6,2,"rust"]]},
 rust_cleaver:{width:64,height:40,pivot:[14,22],muzzle:[60,21],primaryGrip:[14,23],supportGrip:[31,23],family:"axe",shapes:[
  [2,19,48,7,"ink"],[4,21,43,3,"wood"],[6,21,37,1,"light"],[10,19,3,7,"brass"],
  [18,20,2,6,"dark"],[27,19,3,7,"brass"],[36,17,8,12,"ink"],[38,18,5,10,"steel"],
  [42,4,12,32,"ink"],[44,6,10,28,"steel"],[47,4,8,7,"light"],[53,7,6,26,"ink"],
  [54,9,5,22,"steel"],[58,11,4,18,"ink"],[59,12,3,16,"light"],[46,12,6,4,"rust"],
  [45,23,6,6,"dark"],[47,28,8,5,"brass"],[43,34,9,3,"ink"]]}
};
const upgrades = [
 {id:"critDamage",name:"弱点增幅",detail:"暴击伤害倍率 +0.2",family:"firepower",rarity:"advanced",max:3,unlockWave:1,glyph:"critical"},
 {id:"killMend",name:"猎获修复",detail:"每12次击败回复1生命／级",family:"survival",rarity:"prototype",max:3,unlockWave:2,glyph:"recovery"},
 {id:"meleeTempo",name:"格斗节拍",detail:"近战攻速 +10% · 伤害 +8%",family:"firepower",rarity:"advanced",max:4,unlockWave:1,glyph:"fireRate",requires:{attackTypes:["slash","slam"]}},
 {id:"ricochetCoil",name:"锯盘导流",detail:"锯盘额外弹射 +1",family:"utility",rarity:"prototype",max:2,unlockWave:3,glyph:"cascadeRounds",requires:{attackTypes:["disc"]}},
 {id:"chillAmplifier",name:"寒霜延时",detail:"减速持续时间 +0.3秒",family:"utility",rarity:"advanced",max:3,unlockWave:3,glyph:"phaseLining",requires:{weaponIds:["frost_projector"]}},
 {id:"blastFocus",name:"爆裂装药",detail:"伤害 +12% · 爆炸半径 +6%基础值",family:"firepower",rarity:"advanced",max:3,unlockWave:2,glyph:"caliber",requires:{attackTypes:["explosive","slam"]}},
 {id:"fieldRush",name:"战场步频",detail:"移动速度 +6% · 攻速 +4%",family:"mobility",rarity:"prototype",max:4,unlockWave:4,glyph:"speed"},
 {id:"pressureBarrel",name:"散射收束",detail:"散布收拢12% · 射程 +8%",family:"firepower",rarity:"advanced",max:3,unlockWave:1,glyph:"velocity",requires:{attackTypes:["projectile"]}}
];
// Raster rows remain ordinary editable pixel-shape data consumed by AssetStore.
function polygon(points,color){const result=[];const ys=points.map(p=>p[1]);
 for(let y=Math.min(...ys);y<=Math.max(...ys);y++){const hits=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5))hits.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const x=Math.ceil(hits[i]);const w=Math.floor(hits[i+1])-x+1;if(w>0)result.push([x,y,w,1,color]);}}
 return result;}
visuals.rust_cleaver.shapes=[
 [2,20,48,7,"ink"],[4,22,43,3,"wood"],[6,22,34,1,"light"],[10,20,3,7,"brass"],[18,21,2,5,"dark"],[27,20,3,7,"brass"],[38,18,9,12,"ink"],[40,20,5,8,"steel"],
 ...polygon([[43,8],[49,3],[55,2],[59,6],[62,13],[62,20],[59,28],[54,33],[46,35],[42,31],[47,27],[49,21],[47,16],[43,14]],"ink"),
 ...polygon([[45,9],[50,5],[55,4],[57,7],[60,13],[60,20],[57,27],[53,31],[47,33],[46,31],[49,28],[51,21],[49,15],[45,13]],"steel"),
 ...polygon([[56,5],[59,11],[61,16],[60,23],[56,30],[50,33],[51,30],[55,26],[58,20],[58,13]],"light"),
 [50,11,3,2,"rust"],[52,17,2,3,"dark"],[48,27,2,2,"rust"]];
const colors={ink:"#272e24",olive:"#69724f",gold:"#b69452",light:"#e5d29b",red:"#a74e3b",teal:"#79adb0",steel:"#acb3a3"};
const rect=(x,y,w,h,color)=>({kind:"rect",x,y,w,h,color:colors[color]});
const circle=(x,y,r,color,filled=true)=>({kind:"circle",x,y,radius:r,color:colors[color],filled,start:0,end:Math.PI*2,width:4});
const glyphs={
 critDamage:[circle(32,32,20,"ink"),circle(32,32,14,"olive"),circle(32,32,6,"red"),rect(29,4,6,17,"gold"),rect(29,43,6,17,"gold"),rect(4,29,17,6,"gold"),rect(43,29,17,6,"gold"),rect(30,28,3,4,"light")],
 killMend:[rect(14,9,36,43,"ink"),rect(18,13,28,34,"olive"),rect(27,19,10,22,"light"),rect(21,25,22,10,"light"),rect(7,47,49,5,"gold"),rect(23,7,18,4,"red")],
 meleeTempo:[rect(13,10,8,31,"ink"),rect(15,12,4,26,"steel"),rect(9,39,16,5,"gold"),rect(15,44,5,12,"olive"),rect(40,10,8,31,"ink"),rect(42,12,4,26,"light"),rect(36,39,16,5,"gold"),rect(42,44,5,12,"olive"),rect(26,17,9,4,"red"),rect(25,25,9,4,"red")],
 ricochetCoil:[circle(25,31,17,"ink"),circle(25,31,12,"steel"),circle(25,31,4,"gold"),rect(5,26,9,10,"steel"),rect(20,11,10,9,"steel"),rect(20,42,10,9,"steel"),rect(42,13,5,27,"teal"),rect(44,12,12,5,"teal"),rect(51,8,5,13,"light")],
 chillAmplifier:[rect(28,6,7,48,"ink"),rect(9,26,46,7,"ink"),rect(30,8,3,44,"teal"),rect(11,28,42,3,"teal"),rect(16,15,8,4,"light"),rect(20,19,7,4,"teal"),rect(39,15,8,4,"light"),rect(35,19,7,4,"teal"),rect(17,40,8,4,"light"),rect(38,40,8,4,"light"),circle(32,29,6,"light")],
 blastFocus:[rect(19,18,25,33,"ink"),rect(23,21,17,26,"olive"),rect(20,15,23,6,"gold"),rect(27,7,9,10,"red"),rect(47,20,9,4,"gold"),rect(9,26,8,4,"gold"),rect(45,43,10,4,"light"),rect(28,28,7,11,"gold"),rect(8,44,8,4,"red")],
 fieldRush:[rect(23,12,20,30,"ink"),rect(27,15,12,24,"olive"),rect(21,39,30,12,"ink"),rect(24,41,23,6,"gold"),rect(5,22,15,4,"teal"),rect(10,31,10,4,"teal"),rect(2,40,16,4,"light")],
 pressureBarrel:[rect(26,9,12,42,"ink"),rect(29,13,6,33,"gold"),rect(9,13,5,14,"teal"),rect(14,23,5,5,"teal"),rect(18,28,7,5,"light"),rect(50,13,5,14,"teal"),rect(45,23,5,5,"teal"),rect(39,28,7,5,"light"),rect(24,48,16,5,"steel")]
};
const prices={ratchet_crossbow:110,frost_projector:95,breach_spear:80,rust_cleaver:90};
const feedback = {};
for(const w of weapons){const v=visuals[w.id];v.hold={chestY:-12,aimOffsetX:9,upShoulder:14,upLift:3};
 if(w.id==="breach_spear")v.hold={chestY:-8,aimOffsetX:0,upShoulder:0,upLift:0};
 feedback[w.id]={family:v.family,kick:w.recoil,angle:w.attackType?0:0.018,recovery:0.10,camera:0,
  trail:v.family==="crossbow"?10:6,width:3,color:w.color,core:v.family==="cryo"?"#d8f0ec":"#e3d5ae",impact:w.color,
  shell:"none",ejectDelay:0,flash:v.family==="cryo"?"mist":"none"};}
const design={version:1,date:"2026-10-30",weapons,visuals,feedback,upgrades,glyphs,prices,
 gunPrices:{ratchet_crossbow:24,frost_projector:22,breach_spear:17,rust_cleaver:20},
 audio:weapons.map(w=>({id:w.id,src:`./assets/audio/survival-v2/${w.id}.wav`,resourcePath:`res://assets/audio/survival-v2/${w.id}.wav`,role:w.attackType?"melee":"shot",source:"Project original offline synthesis; no third-party samples",seconds:w.id==="rust_cleaver"?0.28:0.20}))};
const dir=path.join(root,"art/combat/survival-builds-v1");fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,"design.json"),JSON.stringify(design,null,2)+"\n");
console.log(JSON.stringify({weapons:weapons.length,upgrades:upgrades.length,source:"art/combat/survival-builds-v1/design.json"}));
