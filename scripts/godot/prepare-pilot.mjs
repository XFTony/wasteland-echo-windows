import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
const project = path.join(root, "experiments/godot-pilot");
const imported = path.join(project, "imported");
const { DEFAULT_CONTENT } = require("../../src/core/content-registry.js");
const { DEFAULT_WORLD } = require("../../src/world/world-registry.js");
const { HERO, MATERIALS, PART_ASSETS, ENEMY_SPRITES } = require("../../src/content/active-compact-actors.js");
const { ART_ASSETS } = require("../../src/render/art/asset-catalog.js");
const { WEAPON_PIXEL_PALETTE } = require("../../src/content/weapon-expansion.js");
const { AUDIO_ASSETS } = require("../../src/content/audio-assets.js");
const Grip = require("../../src/shared/modular-grip-compositor.js");
const Motion = require("../../src/shared/compact-ranger-motion.js");
const copied = new Map();
fs.mkdirSync(imported, { recursive: true });

function copyFile(source) {
  const sourcePath = path.join(root, "web", source);
  const filename = path.basename(sourcePath);
  if (copied.has(filename) && copied.get(filename).source !== source) throw new Error("Duplicate imported filename: " + filename);
  fs.copyFileSync(sourcePath, path.join(imported, filename));
  copied.set(filename, { source, file: filename, bytes: fs.statSync(sourcePath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex").toUpperCase() });
  return "res://imported/" + filename;
}
const asset = id => copyFile(ART_ASSETS[id].src);
const weaponIds = ["scrap_pistol", "prism_laser", "shock_hammer"];
const weapons = weaponIds.map(id => {
  const definition = MATERIALS.weapons.find(w => w.id === id);
  const layout = Grip.layout(MATERIALS, id, MATERIALS.defaultHands, MATERIALS.defaultCuffs);
  return { ...DEFAULT_CONTENT.weapons[id], visual: definition.visual,
    texture: definition.visual.asset.startsWith("native.") ? "" : asset(PART_ASSETS[definition.visual.asset]),
    hold: Grip.runtimeRig(MATERIALS, definition, MATERIALS.defaultCharacter),
    parts: layout.layers.map(part => ({ ...part, texture: asset(PART_ASSETS[part.asset]) })) };
});
const enemies = ["drifter", "brute"].map(id => ({ ...DEFAULT_CONTENT.enemies[id], ...ENEMY_SPRITES[id], texture: asset(ENEMY_SPRITES[id].assetId) }));
const worldTextures = {};
for (const [kind, id] of Object.entries({ground:"world.ground.echo.v1",shop:"world.prop.echo.shop-roof.v1",warehouse:"world.prop.echo.warehouse-roof.v1",container:"world.prop.echo.container.v1",railcar:"world.prop.echo.railcar.v1",tradePost:"world.prop.echo.market.v1"})) worldTextures[kind] = asset(id);
const sounds = {};
for (const id of [...weaponIds, "hammer_impact"]) sounds[id] = copyFile(AUDIO_ASSETS.find(a => a.id === id).src);
const poseCases = [];
for (const id of weaponIds) for (let i = 0; i < 8; i++) {
  const state = Motion.createState({ x:100,y:100,pixelScale:HERO.pixelScale,body:HERO.body,
    weapons:Grip.definitionsForCharacter(MATERIALS,MATERIALS.defaultCharacter),weaponId:id });
  Motion.setAimAngle(state,i*Math.PI/4);
  const pose = Motion.pose(state);
  poseCases.push({ weaponId:id,angle:i*Math.PI/4,anchor:[pose.weapon.anchorX,pose.weapon.anchorY],muzzle:[pose.weapon.muzzleX,pose.weapon.muzzleY] });
}
const catalog = { format: 1, purpose: "Isolated native import and control proof; not a full gameplay port", hero: { ...HERO, texture: asset(HERO.assetId) },
  weapons, enemies, world: DEFAULT_WORLD.get("echo_district"), worldTextures, palette: WEAPON_PIXEL_PALETTE, sounds, poseCases };
fs.writeFileSync(path.join(imported, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
fs.writeFileSync(path.join(imported, "source-manifest.json"), JSON.stringify({ date:"2026-10-29", files:[...copied.values()] }, null, 2) + "\n");
console.log(`Prepared Godot pilot: ${copied.size} existing files, ${[...copied.values()].reduce((s,f)=>s+f.bytes,0)} bytes; 3 weapons, 2 enemies, original map geometry.`);
