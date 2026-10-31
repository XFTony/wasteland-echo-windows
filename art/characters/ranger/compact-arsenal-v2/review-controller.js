(function(){
 'use strict';
 const D=window.COMPACT_ARSENAL_DATA,M=window.CompactRangerMotion,q=id=>document.getElementById(id),canvas=q('stage'),ctx=canvas.getContext('2d');
 const appearance=window.MODULAR_GRIP_APPEARANCE||null;
 const assets={weapons:{}},keys=new Set(),boxes=[{x:0,y:0,w:960,h:100},{x:0,y:510,w:960,h:50},{x:0,y:0,w:68,h:560},{x:892,y:0,w:68,h:560},{x:548,y:272,w:86,h:68}];
 const spawns=[[560,375],[680,185],[760,430],[240,180],[155,425],[395,165],[825,340]];
 let state,ready=false,mode='battle',paused=false,clock=0,carry=0,last=0,live=true,mouse=null,firing=false,fixedAngle=0,statusTime=0;
 const names={battle:'自动战斗 · 只需走位',demo:'自动走位演示',inspect:'持枪姿态检查'};
 for(const w of D.weapons){const option=document.createElement('option');option.value=w.id;option.textContent=w.name;q('weapon').append(option);}
 function create(){return M.createState({x:350,y:370,pixelScale:Number(q('zoom').value),speed:150,body:D.body,weapons:D.weapons,weaponId:q('weapon').value||D.defaultWeaponId,autoCombat:mode!=='inspect',
  world:{width:960,height:560,boxes},targets:spawns.map(([x,y],i)=>({id:'enemy-'+i,x,y,radius:13,hp:120}))});}
 function clear(){keys.clear();mouse=null;firing=false;}
 function labels(){q('mode').value=mode;q('pause').textContent=paused?'继续':'暂停';q('sceneLabel').textContent=names[mode]+(paused?' · 已暂停':'');const w=state.weaponDefinitions[state.weaponId];q('weapon').value=w.id;q('weaponNote').textContent=`${w.name} · ${w.projectileCount>1?w.projectileCount+'发散射':'单发弹道'} · 射击间隔 ${w.interval}秒 · 锁定范围 ${w.lockRange}`;}
 function syncAppearance(){assets.activeWeapon=appearance?appearance.apply(state,assets.weapons[state.weaponId]):assets.weapons[state.weaponId];}
 function setMode(value,reset=true){mode=value;clear();clock=0;paused=false;carry=0;if(reset)state=create();state.paused=false;state.autoCombat=mode!=='inspect';syncAppearance();labels();render();}
 function setWeapon(id){M.setWeapon(state,id);q('weapon').value=id;syncAppearance();labels();render();}
 function setPaused(value){paused=Boolean(value);state.paused=paused;clear();carry=0;labels();render();}
 function background(){
  ctx.fillStyle='#29373d';ctx.fillRect(0,0,960,560);ctx.strokeStyle='#35464c';ctx.lineWidth=1;
  for(let y=100;y<510;y+=32){ctx.beginPath();ctx.moveTo(68,y+.5);ctx.lineTo(892,y+.5);ctx.stroke();}
  for(let x=68;x<892;x+=48){ctx.beginPath();ctx.moveTo(x+.5,100);ctx.lineTo(x+.5,510);ctx.stroke();}
  for(const b of boxes){ctx.fillStyle='#1a282e';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#4c5d63';ctx.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);}
  const b=boxes[4];ctx.fillStyle='#4b5a5f';ctx.fillRect(b.x+5,b.y+5,b.w-10,b.h-10);ctx.strokeStyle='#728080';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(b.x+12,b.y+12);ctx.lineTo(b.x+b.w-12,b.y+b.h-12);ctx.moveTo(b.x+b.w-12,b.y+12);ctx.lineTo(b.x+12,b.y+b.h-12);ctx.stroke();
 }
 function render(){if(!ready)return;background();const pose=M.draw(ctx,state,{body:assets.body,weapon:assets.activeWeapon||assets.weapons[state.weaponId]},{drawTargets:mode!=='inspect'});
  if(mode!=='inspect')for(const t of state.targets){if(t.hp<=0)continue;ctx.fillStyle='#112126';ctx.fillRect(t.x-15,t.y-23,30,3);ctx.fillStyle=t.id===state.aimTargetId?'#edb66b':'#829e8d';ctx.fillRect(t.x-15,t.y-23,30*t.hp/t.maxHp,3);}
  if(q('guides').checked){ctx.strokeStyle='#f3c28299';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(pose.weapon.muzzleX,pose.weapon.muzzleY);ctx.lineTo(pose.weapon.muzzleX+Math.cos(state.angle)*180,pose.weapon.muzzleY+Math.sin(state.angle)*180);ctx.stroke();ctx.setLineDash([]);}
  if(statusTime<=0){const target=state.targets.find(t=>t.id===state.aimTargetId);q('status').textContent=`${state.walking?'移动中':'已站稳'} · ${mode==='inspect'?'姿态检查':target?'自动锁定中':'范围内无可攻击目标'} · ${state.shotsFired}次开火 · ${state.hits}次命中`;statusTime=.15;}
 }
 function enemies(dt){if(mode==='inspect')return;for(let i=0;i<state.targets.length;i++){const t=state.targets[i];if(t.hp<=0){t.deadTime=(t.deadTime||0)+dt;if(t.deadTime>1.6){t.x=spawns[i][0];t.y=spawns[i][1];t.hp=t.maxHp;t.deadTime=0;}continue;}
   const x=state.x-t.x,y=state.y-t.y,d=Math.hypot(x,y);if(d<28)continue;const step=(17+i*2)*dt,nx=t.x+x/d*step,ny=t.y+y/d*step;
   if(!boxes.some(b=>nx>b.x-14&&nx<b.x+b.w+14&&ny>b.y-14&&ny<b.y+b.h+14)){t.x=nx;t.y=ny;}
  }}
 function tick(dt){if(!ready||paused)return;clock+=dt;statusTime-=dt;enemies(dt);const input={paused:false};
  input.moveX=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));input.moveY=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  if(mode==='demo'){input.moveX=Math.cos(clock*1.8);input.moveY=Math.sin(clock*1.8)*.5;}
  if(mode==='inspect'){input.firing=firing||keys.has('Space');if(mouse){input.targetX=mouse.x;input.targetY=mouse.y;}else input.angle=fixedAngle;}
  M.step(state,input,dt);
 }
 function loop(time){if(ready&&live&&last){carry+=Math.min(.1,(time-last)/1000)*Number(q('speed').value);while(carry>=1/60){tick(1/60);carry-=1/60;}render();}last=time;requestAnimationFrame(loop);}
 function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*960/r.width,y:(e.clientY-r.top)*560/r.height};}
 q('mode').onchange=()=>{if(ready)setMode(q('mode').value);};q('weapon').onchange=()=>{if(ready)setWeapon(q('weapon').value);};
 q('nextWeapon').onclick=()=>{if(ready)setWeapon(D.weapons[(D.weapons.findIndex(w=>w.id===state.weaponId)+1)%D.weapons.length].id);};
 q('pause').onclick=()=>{if(ready)setPaused(!paused);};q('reset').onclick=()=>{if(ready)setMode(mode);};
 q('zoom').onchange=()=>{if(ready){state.pixelScale=Number(q('zoom').value);state.config.strideLength=34*state.pixelScale;render();}};q('guides').onchange=render;
 document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{if(!ready)return;setMode('inspect',false);fixedAngle=Number(b.dataset.angle)*Math.PI/180;M.setAimAngle(state,fixedAngle);render();});
 canvas.addEventListener('pointermove',e=>{if(ready&&mode==='inspect')mouse=point(e);});canvas.addEventListener('pointerdown',e=>{if(!ready)return;canvas.focus();if(mode==='inspect'&&e.button===0){mouse=point(e);firing=true;canvas.setPointerCapture(e.pointerId);}e.preventDefault();});
 window.addEventListener('pointerup',()=>{firing=false;});canvas.addEventListener('pointercancel',()=>{firing=false;});
 window.addEventListener('keydown',e=>{if(!ready||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='KeyP'&&!e.repeat){setPaused(!paused);e.preventDefault();return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){keys.add(e.code);e.preventDefault();}});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(ready)setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)setPaused(true);});
 function load(key,url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{if(key==='body')assets.body=im;else assets.weapons[key]=im;resolve();};im.onerror=()=>reject(new Error('素材未能加载，请重新打开预览页。'));im.src=url;});}
 Promise.all([load('body',D.bodyAtlas),...D.weapons.map(w=>load(w.id,w.image))]).then(async()=>{if(appearance)await appearance.init();ready=true;state=create();syncAppearance();labels();q('status').dataset.ready='true';render();requestAnimationFrame(loop);}).catch(e=>{q('status').textContent=e.message;q('status').dataset.ready='false';});
 window.arsenalReview={get ready(){return ready;},get state(){return state;},get assets(){return assets;},get mode(){return mode;},setMode,setWeapon,setPaused,tick,render,refreshAppearance(){syncAppearance();labels();render();},freeze(v=true){live=!v;carry=0;},
  setAngle(d){setMode('inspect',false);fixedAngle=d*Math.PI/180;M.setAimAngle(state,fixedAngle);render();},
  snapshot(){const p=M.pose(state);return{x:state.x,y:state.y,phase:state.phase,walking:state.walking,weaponId:state.weaponId,autoCombat:state.autoCombat,targetId:state.aimTargetId,shots:state.shotsFired,hits:state.hits,angle:state.angle,bodyFrame:p.bodyFrame,weapon:p.weapon,paused:state.paused};},
  async useEmbeddedAssets(data){await Promise.all([load('body',data.body),...D.weapons.map(w=>load(w.id,data.weapons[w.id]))]);if(appearance&&data.parts)await appearance.replaceTextures(data.parts);syncAppearance();canvas.width=960;render();}
 };
})();
