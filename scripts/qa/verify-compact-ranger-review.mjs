import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(import.meta.dirname,'../..');
const art=path.join(root,'art/characters/ranger/compact-motion-v1');
const out=path.join(root,'output/compact-motion-2026-10-23');
await fs.mkdir(out,{recursive:true});
const bodyData='data:image/png;base64,'+(await fs.readFile(path.join(art,'body-atlas.png'))).toString('base64');
const gunData='data:image/png;base64,'+(await fs.readFile(path.join(art,'sidearm-grip.png'))).toString('base64');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1180,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(art,'review.html')).href);
 await page.waitForFunction(()=>window.compactReview?.ready&&document.querySelector('#status').dataset.ready==='true');
 await page.evaluate(async data=>{await compactReview.useEmbeddedAssets(data);compactReview.freeze(true);compactReview.setMode('free');},{body:bodyData,weapon:gunData});
 await page.locator('#zoom').selectOption('3');
 const angles=[];
 for(const degrees of [0,45,90,135,180,-135,-90,-45]){
  const result=await page.evaluate(degrees=>{
   compactReview.setAngle(degrees);compactReview.state.recoil=0;compactReview.state.flash=0;compactReview.render();
   const s=compactReview.state,p=CompactRangerMotion.pose(s),body=s.config.body;
   const mask=document.createElement('canvas');mask.width=64;mask.height=64;const c=mask.getContext('2d');
   c.drawImage(compactReview.assets.body,0,0,64,64,0,0,64,64);
   const x=Math.round(body.root[0]+(p.weapon.muzzleX-s.x)/(s.pixelScale*p.facing));
   const y=Math.round(body.root[1]+(p.weapon.muzzleY-s.y)/s.pixelScale);
   const alpha=x>=0&&x<64&&y>=0&&y<64?c.getImageData(x,y,1,1).data[3]:0;
   return {degrees,facing:p.facing,depth:p.depth,muzzleBodyAlpha:alpha,bodyFrame:p.bodyFrame};
  },degrees);
  if(result.depth==='back')assert.equal(result.muzzleBodyAlpha,0,`Muzzle hidden by hood at ${degrees}`);
  angles.push(result);
  await page.locator('#stage').screenshot({path:path.join(out,`aim-${String(degrees).replace('-','minus')}.png`)});
 }
 await page.locator('[data-angle="0"]').click();
 await page.evaluate(()=>{compactReview.state.x=350;compactReview.state.y=360;});
 const canvas=page.locator('#stage');await canvas.focus();
 await page.keyboard.down('KeyD');
 const walk=await page.evaluate(()=>{for(let i=0;i<30;i++)compactReview.tick(1/60);return compactReview.snapshot();});
 await page.keyboard.up('KeyD');
 assert(walk.x>400&&walk.walking&&walk.phase>0);
 const stop=await page.evaluate(()=>{compactReview.tick(1/60);return compactReview.snapshot();});
 assert.equal(stop.walking,false);assert.equal(stop.bodyFrame,0);
 await page.evaluate(()=>{compactReview.state.x=500;compactReview.state.y=300;});
 await page.keyboard.down('KeyD');
 const collision=await page.evaluate(()=>{for(let i=0;i<60;i++)compactReview.tick(1/60);return compactReview.snapshot();});
 await page.keyboard.up('KeyD');
 assert.equal(collision.x,538);assert.equal(collision.walking,false);
 await page.locator('#reset').click();await canvas.focus();
 await page.keyboard.down('Space');
 const shooting=await page.evaluate(()=>{for(let i=0;i<40;i++)compactReview.tick(1/60);return compactReview.snapshot();});
 await page.keyboard.up('Space');assert(shooting.shots>=2);
 await page.locator('#pause').click();
 const paused=await page.evaluate(()=>{const before=compactReview.snapshot();for(let i=0;i<60;i++)compactReview.tick(1/60);return{before,after:compactReview.snapshot()};});
 assert.equal(paused.before.phase,paused.after.phase);assert.equal(paused.before.shots,paused.after.shots);
 await page.locator('#pause').click();
 await canvas.focus();await page.keyboard.down('KeyD');
 const blur=await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));compactReview.tick(1/60);return compactReview.snapshot();});
 await page.keyboard.up('KeyD');assert.equal(blur.paused,true);
 await page.locator('#reset').click();await page.locator('#mode').selectOption('turn');
 await page.evaluate(()=>{for(let i=0;i<120;i++)compactReview.tick(1/60);compactReview.render();});
 await page.screenshot({path:path.join(out,'review.png'),fullPage:true});
 // A close composition for reviewing the gun/hand assembly at each direction.
 const board=await page.evaluate(()=>{
  const result=document.createElement('canvas');result.width=960;result.height=480;const c=result.getContext('2d');
  c.fillStyle='#263138';c.fillRect(0,0,960,480);c.font='14px system-ui';c.fillStyle='#e9c58b';
  const degrees=[0,45,90,135,180,-135,-90,-45];
  for(let i=0;i<8;i++){
   const x=i%4*240+120,y=Math.floor(i/4)*240+194;
   const s=CompactRangerMotion.createState({x,y,pixelScale:3,body:COMPACT_RANGER_DATA.body,weapon:COMPACT_RANGER_DATA.weapon,angle:degrees[i]*Math.PI/180});
   CompactRangerMotion.draw(c,s,compactReview.assets,{drawTargets:false});
   c.fillStyle='#e9c58b';c.fillText(`${degrees[i]} deg`,i%4*240+18,Math.floor(i/4)*240+24);
  }
  return result.toDataURL('image/png').split(',')[1];
 });
 await fs.writeFile(path.join(out,'aim-contact-sheet.png'),Buffer.from(board,'base64'));
 // Record real playback from an origin-clean canvas, using the same motion model.
 const recording=await page.evaluate(async()=>{
  compactReview.setMode('free');compactReview.freeze(true);const s=compactReview.state;s.pixelScale=3;
  const canvas=document.getElementById('stage');const stream=canvas.captureStream(0),track=stream.getVideoTracks()[0];
  const type=['video/webm;codecs=vp8','video/webm;codecs=vp9'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!type)throw new Error('No local recording codec');
  const recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4000000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject});
  const start=performance.now();let last=start;recorder.start();
  await new Promise(resolve=>{function next(now){const t=Math.max(0,(now-start)/1000),dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
   if(t>=10){resolve();return}
   const input={paused:false,firing:true};
   if(t<4){input.angle=t*Math.PI/2;input.dx=350-s.x;input.dy=360-s.y;}
   else if(t<7){input.targetX=756;input.targetY=195;input.dx=(350+80*Math.sin((t-4)*2))-s.x;input.dy=360-s.y;}
   else{input.angle=Math.PI;input.dx=(350+80*Math.sin((t-7)*2))-s.x;input.dy=360-s.y;}
   CompactRangerMotion.step(s,input,dt);compactReview.render();track.requestFrame();requestAnimationFrame(next);
  }requestAnimationFrame(next)});
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type});
  const base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
  const video=document.createElement('video');video.muted=true;const loaded=new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('Encoded video failed decoding'))});
  video.src=URL.createObjectURL(blob);await loaded;await video.play();await new Promise(r=>setTimeout(r,100));video.pause();
  return {base64,type,width:video.videoWidth,height:video.videoHeight,played:video.currentTime>0};
 });
 const bytes=Buffer.from(recording.base64,'base64');assert(bytes.length>1000);assert(recording.played);
 await fs.writeFile(path.join(out,'compact-ranger-motion.webm'),bytes);
 assert.deepEqual(errors,[]);
 const proof={date:'2026-10-23',pageErrors:errors,eightDirections:angles,keyboardMovement:true,stopUsesIdle:true,
  collisionStopsSteps:true,continuousFire:true,pauseFrozen:true,blurClearsInput:true,
  video:{path:'output/compact-motion-2026-10-23/compact-ranger-motion.webm',bytes:bytes.length,codec:recording.type,width:recording.width,height:recording.height,decodeAndPlay:true},
  visualApproved:false,runtimeIntegrated:false};
 await fs.writeFile(path.join(root,'docs/qa/compact-ranger-motion-browser-2026-10-23.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));
}finally{await browser.close()}
