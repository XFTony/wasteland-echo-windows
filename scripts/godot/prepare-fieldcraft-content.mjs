import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const legacy = JSON.parse(fs.readFileSync(path.join(root, "godot/data/content_source.json"), "utf8"));
const previous = JSON.parse(fs.readFileSync(path.join(root, "art/combat/survival-builds-v1/design.json"), "utf8"));
const base = { projectileCount: 1, spread: 0, pierce: 0, recoil: 0.5, muzzleLength: 32,
  muzzleFlashLength: 10, muzzleFlashLife: 0.055, muzzleParticles: 2, shellLength: 0,
  shellLife: 0, shellColor: "#b18b50", ttl: 0.9 };
const weapons = [
  { ...base, id: "ember_sprayer", name: "焚尘喷火器", description: "短程火舌穿透2次；灼烧1.2秒，每0.4秒3基础伤害，重复命中刷新",
    weaponClass: "flamethrower", rangeBand: "close", visualId: "ember-sprayer", mechanicId: "burning_jet",
    damage: 3, interval: 0.10, projectileSpeed: 440, lockRange: 225, ttl: 0.52, pierce: 2,
    knockback: 3, recoil: 0.35, color: "#e88b43", burnDuration: 1.2, burnInterval: 0.4, burnDamage: 3 },
  { ...base, id: "arc_repeater", name: "雷索发射器", description: "初始命中后最多连锁2次，每次保留65%伤害；电弧不能穿墙",
    weaponClass: "electric", rangeBand: "mid", visualId: "arc-repeater", mechanicId: "arc_tether",
    damage: 18, interval: 0.66, projectileSpeed: 610, lockRange: 460, knockback: 18,
    color: "#7fc9dc", chainJumps: 2, chainRange: 145, chainRetention: 0.65 },
  { ...base, id: "scrap_knuckles", name: "裂响拳刃", description: "74范围、38°快速前刺；无剑气，不消除敌弹",
    attackType: "slash", attackStyle: "thrust", weaponClass: "fist", rangeBand: "close", visualId: "scrap-knuckles", mechanicId: "slash",
    damage: 11, interval: 0.28, projectileSpeed: 1, lockRange: 74, reach: 74, arc: 38 * Math.PI / 180,
    windup: 0.04, activeTime: 0.075, recovery: 0.09, restTipReach: 45, waveDamage: 0, blocksProjectiles: false,
    knockback: 12, recoil: 0.2, color: "#d4bc8d" },
  { ...base, id: "reaper_scythe", name: "拾荒战镰", description: "116范围、205°宽弧清群；有效段消弹，无远程剑气",
    attackType: "slash", weaponClass: "scythe", rangeBand: "close", visualId: "reaper-scythe", mechanicId: "slash",
    damage: 33, interval: 0.90, projectileSpeed: 1, lockRange: 116, reach: 116, arc: 205 * Math.PI / 180,
    windup: 0.22, activeTime: 0.20, recovery: 0.25, waveDamage: 0, blocksProjectiles: true,
    knockback: 56, recoil: 0.3, color: "#c3c7b0" },
];
const visuals = {};
for (const [id, width, height, pivot, muzzle, primaryGrip, supportGrip] of [
  ["ember_sprayer", 56, 30, [15, 10], [54, 10], [17, 20], [35, 18]],
  ["arc_repeater", 52, 28, [14, 9], [50, 9], [17, 18], [33, 16]],
  ["scrap_knuckles", 42, 24, [12, 12], [40, 12], [13, 14], [13, 14]],
  ["reaper_scythe", 76, 42, [15, 20], [73, 20], [17, 22], [35, 22]],
]) {
  const melee = id === "scrap_knuckles" || id === "reaper_scythe";
  visuals[id] = { width, height, pivot, muzzle, primaryGrip, supportGrip,
    family: melee ? "blade" : "heavy", shapes: [[1, Math.max(1, pivot[1] - 2), width - 2, 4, "steel"]],
    hold: { chestY: melee ? -8 : -16, aimOffsetX: melee ? 9 : 3, upShoulder: melee ? 14 : 11, upLift: melee ? 3 : 7 } };
}
const feedback = {};
for (const weapon of weapons) {
  feedback[weapon.id] = { ...previous.feedback.frost_projector, family: "cryo", color: weapon.color, core: "#fff0c2", impact: weapon.color,
    flash: "none", shell: "none", camera: 0.03, kick: 0.6, angle: 0.7, recovery: 0.055, trail: 13, width: 3 };
}
Object.assign(feedback.ember_sprayer, { family: "flame", flash: "flame", core: "#ffe1a0", kick: 0.35, width: 5, camera: 0.015 });
Object.assign(feedback.arc_repeater, { family: "arc", flash: "arc", core: "#d5f8ef", kick: 1.4, width: 3, camera: 0.08 });
Object.assign(feedback.scrap_knuckles, { family: "fist", kick: 0, angle: 0, width: 2 });
Object.assign(feedback.reaper_scythe, { family: "scythe", kick: 0, angle: 0, width: 3 });
const ids = ["prism_laser", "slag_launcher", "saw_disc", "echo_blade", "shock_hammer", ...previous.weapons.map(w => w.id), ...weapons.map(w => w.id)];
const upgrades = [...Object.values(legacy.catalogs.upgrades), ...previous.upgrades].map(w => w.id);
const design = { version: 1, date: "2026-10-31", weapons, visuals, feedback,
  prices: { ember_sprayer: 160, arc_repeater: 175, scrap_knuckles: 70, reaper_scythe: 110 },
  gunPrices: { ember_sprayer: 24, arc_repeater: 27, scrap_knuckles: 15, reaper_scythe: 21 },
  art: { frames: [0, 1, 2, 3, 4, 5].map(i => `res://assets/ui/fieldcraft-v2/frame-${i}.webp`),
    upgradeTextures: Object.fromEntries(upgrades.map(id => [id, `res://assets/ui/fieldcraft-v2/upgrades/${id}.webp`])),
    weaponTextures: Object.fromEntries(ids.map(id => [id, `res://assets/weapons/fieldcraft-v2/${id}.webp`])),
    deathTextures: Object.fromEntries(Object.keys(legacy.actorMetadata.ENEMY_SPRITES).map(id => [id, `res://assets/actors/fieldcraft-v2/${id}-death.webp`])) },
  audio: [...weapons.map(w => ({ id: w.id, role: w.attackType === "slash" ? "melee" : "shot", seconds: w.id === "ember_sprayer" ? 0.15 : 0.23 })),
    { id: "enemy_fall", role: "impact", seconds: 0.26 }].map(a => ({ ...a, src: `assets/audio/fieldcraft-v2/${a.id}.wav`, resourcePath: `res://assets/audio/fieldcraft-v2/${a.id}.wav` })) };
const destination = path.join(root, "art/combat/fieldcraft-v2/design.json");
if (fs.existsSync(destination) && !process.argv.includes("--overwrite")) throw new Error("Design already exists; edit intentionally or pass --overwrite.");
fs.writeFileSync(destination, JSON.stringify(design, null, 2) + "\n");
console.log(JSON.stringify({ weapons: weapons.length, refinedWeapons: ids.length, upgrades: upgrades.length }));
