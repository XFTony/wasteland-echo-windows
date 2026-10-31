"use strict";

function weapon(id, name, description, attackType, weaponClass, rangeBand, values) {
  return Object.freeze({ id, name, description, attackType, weaponClass, rangeBand, visualId: id.replaceAll("_", "-"), mechanicId: attackType,
    projectileCount: 1, spread: 0, pierce: 0, knockback: 18, recoil: 2, muzzleLength: 38, muzzleFlashLength: 12, muzzleFlashLife: .06, muzzleParticles: 3,
    shellLength: 5, shellLife: .7, shellColor: "#c8a870", color: "#9bc9c0", ...values });
}
const NEW_WEAPONS = Object.freeze({
  prism_laser: weapon("prism_laser", "折光脉冲枪", "瞬时贯穿射线，墙体截断；分流最多3束", "beam", "rifle", "long", { damage: 22, interval: .60, projectileSpeed: 1000, ttl: .72, lockRange: 720, pierce: 3, knockback: 4, recoil: 1.3, color: "#77d6cf" }),
  slag_launcher: weapon("slag_launcher", "熔渣榴弹器", "慢速榴弹，接触或到时爆炸；爆炸不能穿墙", "explosive", "heavy", "mid", { damage: 38, interval: 1.05, projectileSpeed: 360, ttl: 1.5, lockRange: 470, knockback: 60, recoil: 6, blastRadius: 90, shellLength: 7, shellColor: "#a7aa84", color: "#e0a064" }),
  saw_disc: weapon("saw_disc", "锯盘弹射器", "最多弹射2次，每跳保留78%伤害；不重复命中", "disc", "disc", "mid", { damage: 16, interval: .48, projectileSpeed: 430, ttl: 1.1, lockRange: 420, knockback: 25, recoil: 2.8, bounces: 2, bounceRange: 200, color: "#c1c5a6" }),
  echo_blade: weapon("echo_blade", "回响军刀", "110度近身挥扫＋40%伤害剑气；有效挥击可消弹", "slash", "blade", "close", { damage: 24, interval: .62, projectileSpeed: 480, ttl: .5, lockRange: 190, knockback: 42, recoil: .5, reach: 80, arc: Math.PI * 110 / 180, windup: .09, activeTime: .14, recovery: .13, color: "#a9d9c7" }),
  shock_hammer: weapon("shock_hammer", "铁砧震荡锤", "举锤后砸地，范围击退与短时消弹；前摇仍会受伤", "slam", "hammer", "close", { damage: 46, interval: 1.25, projectileSpeed: 1, ttl: .5, lockRange: 122, knockback: 95, recoil: .5, reach: 122, impactOffset: 58, blastRadius: 64, windup: .22, activeTime: .14, recovery: .28, color: "#cfb685" })
});
const prices = { prism_laser: [32, 140], slag_launcher: [28, 100], saw_disc: [26, 120], echo_blade: [16, 70], shock_hammer: [22, 90] };
const NEW_SHOP_ITEMS = Object.freeze(Object.fromEntries(Object.values(NEW_WEAPONS).map(w => ["buy_" + w.id, Object.freeze({ id: "buy_" + w.id, category: "weapon", name: w.name, description: w.description, grantType: "weapon", grantId: w.id, currency: "copper", price: prices[w.id][1], unlockStage: 1 })])));
const NEW_GUN_PRICES = Object.freeze(Object.fromEntries(Object.entries(prices).map(([id, p]) => [id, p[0]])));

