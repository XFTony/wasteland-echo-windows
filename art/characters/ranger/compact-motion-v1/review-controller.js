/* Standalone art review: local images, no saved game or external services. */
(function () {
  "use strict";
  const M = window.CompactRangerMotion, data = window.COMPACT_RANGER_DATA;
  const q = id => document.getElementById(id), canvas = q("stage"), ctx = canvas.getContext("2d");
  const keys = new Set(), assets = {}, names = { moving: "移动与连续射击", turn: "原地转向与持枪", strafe: "横移射击", reverse: "反向移动与射击", free: "自由操作" };
  let state, ready = false, paused = false, mode = q("mode").value, clock = 0, last = 0, carry = 0;
  let firing = false, mouseAim = null, fixedAngle = null, autoTick = true, statusTimer = 0;
  const boxes = [{x:0,y:0,w:960,h:100},{x:0,y:510,w:960,h:50},
    {x:0,y:0,w:68,h:560},{x:892,y:0,w:68,h:560},{x:548,y:272,w:86,h:68}];
  function create() {
    return M.createState({x:350,y:360,pixelScale:Number(q("zoom").value),body:data.body,weapon:data.weapon,
      speed:150,world:{width:960,height:560,boxes},targets:[{id:"north",x:756,y:195,radius:17,hp:12},{id:"south",x:778,y:436,radius:17,hp:12}]});
  }
  function clearInput() {keys.clear();firing=false;mouseAim=null;}
  function updateLabels() {
    q("mode").value=mode;q("pause").textContent=paused?"继续":"暂停";
    q("sceneLabel").textContent=names[mode]+(paused?" · 已暂停":"");
  }
  function setMode(value, options={}) {
    if(!names[value])return;
    mode=value;clock=0;clearInput();fixedAngle=null;
    if(options.reset!==false)state=create();
    paused=false;state.paused=false;carry=0;updateLabels();render();
  }
  function setPaused(value) {paused=Boolean(value);state.paused=paused;carry=0;clearInput();updateLabels();render();}
  function floor() {
    ctx.fillStyle="#29373d";ctx.fillRect(0,0,960,560);
    ctx.lineWidth=1;ctx.strokeStyle="#34434a";
    for(let y=100;y<510;y+=32){ctx.beginPath();ctx.moveTo(68,y+.5);ctx.lineTo(892,y+.5);ctx.stroke();}
    for(let x=68;x<892;x+=48){ctx.beginPath();ctx.moveTo(x+.5,100);ctx.lineTo(x+.5,510);ctx.stroke();}
    for(const box of boxes){ctx.fillStyle="#1d292f";ctx.fillRect(box.x,box.y,box.w,box.h);ctx.strokeStyle="#45575d";ctx.strokeRect(box.x+.5,box.y+.5,box.w-1,box.h-1);}
    const box=boxes[4];ctx.fillStyle="#4b595d";ctx.fillRect(box.x+5,box.y+5,box.w-10,box.h-10);ctx.strokeStyle="#697475";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(box.x+14,box.y+12);ctx.lineTo(box.x+box.w-14,box.y+box.h-12);ctx.moveTo(box.x+box.w-14,box.y+12);ctx.lineTo(box.x+14,box.y+box.h-12);ctx.stroke();
    ctx.font='12px system-ui,"Microsoft YaHei"';ctx.textAlign="center";ctx.fillStyle="#9ba9a6";ctx.fillText("障碍箱",box.x+box.w/2,box.y+box.h+18);
    ctx.fillStyle="#9daea4";for(const target of state.targets)ctx.fillText(target.hp>0?"训练靶":"已击中",target.x,target.y+34);
  }
  function render() {
    if(!ready)return;
    floor();const pose=M.draw(ctx,state,assets);
    if(q("guides").checked){ctx.save();ctx.setLineDash([5,6]);ctx.strokeStyle="#efbe7088";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pose.weapon.muzzleX,pose.weapon.muzzleY);ctx.lineTo(pose.weapon.muzzleX+Math.cos(state.angle)*220,pose.weapon.muzzleY+Math.sin(state.angle)*220);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle="#f7cd89";ctx.strokeRect(pose.weapon.muzzleX-3,pose.weapon.muzzleY-3,6,6);ctx.restore();}
    if(mouseAim&&mode==="free"){ctx.strokeStyle="#e4d8ae";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mouseAim.x-5,mouseAim.y);ctx.lineTo(mouseAim.x+5,mouseAim.y);ctx.moveTo(mouseAim.x,mouseAim.y-5);ctx.lineTo(mouseAim.x,mouseAim.y+5);ctx.stroke();}
    if(statusTimer<=0){q("status").textContent=`${state.walking?"移动中":"已站稳"} · 朝${state.facing>0?"右":"左"} · ${state.shotsFired}次开火 · ${state.hits}次命中`;statusTimer=.12;}
  }
  function tick(dt) {
    if(!ready||paused)return;
    clock+=dt;statusTimer-=dt;const input={paused:false};
    if(mode==="free"){
      input.moveX=Number(keys.has("KeyD")||keys.has("ArrowRight"))-Number(keys.has("KeyA")||keys.has("ArrowLeft"));
      input.moveY=Number(keys.has("KeyS")||keys.has("ArrowDown"))-Number(keys.has("KeyW")||keys.has("ArrowUp"));
      input.firing=firing||keys.has("Space");
      if(mouseAim){input.targetX=mouseAim.x;input.targetY=mouseAim.y;}else if(fixedAngle!==null)input.angle=fixedAngle;
    }else{
      input.firing=q("shoot").checked;
      if(mode==="moving"){input.moveX=Math.cos(clock*1.8);input.moveY=Math.sin(clock*1.8)*.5;input.angle=clock*.8;}
      if(mode==="turn"){input.angle=clock*.85;}
      if(mode==="strafe"){input.dx=(350+100*Math.sin(clock*1.5))-state.x;input.dy=360-state.y;input.targetX=756;input.targetY=195;}
      if(mode==="reverse"){input.dx=(350+95*Math.sin(clock*1.6))-state.x;input.dy=360-state.y;input.angle=Math.PI;}
    }
    M.step(state,input,dt);
  }
  function frame(time) {
    if(autoTick&&ready&&last){carry+=Math.min(.1,(time-last)/1000)*Number(q("speed").value);while(carry>=1/60){tick(1/60);carry-=1/60;}render();}
    last=time;requestAnimationFrame(frame);
  }
  function point(event) {const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height};}
  function goFree(reset=false){if(mode!=="free")setMode("free",{reset});}
  q("mode").onchange=()=>{if(ready)setMode(q("mode").value);};
  q("free").onclick=()=>{if(ready){setMode("free");canvas.focus();}};
  q("pause").onclick=()=>{if(ready)setPaused(!paused);};
  q("reset").onclick=()=>{if(ready)setMode(mode);};
  q("zoom").onchange=()=>{if(ready){state.pixelScale=Number(q("zoom").value);state.config.strideLength=34*state.pixelScale;render();}};
  q("guides").onchange=render;
  document.querySelectorAll("[data-angle]").forEach(button=>button.onclick=()=>{
    if(!ready)return;setMode("free",{reset:false});fixedAngle=Number(button.dataset.angle)*Math.PI/180;M.setAimAngle(state,fixedAngle);render();
  });
  canvas.addEventListener("pointermove",event=>{if(ready&&mode==="free"){mouseAim=point(event);fixedAngle=null;}});
  canvas.addEventListener("pointerdown",event=>{if(!ready||event.button!==0)return;goFree(false);canvas.focus();mouseAim=point(event);fixedAngle=null;firing=true;canvas.setPointerCapture(event.pointerId);event.preventDefault();});
  canvas.addEventListener("pointerup",()=>{firing=false;});canvas.addEventListener("pointercancel",()=>{firing=false;});
  window.addEventListener("pointerup",()=>{firing=false;});
  window.addEventListener("keydown",event=>{
    if(!ready||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
    if(event.code==="KeyP"&&!event.repeat){setPaused(!paused);event.preventDefault();return;}
    if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(event.code)){goFree(false);keys.add(event.code);event.preventDefault();}
  });
  window.addEventListener("keyup",event=>{keys.delete(event.code);});
  window.addEventListener("blur",()=>{if(ready){clearInput();setPaused(true);}});
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&ready)setPaused(true);});
  const load=(key,url)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{assets[key]=image;resolve();};image.onerror=()=>reject(new Error("人物素材未能加载，请重新打开预览页。"));image.src=url;});
  Promise.all([load("body",data.bodyAtlas),load("weapon",data.weaponImage)]).then(()=>{
    ready=true;state=create();updateLabels();q("status").dataset.ready="true";render();requestAnimationFrame(frame);
  }).catch(error=>{q("status").textContent=error.message;q("status").classList.add("error");q("status").dataset.ready="false";});
  // A small inspection API is used by offline verification and video export.
  window.compactReview={get state(){return state;},get assets(){return assets;},get ready(){return ready;},
    get mode(){return mode;},setMode,setPaused,render,tick,
    freeze(value=true){autoTick=!value;carry=0;},
    setAngle(degrees){setMode("free",{reset:false});fixedAngle=degrees*Math.PI/180;M.setAimAngle(state,fixedAngle);render();},
    snapshot(){const p=M.pose(state);return{x:state.x,y:state.y,phase:state.phase,walking:state.walking,bodyFrame:p.bodyFrame,
      facing:p.facing,depth:p.depth,angle:state.angle,weapon:p.weapon,shots:state.shotsFired,hits:state.hits,paused:state.paused};},
    async useEmbeddedAssets(sources){await Promise.all([load("body",sources.body),load("weapon",sources.weapon)]);canvas.width=960;render();}
  };
})();
