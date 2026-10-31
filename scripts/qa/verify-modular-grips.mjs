import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {chromium} from 'playwright-core';
const root=path.resolve(import.meta.dirname,'../..'),art=path.join(root,'art/characters/ranger/modular-grips-v3'),out=path.join(root,'output/modular-grips-2026-10-27');
const D=JSON.parse(await fs.readFile(path.join(art,'metadata.json'),'utf8'));await fs.mkdir(out,{recursive:true});
const embedded={body:'data:image/png;base64,'+(await fs.readFile(path.join(art,D.characters[D.defaultCharacter].bodyAtlas))).toString('base64'),weapons:{},parts:{}};
for(const w of D.weapons)embedded.weapons[w.id]='data:image/png;base64,'+(await fs.readFile(path.join(art,w.referenceImage))).toString('base64');
for(const [id,a]of Object.entries(D.assets))embedded.parts[id]='data:image/png;base64,'+(await fs.readFile(path.join(art,a.path))).toString('base64');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const started=Date.now();await page.goto(pathToFileURL(path.join(art,'review.html')).href);await page.waitForFunction(()=>window.arsenalReview?.ready);const readyMs=Date.now()-started;
 await page.evaluate(async e=>{await arsenalReview.useEmbeddedAssets(e);arsenalReview.freeze();arsenalReview.setMode('inspect');},embedded);
 const result=await page.evaluate(()=>{
  const D=MODULAR_GRIP_DATA,G=ModularGrip,M=CompactRangerMotion,R=modularReview;
  const records=[];let cases=0;
  const bodyCanvas=document.createElement('canvas');bodyCanvas.width=64;bodyCanvas.height=64;const bc=bodyCanvas.getContext('2d',{willReadFrequently:true});bc.drawImage(arsenalReview.assets.body,0,0,64,64,0,0,64,64);const head=bc.getImageData(0,0,64,64).data;
  const read=image=>{const c=document.createElement('canvas');c.width=image.naturalWidth||image.width;c.height=image.naturalHeight||image.height;const x=c.getContext('2d');x.drawImage(image,0,0);return x.getImageData(0,0,c.width,c.height).data;};
  for(const w of D.weapons){
   arsenalReview.setWeapon(w.id);R.select(D.defaultHands,D.defaultCuffs);const original=read(arsenalReview.assets.weapons[w.id]),composed=read(R.current.image);
   let mismatch=0;for(let i=0;i<original.length;i++)if(original[i]!==composed[i])mismatch++;
   if(mismatch)throw new Error(w.id+' native mismatch '+mismatch);
   const current=R.current,s=arsenalReview.state;
   const variants=[];
   for(const handId of Object.keys(D.handSets))for(const cuffId of Object.keys(D.cuffSets)){
    R.select(handId,cuffId);const alpha=read(R.current.image);let alphaChanges=0,colorChanges=0;
    for(let i=0;i<Math.min(alpha.length,original.length);i++){if(alpha[i]!==original[i])colorChanges++;if(i%4===3&&alpha[i]!==original[i])alphaChanges++;}
    const check=[];
    for(const degrees of [0,45,90,135,180,-135,-90,-45])for(const recoil of [0,1]){
     M.setAimAngle(s,degrees*Math.PI/180);s.recoil=recoil;arsenalReview.render();const p=M.pose(s),body=s.config.body;
     const sourceX=Math.round(body.root[0]+(p.weapon.muzzleX-s.x)/(s.pixelScale*p.facing)),sourceY=Math.round(body.root[1]+(p.weapon.muzzleY-s.y)/s.pixelScale);
     const muzzleAlpha=sourceX>=0&&sourceX<64&&sourceY>=0&&sourceY<64?head[(sourceY*64+sourceX)*4+3]:0;
     if(p.depth==='back'&&muzzleAlpha)throw new Error('Hidden muzzle '+w.id+' '+degrees);
     const screen=document.getElementById('stage').getContext('2d',{willReadFrequently:true});let faceErrors=0;
     for(let y=12;y<38;y++)for(let x=14;x<53;x++){
      const at=(y*64+x)*4;if(head[at+3]!==255)continue;
      const wx=Math.floor(s.x+(x+.5-body.root[0])*s.pixelScale*p.facing),wy=Math.floor(s.y+(y+.5-body.root[1])*s.pixelScale);
      const pixel=screen.getImageData(wx,wy,1,1).data;if(pixel[0]!==head[at]||pixel[1]!==head[at+1]||pixel[2]!==head[at+2])faceErrors++;
     }
     if(faceErrors)throw new Error('Covered face '+w.id);
     // Appearance changes may alter canvas padding, never the world muzzle.
     const baseline=M.createState({x:s.x,y:s.y,pixelScale:s.pixelScale,weapons:G.definitionsForCharacter(D),weaponId:w.id,angle:s.angle,body:body});baseline.recoil=recoil;
     const expected=M.pose(baseline).weapon;
     if(Math.hypot(expected.muzzleX-p.weapon.muzzleX,expected.muzzleY-p.weapon.muzzleY)>1e-7)throw new Error('Muzzle drift '+w.id);
     cases++;check.push({degrees,recoil,faceErrors,muzzleAlpha:p.depth==='back'?muzzleAlpha:null});
    }
    variants.push({handId,cuffId,alphaChanges,colorChanges,checks:check});
   }
   if(!variants.some(v=>v.handId==='plated-test'&&v.cuffId===D.defaultCuffs&&v.alphaChanges>0))throw new Error('Hand variant did not change shape '+w.id);
   // Compare actual rendered frame to the legacy reference at every angle.
   R.select(D.defaultHands,D.defaultCuffs);s.recoil=0;
   for(const degrees of [0,45,90,135,180,-135,-90,-45]){
    arsenalReview.setAngle(degrees);R.select(D.defaultHands,D.defaultCuffs,'legacy');const a=document.getElementById('stage').toDataURL();
    R.select(D.defaultHands,D.defaultCuffs,'modular');const b=document.getElementById('stage').toDataURL();if(a!==b)throw new Error('Rendered A/B differs '+w.id+' '+degrees);
   }
   records.push({id:w.id,defaultNativeMismatch:mismatch,renderedABExact:true,variants});
  }
  arsenalReview.setMode('battle');arsenalReview.state.phase=.37;arsenalReview.state.fireCooldown=.18;arsenalReview.state.aimTargetId='keep';
  const a=arsenalReview.snapshot();R.select('plated-test','steel-test');const b=arsenalReview.snapshot();
  if(a.phase!==b.phase||a.targetId!==b.targetId||arsenalReview.state.fireCooldown!==.18)throw new Error('Appearance reset gameplay');
  const builds=R.cache.info().builds;for(let i=0;i<300;i++){arsenalReview.tick(1/60);arsenalReview.render();}
  if(builds!==R.cache.info().builds)throw new Error('Per-frame composition');
  return{records,cases,cache:R.cache.info(),noPerFrameBuild:true,appearancePreservesGameplay:true};
 });
 await page.locator('#zoom').selectOption('3');await page.locator('#weapon').selectOption('scrap_pistol');
 await page.evaluate(()=>{modularReview.select('plated-test','steel-test');arsenalReview.setAngle(-45);document.querySelector('details').open=true;arsenalReview.render();});
 await page.screenshot({path:path.join(out,D.pilot?'pilot-review.png':'review.png'),fullPage:true});
 const board=await page.evaluate(()=>{
  const D=MODULAR_GRIP_DATA,G=ModularGrip,M=CompactRangerMotion,R=modularReview;
  const c=document.createElement('canvas');c.width=1040;c.height=D.weapons.length*220+40;const ctx=c.getContext('2d');ctx.fillStyle='#233139';ctx.fillRect(0,0,c.width,c.height);ctx.font='14px Microsoft YaHei';ctx.fillStyle='#eec58b';
  for(const [i,label]of ['旧图基准','分层合成：原手套','宽护手＋原袖口','宽护手＋钢灰护腕'].entries())ctx.fillText(label,i*260+15,24);
  for(let row=0;row<D.weapons.length;row++)for(let col=0;col<4;col++){
   const w=D.weapons[row],s=M.createState({x:col*260+86,y:row*220+210,pixelScale:3,weapons:G.definitionsForCharacter(D),weaponId:w.id,body:D.characters[D.defaultCharacter].body,world:{width:c.width,height:c.height}});
   let image=arsenalReview.assets.weapons[w.id];if(col){const entry=R.cache.apply(s,w.id,col===1?'ranger-cloth':'plated-test',col===3?'steel-test':'ranger-coat');image=entry.image;}
   M.draw(ctx,s,{body:arsenalReview.assets.body,weapon:image},{drawTargets:false});ctx.fillStyle='#eec58b';ctx.fillText(w.name,col*260+15,row*220+58);
  }
  return c.toDataURL('image/png').split(',')[1];
 });
 await fs.writeFile(path.join(out,D.pilot?'pilot-styles.png':'hand-styles.png'),Buffer.from(board,'base64'));
 assert.deepEqual(errors,[]);
 let video=null;
 if(!D.pilot){
  const recording=await page.evaluate(async()=>{
   const D=MODULAR_GRIP_DATA,canvas=document.getElementById('stage'),stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:4000000}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const stopped=new Promise((res,rej)=>{recorder.onstop=res;recorder.onerror=rej});
   let index=-1,style=-1,last=performance.now();const start=last;recorder.start();
   await new Promise(resolve=>{function tick(now){const t=Math.max(0,(now-start)/1000);if(t>=14){resolve();return;}const i=Math.floor(t/2),nextStyle=Math.floor(t%2);
    if(i!==index){index=i;arsenalReview.setWeapon(D.weapons[i].id);arsenalReview.setMode('demo');style=-1;}
    if(style!==nextStyle){style=nextStyle;modularReview.select(style?'plated-test':'ranger-cloth',style?'steel-test':'ranger-coat');}
    arsenalReview.tick(Math.min(.05,Math.max(0,(now-last)/1000)));last=now;arsenalReview.render();
    const c=canvas.getContext('2d');c.fillStyle='#f1ce98';c.font='18px Microsoft YaHei';c.fillText(D.weapons[i].name+' · '+(style?'宽护手／钢灰护腕':'原手套／沙色袖口'),80,80);
    track.requestFrame();requestAnimationFrame(tick);
   }requestAnimationFrame(tick)});
   recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:'video/webm'});
   const base64=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.readAsDataURL(blob)});
   const v=document.createElement('video');v.muted=true;const loaded=new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=rej});v.src=URL.createObjectURL(blob);await loaded;await v.play();await new Promise(r=>setTimeout(r,100));v.pause();return{base64,played:v.currentTime>0,width:v.videoWidth,height:v.videoHeight};
  });
  const bytes=Buffer.from(recording.base64,'base64');assert(recording.played&&bytes.length>1000);await fs.writeFile(path.join(out,'hand-switching.webm'),bytes);
  video={bytes:bytes.length,decodeAndPlay:true,width:recording.width,height:recording.height};
 }
 const proof={date:'2026-10-27',pilot:D.pilot,defaultReconstructionExact:true,renderedABExact:true,...result,readyMs,
  decodedOwnedAssetPixelsBytes:Object.values(D.assets).reduce((sum,a)=>sum+a.width*a.height*4,0),pageErrors:errors,video,
  limits:'Same ranger body with two hand appearances and two cuff appearances; no second character body art claimed.'};
 await fs.writeFile(path.join(root,'docs/qa/'+(D.pilot?'modular-grips-pilot-2026-10-27.json':'modular-grips-browser-2026-10-27.json')),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({weapons:result.records.length,cases:result.cases,defaultPixelsExact:true,renderedABExact:true,cache:result.cache,pageErrors:errors,video}));
}finally{await browser.close()}
