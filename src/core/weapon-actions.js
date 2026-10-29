"use strict";
const { firstObstacleTime,segmentCircleTime }=require("./projectile-geometry");
const { meleeScale,targetRange,sectorContains,segmentSectorTime,attackProgress,clamp01,impactPoint }=require("./weapon-geometry");

class WeaponActions {
  constructor(host){this.host=host;}
  effect(kind,values){const r=this.host.run,slot=r.attackEffects[r.nextAttackEffect++%r.attackEffects.length];Object.assign(slot,{active:true,kind,life:.14,maxLife:.14},values);}
  source(weapon,attackId,aimX,aimY,damage,critical,owner="player") {return{weaponId:weapon.id,attackId,owner,damage,critical,knockback:weapon.knockback*this.host.run.player.knockbackMultiplier,vx:aimX*480,vy:aimY*480};}
  traceBeam(grip,muzzle,dx,dy,range,source,maxHits,radius) {
    const h=this.host,seen=new Set(),segments=[
      {x:grip.x,y:grip.y,dx:muzzle.x-grip.x,dy:muzzle.y-grip.y},
      {x:muzzle.x,y:muzzle.y,dx:dx*range,dy:dy*range}
    ];
    // Test the barrel and the visible ray separately: split rays must not bend
    // their hit path toward the hand anchor or miss a point-blank enemy.
    for(const segment of segments){
      const {x,y,dx:sx,dy:sy}=segment,contacts=[];
      const wall=firstObstacleTime(h.obstacles,x,y,sx,sy,1,true);
      if(Number.isFinite(wall))contacts.push({t:wall,wall:true});
      for(const e of h.enemies){if(!e.active||seen.has(e.id))continue;const t=segmentCircleTime(x,y,sx,sy,e.x,e.y,e.radius+radius);if(Number.isFinite(t))contacts.push({t,e});}
      for(const item of h.interactives){if(!item.active||(item.type!=="explosiveBarrel"&&!(item.solidRadius>0)))continue;const t=segmentCircleTime(x,y,sx,sy,item.x,item.y,item.radius+radius);if(Number.isFinite(t))contacts.push({t,item});}
      contacts.sort((a,b)=>a.t-b.t||Number(Boolean(b.wall))-Number(Boolean(a.wall)));
      for(const contact of contacts){
        if(contact.e&&!contact.e.active||contact.item&&!contact.item.active)continue;
        const endX=x+sx*contact.t,endY=y+sy*contact.t;
        if(contact.e){seen.add(contact.e.id);source.hitX=endX;source.hitY=endY;h.damageEnemy(contact.e,source.damage,source);if(seen.size<maxHits)continue;}
        else if(contact.item?.type==="explosiveBarrel")h.triggerInteractive(contact.item);
        return{x,y,endX,endY};
      }
    }
    return{x:muzzle.x,y:muzzle.y,endX:muzzle.x+dx*range,endY:muzzle.y+dy*range};
  }
  fire(weapon,aimX,aimY,compact,refit,mechanic) {
    const h=this.host,r=h.run,p=r.player,id=r.shotsFired+1;
    const critical=mechanic.forceCritical||(p.criticalChance>0&&h.random.next()<p.criticalChance);
    const damage=weapon.damage*refit.damage*p.damageMultiplier*mechanic.damageMultiplier*(critical?p.criticalMultiplier:1);
    if(!r.weaponStats[weapon.id])r.weaponStats[weapon.id]={shots:0,kills:0,damage:0,eliteKills:0};
    let count=0,interval;
    if(weapon.attackType==="beam"){
      count=Math.min(3,1+p.projectileBonus);
      const start=compact?{x:compact.muzzleX,y:compact.muzzleY}:{x:p.x+aimX*18,y:p.y+aimY*18};
      const grip=compact?{x:compact.anchorX-aimX*p.radius,y:compact.anchorY-aimY*p.radius}:p;
      for(let i=0;i<count;i++){
        const angle=Math.atan2(aimY,aimX)+(i-(count-1)/2)*.085,dx=Math.cos(angle),dy=Math.sin(angle),range=targetRange(weapon,p);
        const source=this.source(weapon,id,dx,dy,damage/(1+(count-1)*.35),critical);
        const trace=this.traceBeam(grip,start,dx,dy,range,source,1+weapon.pierce+p.pierceBonus,2+Math.min(6,p.projectileRadiusBonus)/2);
        this.effect("beam",{...trace,color:weapon.color,width:4+Math.min(6,p.projectileRadiusBonus),life:.105,maxLife:.105});
      }
    }else if(weapon.attackType==="slash"||weapon.attackType==="slam"){
      if(r.attack)return;
      const speed=Math.min(2.4,p.fireRateMultiplier*refit.rate),windup=weapon.windup/speed,activeTime=weapon.activeTime/speed,recovery=weapon.recovery/speed;
      const scale=meleeScale(p);
      r.attack={weaponId:weapon.id,type:weapon.attackType,started:r.elapsed,windup,activeTime,recovery,previousAge:-1e-6,angle:Math.atan2(aimY,aimX),
        aimX,aimY,sweepSign:p.compactFacing||Math.sign(aimX)||1,range:weapon.reach*scale,radius:(weapon.blastRadius||0)*scale*Math.min(1.4,p.blastRadiusMultiplier||1),offset:(weapon.impactOffset||0)*scale,arc:weapon.arc||0,
        hitIds:new Set(),source:this.source(weapon,id,aimX,aimY,damage,critical,"melee"),waveSent:false,impacted:false,weapon};
      interval=Math.max(weapon.interval/speed,windup+activeTime+recovery+.035);r.meleeSwings++;
    }else{
      const rawCount=Math.min(6,1+p.projectileBonus),angle=Math.atan2(aimY,aimX);
      for(let i=0;i<rawCount&&h.projectiles.length<h.limits.projectiles;i++){
        const a=angle+(i-(rawCount-1)/2)*.11,dx=Math.cos(a),dy=Math.sin(a);
        const projectile=h.projectilePool.acquire({id:h.entityId++,x:compact?compact.muzzleX:p.x+aimX*18,y:compact?compact.muzzleY:p.y+aimY*18,
          barrelStartX:compact?compact.anchorX-aimX*p.radius:null,barrelStartY:compact?compact.anchorY-aimY*p.radius:null,
          vx:dx*weapon.projectileSpeed*p.projectileSpeedMultiplier,vy:dy*weapon.projectileSpeed*p.projectileSpeedMultiplier,
          radius:(weapon.attackType==="disc"?8:5)+Math.min(6,p.projectileRadiusBonus),ttl:weapon.ttl*p.projectileRangeMultiplier,damage:damage/(1+(rawCount-1)*.2),pierce:0,knockback:weapon.knockback*p.knockbackMultiplier,
          owner:"player",weaponId:weapon.id,attackId:id,critical,color:weapon.color,attackKind:weapon.attackType,
          bounces:weapon.bounces||0,blastRadius:(weapon.blastRadius||0)*Math.min(1.4,p.blastRadiusMultiplier||1)});
        h.projectiles.push(projectile);count++;
      }
    }
    h.combatSim.commitAttack(weapon,aimX,aimY,compact,refit,mechanic,count,interval);
  }
  detonate(projectile,x,y){
    const h=this.host,r=h.run,radius=projectile.blastRadius; if(!(radius>0))return;
    const source={...projectile,hitX:x,hitY:y};
    for(const e of h.enemies){if(!e.active)continue;const distance=Math.hypot(e.x-x,e.y-y);if(distance>radius+e.radius||Number.isFinite(firstObstacleTime(h.obstacles,x,y,e.x-x,e.y-y)))continue;
      source.vx=e.x-x;source.vy=e.y-y;source.hitX=e.x;source.hitY=e.y;h.damageEnemy(e,projectile.damage*Math.max(.4,1-distance/radius*.6),source);}
    for(const item of h.interactives)if(item.active&&item.type==="explosiveBarrel"&&Math.hypot(item.x-x,item.y-y)<=radius&&!Number.isFinite(firstObstacleTime(h.obstacles,x,y,item.x-x,item.y-y,0,true)))h.triggerInteractive(item);
    this.effect("explosion",{x,y,radius,color:projectile.color,life:.32,maxLife:.32});h.emit("weaponImpact",{kind:"explosion",x,y,radius,weaponId:projectile.weaponId});r.explosions++;
  }
  bounce(projectile,enemy){
    const h=this.host;if(projectile.bounces<=0)return false;
    const w=h.content.weapons[projectile.weaponId];let target=null,best=w.bounceRange;
    for(const e of h.enemies){if(!e.active||projectile.hitIds.has(e.id))continue;const d=Math.hypot(e.x-enemy.x,e.y-enemy.y);if(d<best&&!Number.isFinite(firstObstacleTime(h.obstacles,enemy.x,enemy.y,e.x-enemy.x,e.y-enemy.y))){best=d;target=e;}}
    if(!target)return false;
    const dx=target.x-enemy.x,dy=target.y-enemy.y,length=Math.hypot(dx,dy)||1,speed=Math.hypot(projectile.vx,projectile.vy);
    projectile.x=enemy.x;projectile.y=enemy.y;projectile.vx=dx/length*speed;projectile.vy=dy/length*speed;projectile.damage*=.78;projectile.bounces--;
    h.emit("weaponImpact",{kind:"ricochet",x:enemy.x,y:enemy.y,weaponId:projectile.weaponId});return true;
  }
  sendWave(a){
    const h=this.host,r=h.run,p=r.player;if(h.projectiles.length>=h.limits.projectiles)return;
    h.projectiles.push(h.projectilePool.acquire({id:h.entityId++,x:p.x+a.aimX*25,y:p.y-12+a.aimY*25,
      vx:a.aimX*a.weapon.projectileSpeed,vy:a.aimY*a.weapon.projectileSpeed,radius:12,ttl:a.weapon.ttl*Math.min(1.5,p.projectileRangeMultiplier),
      damage:a.source.damage*.4,pierce:2+p.pierceBonus,knockback:20*p.knockbackMultiplier,owner:"player",weaponId:a.weaponId,attackId:a.source.attackId,
      critical:a.source.critical,color:a.weapon.color,attackKind:"swordWave"}));r.projectilesFired++;
  }
  update(dt=1/60){
    const h=this.host,r=h.run,p=r.player,a=r.attack;
    for(const fx of r.attackEffects)if(fx.active){fx.life-=dt;if(fx.life<=0)fx.active=false;}
    if(!a)return;
    const age=r.elapsed-a.started,progress=attackProgress(a,r.elapsed);
    if(age>=a.windup&&a.previousAge<a.windup+a.activeTime){
      if(a.type==="slam"&&!a.impacted){a.impacted=true;Object.assign(a,impactPoint(p,a,h.obstacles));
        h.emit("weaponImpact",{kind:"slam",x:a.x,y:a.y,radius:a.radius,weaponId:a.weaponId});}
      const previous=clamp01((a.previousAge-a.windup)/a.activeTime),start=a.angle-a.arc/2*a.sweepSign+a.arc*previous*a.sweepSign,end=a.angle-a.arc/2*a.sweepSign+a.arc*progress*a.sweepSign;
      for(const e of h.enemies){
        if(!e.active||a.hitIds.has(e.id))continue;
        const x=a.type==="slash"?p.x:a.x,y=a.type==="slash"?p.y-12:a.y;
        const hit=a.type==="slash"?sectorContains(x,y,a.range,(start+end)/2,Math.max(.025,Math.abs(end-start)),e):Math.hypot(e.x-x,e.y-y)<=a.radius*progress+e.radius;
        if(!hit||Number.isFinite(firstObstacleTime(h.obstacles,x,y,e.x-x,e.y-y)))continue;
        a.hitIds.add(e.id);a.source.hitX=e.x;a.source.hitY=e.y;if(a.type==="slam"){a.source.vx=e.x-x;a.source.vy=e.y-y;}h.damageEnemy(e,a.source.damage,a.source);
      }
      for(const item of h.interactives){
        if(!item.active||item.type!=="explosiveBarrel")continue;
        const x=a.type==="slash"?p.x:a.x,y=a.type==="slash"?p.y-12:a.y;
        const hit=a.type==="slash"?sectorContains(x,y,a.range,(start+end)/2,Math.max(.025,Math.abs(end-start)),item):Math.hypot(item.x-x,item.y-y)<=a.radius*progress+item.radius;
        if(hit&&!Number.isFinite(firstObstacleTime(h.obstacles,x,y,item.x-x,item.y-y,0,true)))h.triggerInteractive(item);
      }
    }
    if(a.type==="slash"&&!a.waveSent&&age>=a.windup+a.activeTime){a.waveSent=true;this.sendWave(a);}
    a.previousAge=age;
    if(age>=a.windup+a.activeTime+a.recovery){r.attack=null;}
  }
  blockTime(shot,x,y,dx,dy){
    const h=this.host,r=h.run,a=r.attack;if(!a)return Infinity;const age=r.elapsed-a.started;if(age<a.windup||age>a.windup+a.activeTime)return Infinity;
    const progress=attackProgress(a,r.elapsed),sweptArc=Math.max(.025,a.arc*progress),sweptAngle=a.angle-a.arc/2*a.sweepSign+sweptArc/2*a.sweepSign;
    const t=a.type==="slash"?segmentSectorTime(x,y,dx,dy,r.player.x,r.player.y-12,a.range,sweptAngle,sweptArc,shot.radius)
      :segmentCircleTime(x,y,dx,dy,a.x,a.y,a.radius*attackProgress(a,r.elapsed)+shot.radius);
    if(!Number.isFinite(t))return Infinity;
    const cx=a.type==="slash"?r.player.x:a.x,cy=a.type==="slash"?r.player.y-12:a.y;
    return Number.isFinite(firstObstacleTime(h.obstacles,cx,cy,x+dx*t-cx,y+dy*t-cy))?Infinity:t;
  }
}
module.exports={WeaponActions};
