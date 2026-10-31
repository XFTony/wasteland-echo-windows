import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {chromium} from 'playwright-core';
const root=path.resolve(import.meta.dirname,'../..'),art=path.join(root,'art/characters/ranger/compact-arsenal-v2'),out=path.join(root,'output/compact-arsenal-2026-10-27');
const data=JSON.parse(await fs.readFile(path.join(art,'metadata.json'),'utf8'));await fs.mkdir(out,{recursive:true});
const embedded={body:'data:image/png;base64,'+(await fs.readFile(path.join(art,data.bodyAtlas))).toString('base64'),weapons:{}};
for(const w of data.weapons)embedded.weapons[w.id]='data:image/png;base64,'+(await fs.readFile(path.join(art,w.image))).toString('base64');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(art,'review.html')).href);await page.waitForFunction(()=>arsenalReview.ready);
 await page.evaluate(async e=>{await arsenalReview.useEmbeddedAssets(e);arsenalReview.freeze();arsenalReview.setMode('battle');},embedded);
 assert.equal(await page.locator('#mode').inputValue(),'battle');
 const auto=await page.evaluate(()=>{for(let i=0;i<120;i++)arsenalReview.tick(1/60);return arsenalReview.snapshot();});
 assert(auto.autoCombat&&auto.shots>0&&auto.targetId);
 await page.mouse.move(100,100);await page.mouse.move(950,800);
 assert.equal(await page.evaluate(()=>arsenalReview.state.autoCombat),true);
 const results=[];
 for(const w of data.weapons){
  await page.locator('#weapon').selectOption(w.id);
  const fired=await page.evaluate(()=>{arsenalReview.setMode('battle');arsenalReview.state.targets=[{id:'live',x:510,y:370,radius:13,hp:100000,maxHp:100000,active:true,hitFlash:0}];for(let i=0;i<120;i++)arsenalReview.tick(1/60);arsenalReview.render();return arsenalReview.snapshot();});
  assert(fired.shots>0&&fired.hits>0,w.id);assert.equal(fired.weaponId,w.id);
  const checks=await page.evaluate(()=>{
   arsenalReview.setMode('inspect');const s=arsenalReview.state,body=s.config.body,mask=document.createElement('canvas');mask.width=64;mask.height=64;const c=mask.getContext('2d');c.drawImage(arsenalReview.assets.body,0,0,64,64,0,0,64,64);
   const list=[];const sourcePixels=c.getImageData(0,0,64,64).data;
   for(const a of [0,45,90,135,180,-135,-90,-45])for(const recoil of [0,1]){
    CompactRangerMotion.setAimAngle(s,a*Math.PI/180);s.recoil=recoil;const p=CompactRangerMotion.pose(s),x=Math.round(body.root[0]+(p.weapon.muzzleX-s.x)/(s.pixelScale*p.facing)),y=Math.round(body.root[1]+(p.weapon.muzzleY-s.y)/s.pixelScale);
    const alpha=x>=0&&x<64&&y>=0&&y<64?c.getImageData(x,y,1,1).data[3]:0;
    arsenalReview.render();const pixels=document.getElementById('stage').getContext('2d');let faceErrors=0;
    for(let sy=12;sy<38;sy++)for(let sx=14;sx<53;sx++){
      const offset=(sy*64+sx)*4;if(sourcePixels[offset+3]!==255)continue;
      const wx=Math.floor(s.x+(sx+.5-body.root[0])*s.pixelScale*p.facing),wy=Math.floor(s.y+(sy+.5-body.root[1])*s.pixelScale);
      const pixel=pixels.getImageData(wx,wy,1,1).data;
      if(pixel[0]!==sourcePixels[offset]||pixel[1]!==sourcePixels[offset+1]||pixel[2]!==sourcePixels[offset+2])faceErrors++;
    }
    list.push({angle:a,recoil,depth:p.depth,muzzleBodyAlpha:alpha,faceErrors});
   }
   s.recoil=0;arsenalReview.setAngle(0);return list;
  });
  for(const check of checks){if(check.depth==='back')assert.equal(check.muzzleBodyAlpha,0,`${w.id} ${check.angle} recoil=${check.recoil}`);assert.equal(check.faceErrors,0,`${w.id} stock obscures face at ${check.angle}`);}
  await page.locator('#stage').screenshot({path:path.join(out,w.id+'.png')});
  results.push({id:w.id,autoShots:fired.shots,hits:fired.hits,aimChecks:checks});
 }
 await page.locator('#zoom').selectOption('3');await page.locator('#weapon').selectOption('scrap_pistol');await page.locator('#reset').click();
 await page.locator('#mode').selectOption('battle');const stage=page.locator('#stage');await stage.focus();await page.keyboard.down('KeyD');
 const moved=await page.evaluate(()=>{for(let i=0;i<30;i++)arsenalReview.tick(1/60);return arsenalReview.snapshot();});await page.keyboard.up('KeyD');assert(moved.x>400&&moved.autoCombat&&moved.shots>0);
 await page.locator('#pause').click();const freeze=await page.evaluate(()=>{const before=arsenalReview.snapshot();for(let i=0;i<60;i++)arsenalReview.tick(1/60);return{before,after:arsenalReview.snapshot()};});assert.equal(freeze.before.shots,freeze.after.shots);assert.equal(freeze.before.phase,freeze.after.phase);
 await page.locator('#pause').click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert(await page.evaluate(()=>arsenalReview.state.paused));
 await page.locator('#reset').click();await page.evaluate(()=>{arsenalReview.render();});await page.screenshot({path:path.join(out,'review.png'),fullPage:true});
 const boards=await page.evaluate(()=>{
  const overview=document.createElement('canvas');overview.width=1000;overview.height=500;const c=overview.getContext('2d');c.fillStyle='#263239';c.fillRect(0,0,1000,500);
  const directions=document.createElement('canvas');directions.width=1600;directions.height=1680;const d=directions.getContext('2d');d.fillStyle='#263239';d.fillRect(0,0,1600,1680);
  for(let i=0;i<COMPACT_ARSENAL_DATA.weapons.length;i++){
   const w=COMPACT_ARSENAL_DATA.weapons[i],x=i%4*250+92,y=Math.floor(i/4)*250+205;
   const s=CompactRangerMotion.createState({x,y,pixelScale:3,body:COMPACT_ARSENAL_DATA.body,weapons:COMPACT_ARSENAL_DATA.weapons,weaponId:w.id});
   CompactRangerMotion.draw(c,s,{body:arsenalReview.assets.body,weapon:arsenalReview.assets.weapons[w.id]},{drawTargets:false});c.font='16px Microsoft YaHei,system-ui';c.fillStyle='#edc28a';c.fillText(w.name,i%4*250+18,Math.floor(i/4)*250+28);
   for(let j=0;j<8;j++){s.x=j*200+70;s.y=i*240+185;s.pixelScale=2;CompactRangerMotion.setAimAngle(s,[0,45,90,135,180,-135,-90,-45][j]*Math.PI/180);CompactRangerMotion.draw(d,s,{body:arsenalReview.assets.body,weapon:arsenalReview.assets.weapons[w.id]},{drawTargets:false});d.font='12px Microsoft YaHei,system-ui';d.fillStyle='#edc28a';d.fillText(w.name+' '+[0,45,90,135,180,-135,-90,-45][j]+'°',j*200+10,i*240+22);}
  }
  return{overview:overview.toDataURL('image/png').split(',')[1],directions:directions.toDataURL('image/png').split(',')[1]};
 });
 for(const [key,name]of [['overview','seven-weapons.png'],['directions','all-directions.png']])await fs.writeFile(path.join(out,name),Buffer.from(boards[key],'base64'));
 const recording=await page.evaluate(async()=>{
  const canvas=document.getElementById('stage'),stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],type='video/webm;codecs=vp8',recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4000000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const ended=new Promise((res,rej)=>{recorder.onstop=res;recorder.onerror=rej});
  let index=-1,last=performance.now();const start=last;recorder.start();
  await new Promise(resolve=>{function frame(now){const t=Math.max(0,(now-start)/1000);if(t>=14){resolve();return;}const next=Math.floor(t/2);if(next!==index){index=next;arsenalReview.setWeapon(COMPACT_ARSENAL_DATA.weapons[index].id);arsenalReview.setMode('demo');}
   arsenalReview.tick(Math.min(.05,Math.max(0,(now-last)/1000)));last=now;arsenalReview.render();track.requestFrame();requestAnimationFrame(frame);}requestAnimationFrame(frame)});
  recorder.stop();await ended;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type});const base64=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.readAsDataURL(blob)});
  const video=document.createElement('video');video.muted=true;const loaded=new Promise((res,rej)=>{video.onloadeddata=res;video.onerror=rej});video.src=URL.createObjectURL(blob);await loaded;await video.play();await new Promise(r=>setTimeout(r,100));video.pause();return{base64,width:video.videoWidth,height:video.videoHeight,played:video.currentTime>0};
 });
 const bytes=Buffer.from(recording.base64,'base64');assert(recording.played&&bytes.length>1000);await fs.writeFile(path.join(out,'seven-weapons.webm'),bytes);
 assert.deepEqual(errors,[]);const proof={date:'2026-10-27',pageErrors:errors,defaultMovementOnlyCombat:true,mouseCannotOverrideAutoAim:true,keyboardMovement:true,pauseAndBlur:true,weapons:results,
  video:{path:'output/compact-arsenal-2026-10-27/seven-weapons.webm',bytes:bytes.length,width:recording.width,height:recording.height,decodeAndPlay:true},visualApproved:false,mainGameArtIntegrated:false};
 await fs.writeFile(path.join(root,'docs/qa/compact-arsenal-browser-2026-10-27.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({weapons:results.length,directionAndRecoilChecks:results.length*16,automaticCombat:true,videoBytes:bytes.length,pageErrors:errors}));
}finally{await browser.close()}
