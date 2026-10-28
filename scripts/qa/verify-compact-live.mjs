import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'output/compact-enemies-2026-10-28');
await fs.mkdir(out,{recursive:true});
const server=spawn(process.execPath,[path.join(root,'scripts/serve.mjs')],{cwd:root,env:{...process.env,GAME_PORT:'4194'},windowsHide:true,stdio:'ignore'});
let browser;
try {
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:4194/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4194/?seed=17');
 await page.waitForFunction(()=>window.__WASTELAND_GAME__);
 await page.evaluate(()=>__WASTELAND_GAME__.app.stop());
 const settle=async()=>{await page.evaluate(async()=>{const {renderer:r,model:m}=__WASTELAND_GAME__;await document.fonts.ready;for(let i=0;i<3;i++){r.render(m);await Promise.all(Object.values(r.artStore.images).map(image=>image.decode().catch(()=>{})));}r.frame+=60;r.render(m);});};
 await page.evaluate(()=>__WASTELAND_GAME__.model.setMenuPage('inventory'));
 await settle();await page.screenshot({path:path.join(out,'inventory-720.png')});
 const maps=await page.evaluate(()=>__WASTELAND_GAME__.content.ids('maps'));
 const scenes=[];
 for(const mapId of maps){
  await page.evaluate(mapId=>{const {model:m,renderer:r}=__WASTELAND_GAME__;m.startRun({mapId,seed:17,tutorial:false});m.releaseAllEntities();m.run.elapsed=70;const p=m.run.player;
   const offsets=[[-290,-80],[-150,-145],[135,-130],[300,-65],[-230,100],[-95,165],[155,150],[330,140]],types=m.content.ids('enemies');
   types.forEach((id,i)=>m.spawnEnemy(id,p.x+offsets[i][0],p.y+offsets[i][1]));
   r.handleEvents(m.drainEvents(),m);r.banner.life=0;
  },mapId);
  await settle();
  const record=await page.evaluate(()=>{const r=__WASTELAND_GAME__;return{mapId:r.model.run.mapId,hero:r.renderer.compactActors.info(),enemyTypes:r.model.enemies.map(e=>e.type),loaded:Object.keys(r.renderer.artStore.images)};});
  assert(record.hero.playerIntegrated);assert.equal(new Set(record.enemyTypes).size,8);
  await page.screenshot({path:path.join(out,`combat-${mapId}-720.png`)});scenes.push(record);
 }
 const directions=[];
 for(const weaponId of await page.evaluate(()=>__WASTELAND_GAME__.content.ids('weapons'))){
  for(let direction=0;direction<8;direction++){
   await page.evaluate(({weaponId,direction})=>{const {model:m,renderer:r}=__WASTELAND_GAME__;m.startRun({weaponId,seed:17,tutorial:false});m.releaseAllEntities();m.obstacles.length=0;m.interactives.length=0;m.rebuildObstacleGrid();r.handleEvents(m.drainEvents(),m);r.banner.life=0;const p=m.run.player,a=direction*Math.PI/4;m.spawnEnemy('brute',p.x+Math.cos(a)*180,p.y+Math.sin(a)*180);m.updatePlayer(0);},{weaponId,direction});
   await settle();
   const record=await page.evaluate(()=>{const {model:m,renderer:r}=__WASTELAND_GAME__,shot=m.projectiles[0],pose=r.compactActors.info().lastDraw;return{weaponId:m.run.player.weaponId,pose,shot:{x:shot.x,y:shot.y},delta:Math.hypot(shot.x-pose.muzzleX,shot.y-pose.muzzleY)};});
   assert(record.delta<1.5,weaponId+' rendered muzzle mismatch');directions.push({...record,direction});
  }
 }
 const movement=await page.evaluate(()=>{const {model:m,renderer:r}=__WASTELAND_GAME__;m.startRun({seed:17,tutorial:false});m.obstacles.length=0;m.interactives.length=0;m.rebuildObstacleGrid();r.handleEvents(m.drainEvents(),m);r.render(m);m.setInput({moveX:1,moveY:0,firing:false});for(let i=0;i<25;i++){m.run.elapsed+=1/60;m.updatePlayer(1/60);r.render(m);}const moving=r.compactActors.info().lastDraw;m.togglePause();for(let i=0;i<20;i++)r.render(m);const paused=r.compactActors.info().lastDraw;m.togglePause();m.setInput({moveX:0,moveY:0,firing:false});m.run.elapsed+=1/60;m.updatePlayer(1/60);r.render(m);return{moving,paused,stopped:r.compactActors.info().lastDraw};});
 assert(movement.moving.walking);assert.equal(movement.paused.phase,movement.moving.phase);assert.equal(movement.stopped.walking,false);
 const cache=await page.evaluate(()=>{const r=__WASTELAND_GAME__,a=r.renderer.compactActors.info().gripCache;for(let i=0;i<300;i++)r.renderer.render(r.model);return{before:a,after:r.renderer.compactActors.info().gripCache};});
 assert.equal(cache.before.builds,cache.after.builds);
 const cleanup=await page.evaluate(()=>{const r=__WASTELAND_GAME__;r.model.goToMenu();r.renderer.render(r.model);return{cache:r.renderer.compactActors.info().gripCache,retained:Object.keys(r.renderer.artStore.images).filter(id=>id.startsWith('actor.compact.')||id.startsWith('compact.part.'))};});
 assert.equal(cleanup.cache,null);assert.deepEqual(cleanup.retained,[]);
 await page.goto(pathToFileURL(path.join(root,'art/enemies/compact-v1/review.html')).href);
 await page.waitForFunction(()=>window.enemyReview?.ready);
 await page.evaluate(()=>{enemyReview.freeze();enemyReview.setTime(.18);});
 await page.screenshot({path:path.join(out,'enemy-review.png'),fullPage:true});
 await page.locator('#lineup').screenshot({path:path.join(out,'lineup.png')});
 assert.deepEqual(errors,[]);
 const proof={date:'2026-10-28',scenes,directionCases:directions.length,directions,movement,cache,cleanup,pageErrors:errors,
  limits:'Staged scenes and isolated browser checks; not physical-controller or real WebView2/minimum-hardware acceptance.'};
 await fs.writeFile(path.join(root,'docs/qa/compact-live-browser-2026-10-28.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({maps:scenes.length,enemies:8,directions:directions.length,walkPauseStop:true,cache,cleanup,pageErrors:errors}));
} finally {if(browser)await browser.close();server.kill();}
