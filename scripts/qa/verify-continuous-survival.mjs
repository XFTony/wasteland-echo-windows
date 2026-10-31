import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..'), out = path.join(root, 'output/continuous-survival-2026-10-28');
await fs.mkdir(out, { recursive: true });
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], { cwd: root, env: { ...process.env, GAME_PORT: '4241' }, windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:4241/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(), errors = [], missing = [], requests = new Set();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('/assets/')) missing.push(r.url()); if(r.url().includes('/audio/')) requests.add(new URL(r.url()).pathname); });
  await page.goto('http://127.0.0.1:4241/?menu=loadout&seed=1029');
  await page.waitForFunction(() => window.__WASTELAND_GAME__);
  await page.evaluate(() => {
    const { app, model: m, renderer: r, audio } = __WASTELAND_GAME__; app.stop(); app.startup.skip();
    window.survivalQA = {
      time: 100,
      render(dt = 1 / 60) {
        this.time += dt; const events = m.drainEvents(); r.handleEvents(events, m); audio.handle(events); r.updateEffects(dt, m);
        audio.update(dt, m.screen === 'running', m.run, m.screen);
        r.render(m, { ...app.inputManager.getPresentationState(), uiTime: this.time, focusAction: app.navigator.focusedAction });
        app.navigator.sync(r.regions, app.contextKey());
      },
      reset(mapId = 'echo_district') { app.resetInput(); m.startRun({ mapId, seed: 1029, tutorial: false }); m.updateSpawner = () => {}; m.run.player.xpNext = 100000; this.render(); },
      counter() { const s = m.interactives.find(i => i.type === 'tradePost'); Object.assign(m.run.player, { x: s.x, y: s.y + 20 }); this.render(); },
      menu() { m.goToMenu(); m.setMenuPage('loadout'); this.render(); }
    };
    survivalQA.render();
  });
  const settle = async () => page.evaluate(async () => {
    await document.fonts.ready; const r = __WASTELAND_GAME__.renderer;
    for (let i = 0; i < 5; i++) { survivalQA.render(.1); await Promise.all(Object.values(r.artStore.images).map(image => image.decode().catch(() => {}))); }
  });
  const click = async action => {
    const hit = await page.evaluate(a => { const r=__WASTELAND_GAME__.renderer, b=r.regions.find(b=>b.action===a); if(!b)throw Error('Missing action '+a); return {x:b.x+b.w/2,y:b.y+b.h/2}; }, action);
    await page.mouse.click(hit.x,hit.y); await page.evaluate(() => survivalQA.render());
  };
  await page.keyboard.press('Enter'); await page.evaluate(() => survivalQA.render());
  // Use a real input gesture to unlock sound, then return to the deployment fixture.
  await page.evaluate(() => survivalQA.menu()); await settle();
  const layouts=[];
  for (const [width,height] of [[960,540],[1280,720],[1920,1080],[2560,1440]]) {
    await page.setViewportSize({width,height}); await page.evaluate(() => {__WASTELAND_GAME__.app.resize();survivalQA.menu();}); await settle();
    await page.screenshot({path:path.join(out,`deployment-${height}.png`)});
    const deployment = await page.evaluate(() => __WASTELAND_GAME__.renderer.regions.map(r=>r.action));
    assert(!deployment.some(a=>/^stage|^mode/.test(a))); assert(deployment.includes('mapNext'));
    await click('deploy'); await page.evaluate(() => {survivalQA.counter();__WASTELAND_GAME__.model.run.scrap=300;});
    await page.keyboard.press('KeyE'); await page.evaluate(() => survivalQA.render());
    assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.model.screen),'fieldShop');
    const tabs=[];
    for(const tab of ['supplies','arsenal','support']) {
      await click('fieldTab:'+tab); await settle(); await page.screenshot({path:path.join(out,`shop-${tab}-${height}.png`)});
      const regions=await page.evaluate(()=>__WASTELAND_GAME__.renderer.regions.map(b=>({action:b.action,x:b.x,y:b.y,w:b.w,h:b.h})));
      for(const b of regions)assert(b.x>=0&&b.y>=0&&b.x+b.w<=width+.1&&b.y+b.h<=height+.1,`${height} ${b.action}`);
      tabs.push({tab,actions:regions.map(b=>b.action)});
    }
    layouts.push({width,height,deployment,tabs});
  }
  console.log('Checked deployment and three shop tabs at four resolutions.');
  await page.setViewportSize({width:1280,height:720}); await page.evaluate(()=>{__WASTELAND_GAME__.app.resize();survivalQA.reset();survivalQA.counter();__WASTELAND_GAME__.model.run.scrap=300;});
  await page.keyboard.press('KeyE'); await page.evaluate(()=>survivalQA.render()); await click('fieldTab:arsenal'); await click('arsenalBuy:breaker_shotgun');
  assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.model.run.player.weaponId),'breaker_shotgun');
  await click('fieldTab:supplies'); await click('fieldBuy:weaponCalibration');
  await click('fieldTab:support'); await click('fieldBuy:turretKit'); await click('fieldClose');
  const frozen=await page.evaluate(()=>{const m=__WASTELAND_GAME__.model;survivalQA.counter();m.fieldMarket.open();const t=m.run.elapsed;for(let i=0;i<600;i++)m.tick(1/60);m.fieldMarket.close();return{before:t,after:m.run.elapsed};});assert.equal(frozen.before,frozen.after);
  await page.evaluate(()=>{const {model:m,app}=__WASTELAND_GAME__;app.resetInput();m.run.player.x+=140; m.run.player.lastAimX=1;m.run.player.lastAimY=0;survivalQA.render();});
  await page.keyboard.press('KeyT'); await page.evaluate(()=>survivalQA.render());
  assert(await page.evaluate(()=>__WASTELAND_GAME__.model.run.placement)); await settle(); await page.screenshot({path:path.join(out,'turret-placement.png')});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.model.run.placement),null);
  await page.keyboard.press('KeyT'); await page.evaluate(()=>survivalQA.render());
  // Aim at the open square and confirm through the real pointer path.
  const ground=await page.evaluate(()=>{const r=__WASTELAND_GAME__.renderer,p=__WASTELAND_GAME__.model.run.player;return{x:(p.x+90-r.camera.x)*r.camera.zoom,y:(p.y-r.camera.y)*r.camera.zoom};});
  await page.mouse.move(ground.x,ground.y);await page.mouse.click(ground.x,ground.y);await page.evaluate(()=>survivalQA.render());
  assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.model.run.structures.length),1);
  await page.evaluate(()=>{const m=__WASTELAND_GAME__.model,t=m.run.structures[0];m.spawnEnemy('brute',t.x+170,t.y-20);m.run.player.weaponCooldown=0;for(let i=0;i<30;i++)m.tick(1/60);survivalQA.render();});
  await settle();await page.screenshot({path:path.join(out,'turret-combat.png')});
  const maps=[];
  for(const id of ['echo_district','freight_nexus','red_basin']) {
    await page.evaluate(id=>{survivalQA.reset(id);survivalQA.counter();},id);await settle();await page.screenshot({path:path.join(out,`map-${id}.png`)});
    maps.push(await page.evaluate(()=>{const m=__WASTELAND_GAME__.model;return{id:m.run.mapId,endless:m.run.endless,stage:m.run.stageId,stationAccessible:!!m.fieldMarket.nearest()};}));
  }
  await page.evaluate(()=>{const m=__WASTELAND_GAME__.model;m.run.player.xp=m.run.player.xpNext;m.checkLevelUp();m.run.upgradeOptions=['engineering','turretRepair','endlessPower','endlessSupplies'].map(id=>m.content.upgrades[id]);survivalQA.render();});
  await settle();await page.screenshot({path:path.join(out,'engineering-upgrades.png')}); await click('upgrade:engineering');
  // Validate the actual decoded recordings and advancing streamed music, not the synth fallback.
  const audioProof=await page.evaluate(async()=>{
    const {audio:a,model:m}=__WASTELAND_GAME__;a.unlock();
    await Promise.all(m.content.ids('weapons').map(id=>a.bank.prepare(a.context,id)));
    a.update(1,false,null,'menu');await new Promise(r=>setTimeout(r,300));
    const menu=a.music.slots.find(s=>s.id==='theme_menu');const before=menu.element.currentTime;await new Promise(r=>setTimeout(r,200));assertBrowser(menu.element.currentTime>before,'menu music must advance');
    a.update(1,true,m.run,'running');await new Promise(r=>setTimeout(r,200));
    const combat=a.music.slots.find(s=>s.id==='theme_combat');assertBrowser(combat.element.currentTime>0,'combat music playing');
    m.run.activeBosses=1;a.update(1,true,m.run,'running');await new Promise(r=>setTimeout(r,200));const pressure=a.music.slots.find(s=>s.id==='theme_pressure');assertBrowser(pressure.element.currentTime>0,'pressure music playing');m.run.activeBosses=0;
    const starts=a.soundStats.recorded;for(const id of m.content.ids('weapons'))a.playShot(id,{interval:.3});
    assertBrowser(a.soundStats.recorded-starts===7,'seven recorded shots');
    a.setSettings({musicMuted:true,sfxMuted:true});assertBrowser(a.music.slots.every(s=>s.element.volume===0),'music mute');const count=a.soundStats.recorded;assertBrowser(!a.playShot('scrap_pistol')&&a.soundStats.recorded===count,'sfx mute');
    a.suspend();assertBrowser(a.music.slots.every(s=>s.element.paused),'hide pauses music');
    a.setSettings({musicMuted:false,sfxMuted:false});a.unlock();a.update(1,true,m.run,'running');
    return{decoded:a.bank.stats,recordedShots:a.soundStats.recorded,fallbackShots:a.soundStats.fallback,maxMusicChannels:a.music.slots.length,musicAdvances:true,muteVerified:true,hideVerified:true};
    function assertBrowser(value,label){if(!value)throw Error(label);}
  });
  console.log('Verified seven decoded recordings, three advancing themes, mute and hide.');
  // Capture a short actual-renderer demo and its WebAudio mix in this isolated QA context.
  const demo=await page.evaluate(async()=>{
    const {audio:a,model:m,renderer:r}=__WASTELAND_GAME__,canvas=document.querySelector('#game');survivalQA.reset();
    const dest=a.context.createMediaStreamDestination(),original=a.sfxDestination();original.connect(dest);
    const create=a.music.createAudio;a.music.createAudio=src=>{const e=create(src),source=a.context.createMediaElementSource(e);source.connect(a.context.destination);source.connect(dest);return e;};
    for(const s of a.music.slots){const source=a.context.createMediaElementSource(s.element);source.connect(a.context.destination);source.connect(dest);}
    const stream=canvas.captureStream(30);for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
    const chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:2200000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject;});
    const ids=m.content.ids('weapons');let index=-1,start=performance.now(),last=start,acc=0;recorder.start();
    await new Promise(resolve=>{function frame(now){const t=(now-start)/1000,dt=Math.min(.05,(now-last)/1000);last=now;if(t>=14){resolve();return;}
      const next=Math.min(ids.length-1,Math.floor(t/2));if(next!==index){index=next;m.releaseAllEntities();m.run.player.weaponId=ids[index];m.run.arsenal[ids[index]]={tier:1,calibration:0};m.run.player.weaponCooldown=0;const e=m.spawnEnemy('brute',m.run.player.x+220,m.run.player.y+40);e.hp=e.maxHp=50000;a.prepareWeapon(ids[index]);}
      m.setInput({moveX:Math.sin(t*3)*.2,moveY:Math.cos(t*3)*.2});acc+=dt;while(acc>=1/60){m.tick(1/60);acc-=1/60;}survivalQA.render(dt);r.banner.life=0;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());original.disconnect(dest);
    const blob=new Blob(chunks,{type:'video/webm'}),base64=await new Promise(resolve=>{const f=new FileReader();f.onload=()=>resolve(f.result.split(',')[1]);f.readAsDataURL(blob);});
    const v=document.createElement('video');v.muted=true;const ready=new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject;});v.src=URL.createObjectURL(blob);await ready;await v.play();await new Promise(r=>setTimeout(r,100));v.pause();
    return{base64,decoded:v.currentTime>0,width:v.videoWidth,height:v.videoHeight,audioTracks:stream.getAudioTracks().length};
  });
  assert(demo.decoded&&demo.audioTracks===1);const video=Buffer.from(demo.base64,'base64');delete demo.base64;await fs.writeFile(path.join(out,'survival-seven-guns.webm'),video);demo.bytes=video.length;
  await page.evaluate(()=>{const m=__WASTELAND_GAME__.model;m.run.elapsed=1211;m.togglePause();survivalQA.render();});await click('quit');await page.evaluate(()=>survivalQA.render());
  assert.equal(await page.evaluate(()=>__WASTELAND_GAME__.model.run.result),'retire');await page.screenshot({path:path.join(out,'retirement.png')});
  const scaling=[];
  for(const dpr of [1.25,1.5]){
    const c=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:4241/?menu=loadout');await p.waitForFunction(()=>window.__WASTELAND_GAME__);
    await p.evaluate(()=>{const {app,model:m,renderer:r}=__WASTELAND_GAME__;app.stop();m.startRun({tutorial:false});const s=m.interactives.find(i=>i.type==='tradePost');Object.assign(m.run.player,{x:s.x,y:s.y+20});m.run.scrap=100;m.fieldMarket.open();r.render(m);});
    const target=await p.evaluate(()=>{const b=__WASTELAND_GAME__.renderer.regions.find(r=>r.action==='fieldBuy:weaponCalibration');return{x:b.x+b.w/2,y:b.y+b.h/2};});await p.mouse.click(target.x,target.y);
    assert.equal(await p.evaluate(()=>__WASTELAND_GAME__.model.run.arsenal.scrap_pistol.calibration),1);scaling.push({dpr,clickVerified:true});await c.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  const proof={date:'2026-10-29',pageErrors:errors,missingAssets:missing,isolatedProfile:true,layouts,maps,audio:audioProof,audioRequests:[...requests],video:demo,scaling,keyboardAndPointerDeployment:true,shopFreezesClock:true,retirement:true,realGamepadVerified:false,realWebViewLongRunVerified:false};
  await fs.writeFile(path.join(root,'docs/qa/continuous-survival-browser-2026-10-28.json'),JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({pageErrors:errors,layouts:layouts.length,maps:maps.length,audio:audioProof,videoBytes:video.length,scaling}));
} finally { await browser?.close(); server.kill(); }
