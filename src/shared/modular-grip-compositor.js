/* Source ownership is separate; the composed grip still uses one motion transform. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ModularGrip=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
 function character(data,id){const result=data.characters[id||data.defaultCharacter];if(!result)throw new Error('Unknown character rig: '+id);return result;}
 function weapon(data,id){const result=data.weapons.find(w=>w.id===id);if(!result)throw new Error('Unknown weapon: '+id);return result;}
 function runtimeRig(data,w,characterId){
  const c=character(data,characterId),hold=c.holdByWeapon?.[w.id]||c.holdByFamily?.[w.visual.family];
  if(!hold)throw new Error('Missing hold rig: '+c.id+' / '+w.id);
  return {...hold,width:w.visual.width,height:w.visual.height,pivot:w.visual.pivot.slice(),muzzle:w.visual.muzzle.slice(),recoil:w.combat.recoil};
 }
 function definitionsForCharacter(data,characterId){return data.weapons.map(w=>({...w.combat,id:w.id,name:w.name,rig:runtimeRig(data,w,characterId)}));}
 function slots(profile,w){const result=profile.overrides?.[w.id]||profile.poses?.[w.visual.family];if(!result)throw new Error('Missing grip pose: '+profile.id+' / '+w.id);return result;}
 function layout(data,weaponId,handId,cuffId){
  const w=weapon(data,weaponId),hands=data.handSets[handId],cuffs=data.cuffSets[cuffId];
  if(!hands)throw new Error('Unknown hand set: '+handId);if(!cuffs)throw new Error('Unknown cuff set: '+cuffId);
  const hp=slots(hands,w),cp=slots(cuffs,w),layers=[];
  for(const [kind,group]of [['hand',hp],['cuff',cp]])for(const slot of ['primary','support']){
   const anchor=w.visual[slot+'Grip'];if(!point(anchor))throw new Error('Invalid weapon grip: '+w.id+' / '+slot);
   if(!Array.isArray(group[slot]))throw new Error('Missing '+kind+' slot: '+slot);
   for(const part of group[slot]){
    if(!point(part.anchor)||!Array.isArray(part.rect)||part.rect.length!==4)throw new Error('Invalid part: '+part.asset);
    const [sx,sy,width,height]=part.rect;if(![sx,sy,width,height].every(Number.isInteger)||sx<0||sy<0||width<=0||height<=0)throw new Error('Invalid source rectangle');
    const x=anchor[0]-part.anchor[0],y=anchor[1]-part.anchor[1];
    if(Math.abs(x-Math.round(x))>1e-7||Math.abs(y-Math.round(y))>1e-7)throw new Error('Hand source is not on the native pixel grid');
    if(part.depth!=='front'&&part.depth!=='back')throw new Error('Invalid attachment depth');
    layers.push({...part,kind,slot,x:Math.round(x),y:Math.round(y),width,height});
   }
  }
  const minX=Math.min(0,...layers.map(p=>p.x)),minY=Math.min(0,...layers.map(p=>p.y));
  const maxX=Math.max(w.visual.width,...layers.map(p=>p.x+p.width)),maxY=Math.max(w.visual.height,...layers.map(p=>p.y+p.height));
  const width=maxX-minX,height=maxY-minY;
  if(width>256||height>256)throw new Error('Grip canvas exceeds native sprite budget');
  return {weapon:w,layers,width,height,origin:[minX,minY],pivot:[w.visual.pivot[0]-minX,w.visual.pivot[1]-minY],muzzle:[w.visual.muzzle[0]-minX,w.visual.muzzle[1]-minY]};
 }
 function createCache(data,textures,options={}){
  const limit=options.limit??8;if(!Number.isInteger(limit)||limit<1)throw new Error('Cache limit must be positive');
  const factory=options.canvasFactory||((width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;});
  const cache=new Map(),stats={builds:0,hits:0,evictions:0};
  function texture(id){const t=textures[id];if(!t)throw new Error('Missing texture: '+id);return t;}
  function get(weaponId,handId=data.defaultHands,cuffId=data.defaultCuffs){
   const w=weapon(data,weaponId),hand=data.handSets[handId],cuff=data.cuffSets[cuffId];
   if(!hand||!cuff)throw new Error('Unknown hand/cuff appearance');
   const key=JSON.stringify([w.id,w.version,hand.id,hand.version,cuff.id,cuff.version]);
   if(cache.has(key)){const result=cache.get(key);cache.delete(key);cache.set(key,result);stats.hits++;return result;}
   const l=layout(data,weaponId,handId,cuffId),image=factory(l.width,l.height),ctx=image.getContext('2d');
   ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,l.width,l.height);
   function part(p){const im=texture(p.asset);if(p.rect[0]+p.width>(im.naturalWidth||im.width)||p.rect[1]+p.height>(im.naturalHeight||im.height))throw new Error('Part is outside its atlas: '+p.asset);ctx.drawImage(im,...p.rect,p.x-l.origin[0],p.y-l.origin[1],p.width,p.height);}
   for(const p of l.layers)if(p.depth==='back')part(p);
   ctx.drawImage(texture(w.visual.asset),-l.origin[0],-l.origin[1]);
   for(const p of l.layers)if(p.depth==='front')part(p);
   const result={key,image,width:l.width,height:l.height,origin:l.origin,pivot:l.pivot,muzzle:l.muzzle,weaponId,handId,cuffId,bytes:l.width*l.height*4};
   cache.set(key,result);stats.builds++;
   while(cache.size>limit){cache.delete(cache.keys().next().value);stats.evictions++;}
   return result;
  }
  function apply(state,weaponId,handId,cuffId,characterId=data.defaultCharacter){
   if(state.weaponId!==weaponId)throw new Error('Select the weapon before applying its appearance');
   const c=character(data,characterId);
   const selectedHands=handId??c.defaultHands,selectedCuffs=cuffId??c.defaultCuffs;
   if(!selectedHands||!selectedCuffs)throw new Error('Character is missing an explicit hand/cuff binding: '+c.id);
   const result=get(weaponId,selectedHands,selectedCuffs),rig=runtimeRig(data,weapon(data,weaponId),characterId);
   state.config.weapon={...rig,width:result.width,height:result.height,pivot:result.pivot.slice(),muzzle:result.muzzle.slice()};
   state.config.body={...c.body};
   return result;
  }
  return {get,apply,clear(){cache.clear();},info(){return {...stats,entries:cache.size,limit,bytes:[...cache.values()].reduce((sum,e)=>sum+e.bytes,0)};}};
 }
 return {createCache,layout,definitionsForCharacter,runtimeRig};
});
