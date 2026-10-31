import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { HEROES, SKINS, ENEMIES, WEAPONS, EQUIPMENT, UPGRADES, MAPS } = require("../src/config");
const { ART_ASSETS, MAP_GROUND_ART } = require("../src/render/art/asset-catalog");
const { HERO_SKIN_ART, ENEMY_ART, WEAPON_ART } = require("../src/render/illustrated-actors");
const { SKIN_ART, EQUIPMENT_ART } = require("../src/render/ui/item-icons");
const {NATIVE_WEAPONS}=require("../src/content/weapon-expansion");
const {ENEMY_SPRITES}=require("../src/content/active-compact-actors");

function ready(id) {
  const definition = ART_ASSETS[id];
  return Boolean(definition && definition.active && fs.existsSync(path.join(root, "web", definition.src.slice(2))));
}

function category(ids, mapping) {
  const keys = Object.keys(ids).sort();
  const missing = keys.filter((id) => !ready(mapping[id]));
  return { covered: keys.length - missing.length, total: keys.length, missing };
}

const pairs = Object.keys(HEROES).flatMap((heroId) => Object.keys(SKINS).map((skinId) => ({ heroId, skinId })));
const missingPairs = pairs.filter(({ heroId, skinId }) => !ready(HERO_SKIN_ART[heroId]?.[skinId]));
const mapPropIds = Object.values(ART_ASSETS).filter((asset) => asset.group === "world-props" && ready(asset.id)).map((asset) => asset.id).sort();
const report = {
  styleVersion: "1.5",
  heroOutfits: {
    covered: pairs.length - missingPairs.length,
    total: pairs.length,
    missing: missingPairs.map(({ heroId, skinId }) => `${heroId}/${skinId}`)
  },
  enemies: category(ENEMIES, Object.fromEntries(Object.entries(ENEMY_SPRITES).map(([id,e])=>[id,e.assetId]))),
  weapons: {covered:Object.keys(WEAPONS).filter(id=>ready(WEAPON_ART[id])||NATIVE_WEAPONS[id]).length,total:Object.keys(WEAPONS).length,missing:Object.keys(WEAPONS).filter(id=>!ready(WEAPON_ART[id])&&!NATIVE_WEAPONS[id]),nativePixel:Object.keys(NATIVE_WEAPONS)},
  outfitIcons: category(SKINS, SKIN_ART),
  equipmentIcons: category(EQUIPMENT, EQUIPMENT_ART),
  mapGrounds: category(MAPS, MAP_GROUND_ART),
  mapProps: { illustratedAssets: mapPropIds.length, ids: mapPropIds },
  remainingVisualSystems: {
    wornEquipment: "dedicated character layers pending",
    mapObjects: `${mapPropIds.length} painted map-object assets; other collision objects remain programmatic`,
    upgradeIcons: `${Object.keys(UPGRADES).length} code-drawn field-repair illustrations`,
    actorMotion: "Compact ranger and enemies use travel-based animation; new melee moves held parts. Other hero/outfit compact bodies remain pending."
  }
};

if (process.argv.includes("--write")) {
  fs.writeFileSync(path.join(root, "docs", "illustrated-coverage-v1.5.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
