import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {GameModel}=require("../../src/core/game-model.js");
const {SaveManager}=require("../../src/core/save.js");
const output=path.resolve(import.meta.dirname,"../../output/survival-builds");fs.mkdirSync(output,{recursive:true});
const reports=[];
const buildImpact=process.argv.includes('--build-impact');
for(const map of buildImpact?["echo_district"]:["echo_district","freight_nexus","red_basin"])for(const policy of buildImpact?["orbit-build"]:["standing","orbit"]){
 const model=new GameModel(new SaveManager({get:()=>null,set(){}}));
 model.startRun({mapId:map,modeId:"endless",seed:88,tutorial:false});
 const cx=model.run.player.x,cy=model.run.player.y;
 let peak=0,visibleSum=0,nearSum=0,firstHit=null,firstUpgrade=null,ticks=0;const samples=[];
 for(let i=0;i<3600;i++){
  const t=model.run.elapsed;
  if(policy.startsWith("orbit")){const a=t*.65;const dx=cx+Math.cos(a)*210-model.run.player.x,dy=cy+Math.sin(a)*210-model.run.player.y;const length=Math.hypot(dx,dy)||1;model.setInput({moveX:dx/length,moveY:dy/length});}
  model.tick(1/60);
  if(model.screen==="levelup"){firstUpgrade??=model.run.elapsed;if(buildImpact){const order=['projectile','focusProtocol','damage','fireRate','critical','pierce','vitality','armor'];const selected=order.map(id=>model.run.upgradeOptions.find(x=>x.id===id)).find(Boolean)||model.run.upgradeOptions[0];model.chooseUpgrade(selected.id);}else model.salvageUpgradeOptions();}
  const enemies=model.enemies.filter(e=>e.active);peak=Math.max(peak,enemies.length);
  visibleSum+=enemies.filter(e=>Math.abs(e.x-model.run.player.x)<=640&&Math.abs(e.y-model.run.player.y)<=360).length;
  nearSum+=enemies.filter(e=>Math.hypot(e.x-model.run.player.x,e.y-model.run.player.y)<240).length;ticks++;
  if(model.run.damageTaken>0&&firstHit===null)firstHit=model.run.elapsed;
  if((i+1)%600===0)samples.push({time:model.run.elapsed,enemies:enemies.length,kills:model.run.kills,hp:model.run.player.hp});
  if(model.screen!=="running")break;
 }
 reports.push({map,policy,seconds:model.run.elapsed,peakEnemies:peak,meanVisible:visibleSum/ticks,meanNear:nearSum/ticks,kills:model.run.kills,damageTaken:model.run.damageTaken,hp:model.run.player.hp,firstHit,firstUpgrade,samples});
}
fs.writeFileSync(path.join(output,buildImpact?"opening-legacy-build.json":"opening-legacy.json"),JSON.stringify({scope:"Normal health, seed88, starting pistol; fixed priorities for build policy, otherwise salvage; no shopping. Script proxies, not human win rates",reports},null,2)+"\n");
console.log(JSON.stringify(reports.map(({samples,...r})=>r)));
