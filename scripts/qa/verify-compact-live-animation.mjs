import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'output/compact-enemies-2026-10-28');
const server=spawn(process.execPath,[path.join(root,'scripts/serve.mjs')],{cwd:root,env:{...process.env,GAME_PORT:'4195'},windowsHide:true,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:4195/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4195/?seed=17');await page.waitForFunction(()=>window.__WASTELAND_GAME__);
 await page.evaluate(()=>{const {model:m,renderer:r,app}=__WASTELAND_GAME__;app.stop();m.startRun({seed:17,tutorial:false});m.releaseAllEntities();m.obstacles.length=0;m.interactives.length=0;m.rebuildObstacleGrid();m.content.ids('enemies').forEach((id,i)=>m.spawnEnemy(id,m.run.player.x-350+i*100,m.run.player.y+120));r.handleEvents(m.drainEvents(),m);r.banner.life=0;r.render(m);});
 const settle=()=>page.evaluate(async()=>{const {model:m,renderer:r}=__WASTELAND_GAME__;for(let i=0;i<3;i++){r.render(m);await Promise.all(Object.values(r.artStore.images).map(image=>image.decode().catch(()=>{})));}});
 await settle();
 const animation=await page.evaluate(()=>{const {model:m,renderer:r}=__WASTELAND_GAME__,sets=Object.fromEntries(m.enemies.map(e=>[e.type,new Set()]));const initial=m.enemies.map(e=>({x:e.x,y:e.y}));for(let frame=0;frame<400;frame++){m.run.elapsed+=1/60;m.enemies.forEach((enemy,i)=>{enemy.x=initial[i].x+Math.cos(frame*.025)*30;enemy.y=initial[i].y+Math.sin(frame*.025)*30;enemy.heading=frame*.025+Math.PI/2;});r.render(m);for(const enemy of m.enemies){const state=r.compactActors.enemies.get(enemy);sets[enemy.type].add(state.frame);}}return Object.fromEntries(Object.entries(sets).map(([id,set])=>[id,[...set].sort()]));});
 for(const [id,frames]of Object.entries(animation))assert.equal(frames.length,8,id+' did not display all eight live frames');
 const viewports=[];
 for(const [width,height]of [[960,540],[1920,1080],[2560,1440]]){
  await page.setViewportSize({width,height});await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));__WASTELAND_GAME__.app.resize();});
  await settle();await page.screenshot({path:path.join(out,`combat-${height}.png`)});
  viewports.push(await page.evaluate(()=>{const r=__WASTELAND_GAME__.renderer;return{width:r.width,height:r.height,worldWidth:r.visibleWorldWidth,worldHeight:r.visibleWorldHeight};}));
 }
 await page.setViewportSize({width:1280,height:720});
 await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const {model:m,renderer:r,app}=__WASTELAND_GAME__;app.resize();m.startRun({seed:17,tutorial:false});m.releaseAllEntities();m.run.player.hp=m.run.player.maxHp=100000;m.content.ids('enemies').forEach((id,i)=>{const angle=i*Math.PI/4;m.spawnEnemy(id,m.run.player.x+Math.cos(angle)*270,m.run.player.y+Math.sin(angle)*240);});r.handleEvents(m.drainEvents(),m);r.banner.life=0;});
 await settle();
 const video=await page.evaluate(async()=>{
  const {model:m,renderer:r}=__WASTELAND_GAME__,canvas=document.querySelector('#game');
  const stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2500000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject});recorder.start();
  let start=performance.now(),last=start,accumulator=0,recorded=start;
  await new Promise(resolve=>{function tick(now){const elapsed=(now-start)/1000;if(elapsed>=8){resolve();return;}const dt=Math.min(.05,(now-last)/1000);last=now;accumulator+=dt;m.setInput({moveX:Math.cos(elapsed*1.2),moveY:Math.sin(elapsed*1.2),firing:false});while(accumulator>=1/60){if(m.screen==='levelup')m.chooseUpgrade(m.run.upgradeOptions[0].id);m.tick(1/60);accumulator-=1/60;}r.handleEvents(m.drainEvents(),m);r.updateEffects(dt);r.banner.life=0;r.render(m);if(now-recorded>=1000/30){track.requestFrame();recorded=now;}requestAnimationFrame(tick);}requestAnimationFrame(tick)});
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:'video/webm'});
  const base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
  const v=document.createElement('video');v.muted=true;const loaded=new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject});v.src=URL.createObjectURL(blob);await loaded;await v.play();await new Promise(resolve=>setTimeout(resolve,100));v.pause();return{base64,decoded:v.currentTime>0,width:v.videoWidth,height:v.videoHeight};
 });
 assert(video.decoded);const bytes=Buffer.from(video.base64,'base64');await fs.writeFile(path.join(out,'live-combat-demo.webm'),bytes);
 const fallback=await page.evaluate(()=>{const {model:m,renderer:r}=__WASTELAND_GAME__,ready=r.artStore.ready.bind(r.artStore);r.artStore.ready=id=>id.startsWith('actor.compact.')?false:ready(id);r.render(m);const before=m.run.player.x;m.setInput({moveX:1,moveY:0,firing:false});m.tick(1/60);r.render(m);r.artStore.ready=ready;return{screen:m.screen,moved:m.run.player.x!==before};});
 assert.equal(fallback.screen,'running');assert(fallback.moved);
 await page.goto(pathToFileURL(path.join(root,'art/characters/ranger/modular-grips-v3/review.html')).href);await page.waitForFunction(()=>window.arsenalReview?.ready);await page.evaluate(()=>{arsenalReview.freeze();arsenalReview.render();});
 assert.deepEqual(errors,[]);
 const proof={date:'2026-10-28',animation,viewports,missingArtFallback:fallback,legacyPreviewLoads:true,
  video:{bytes:bytes.length,decoded:video.decoded,width:video.width,height:video.height,seconds:8,scope:'scripted visual demonstration with stress health, not normal-health playtest'},pageErrors:errors};
 await fs.writeFile(path.join(root,'docs/qa/compact-live-animation-2026-10-28.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));
}finally{if(browser)await browser.close();server.kill();}
