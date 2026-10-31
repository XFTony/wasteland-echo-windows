"use strict";
const {attackProgress,clamp01,impactPoint}=require("../core/weapon-geometry");
const {firstObstacleTime}=require("../core/projectile-geometry");
function radialPath(r,model,x,y,radius){const ctx=r.ctx;ctx.beginPath();for(let i=0;i<=32;i++){const angle=i*Math.PI/16,dx=Math.cos(angle)*Math.max(1,radius),dy=Math.sin(angle)*Math.max(1,radius),t=Math.min(1,firstObstacleTime(model.obstacles,x+r.camera.x,y+r.camera.y,dx,dy));if(i===0)ctx.moveTo(x+dx*t,y+dy*t);else ctx.lineTo(x+dx*t,y+dy*t);}ctx.closePath();}
function visiblePoint(r,model,x,y,angle,radius){const dx=Math.cos(angle)*radius,dy=Math.sin(angle)*radius,t=Math.min(1,firstObstacleTime(model.obstacles,x+r.camera.x,y+r.camera.y,dx,dy));return{x:x+dx*t,y:y+dy*t};}
function slashPath(r,model,x,y,radius,start,end,fill){const ctx=r.ctx,steps=Math.max(1,Math.ceil(Math.abs(end-start)*12));ctx.beginPath();if(fill)ctx.moveTo(x,y);for(let i=0;i<=steps;i++){const point=visiblePoint(r,model,x,y,start+(end-start)*i/steps,radius);if(i===0&&!fill)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y);}if(fill)ctx.closePath();}
function ring(r,model,x,y,radius,color,life,lineWidth=2){const ctx=r.ctx;ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.globalAlpha=life;radialPath(r,model,x,y,radius);ctx.stroke();}
function drawAttackEffects(r,model,layer="all"){
  const ctx=r.ctx,run=model.run,a=run.attack;
  ctx.save();
  for(const fx of run.attackEffects){if(!fx.active)continue;const x=fx.x-r.camera.x,y=fx.y-r.camera.y,life=clamp01(fx.life/fx.maxLife);
    if(fx.kind==="beam"&&layer!=="ground"){
      ctx.globalAlpha=life*(r.flashSetting==="off"?.06:.28);ctx.strokeStyle=fx.color;ctx.lineWidth=fx.width+5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(fx.endX-r.camera.x,fx.endY-r.camera.y);ctx.stroke();
      ctx.globalAlpha=life;ctx.strokeStyle=fx.color;ctx.lineWidth=fx.width;ctx.stroke();ctx.strokeStyle="#e6ffe0";ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle="#c1e8be";ctx.fillRect(fx.endX-r.camera.x-2,fx.endY-r.camera.y-2,4,4);
    }else if(fx.kind==="explosion"&&layer!=="over"){
      const size=fx.radius*(.3+(1-life)*.7);ring(r,model,x,y,size,fx.color,life*.8,3);
      if(r.flashSetting!=="off"){ctx.globalAlpha=life*.12;ctx.fillStyle="#f1ce8b";radialPath(r,model,x,y,size);ctx.fill();}
      for(let i=0;i<8;i++){const point=visiblePoint(r,model,x,y,i*Math.PI/4,size);ctx.globalAlpha=life;ctx.fillStyle="#bda16e";ctx.fillRect(point.x-2,point.y-2,4,3);}
    }
  }
  if(a&&layer!=="over"){
    const age=run.elapsed-a.started,progress=attackProgress(a,run.elapsed),active=age>=a.windup&&age<=a.windup+a.activeTime;
    if(a.type==="slash"&&active){
      const x=run.player.x-r.camera.x,y=run.player.y-12-r.camera.y,start=a.angle-a.arc/2*a.sweepSign,end=start+a.arc*progress*a.sweepSign;
      ctx.globalAlpha=.20;ctx.fillStyle="#a3cdb0";slashPath(r,model,x,y,a.range,start,end,true);ctx.fill();
      ctx.globalAlpha=.9;ctx.strokeStyle="#b7e4c5";ctx.lineWidth=3;slashPath(r,model,x,y,a.range,start,end,false);ctx.stroke();
      ctx.strokeStyle="#edffdc";ctx.lineWidth=1;slashPath(r,model,x,y,a.range-4,end-.15*a.sweepSign,end,false);ctx.stroke();
    }else if(a.type==="slam"){
      const center=a.impacted?a:impactPoint(run.player,a,model.obstacles),x=center.x-r.camera.x,y=center.y-r.camera.y;
      if(age<a.windup)ring(r,model,x,y,a.radius,"#b29d6d",.35,1);
      else{const life=1-clamp01((age-a.windup)/(.32+a.activeTime)),radius=a.radius*progress;
        ring(r,model,x,y,radius,"#d7c28e",life,3);ring(r,model,x,y,Math.max(1,radius-8),"#a58f63",life*.6,2);
        ctx.globalAlpha=life;ctx.strokeStyle="#64523b";ctx.lineWidth=2;
        for(let i=0;i<7;i++){const angle=i*Math.PI*2/7+.2,mid=visiblePoint(r,model,x,y,angle,radius*.48),tip=visiblePoint(r,model,x,y,angle+.14,radius*.8);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(mid.x,mid.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();}
      }
    }
  }
  ctx.restore();
}
module.exports={drawAttackEffects};
