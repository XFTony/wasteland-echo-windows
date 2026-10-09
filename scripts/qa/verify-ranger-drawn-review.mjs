// Local review and video export. No user browser profile or remote services.
import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const root=path.resolve(import.meta.dirname,'../..');
const preview=path.join(root,'output/animation/ranger/pixel-production-review');
const metaPath=path.join(root,'art/animation/ranger/pixel-source/run-candidate-v4/metadata.json');
const meta=JSON.parse(await fs.readFile(metaPath,'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1180,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(preview,'review.html')).href);
 await page.waitForFunction(()=>document.querySelector('#status').dataset.ready==='true');
 assert.equal(await page.locator('#version').inputValue(),'v4');
 assert.equal(await page.locator('#timeline').getAttribute('max'),'24');
 assert.equal(await page.locator('#detail').inputValue(),'art');
 await page.locator('#play').click();
 const hashes=[];
 for(let i=1;i<=24;i++){
  await page.locator('#timeline').evaluate((e,n)=>{e.value=String(n);e.dispatchEvent(new Event('input',{bubbles:true}))},i);
  hashes.push(createHash('sha256').update(await page.locator('#run').screenshot()).digest('hex'));
 }
 assert.equal(new Set(hashes).size,24);
 await page.locator('#next').click();assert.equal(await page.locator('#timeline').inputValue(),'1');
 await page.locator('#previous').click();assert.equal(await page.locator('#timeline').inputValue(),'24');
 await page.locator('#speed').selectOption('0.25');
 await page.locator('#seam').click();
 await page.waitForFunction(()=>document.querySelector('#play').textContent==='播放');
 assert.equal(await page.locator('#timeline').inputValue(),'2');
 for(const mode of ['native','art']){
  await page.locator('#detail').selectOption(mode);
  await page.locator('#timeline').evaluate(e=>{e.value='23';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('#run').screenshot({path:path.join(preview,`v4-seam-${mode}.png`)});
 }
 await page.locator('#version').selectOption('v2');
 await page.waitForFunction(()=>document.querySelector('#status').dataset.ready==='true'&&document.querySelector('#timeline').max==='8');
 assert.equal(await page.locator('#detail').inputValue(),'native');
 await page.locator('#version').selectOption('v4');
 await page.waitForFunction(()=>document.querySelector('#status').dataset.ready==='true'&&document.querySelector('#timeline').max==='24');
 await page.locator('#detail').selectOption('art');
 await page.locator('#timeline').evaluate(e=>{e.value='1';e.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.screenshot({path:path.join(preview,'v4-review.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 // Browser encodes an offline canvas video; no system codec install is needed.
 const videoPage=await browser.newPage({viewport:{width:540,height:540}});
 await videoPage.goto(pathToFileURL(path.join(preview,'review.html')).href);
 await videoPage.bringToFront();
 const recording=await videoPage.evaluate(async inputs=>{
  const load=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url});
  const [atlas,ground]=await Promise.all([load(inputs.atlas),load(inputs.ground)]);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  document.body.replaceChildren(canvas);
  const ctx=canvas.getContext('2d');
  const stream=canvas.captureStream(0);const track=stream.getVideoTracks()[0];
  const mime=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime)throw new Error('Local browser has no WebM recording codec');
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
  const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject});
  const presented=new Set();const totalMs=4000;
  const draw=i=>{ctx.drawImage(ground,0,0,512,512);ctx.fillStyle='#0008';ctx.fillRect(0,0,512,512);ctx.fillStyle='#0a0c08aa';ctx.beginPath();ctx.ellipse(256,476,40,8,0,0,Math.PI*2);ctx.fill();ctx.imageSmoothingEnabled=false;ctx.drawImage(atlas,i*512,0,512,512,0,0,512,512);presented.add(i);track.requestFrame()};
  draw(0);recorder.start();
  const start=performance.now();
  await new Promise(resolve=>{function tick(now){const elapsed=Math.max(0,now-start);if(elapsed>=totalMs){resolve();return}draw(Math.floor((elapsed%400)*24/400)%24);requestAnimationFrame(tick)}requestAnimationFrame(tick)});
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
  const blob=new Blob(chunks,{type:mime});
  const encoded=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
  return {base64:encoded,mime,presented:[...presented].sort((a,b)=>a-b),targetDurationMs:totalMs};
 },{atlas:'data:image/png;base64,'+(await fs.readFile(path.join(root,meta.artAtlasPath))).toString('base64'),
    ground:'data:image/webp;base64,'+(await fs.readFile(path.join(root,'web/assets/world/echo-ground-v1.webp'))).toString('base64')});
 assert.equal(recording.presented.length,24);
 const videoRel='output/animation/ranger/pixel-run-candidate-v4/ranger-drawn-run-v4.webm';
 const videoPath=path.join(root,videoRel);const bytes=Buffer.from(recording.base64,'base64');
 assert(bytes.length>1000,'Recorder produced a header without video frames');
 await fs.writeFile(videoPath,bytes);
 // Verify that the exported video is decodable and has frames before linking it.
 const decoded=await videoPage.evaluate(async payload=>{
  const v=document.createElement('video');v.muted=true;
  const loaded=new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(new Error(`Video decode failed: ${v.error?.code} ${v.error?.message}`))});
  // Decode the same bytes via a Blob URL; file media restrictions cannot hide a codec error.
  v.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(payload.base64),c=>c.charCodeAt(0))],{type:payload.mime}));
  await loaded;
  const ready={width:v.videoWidth,height:v.videoHeight,readyState:v.readyState};
  await v.play();await new Promise(r=>setTimeout(r,150));v.pause();
  return {...ready,currentTime:v.currentTime};
 },{base64:recording.base64,mime:recording.mime});
 assert.equal(decoded.width,512);assert.equal(decoded.height,512);assert(decoded.currentTime>0);
 meta.videoPath=videoRel;meta.videoSha256=createHash('sha256').update(bytes).digest('hex').toUpperCase();
 await fs.writeFile(metaPath,JSON.stringify(meta,null,2)+'\n');
 const proof={date:'2026-10-09',uniqueDisplayedFrames:24,originalVersionSwitch:true,artAndNativeViews:true,
  forwardAndBackwardWrap:true,seamPlayback:true,pageErrors:errors,
  video:{path:videoRel,bytes:bytes.length,mime:recording.mime,presentedFrames:recording.presented.length,targetDurationMs:recording.targetDurationMs,decoded},
  visualApproved:false,runtimeIntegrated:false};
 await fs.writeFile(path.join(root,'docs/qa/ranger-drawn-review-browser-2026-10-09.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));
}finally{await browser.close()}