// Project-original native pixel rectangles. Hands and cuffs remain separate.
const PALETTE = Object.freeze({ ink:"#202923", dark:"#3a463b", steel:"#8f9a8c", light:"#d8d4b1", olive:"#687452", brass:"#b18b50", wood:"#795840", rust:"#a1603e", teal:"#5aafa6", glow:"#c3f2d8" });
const NATIVE_WEAPONS = Object.freeze({
  prism_laser: { width:52,height:24,pivot:[14,8],muzzle:[50,8],primaryGrip:[17,15],supportGrip:[34,13],family:"longgun", hold:{chestY:-15,aimOffsetX:4,upShoulder:12,upLift:4}, shapes:[
    [1,5,15,10,"ink"],[3,6,10,6,"wood"],[11,3,30,15,"ink"],[13,5,26,10,"dark"],[15,5,4,8,"brass"],[21,4,3,10,"teal"],[27,4,3,10,"teal"],[33,4,3,10,"teal"],[20,5,16,2,"glow"],[37,5,14,7,"ink"],[39,6,10,4,"steel"],[47,5,3,7,"brass"],[18,15,7,7,"ink"],[19,16,4,5,"olive"],[10,1,13,3,"ink"],[12,1,9,1,"steel"] ] },
  slag_launcher: { width:48,height:28,pivot:[13,9],muzzle:[46,9],primaryGrip:[17,19],supportGrip:[33,18],family:"heavy", hold:{chestY:-14,aimOffsetX:4,upShoulder:12,upLift:7},shapes:[
    [1,8,13,10,"ink"],[3,9,10,6,"wood"],[11,3,36,16,"ink"],[13,5,31,11,"olive"],[13,5,28,2,"steel"],[17,4,4,14,"brass"],[36,4,3,14,"brass"],[44,5,3,11,"dark"],[45,7,2,6,"ink"],[20,13,14,10,"ink"],[22,15,10,6,"rust"],[25,16,2,4,"brass"],[15,18,6,8,"ink"],[16,19,3,6,"wood"],[27,1,8,3,"ink"],[29,1,5,1,"light"] ] },
  saw_disc: { width:48,height:28,pivot:[13,9],muzzle:[46,9],primaryGrip:[17,20],supportGrip:[33,19],family:"heavy",hold:{chestY:-14,aimOffsetX:4,upShoulder:12,upLift:7},shapes:[
    [1,9,13,9,"ink"],[3,10,10,6,"wood"],[11,5,35,16,"ink"],[13,7,30,11,"dark"],[29,1,10,23,"ink"],[25,5,18,15,"steel"],[28,2,12,21,"steel"],[24,9,20,7,"light"],[30,6,8,13,"dark"],[32,9,4,7,"brass"],[40,7,7,8,"ink"],[42,9,4,4,"steel"],[18,19,6,7,"ink"],[19,20,3,5,"olive"],[14,7,10,2,"olive"],[15,12,7,1,"brass"],[15,15,7,1,"steel"],[23,8,2,2,"light"] ] },
  echo_blade: { width:58,height:20,pivot:[12,10],muzzle:[56,10],primaryGrip:[13,11],supportGrip:[13,11],family:"blade",hold:{chestY:-8,aimOffsetX:9,upShoulder:14,upLift:3},shapes:[
    [1,8,15,6,"ink"],[3,9,12,4,"wood"],[5,8,2,6,"brass"],[10,8,2,6,"brass"],[15,3,4,15,"ink"],[16,5,2,11,"brass"],[18,6,29,9,"ink"],[20,7,28,6,"steel"],[21,7,25,2,"light"],[20,12,24,2,"teal"],[46,6,6,8,"ink"],[47,7,5,5,"steel"],[51,7,3,5,"ink"],[52,8,3,3,"light"],[55,9,2,1,"light"],[24,9,2,2,"dark"],[36,9,3,2,"dark"] ] },
  shock_hammer: { width:54,height:32,pivot:[12,17],muzzle:[46,17],primaryGrip:[14,18],supportGrip:[27,18],family:"hammer",hold:{chestY:-7,aimOffsetX:8,upShoulder:15,upLift:5},shapes:[
    [1,14,40,7,"ink"],[3,16,35,3,"wood"],[7,14,3,7,"brass"],[18,14,3,7,"brass"],[29,14,3,7,"brass"],[35,1,16,30,"ink"],[37,3,12,26,"steel"],[38,4,10,3,"light"],[38,8,10,15,"dark"],[38,12,10,3,"brass"],[39,16,8,2,"teal"],[38,24,10,4,"olive"],[33,7,4,18,"ink"],[50,7,3,18,"ink"],[37,28,12,2,"dark"],[39,5,2,2,"brass"],[45,24,2,2,"light"] ] }
});
function weaponSummary(w){
  if(w.attackType==="beam")return[`基础${w.damage}伤害 / ${w.lockRange}射程`,`贯穿${w.pierce+1}目标 · 最多3束`,"遇墙终止 · 无普通弹壳"];
  if(w.attackType==="explosive")return[`基础${w.damage}伤害 / ${w.blastRadius}爆炸半径`,"接触或到时引爆","边缘衰减 · 掩体挡爆"];
  if(w.attackType==="disc")return[`基础${w.damage}伤害 / 弹射${w.bounces}次`,"每跳78% · 不重复命中","实体墙阻挡"];
  if(w.attackType==="slash")return[`基础${w.damage}刃伤 / ${w.reach}近战范围`,"110°挥扫 · 40%伤害剑气","有效挥扫可消弹"];
  if(w.attackType==="slam")return[`基础${w.damage}伤害 / ${w.blastRadius}冲击半径`,`${w.impactOffset}落点 · 前摇${w.windup}秒`,"击退与短时消弹"];
  return[w.description];
}
module.exports = { NEW_WEAPONS, NEW_SHOP_ITEMS, NEW_GUN_PRICES, NATIVE_WEAPONS, WEAPON_PIXEL_PALETTE: PALETTE, weaponSummary };
