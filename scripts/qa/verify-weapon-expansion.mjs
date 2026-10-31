import fs from'node:fs/promises';import path from'node:path';import http from'node:http';import{chromium}from'playwright-core';import assert from'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'output/weapon-expansion-2026-10-29');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});let server;
try{
 server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),target=path.resolve(root,'.'+decodeURIComponent(url.pathname)),web=path.join(root,'web');if(!target.startsWith(web+path.sep)&&target!==web&&!target.startsWith(out+path.sep)){res.writeHead(403).end();return;}let file=target;if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.wav':'audio/wav','.ogg':'audio/ogg'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(4245,'127.0.0.1',resolve));
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4245/output/weapon-expansion-2026-10-29/workshop.html');await page.waitForFunction(()=>window.weaponWorkshop);
 await page.evaluate(()=>{
  const{app,model:m,renderer:r,audio:a}=__WASTELAND_GAME__;app.stop();a.setSettings({sfxMuted:true,musicMuted:true});
  window.expansionQA={now:100,draw(dt=0){const events=m.drainEvents();r.handleEvents(events,m);a.handle(events);r.updateEffects(dt,m);this.now+=dt;r.render(m,{...app.inputManager.getPresentationState(),uiTime:this.now});app.navigator.sync(r.regions,app.contextKey());r.banner.life=0;},
   reset(id){weaponWorkshop.reset(id);this.draw();},step(n){for(let i=0;i<n;i++){m.setInput({moveX:0,moveY:0,firing:false});m.tick(1/60);this.draw(1/60);}}};
 });
 const settle=async()=>page.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++){expansionQA.draw();const r=__WASTELAND_GAME__.renderer;await Promise.all(Object.values(r.artStore.images).map(image=>image.decode().catch(()=>{})));}});
 const ids=['prism_laser','slag_launcher','saw_disc','echo_blade','shock_hammer'],results=[];
 for(const id of ids){
  await page.selectOption('#weapon',id);await settle();await page.evaluate(()=>__WASTELAND_GAME__.app.stop());
  await page.evaluate(id=>{expansionQA.reset(id);expansionQA.step({prism_laser:1,slag_launcher:10,saw_disc:10,echo_blade:10,shock_hammer:22}[id]);},id);await settle();
  const state=await page.evaluate(()=>{const{model:m,renderer:r}=__WASTELAND_GAME__;return{weaponId:m.run.player.weaponId,compactWeapon:r.compactActors.lastDraw?.weaponId,shots:m.run.shotsFired,melee:m.run.meleeHits,enemyDamage:m.enemies.map(e=>e.maxHp-e.hp),fx:m.run.attackEffects.filter(e=>e.active).map(e=>e.kind),attack:m.run.attack?.type,gripBytes:r.compactActors.grips?.info().bytes};});
  assert.equal(state.compactWeapon,id);assert(state.shots>0);await page.screenshot({path:path.join(out,id+'.png')});results.push(state);
  await page.evaluate(()=>{__WASTELAND_GAME__.model.save.settings.flashes='off';expansionQA.draw();});await page.screenshot({path:path.join(out,id+'-low-flash.png')});await page.evaluate(()=>{__WASTELAND_GAME__.model.save.settings.flashes='low';});
  if(id==='slag_launcher'){await page.evaluate(()=>expansionQA.step(21));await page.screenshot({path:path.join(out,'slag-explosion.png')});}
 }
 console.log('Captured all five weapons from the real runtime and verified compact held parts.');
 const poses=await page.evaluate(()=>{
  const{model:m,renderer:r}=__WASTELAND_GAME__,board=document.createElement('canvas');board.width=2080;board.height=1300;const c=board.getContext('2d');c.fillStyle='#263129';c.fillRect(0,0,board.width,board.height);
  const saved={ctx:r.ctx,camera:{...r.camera},width:r.width,height:r.height};const ids=['prism_laser','slag_launcher','saw_disc','echo_blade','shock_hammer'],checks=[];
  try{r.ctx=c;r.width=260;r.height=260;
   for(let row=0;row<ids.length;row++)for(let col=0;col<8;col++){
    weaponWorkshop.reset(ids[row]);r.ctx=c;const p=m.run.player,angle=[0,45,90,135,180,-135,-90,-45][col]*Math.PI/180;
    m.save.settings.autoAim=false;m.save.settings.autoFire=false;p.lastAimX=Math.cos(angle);p.lastAimY=Math.sin(angle);p.compactFacing=Math.cos(angle)<-.1?-1:1;
    m.fireWeapon(p.lastAimX,p.lastAimY);const age=ids[row]==='echo_blade'?.17:ids[row]==='shock_hammer'?.31:0;m.run.elapsed=age;m.weaponActions.update(0);
    r.camera.x=p.x-125;r.camera.y=p.y-165;r.compactActors.playerRun=m.run;r.compactActors.playerState=r.compactActors.stateFor(ids[row]);r.compactActors.playerState.pixelScale=2.3;
    c.save();c.beginPath();c.rect(col*260,row*260,260,260);c.clip();c.translate(col*260,row*260);r.compactActors.drawPlayer(r,p,m.run,false);c.font='12px Microsoft YaHei';c.fillStyle='#d8c592';c.fillText(m.content.weapons[ids[row]].name,10,20);c.fillText([0,45,90,135,180,-135,-90,-45][col]+'°',10,40);c.restore();
    checks.push({weapon:ids[row],angle:Math.round(angle*180/Math.PI),frame:r.compactActors.lastDraw.frame,weaponAngle:r.compactActors.lastDraw.weaponAngle});
   }
  }finally{r.ctx=saved.ctx;Object.assign(r.camera,saved.camera);r.width=saved.width;r.height=saved.height;}
  return{base64:board.toDataURL('image/png').split(',')[1],checks};
 });
 await fs.writeFile(path.join(out,'five-weapons-eight-directions.png'),Buffer.from(poses.base64,'base64'));delete poses.base64;
 await page.evaluate(()=>{__WASTELAND_GAME__.app.stop();expansionQA.reset('echo_blade');});await settle();
 // Verify actual samples, not synthesizer fallback. The file workshop embeds short WAV data.
 await page.click('#reset');await page.evaluate(()=>__WASTELAND_GAME__.app.stop());
 const audio=await page.evaluate(async()=>{const{audio:a,model:m}=__WASTELAND_GAME__;a.setSettings({sfxMuted:false,musicMuted:false});a.unlock();
  await Promise.all(m.content.ids('weapons').map(id=>a.bank.prepare(a.context,id)));await Promise.all(['explosion','hammer_impact','melee_hit','ricochet'].map(id=>a.bank.prepare(a.context,id)));
  const before=a.soundStats.recorded;for(const id of m.content.ids('weapons'))a.playShot(id);return{played:a.soundStats.recorded-before,failed:a.bank.stats.failed,decoded:a.bank.stats.decodedBytes,loaded:a.bank.stats.loaded,isolated:weaponWorkshop.isolated};});
 assert.equal(audio.played,12);assert.equal(audio.failed,0);assert(audio.isolated);
 const demo=await page.evaluate(async()=>{
  const{app,model:m,renderer:r,audio:a}=__WASTELAND_GAME__,canvas=document.getElementById('game');app.stop();
  const dest=a.context.createMediaStreamDestination(),bus=a.sfxDestination();bus.connect(dest);
  const stream=canvas.captureStream(30);for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
  const chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:2300000});rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=reject;});
  const ids=['prism_laser','slag_launcher','saw_disc','echo_blade','shock_hammer','breaker_shotgun','needle_rifle'];let current=-1,start=performance.now(),last=start,acc=0;rec.start();
  await new Promise(resolve=>{function frame(now){const t=(now-start)/1000,dt=Math.min(.05,(now-last)/1000);last=now;if(t>=14){resolve();return;}const index=Math.floor(t/2);if(index!==current){current=index;expansionQA.reset(ids[index]);a.setSettings({sfxMuted:false,musicMuted:false});a.prepareWeapon(ids[index]);}
   m.setInput({moveX:Math.sin(t*2)*.12,moveY:Math.cos(t*2)*.12});acc+=dt;while(acc>=1/60){m.tick(1/60);acc-=1/60;}expansionQA.draw(dt);r.banner.life=0;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  rec.stop();await stopped;stream.getTracks().forEach(t=>t.stop());bus.disconnect(dest);const blob=new Blob(chunks,{type:'video/webm'}),base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});
  const v=document.createElement('video');v.muted=true;const ready=new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject;});v.src=URL.createObjectURL(blob);await ready;await v.play();await new Promise(r=>setTimeout(r,100));v.pause();return{base64,decoded:v.currentTime>0,audioTracks:stream.getAudioTracks().length};
 });assert(demo.decoded&&demo.audioTracks===1);const video=Buffer.from(demo.base64,'base64');delete demo.base64;demo.bytes=video.length;await fs.writeFile(path.join(out,'weapon-expansion.webm'),video);
 console.log('Verified sampled playback of all twelve weapons and recorded a 14-second real-renderer demo.');
 // Normal web entry and purchases, without the workshop fixture.
 const normal=await context.newPage();normal.on('pageerror',e=>errors.push(e.message));await normal.goto('http://127.0.0.1:4245/web/?menu=loadout');await normal.waitForFunction(()=>window.__WASTELAND_GAME__);
 const layouts=[];
 for(const[width,height]of[[960,540],[1280,720],[1920,1080],[2560,1440]]){
  await normal.setViewportSize({width,height});
  await normal.evaluate(async()=>{const{app,model:m,renderer:r}=__WASTELAND_GAME__;app.stop();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));app.resize();m.startRun({tutorial:false});const s=m.interactives.find(i=>i.type==='tradePost');Object.assign(m.run.player,{x:s.x,y:s.y+20});m.run.scrap=300;m.fieldMarket.open();m.run.fieldMarket.tab='arsenal';await document.fonts.ready;for(let i=0;i<4;i++){r.render(m);await Promise.all(Object.values(r.artStore.images).map(image=>image.decode().catch(()=>{})));}await new Promise(resolve=>requestAnimationFrame(resolve));r.render(m);});
  const actions=await normal.evaluate(()=>__WASTELAND_GAME__.renderer.regions.map(b=>({...b})));for(const b of actions)assert(b.x>=0&&b.y>=0&&b.x+b.w<=width+.1&&b.y+b.h<=height+.1);
  const visibleSamples=await normal.evaluate(()=>{const c=document.getElementById('game'),ctx=c.getContext('2d');let count=0;for(let y=1;y<6;y++)for(let x=1;x<8;x++){const p=ctx.getImageData(Math.floor(c.width*x/8),Math.floor(c.height*y/6),1,1).data;if(p[0]+p[1]+p[2]>45)count++;}return count;});assert(visibleSamples>12,'Market canvas must be visibly rendered before screenshot');
  await normal.screenshot({path:path.join(out,`field-weapons-${height}.png`)});layouts.push({width,height,visibleSamples,actions:actions.map(b=>b.action)});
 }
 for(const id of ids){
  await normal.evaluate(()=>{const m=__WASTELAND_GAME__.model;m.run.scrap=300;m.run.fieldMarket.tab='arsenal';__WASTELAND_GAME__.renderer.render(m);});
  const b=await normal.evaluate(id=>{const b=__WASTELAND_GAME__.renderer.regions.find(b=>b.action==='arsenalBuy:'+id);return{x:b.x+b.w/2,y:b.y+b.h/2};},id);
  await normal.mouse.click(b.x,b.y);assert.equal(await normal.evaluate(()=>__WASTELAND_GAME__.model.run.player.weaponId),id);
 }
 await normal.evaluate(()=>{const{model:m,renderer:r}=__WASTELAND_GAME__;m.goToMenu();m.setMenuPage('shop');m.shopPage=0;r.render(m);});await normal.screenshot({path:path.join(out,'camp-weapons-page1.png')});
 const buy=await normal.evaluate(()=>{const b=__WASTELAND_GAME__.renderer.regions.find(b=>b.action==='buy:buy_echo_blade');return{x:b.x+b.w/2,y:b.y+b.h/2};});await normal.mouse.click(buy.x,buy.y);assert(await normal.evaluate(()=>__WASTELAND_GAME__.model.save.unlockedWeapons.includes('echo_blade')));
 assert.deepEqual(errors,[]);const proof={date:'2026-10-29',pageErrors:errors,workshopIsolated:true,newWeapons:results,eightDirectionPoses:poses.checks,audio,video:demo,layouts,realFieldPurchase:true,realPermanentPurchase:true,physicalGamepad:false,nativeLowSpecLongRun:false};
 await fs.writeFile(path.join(root,'docs/qa/weapon-expansion-browser-2026-10-29.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({weapons:results.length,poses:poses.checks.length,audio,videoBytes:video.length,layouts:layouts.length,pageErrors:errors}));
}finally{await browser.close();server?.close();}
