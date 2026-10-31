"use strict";

const base = require("./compact-actors");
const { NEW_WEAPONS, NATIVE_WEAPONS } = require("./weapon-expansion");
const MATERIALS = { ...base.MATERIALS, weapons: base.MATERIALS.weapons.slice(), characters: { ...base.MATERIALS.characters }, handSets: { ...base.MATERIALS.handSets }, cuffSets: { ...base.MATERIALS.cuffSets } };
for (const [id, character] of Object.entries(MATERIALS.characters)) MATERIALS.characters[id] = { ...character, holdByWeapon: { ...character.holdByWeapon } };
for (const key of ["handSets", "cuffSets"]) for (const [id, parts] of Object.entries(MATERIALS[key])) {
  const primary = parts.poses.longgun.primary;
  MATERIALS[key][id] = { ...parts, poses: { ...parts.poses, blade: { primary, support: [] }, hammer: parts.poses.heavy } };
}
for (const [id, spec] of Object.entries(NATIVE_WEAPONS)) {
  const w = NEW_WEAPONS[id];
  MATERIALS.weapons.push({ id, name: w.name, version: "native-v2-1", visual: { ...spec, asset: "native." + id },
    combat: { ...w, recoil: Math.min(4, Math.max(.5, w.recoil * .35)) } });
  for (const character of Object.values(MATERIALS.characters)) character.holdByWeapon[id] = { ...spec.hold };
}
module.exports = { ...base, MATERIALS };
