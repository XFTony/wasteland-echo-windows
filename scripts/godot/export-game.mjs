import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
const target = path.join(root, "godot");
const dataDirectory = path.join(target, "data");
const { DEFAULT_CONTENT: content } = require("../../src/core/content-registry.js");
const { DEFAULT_WORLD: world } = require("../../src/world/world-registry.js");
const { ART_ASSETS, ...artMappings } = require("../../src/render/art/asset-catalog.js");
const { AUDIO_ASSETS } = require("../../src/content/audio-assets.js");
const actors = require("../../src/content/active-compact-actors.js");
const { NATIVE_WEAPONS, WEAPON_PIXEL_PALETTE } = require("../../src/content/weapon-expansion.js");
const save = require("../../src/core/save.js");
const { Random } = require("../../src/core/random.js");
const survival = require("../../src/content/survival.js");
const { createBasePlayerStats, createRunState } = require("../../src/core/run-state.js");
const { calculateLoadoutStats } = require("../../src/core/equipment.js");
const { NavigationGrid, NavigationFlowField } = require("../../src/world/navigation-grid.js");
const geometry = require("../../src/core/projectile-geometry.js");
const { DEFAULT_UPGRADE_EFFECTS } = require("../../src/core/upgrade-effects.js");
const { GameModel } = require("../../src/core/game-model.js");
const { getShopItemState } = require("../../src/core/economy.js");
const Grip = require("../../src/shared/modular-grip-compositor.js");
const Motion = require("../../src/shared/compact-ranger-motion.js");
const { WEAPON_FEEDBACK, CASINGS } = require("../../src/render/weapon-feedback.js");
const illustrated = require("../../src/render/illustrated-actors.js");
const iconDefinitions = require("../../src/render/ui/item-icons.js");
fs.mkdirSync(dataDirectory, { recursive: true });
const categories = Object.keys(content.catalogIds);
const catalogs = Object.fromEntries(categories.map(category => [category, content[category]]));
const assets = Object.values(ART_ASSETS).filter(asset => asset.active).map(asset => ({ ...asset,
  resourcePath: "res://" + asset.src.replace(/^\.\//, "") }));
const audio = AUDIO_ASSETS.map(asset => ({ ...asset, resourcePath:"res://" + asset.src.replace(/^\.\//, "") }));
const copied = [];
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
for (const source of [...assets.map(a => a.src), ...audio.map(a => a.src),
  ...fs.readdirSync(path.join(root,"web/assets/fonts")).map(name => "./assets/fonts/" + name)]) {
  const relative = source.replace(/^\.\//, "");
  const original = path.join(root,"web",relative), destination = path.join(target,relative);
  const bytes = fs.readFileSync(original);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  if (!fs.existsSync(destination) || hash(fs.readFileSync(destination)) !== hash(bytes)) fs.writeFileSync(destination,bytes);
  copied.push({ source:"web/" + relative, target:relative, bytes:bytes.length, sha256:hash(bytes) });
}
const poses = {};
for (const weapon of actors.MATERIALS.weapons) {
  poses[weapon.id] = { definition:weapon, hold:Grip.runtimeRig(actors.MATERIALS,weapon,actors.MATERIALS.defaultCharacter),
    layout:Grip.layout(actors.MATERIALS,weapon.id,actors.MATERIALS.defaultHands,actors.MATERIALS.defaultCuffs) };
}
const config = require("../../src/config.js");
const source = { format:1, baseline:"ef7d50d", version:require("../../package.json").version,
  catalogs, defaults:content.defaults, layouts:world.layouts, assets, audio, artMappings,
  actorMetadata:actors, poses, nativeWeapons:NATIVE_WEAPONS, nativePalette:WEAPON_PIXEL_PALETTE,
  illustrated:{heroes:illustrated.HERO_SKIN_ART,enemies:illustrated.ENEMY_ART,weapons:illustrated.WEAPON_ART},
  icons:{skins:iconDefinitions.SKIN_ART,equipment:iconDefinitions.EQUIPMENT_ART,rangeBands:iconDefinitions.RANGE_BANDS,weaponClasses:iconDefinitions.WEAPON_CLASS_LABELS},
  weaponFeedback:WEAPON_FEEDBACK, casings:CASINGS, palette:config.PALETTE,
  survival: { maps:survival.SURVIVAL_MAPS, gunPrices:survival.GUN_PRICES, turret:survival.TURRET, legacyMaps:survival.LEGACY_STAGE_MAPS },
  defaultSave:save.createDefaultSave(), saveSchema:save.CURRENT_SCHEMA_VERSION,
  masteryEvolutionRewards:content.masteryEvolutionRewards,
  masteryRewards:require("../../src/content/mastery-rewards.js").MASTERY_REWARD_LEVELS };
const parity = { random:[], pressure:[], loadouts:[], upgrades:[], saves:[], shop:[], poses:[], baseRuns:[], navigation:[], geometry:[] };
for(const mapId of content.ids("maps"))for(const clearance of [14,24,40]){
  const layout=world.get(content.maps[mapId].layoutId),grid=new NavigationGrid(layout,{cellSize:64,clearance}),flow=new NavigationFlowField(grid);
  flow.rebuild(layout.worldSize/2,layout.worldSize/2);
  parity.navigation.push({mapId,clearance,target:[layout.worldSize/2,layout.worldSize/2],walkable:Array.from(grid.walkable),distances:Array.from(flow.distances),directionX:Array.from(flow.directionX),directionY:Array.from(flow.directionY)});
}
for(const values of [[0,0,200,0,100,0,10],[0,0,10,0,-20,0,4],[0,0,0,0,0,0,5],[10,-4,300,4,220,2,8]]){
  const result=geometry.segmentCircleTime(...values);parity.geometry.push({kind:"circle",values,expected:Number.isFinite(result)?result:null});
}
for(const rect of [{x:40,y:-20,w:5,h:40},{x:400,y:20,w:10,h:20}])for(const values of [[0,0,200,0],[0,0,0,0],[50,-80,0,180]]){
  const result=geometry.segmentRectTime(...values,rect,2);parity.geometry.push({kind:"rectangle",values,rect,padding:2,expected:Number.isFinite(result)?result:null});
}
for (const seed of [1,17,88,20261029,0xffffffff]) {
  const random = new Random(seed);
  parity.random.push({seed,values:Array.from({length:64},()=>random.next())});
}
for (const seconds of [-3,0,30,60,180,300,900,1800,36000]) parity.pressure.push({seconds,expected:survival.getSurvivalPressure(seconds)});
const base = createBasePlayerStats(content.modes.endless);
for (const hero of Object.values(content.heroes)) for (const equipmentId of [null,...Object.keys(content.equipment),"all"]){
  const candidate = save.createDefaultSave();
  candidate.ownedEquipment=Object.keys(content.equipment);candidate.equippedEquipment={};
  for (const item of Object.values(content.equipment)) if (equipmentId === "all" || item.id === equipmentId) candidate.equippedEquipment[item.slot]=item.id;
  parity.loadouts.push({heroId:hero.id,equipment:candidate.equippedEquipment,expected:calculateLoadoutStats(base,hero,candidate,content).stats});
}
for (const id of Object.keys(content.upgrades)) {
  const model = new GameModel(new save.SaveManager({get:()=>null,set(){}}));
  model.startRun({seed:17,tutorial:false});
  const before = {player:structuredClone(model.run.player),run:{upgrades:{},engineering:0,turretRegen:0,scrap:0,mechanicUpgrades:{}}};
  DEFAULT_UPGRADE_EFFECTS[id](model.run.player,model.run,model);
  parity.upgrades.push({id,before,player:model.run.player,run:{engineering:model.run.engineering,turretRegen:model.run.turretRegen,scrap:model.run.scrap,mechanicUpgrades:model.run.mechanicUpgrades}});
}
for(const candidate of [null,{}, {schemaVersion:1,scrap:120,unlockedWeapons:["scrap_pistol"]},
  {schemaVersion:5,ownedEquipment:["field_vest","magnet_coil"],equippedEquipment:{armor:"field_vest",tool:"magnet_coil"}},
  {schemaVersion:10,currencies:{copper:-5,gold:100},unlockedWeapons:["prism_laser","unknown_future_weapon"],settings:{sfx:5,autoAim:false}},
  {schemaVersion:10,ownedEquipment:"invalid",recentRuns:[],settings:{musicMuted:true,flashes:"off"}}]) parity.saves.push({input:candidate,expected:save.normalizeSave(candidate)});
for(const item of Object.values(content.shopItems)) for (const profile of ["default","poor","rich","owned"]){
  const state=save.createDefaultSave();state.currencies={copper:profile==="poor"?0:profile==="rich"?10000:250,gold:100};
  if(profile==="owned"){const key={weapon:"unlockedWeapons",skin:"unlockedSkins",equipment:"ownedEquipment"}[item.grantType];if(key)state[key].push(item.grantId);}
  parity.shop.push({id:item.id,profile,save:state,highestStage:1,expected:getShopItemState(state,item,1)});
}
for(const definition of actors.MATERIALS.weapons) for(let i=0;i<16;i++){
  const state=Motion.createState({x:100,y:100,pixelScale:actors.HERO.pixelScale,body:actors.HERO.body,weapons:Grip.definitionsForCharacter(actors.MATERIALS,actors.MATERIALS.defaultCharacter),weaponId:definition.id});
  Motion.setAimAngle(state,i*Math.PI/8);parity.poses.push({weaponId:definition.id,angle:i*Math.PI/8,expected:Motion.pose(state)});
}
for(const mapId of content.ids("maps"))for(const weaponId of content.ids("weapons"))parity.baseRuns.push({mapId,weaponId,expected:createRunState({duration:180,worldSize:world.get(content.maps[mapId].layoutId).worldSize,weaponId,skinId:content.defaults.skin,modeId:"endless",mapId,seed:17,mode:content.modes.endless})});
fs.writeFileSync(path.join(dataDirectory,"content_source.json"),JSON.stringify(source,null,2)+"\n");
fs.writeFileSync(path.join(dataDirectory,"parity_cases.json"),JSON.stringify(parity,null,2)+"\n");
const manifest={date:"2026-10-29",baseline:source.baseline,contentSha256:hash(Buffer.from(JSON.stringify(source))),
  categories:Object.fromEntries(categories.map(category=>[category,Object.keys(catalogs[category]).length])),files:copied,
  parityCases:Object.fromEntries(Object.entries(parity).map(([k,v])=>[k,v.length]))};
fs.writeFileSync(path.join(dataDirectory,"source_manifest.json"),JSON.stringify(manifest,null,2)+"\n");
fs.writeFileSync(path.join(root,"docs/godot-content-source-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({categories:manifest.categories,assets:copied.length,bytes:copied.reduce((n,f)=>n+f.bytes,0),parity:manifest.parityCases},null,2));
