import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, "../..");
const folder = "art/combat/fieldcraft-v2";
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const design = read(`${folder}/design.json`);
const audio = read(`${folder}/audio-manifest.json`);
const digest = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const groups = [
  ["damage", "fireRate", "projectile", "pierce", "velocity", "caliber", "critical", "speed", "vitality", "magnet", "armor", "recovery", "scavenger", "phaseLining", "meleeReach", "blastRadius"],
  ["engineering", "turretRepair", "endlessPower", "endlessVitality", "endlessSupplies", "endlessAid", "executionCapacitor", "reactivePlating", "salvageOverdrive", "pointBlankRelay", "focusProtocol", "cascadeRounds", "penetratorDoctrine", "swarmProtocol", "recoveryField", "phaseAegis"],
  ["kineticLoop", "arcNetwork", "critDamage", "killMend", "meleeTempo", "ricochetCoil", "chillAmplifier", "blastFocus", "fieldRush", "pressureBarrel"],
];
const assets = [];
const add = (id, type, resource, source) => {
  const runtime = "godot/" + resource.slice("res://".length);
  assets.push({ id: "fieldcraft." + id, type, runtime, sourcePaths: [source, `${folder}/prompts.json`, "godot/scripts/tools/prepare_fieldcraft_art.gd"],
    bytes: fs.statSync(path.join(root, runtime)).size, sha256: digest(runtime), processing: "Grid crop, alpha-threshold bounds, nearest-neighbor scale and logical muzzle alignment; no geometry-drawn replacement" });
};
design.art.frames.forEach((file, index) => add(`frame.${index}`, "card-frame", file, `${folder}/sources/cards.png`));
for (const [id, file] of Object.entries(design.art.upgradeTextures)) add(`upgrade.${id}`, "upgrade-illustration", file, `${folder}/sources/icons-${groups.findIndex(g => g.includes(id))}.png`);
for (const [id, file] of Object.entries(design.art.weaponTextures)) add(`weapon.${id}`, "independent-weapon-body", file, `${folder}/sources/weapons.png`);
for (const [id, file] of Object.entries(design.art.deathTextures)) add(`death.${id}`, "enemy-death-strip", file, `${folder}/sources/death-${["drifter", "runner", "spitter", "brute"].includes(id) ? 0 : 1}.png`);
for (const item of audio) assets.push({ ...item, id: `fieldcraft.audio.${item.id}`, type: "audio" });
const sources = fs.readdirSync(path.join(root, folder, "sources")).filter(f => f.endsWith(".png")).map(name => {
  const file = `${folder}/sources/${name}`;
  return { path: file, bytes: fs.statSync(path.join(root, file)).size, sha256: digest(file) };
});
const manifest = { version: "fieldcraft-v2", created: "2026-10-31", generator: "OpenAI built-in ImageGen for original bitmap art; project-original offline audio synthesis",
  usageTerms: "Generated art follows applicable service terms; not third-party CC0. Audio is project original. No game graphics or recordings copied.",
  sourceReference: `${folder}/references/enemies.png`, prompts: `${folder}/prompts.json`, sources, assets,
  runtimeBytes: assets.reduce((n, a) => n + a.bytes, 0), bitmapFiles: 69, audioFiles: 5,
  decodedBitmapBytes: 6919488, decodedBitmapScope: "RGBA pixel payload sum measured by native tests, excluding GPU/driver/import-cache overhead" };
fs.writeFileSync(path.join(root, folder, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const ledgerPath = path.join(root, "docs/assets-ledger.csv");
const old = fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(line => line && !line.startsWith("fieldcraft."));
const csv = value => /[,"\r\n]/.test(String(value)) ? '"' + String(value).replaceAll('"', '""') + '"' : String(value);
for (const item of assets) {
  const original = item.type === "audio";
  old.push([item.id, item.type, [item.runtime, ...item.sourcePaths].join("; "), "", original ? "Wasteland Echo project" : "OpenAI built-in ImageGen",
    original ? "Project original" : "Generated project asset; applicable service terms; not third-party CC0", "2026-10-31", "true",
    original ? "Original offline synthesis; source and SHA recorded" : "Source sheet and prompt retained; technical extraction only; character references are project assets",
    original ? "true" : "review-required", original ? "approved" : "source-recorded-commercial-terms-review"].map(csv).join(","));
}
fs.writeFileSync(ledgerPath, old.join("\n") + "\n");
console.log(JSON.stringify({ assets: assets.length, runtimeBytes: manifest.runtimeBytes, decodedBitmapBytes: manifest.decodedBitmapBytes, sources: sources.length }));
