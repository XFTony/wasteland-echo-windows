(function(){
 'use strict';
 const D=window.MODULAR_GRIP_DATA,G=window.ModularGrip,q=id=>document.getElementById(id),textures={};
 const character=D.characters[D.defaultCharacter];
 const definitions=G.definitionsForCharacter(D,D.defaultCharacter).map(w=>({...w,image:D.weapons.find(v=>v.id===w.id).referenceImage}));
 window.COMPACT_ARSENAL_DATA={bodyAtlas:character.bodyAtlas,body:character.body,weapons:definitions,defaultWeaponId:D.defaultWeapon,defaultAutoCombat:true};
 let cache,lastEntry;
 function load(id,url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{textures[id]=im;resolve();};im.onerror=()=>reject(new Error('分层材料未能加载：'+id));im.src=url;});}
 function selection(){return {handId:q('hands').value||D.defaultHands,cuffId:q('cuffs').value||D.defaultCuffs,assembly:q('assembly').value};}
 function note(){const info=cache.info();q('cacheNote').textContent=`缓存 ${info.entries}/${info.limit} 套 · 持握图像素 ${(info.bytes/1024).toFixed(1)}KB`;}
 function layers(state,entry){
  const canvas=q('parts');if(!canvas)return;const c=canvas.getContext('2d');c.fillStyle='#233139';c.fillRect(0,0,1000,220);c.imageSmoothingEnabled=false;
  const s=selection(),l=G.layout(D,state.weaponId,s.handId,s.cuffId),base=D.assets[l.weapon.visual.asset];
  const groups=[{label:'完整枪体',parts:[{asset:l.weapon.visual.asset,rect:[0,0,base.width,base.height],x:0,y:0,width:base.width,height:base.height}]},
   {label:'主手',parts:l.layers.filter(p=>p.kind==='hand'&&p.slot==='primary')},
   {label:'托枪手',parts:l.layers.filter(p=>p.kind==='hand'&&p.slot==='support')},
   {label:'袖口／护腕',parts:l.layers.filter(p=>p.kind==='cuff')},
   {label:'组合结果',parts:[{image:entry.image,x:0,y:0,width:entry.width,height:entry.height}]}];
  for(let i=0;i<groups.length;i++){
   const group=groups[i];c.font='15px Microsoft YaHei,system-ui';c.fillStyle='#eac08a';c.fillText(group.label,i*200+16,28);
   if(!group.parts.length)continue;const minX=Math.min(...group.parts.map(p=>p.x)),minY=Math.min(...group.parts.map(p=>p.y));
   const maxX=Math.max(...group.parts.map(p=>p.x+p.width)),maxY=Math.max(...group.parts.map(p=>p.y+p.height));
   const scale=Math.min(7,170/(maxX-minX),145/(maxY-minY));
   const dx=i*200+(200-(maxX-minX)*scale)/2-minX*scale,dy=55+(145-(maxY-minY)*scale)/2-minY*scale;
   for(const p of group.parts){if(p.image)c.drawImage(p.image,dx+p.x*scale,dy+p.y*scale,p.width*scale,p.height*scale);else c.drawImage(textures[p.asset],...p.rect,dx+p.x*scale,dy+p.y*scale,p.width*scale,p.height*scale);}
  }
 }
 function apply(state,reference){
  const s=selection();
  if(s.assembly==='legacy'){
   state.config.weapon=G.runtimeRig(D,D.weapons.find(w=>w.id===state.weaponId),D.defaultCharacter);state.config.body={...character.body};
   lastEntry=cache.get(state.weaponId,D.defaultHands,D.defaultCuffs);layers(state,lastEntry);note();return reference;
  }
  lastEntry=cache.apply(state,state.weaponId,s.handId,s.cuffId,D.defaultCharacter);layers(state,lastEntry);note();return lastEntry.image;
 }
 function refresh(){if(window.arsenalReview?.ready)window.arsenalReview.refreshAppearance();}
 async function init(){
  for(const [id,p]of Object.entries(D.handSets)){const o=document.createElement('option');o.value=id;o.textContent=p.label;q('hands').append(o);}
  for(const [id,p]of Object.entries(D.cuffSets)){const o=document.createElement('option');o.value=id;o.textContent=p.label;q('cuffs').append(o);}
  q('hands').value=D.defaultHands;q('cuffs').value=D.defaultCuffs;
  await Promise.all(Object.entries(D.assets).map(([id,a])=>load(id,a.path)));cache=G.createCache(D,textures,{limit:8});
  q('hands').onchange=refresh;q('cuffs').onchange=refresh;
  q('assembly').onchange=()=>{const old=q('assembly').value==='legacy';if(old){q('hands').value=D.defaultHands;q('cuffs').value=D.defaultCuffs;}q('hands').disabled=old;q('cuffs').disabled=old;refresh();};
 }
 async function replaceTextures(parts){await Promise.all(Object.entries(parts).map(([id,url])=>load(id,url)));cache.clear();q('parts').width=1000;}
 window.MODULAR_GRIP_APPEARANCE={init,apply,replaceTextures};
 window.modularReview={get data(){return D;},get cache(){return cache;},get textures(){return textures;},get current(){return lastEntry;},selection,
  select(hand,cuff,assembly='modular'){q('assembly').value=assembly;q('hands').disabled=assembly==='legacy';q('cuffs').disabled=assembly==='legacy';q('hands').value=assembly==='legacy'?D.defaultHands:hand;q('cuffs').value=assembly==='legacy'?D.defaultCuffs:cuff;refresh();}};
})();
