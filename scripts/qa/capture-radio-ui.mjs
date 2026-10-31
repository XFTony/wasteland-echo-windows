import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'output/radio-ui-2026-10-28');
await fs.mkdir(out,{recursive:true});
const server=spawn(process.execPath,[path.join(root,'scripts/serve.mjs')],{cwd:root,env:{...process.env,GAME_PORT:'4211'},windowsHide:true,stdio:'ignore'});
let browser;
try {
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:4211/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4211/?seed=17');await page.waitForFunction(()=>window.__WASTELAND_GAME__);
 await page.waitForTimeout(850);await page.screenshot({path:path.join(out,'startup-720.png')});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>!__WASTELAND_GAME__.app.startup.state.active);
 assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.model.menuPage),'main','skip must not open deployment');
 await page.evaluate(()=>__WASTELAND_GAME__.app.stop());
 const settle=async()=>page.evaluate(async()=>{const {model:m,renderer:r}=__WASTELAND_GAME__;await document.fonts.ready;for(let i=0;i<3;i++){r.render(m);await Promise.all(Object.values(r.artStore.images).map(image=>image.decode().catch(()=>{})));}r.frame+=60;r.render(m);});
 const records=[];
 for(const [width,height,pages]of [[1280,720,['main','loadout','inventory','shop','settings','credits']],[960,540,['main','inventory','shop','settings']],[1920,1080,['main','loadout']],[2560,1440,['main','shop']]]){
  await page.setViewportSize({width,height});await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));__WASTELAND_GAME__.app.resize();});
  await page.evaluate(()=>{const {model:m,renderer:r}=__WASTELAND_GAME__;m.goToMenu();r.render(m,{startup:{active:true,elapsed:1.4,progress:.65,assetsReady:true}});});
  await page.screenshot({path:path.join(out,`startup-layout-${height}.png`)});
  for(const menu of pages){
   await page.evaluate(menu=>{const m=__WASTELAND_GAME__.model;m.goToMenu();m.setMenuPage(menu);},menu);await settle();
   await page.screenshot({path:path.join(out,`${menu}-${height}.png`)});
   const record=await page.evaluate(()=>{const r=__WASTELAND_GAME__.renderer;return{width:r.width,height:r.height,actions:r.regions.map(a=>({...a}))};});
   for(const action of record.actions)assert(action.x>=-1&&action.y>=-1&&action.x+action.w<=width+1&&action.y+action.h<=height+1,menu+' / '+action.action);
   records.push({menu,...record});
  }
 }
 await page.setViewportSize({width:960,height:540});await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));__WASTELAND_GAME__.app.resize();});
 for(const category of ['equipment','outfit']){await page.evaluate(category=>{const m=__WASTELAND_GAME__.model;m.setMenuPage('shop');m.shopCategory=category;},category);await settle();await page.screenshot({path:path.join(out,`shop-${category}-540.png`)});}
 for(const menu of ['shop','settings','inventory']){await page.evaluate(menu=>{const m=__WASTELAND_GAME__.model;m.save.settings.uiScale=1.2;m.setMenuPage(menu);if(menu==='shop')m.shopCategory='weapon';},menu);await settle();await page.screenshot({path:path.join(out,`${menu}-scale120-540.png`)});}
 await page.evaluate(()=>{__WASTELAND_GAME__.model.save.settings.uiScale=1;});
 await page.evaluate(()=>{const m=__WASTELAND_GAME__.model;m.setMenuPage('settings');m.setSettingsSection('controls');});await settle();await page.screenshot({path:path.join(out,'controls-540.png')});
 await page.setViewportSize({width:1280,height:720});await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));__WASTELAND_GAME__.app.resize();const {model:m,renderer:r}=__WASTELAND_GAME__;m.startRun({seed:17,tutorial:false});m.run.elapsed=60;m.spawnEnemy('drifter',m.run.player.x+120,m.run.player.y-50);m.spawnEnemy('brute',m.run.player.x-100,m.run.player.y+80);r.handleEvents(m.drainEvents(),m);r.banner.life=0;});
 await settle();await page.screenshot({path:path.join(out,'combat-720.png')});
 await page.evaluate(()=>{const m=__WASTELAND_GAME__.model;m.run.player.xp=m.run.player.xpNext;m.checkLevelUp();});await settle();await page.screenshot({path:path.join(out,'upgrade-720.png')});
 await page.evaluate(()=>{__WASTELAND_GAME__.model.screen='paused';});await settle();await page.screenshot({path:path.join(out,'pause-720.png')});
 await page.evaluate(()=>__WASTELAND_GAME__.model.finishRun('win'));await settle();await page.screenshot({path:path.join(out,'result-720.png')});
 let interaction=null,video=null;
 if(process.argv.includes('--full')) {
  await page.goto('http://127.0.0.1:4211/?menu=settings');
  await page.waitForFunction(()=>window.__WASTELAND_GAME__);
  const recording=await page.evaluate(async()=>{
   const {app,model:m}=__WASTELAND_GAME__,canvas=document.querySelector('#game');
   const stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],chunks=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2200000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject});
   app.handleAction('replayStartup');recorder.start();const started=performance.now();let last=started,settingsShown=false;
   await new Promise(resolve=>{function tick(now){const t=(now-started)/1000;if(t>=7){resolve();return;}if(t>4.6&&!settingsShown){settingsShown=true;app.handleAction('settings');}if(now-last>=1000/30){track.requestFrame();last=now;}requestAnimationFrame(tick)}requestAnimationFrame(tick)});
   recorder.stop();await stopped;stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:'video/webm'});
   const base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
   const player=document.createElement('video');player.muted=true;const loaded=new Promise((resolve,reject)=>{player.onloadeddata=resolve;player.onerror=reject});player.src=URL.createObjectURL(blob);await loaded;await player.play();await new Promise(resolve=>setTimeout(resolve,100));player.pause();return{base64,decoded:player.currentTime>0,width:player.videoWidth,height:player.videoHeight};
  });
  assert(recording.decoded);const bytes=Buffer.from(recording.base64,'base64');await fs.writeFile(path.join(out,'startup-and-menu.webm'),bytes);
  video={bytes:bytes.length,decoded:true,width:recording.width,height:recording.height,seconds:7};
  await page.evaluate(()=>__WASTELAND_GAME__.model.updateSetting('introAnimation',false));
  await page.goto('http://127.0.0.1:4211/');await page.waitForFunction(()=>window.__WASTELAND_GAME__);
  assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.app.startup.active),false,'disabled intro must survive reload');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>__WASTELAND_GAME__.model.menuPage==='loadout');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>__WASTELAND_GAME__.model.screen==='running');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__WASTELAND_GAME__.model.screen==='paused');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__WASTELAND_GAME__.model.screen==='running');
  await page.evaluate(()=>{__WASTELAND_GAME__.model.updateSetting('introAnimation',true);});
  await page.goto('http://127.0.0.1:4211/');await page.waitForFunction(()=>window.__WASTELAND_GAME__);
  await page.mouse.click(200,590);await page.waitForFunction(()=>!__WASTELAND_GAME__.app.startup.active);
  assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.model.menuPage),'main','click-through must not activate start');
  const reduced=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'}),reducedPage=await reduced.newPage();
  await reducedPage.goto('http://127.0.0.1:4211/');await reducedPage.waitForFunction(()=>window.__WASTELAND_GAME__);
  assert.equal(await reducedPage.evaluate(()=>__WASTELAND_GAME__.app.startup.active),false);await reduced.close();
  const missing=await browser.newContext({viewport:{width:1280,height:720}}),missingPage=await missing.newPage();
  await missingPage.route('**/ui/radio-v1/*.webp',route=>route.abort());
  const began=Date.now();await missingPage.goto('http://127.0.0.1:4211/');await missingPage.waitForFunction(()=>window.__WASTELAND_GAME__&&!__WASTELAND_GAME__.app.startup.active,{timeout:6000});
  assert.equal(await missingPage.evaluate(()=>__WASTELAND_GAME__.model.menuPage),'main');
  const missingFallbackMs=Date.now()-began;await missingPage.screenshot({path:path.join(out,'missing-background-fallback.png')});await missing.close();
  interaction={disabledSettingPersists:true,keyboardMenuDeployPauseResume:true,mouseSkipDoesNotActivate:true,reducedMotionBypassesIntro:true,missingBackgroundExits:true,missingFallbackMs};
 }
 assert.deepEqual(errors,[]);
 const proof={date:'2026-10-28',records,pageErrors:errors,interaction,video,limits:'Isolated Edge/browser checks, not physical gamepad or real WebView2 long-run acceptance.'};
 await fs.writeFile(path.join(out,'screenshots.json'),JSON.stringify(proof,null,2)+'\n');
 if(interaction)await fs.writeFile(path.join(root,'docs/qa/radio-ui-browser-2026-10-28.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({pages:records.length,modals:4,startupSkipDoesNotActivate:true,interaction,video,pageErrors:errors}));
} finally {if(browser)await browser.close();server.kill();}
