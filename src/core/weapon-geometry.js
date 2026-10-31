"use strict";
const { segmentCircleTime, firstObstacleTime } = require("./projectile-geometry");
const TAU = Math.PI * 2;
const clamp01 = n => Math.max(0,Math.min(1,n));
function angleDelta(a,b) { return ((a-b+Math.PI)%TAU+TAU)%TAU-Math.PI; }
function meleeScale(player) { return Math.max(1,Math.min(1.5,player.meleeRangeMultiplier||1)); }
function targetRange(weapon,player) {
  const range = player.projectileRangeMultiplier||1;
  if(weapon.attackType==="slam")return (weapon.impactOffset+weapon.blastRadius*Math.min(1.4,player.blastRadiusMultiplier||1))*meleeScale(player);
  if(weapon.attackType==="slash")return Math.min(240,weapon.lockRange*(1+(range-1)*.5));
  if(weapon.attackType==="beam")return Math.min(1100,weapon.lockRange*range*(player.lockRangeMultiplier||1));
  return weapon.lockRange*range*(player.lockRangeMultiplier||1);
}
function sectorContains(x,y,radius,angle,arc,circle) {
  const dx=circle.x-x,dy=circle.y-y,d=Math.hypot(dx,dy),r=circle.radius||0;
  if(d>radius+r)return false;if(d<=r)return true;
  const delta=Math.abs(angleDelta(Math.atan2(dy,dx),angle));
  if(delta<=arc/2)return true;
  const edge=delta-arc/2,projection=Math.max(0,Math.min(radius,d*Math.cos(edge)));
  return d*d+projection*projection-2*d*projection*Math.cos(edge)<=r*r;
}
// A swept disk clipped against the two radial half planes of a convex sector.
function segmentSectorTime(x,y,dx,dy,cx,cy,radius,angle,arc,padding=0) {
  const ox=x-cx,oy=y-cy,rr=radius+padding,a=dx*dx+dy*dy;
  if(a<1e-12)return sectorContains(cx,cy,radius,angle,arc,{x,y,radius:padding})?0:Infinity;
  const b=ox*dx+oy*dy,c=ox*ox+oy*oy-rr*rr,disc=b*b-a*c;
  if(disc<0)return Infinity;const root=Math.sqrt(disc);let lo=Math.max(0,(-b-root)/a),hi=Math.min(1,(-b+root)/a);
  for(const [edge,sign]of [[angle-arc/2,1],[angle+arc/2,-1]]){
    const ex=Math.cos(edge),ey=Math.sin(edge),v=sign*(ex*oy-ey*ox)+padding,slope=sign*(ex*dy-ey*dx);
    if(Math.abs(slope)<1e-12){if(v<0)return Infinity;}else if(slope>0)lo=Math.max(lo,-v/slope);else hi=Math.min(hi,-v/slope);
  }
  return lo<=hi?lo:Infinity;
}
function attackProgress(attack,elapsed) {
  return clamp01((elapsed-attack.started-attack.windup)/attack.activeTime);
}
function attackMotion(attack,elapsed) {
  if(!attack)return 0;const age=Math.max(0,elapsed-attack.started),sign=attack.sweepSign||1;
  const amount=attack.type==="slash"?attack.arc/2:1.35;
  if(age<attack.windup)return -amount*clamp01(age/attack.windup)*sign;
  if(age<attack.windup+attack.activeTime)return (attack.type==="slash"?-amount+amount*2*attackProgress(attack,elapsed):-amount*(1-clamp01((age-attack.windup)/Math.min(.055,attack.activeTime))))*sign;
  return (attack.type==="slash"?amount*(1-clamp01((age-attack.windup-attack.activeTime)/attack.recovery)):0)*sign;
}
function impactPoint(player,attack,obstacles){const time=firstObstacleTime(obstacles,player.x,player.y,attack.aimX*attack.offset,attack.aimY*attack.offset),reach=Number.isFinite(time)?Math.max(0,attack.offset*time-4):attack.offset;return{x:player.x+attack.aimX*reach,y:player.y+attack.aimY*reach};}
module.exports={angleDelta,meleeScale,targetRange,sectorContains,segmentSectorTime,attackProgress,attackMotion,impactPoint,clamp01,segmentCircleTime};
