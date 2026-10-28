"use strict";

const { COMPACT_IDS, COMPACT_ASSETS } = require("./compact-asset-catalog");

const ART_IDS = Object.freeze({
  ...COMPACT_IDS,
  GROUND: "world.ground.v1",
  GROUND_ECHO: "world.ground.echo.v1",
  GROUND_FREIGHT: "world.ground.freight.v1",
  GROUND_RED_BASIN: "world.ground.red-basin.v1",
  PROP_ECHO_APOTHECARY: "world.prop.echo.apothecary-roof.v1",
  PROP_ECHO_SHOP: "world.prop.echo.shop-roof.v1",
  PROP_ECHO_WAREHOUSE: "world.prop.echo.warehouse-roof.v1",
  PROP_ECHO_CONTAINER: "world.prop.echo.container.v1",
  PROP_ECHO_RAILCAR: "world.prop.echo.railcar.v1",
  TITLE_KEY_ART: "cover.survivor.v3",
  BACKDROP_MAIN: "menu.backdrop.main.v3",
  BACKDROP_DEPLOYMENT: "menu.backdrop.deployment.v3",
  BACKDROP_INVENTORY: "menu.backdrop.inventory.v3",
  BACKDROP_SHOP: "menu.backdrop.shop.v3",
  BACKDROP_SETTINGS: "menu.backdrop.settings.v3",
  BACKDROP_CREDITS: "menu.backdrop.credits.v3",
  UI_FIELD_PLATE: "ui.field-plate.v2",
  DEPLOYMENT_CONVOY: "deployment.convoy.v1",
  ACTOR_RANGER: "actor.ranger.base.v1",
  ACTOR_RANGER_MECHANIC: "actor.ranger.mechanic.v1",
  ACTOR_RANGER_NIGHTWATCH: "actor.ranger.nightwatch.v2",
  ACTOR_RANGER_PORTRAIT: "actor.ranger.portrait.v1",
  ACTOR_DRIFTER: "actor.drifter.v1",
  ACTOR_MECHANIC: "actor.mechanic.base.v1",
  ACTOR_MECHANIC_MECHANIC: "actor.mechanic.mechanic.v2",
  ACTOR_MECHANIC_NIGHTWATCH: "actor.mechanic.nightwatch.v1",
  ACTOR_BULWARK: "actor.bulwark.base.v1",
  ACTOR_BULWARK_MECHANIC: "actor.bulwark.mechanic.v1",
  ACTOR_BULWARK_NIGHTWATCH: "actor.bulwark.nightwatch.v2",
  ACTOR_RUNNER: "actor.runner.v1",
  ACTOR_SPITTER: "actor.spitter.v1",
  ACTOR_BRUTE: "actor.brute.v1",
  ACTOR_SCREECHER: "actor.screecher.v1",
  ACTOR_CRAWLER: "actor.crawler.v1",
  ACTOR_WARDEN: "actor.warden.v1",
  ACTOR_IRON_COLOSSUS: "actor.iron-colossus.v1",
  WEAPON_SCRAP_PISTOL: "weapon.scrap-pistol.v1",
  WEAPON_SWARM_SMG: "weapon.swarm-smg.v1",
  WEAPON_BREAKER_SHOTGUN: "weapon.breaker-shotgun.v1",
  WEAPON_NEEDLE_RIFLE: "weapon.needle-rifle.v1",
  WEAPON_RUST_REVOLVER: "weapon.rust-revolver.v1",
  WEAPON_EMBER_CARBINE: "weapon.ember-carbine.v1",
  WEAPON_COIL_CANNON: "weapon.coil-cannon.v1",
  OUTFIT_WANDERER: "outfit.wanderer.v1",
  OUTFIT_MECHANIC: "outfit.mechanic.v1",
  OUTFIT_NIGHTWATCH: "outfit.nightwatch.v1",
  EQUIPMENT_FIELD_VEST: "equipment.field-vest.v1",
  EQUIPMENT_IRON_PLATE: "equipment.iron-plate.v1",
  EQUIPMENT_RUNNER_BOOTS: "equipment.runner-boots.v1",
  EQUIPMENT_MAGNET_HELM: "equipment.magnet-helm.v1",
  EQUIPMENT_AMMO_RIG: "equipment.ammo-rig.v1",
  EQUIPMENT_SIGNAL_HELM: "equipment.signal-helm.v1",
  EQUIPMENT_SERVO_GREAVES: "equipment.servo-greaves.v1",
  EQUIPMENT_STORMSTEP_BOOTS: "equipment.stormstep-boots.v1",
  LEGACY_TITLE_KEY_ART: "cover.keyart.v1",
  LEGACY_BACKDROP_MAIN: "menu.backdrop.main.v2",
  LEGACY_BACKDROP_DEPLOYMENT: "menu.backdrop.deployment.v2",
  LEGACY_BACKDROP_INVENTORY: "menu.backdrop.inventory.v2",
  LEGACY_BACKDROP_SHOP: "menu.backdrop.shop.v2",
  LEGACY_BACKDROP_SETTINGS: "menu.backdrop.settings.v2",
  LEGACY_BACKDROP_CREDITS: "menu.backdrop.credits.v2"
});
const MAP_GROUND_ART = Object.freeze({
  echo_district: ART_IDS.GROUND_ECHO,
  freight_nexus: ART_IDS.GROUND_FREIGHT,
  red_basin: ART_IDS.GROUND_RED_BASIN
});

const RETIRED_ENEMY_ART = new Set([
  ART_IDS.ACTOR_DRIFTER, ART_IDS.ACTOR_RUNNER, ART_IDS.ACTOR_SPITTER,
  ART_IDS.ACTOR_BRUTE, ART_IDS.ACTOR_SCREECHER, ART_IDS.ACTOR_CRAWLER,
  ART_IDS.ACTOR_WARDEN, ART_IDS.ACTOR_IRON_COLOSSUS
]);

function asset(id, src, group, options = {}) {
  const retired = RETIRED_ENEMY_ART.has(id);
  return Object.freeze({
    id,
    src,
    group: retired ? "legacy" : group,
    version: options.version || "1.0",
    optional: options.optional !== false,
    active: !retired && options.active !== false,
    eager: options.eager === true,
    nineSlice: options.nineSlice ? Object.freeze({ ...options.nineSlice }) : null,
    notes: options.notes || ""
  });
}

const ART_ASSETS = Object.freeze({
  ...COMPACT_ASSETS,
  [ART_IDS.GROUND]: asset(ART_IDS.GROUND, "./assets/wasteland-ground-texture-v1.webp", "world", {
    eager: true, notes: "Legacy shared ground until every map has a painted material."
  }),
  [ART_IDS.GROUND_ECHO]: asset(ART_IDS.GROUND_ECHO, "./assets/world/echo-ground-v1.webp", "world", {
    version: "1.5", notes: "Painted Echo District overhead ground material, mirrored in world space."
  }),
  [ART_IDS.GROUND_FREIGHT]: asset(ART_IDS.GROUND_FREIGHT, "./assets/world/freight-ground-v1.webp", "world", {
    version: "1.5", notes: "Painted cool slate rail-yard ground material."
  }),
  [ART_IDS.GROUND_RED_BASIN]: asset(ART_IDS.GROUND_RED_BASIN, "./assets/world/red-basin-ground-v1.webp", "world", {
    version: "1.5", notes: "Painted warm cracked-clay desert ground material."
  }),
  [ART_IDS.PROP_ECHO_SHOP]: asset(ART_IDS.PROP_ECHO_SHOP, "./assets/world/props/echo-shop-roof-v1.webp", "world-props", {
    version: "1.5", notes: "Reusable overhead Echo District shop roof; game draws the shop name separately."
  }),
  [ART_IDS.PROP_ECHO_WAREHOUSE]: asset(ART_IDS.PROP_ECHO_WAREHOUSE, "./assets/world/props/echo-warehouse-roof-v1.webp", "world-props", {
    version: "1.5", notes: "Overhead Echo District warehouse roof; dimensions come from registered obstacles."
  }),
  [ART_IDS.PROP_ECHO_CONTAINER]: asset(ART_IDS.PROP_ECHO_CONTAINER, "./assets/world/props/echo-container-v1.webp", "world-props", {
    version: "1.5", notes: "Overhead Echo District cargo container; collision size comes from registered obstacles."
  }),
  [ART_IDS.PROP_ECHO_RAILCAR]: asset(ART_IDS.PROP_ECHO_RAILCAR, "./assets/world/props/echo-railcar-v1.webp", "world-props", {
    version: "1.5", notes: "Overhead Echo District freight wagon; rotated for vertical registered obstacles."
  }),
  [ART_IDS.PROP_ECHO_APOTHECARY]: asset(ART_IDS.PROP_ECHO_APOTHECARY, "./assets/world/props/echo-apothecary-roof-v1.webp", "world-props", {
    version: "1.5", notes: "Painted overhead apothecary roof aligned to its registered collision footprint."
  }),
  [ART_IDS.TITLE_KEY_ART]: asset(ART_IDS.TITLE_KEY_ART, "./assets/ui/characters/cover-survivor-v3.webp", "cover", {
    version: "1.5", eager: true,
    notes: "New illustrated survivor cutout used when the full menu scene has not loaded."
  }),
  [ART_IDS.BACKDROP_MAIN]: asset(ART_IDS.BACKDROP_MAIN, "./assets/ui/backdrops/menu-main-v3.webp", "menu-backdrop", {
    version: "1.5", eager: true, notes: "New illustrated camp scene with quiet left-side title zone."
  }),
  [ART_IDS.BACKDROP_DEPLOYMENT]: asset(ART_IDS.BACKDROP_DEPLOYMENT, "./assets/ui/backdrops/deployment-command-garage-v3.webp", "menu-backdrop", {
    version: "1.5", notes: "New illustrated convoy garage with protected mission controls."
  }),
  [ART_IDS.BACKDROP_INVENTORY]: asset(ART_IDS.BACKDROP_INVENTORY, "./assets/ui/backdrops/inventory-armory-v3.webp", "menu-backdrop", {
    version: "1.5", notes: "New illustrated armory with wardrobe and inventory reading zones."
  }),
  [ART_IDS.BACKDROP_SHOP]: asset(ART_IDS.BACKDROP_SHOP, "./assets/ui/backdrops/shop-quartermaster-v3.webp", "menu-backdrop", {
    version: "1.5", notes: "New illustrated market with quiet product area."
  }),
  [ART_IDS.BACKDROP_SETTINGS]: asset(ART_IDS.BACKDROP_SETTINGS, "./assets/ui/backdrops/settings-radio-room-v3.webp", "menu-backdrop", {
    version: "1.5", notes: "New illustrated radio room with quiet settings columns."
  }),
  [ART_IDS.BACKDROP_CREDITS]: asset(ART_IDS.BACKDROP_CREDITS, "./assets/ui/backdrops/credits-archive-v3.webp", "menu-backdrop", {
    version: "1.5", notes: "New illustrated archive with protected central text area."
  }),
  [ART_IDS.UI_FIELD_PLATE]: asset(ART_IDS.UI_FIELD_PLATE, "./assets/ui/shared/ui-field-plate-v2.webp", "shared-ui", {
    version: "1.2", eager: true,
    nineSlice: { left: 175, right: 175, top: 125, bottom: 125 },
    notes: "Transitional field plate; will be replaced with lighter painted surfaces."
  }),
  [ART_IDS.DEPLOYMENT_CONVOY]: asset(ART_IDS.DEPLOYMENT_CONVOY, "./assets/ui/deployment/deployment-convoy-vignette-v1.webp", "deployment", {
    version: "1.1", notes: "Transitional fixed convoy vignette."
  }),
  [ART_IDS.ACTOR_RANGER]: asset(ART_IDS.ACTOR_RANGER, "./assets/actors/ranger-base-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted survivor base body without a weapon."
  }),
  [ART_IDS.ACTOR_RANGER_NIGHTWATCH]: asset(ART_IDS.ACTOR_RANGER_NIGHTWATCH, "./assets/actors/ranger-nightwatch-v2.webp", "combat-actors", {
    version: "1.5", notes: "Painted ranger in the legible nightwatch outfit; v1 source archived as too dark."
  }),
  [ART_IDS.ACTOR_RANGER_MECHANIC]: asset(ART_IDS.ACTOR_RANGER_MECHANIC, "./assets/actors/ranger-mechanic-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted ranger wearing signal mechanic outfit; internal combination sample."
  }),
  [ART_IDS.ACTOR_RANGER_PORTRAIT]: asset(ART_IDS.ACTOR_RANGER_PORTRAIT, "./assets/actors/ranger-armed-portrait-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted armed ranger for inventory and result pages."
  }),
  [ART_IDS.ACTOR_DRIFTER]: asset(ART_IDS.ACTOR_DRIFTER, "./assets/actors/drifter-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted ordinary infected drifter."
  }),
  [ART_IDS.ACTOR_MECHANIC]: asset(ART_IDS.ACTOR_MECHANIC, "./assets/actors/mechanic-base-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted salvage specialist hero body."
  }),
  [ART_IDS.ACTOR_MECHANIC_NIGHTWATCH]: asset(ART_IDS.ACTOR_MECHANIC_NIGHTWATCH, "./assets/actors/mechanic-nightwatch-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted mechanic hero in nightwatch gear, retaining visible face and goggles."
  }),
  [ART_IDS.ACTOR_MECHANIC_MECHANIC]: asset(ART_IDS.ACTOR_MECHANIC_MECHANIC, "./assets/actors/mechanic-mechanic-v2.webp", "combat-actors", {
    version: "1.5", notes: "Painted mechanic hero in distinct signal-repair outfit; v1 archived as too similar to default."
  }),
  [ART_IDS.ACTOR_BULWARK_NIGHTWATCH]: asset(ART_IDS.ACTOR_BULWARK_NIGHTWATCH, "./assets/actors/bulwark-nightwatch-v2.webp", "combat-actors", {
    version: "1.5", notes: "Painted heavy bulwark in nightwatch cape; rejected checkerboard v1 archived."
  }),
  [ART_IDS.ACTOR_BULWARK_MECHANIC]: asset(ART_IDS.ACTOR_BULWARK_MECHANIC, "./assets/actors/bulwark-mechanic-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted heavy bulwark in signal-repair field gear; armor silhouette preserved."
  }),
  [ART_IDS.ACTOR_BULWARK]: asset(ART_IDS.ACTOR_BULWARK, "./assets/actors/bulwark-base-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted armored defender hero body."
  }),
  [ART_IDS.ACTOR_RUNNER]: asset(ART_IDS.ACTOR_RUNNER, "./assets/actors/runner-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted fast infected runner."
  }),
  [ART_IDS.ACTOR_SPITTER]: asset(ART_IDS.ACTOR_SPITTER, "./assets/actors/spitter-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted corrosive ranged infected."
  }),
  [ART_IDS.ACTOR_BRUTE]: asset(ART_IDS.ACTOR_BRUTE, "./assets/actors/brute-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted heavy infected tank."
  }),
  [ART_IDS.ACTOR_SCREECHER]: asset(ART_IDS.ACTOR_SCREECHER, "./assets/actors/screecher-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted alarm infected."
  }),
  [ART_IDS.ACTOR_CRAWLER]: asset(ART_IDS.ACTOR_CRAWLER, "./assets/actors/crawler-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted low crawling infected."
  }),
  [ART_IDS.ACTOR_WARDEN]: asset(ART_IDS.ACTOR_WARDEN, "./assets/actors/warden-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted elite wasteland warden."
  }),
  [ART_IDS.ACTOR_IRON_COLOSSUS]: asset(ART_IDS.ACTOR_IRON_COLOSSUS, "./assets/actors/iron-colossus-v1.webp", "combat-actors", {
    version: "1.5", notes: "Painted iron colossus boss."
  }),
  [ART_IDS.WEAPON_SCRAP_PISTOL]: asset(ART_IDS.WEAPON_SCRAP_PISTOL, "./assets/weapons/scrap-pistol-v1.webp", "combat-weapons", {
    version: "1.5", notes: "Painted separate starter pistol sprite."
  }),
  [ART_IDS.WEAPON_SWARM_SMG]: asset(ART_IDS.WEAPON_SWARM_SMG, "./assets/weapons/swarm-smg-v1.webp", "combat-weapons", {
    version: "1.5", notes: "Painted standalone swarm-smg sprite for combat and inventory."
  }),
  [ART_IDS.WEAPON_BREAKER_SHOTGUN]: asset(ART_IDS.WEAPON_BREAKER_SHOTGUN, "./assets/weapons/breaker-shotgun-v1.webp", "combat-weapons", {
    version: "1.5", notes: "Painted standalone breaker-shotgun sprite for combat and inventory."
  }),
  [ART_IDS.WEAPON_NEEDLE_RIFLE]: asset(ART_IDS.WEAPON_NEEDLE_RIFLE, "./assets/weapons/needle-rifle-v1.webp", "combat-weapons", {
    version: "1.5", notes: "Painted standalone needle-rifle sprite for combat and inventory."
  }),
  [ART_IDS.WEAPON_RUST_REVOLVER]: asset(ART_IDS.WEAPON_RUST_REVOLVER, "./assets/weapons/rust-revolver-v1.webp", "combat-weapons", {
    version: "1.5", notes: "Painted standalone rust-revolver sprite for combat and inventory."
  }),
  [ART_IDS.WEAPON_EMBER_CARBINE]: asset(ART_IDS.WEAPON_EMBER_CARBINE, "./assets/weapons/ember-carbine-v1.webp", "combat-weapons", {
    version: "1.5", notes: "Painted standalone ember-carbine sprite for combat and inventory."
  }),
  [ART_IDS.WEAPON_COIL_CANNON]: asset(ART_IDS.WEAPON_COIL_CANNON, "./assets/weapons/coil-cannon-v1.webp", "combat-weapons", {
    version: "1.5", notes: "Painted standalone coil-cannon sprite for combat and inventory."
  }),
  [ART_IDS.OUTFIT_WANDERER]: asset(ART_IDS.OUTFIT_WANDERER, "./assets/outfits/wanderer-v1.webp", "outfit-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.OUTFIT_MECHANIC]: asset(ART_IDS.OUTFIT_MECHANIC, "./assets/outfits/mechanic-v1.webp", "outfit-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.OUTFIT_NIGHTWATCH]: asset(ART_IDS.OUTFIT_NIGHTWATCH, "./assets/outfits/nightwatch-v1.webp", "outfit-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_FIELD_VEST]: asset(ART_IDS.EQUIPMENT_FIELD_VEST, "./assets/equipment/field-vest-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_IRON_PLATE]: asset(ART_IDS.EQUIPMENT_IRON_PLATE, "./assets/equipment/iron-plate-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_RUNNER_BOOTS]: asset(ART_IDS.EQUIPMENT_RUNNER_BOOTS, "./assets/equipment/runner-boots-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_MAGNET_HELM]: asset(ART_IDS.EQUIPMENT_MAGNET_HELM, "./assets/equipment/magnet-helm-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_AMMO_RIG]: asset(ART_IDS.EQUIPMENT_AMMO_RIG, "./assets/equipment/ammo-rig-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_SIGNAL_HELM]: asset(ART_IDS.EQUIPMENT_SIGNAL_HELM, "./assets/equipment/signal-helm-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_SERVO_GREAVES]: asset(ART_IDS.EQUIPMENT_SERVO_GREAVES, "./assets/equipment/servo-greaves-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.EQUIPMENT_STORMSTEP_BOOTS]: asset(ART_IDS.EQUIPMENT_STORMSTEP_BOOTS, "./assets/equipment/stormstep-boots-v1.webp", "equipment-icons", {
    version: "1.5", notes: "Painted inventory and shop item illustration."
  }),
  [ART_IDS.LEGACY_TITLE_KEY_ART]: asset(ART_IDS.LEGACY_TITLE_KEY_ART, "./assets/wasteland-title-keyart-v1.webp", "legacy", { active: false }),
  [ART_IDS.LEGACY_BACKDROP_MAIN]: asset(ART_IDS.LEGACY_BACKDROP_MAIN, "./assets/ui/backdrops/menu-main-camp-v2.webp", "legacy", { active: false }),
  [ART_IDS.LEGACY_BACKDROP_DEPLOYMENT]: asset(ART_IDS.LEGACY_BACKDROP_DEPLOYMENT, "./assets/ui/backdrops/deployment-command-bunker-v2.webp", "legacy", { active: false }),
  [ART_IDS.LEGACY_BACKDROP_INVENTORY]: asset(ART_IDS.LEGACY_BACKDROP_INVENTORY, "./assets/ui/backdrops/inventory-armory-v2.webp", "legacy", { active: false }),
  [ART_IDS.LEGACY_BACKDROP_SHOP]: asset(ART_IDS.LEGACY_BACKDROP_SHOP, "./assets/ui/backdrops/shop-quartermaster-v2.webp", "legacy", { active: false }),
  [ART_IDS.LEGACY_BACKDROP_SETTINGS]: asset(ART_IDS.LEGACY_BACKDROP_SETTINGS, "./assets/ui/backdrops/settings-radio-room-v2.webp", "legacy", { active: false }),
  [ART_IDS.LEGACY_BACKDROP_CREDITS]: asset(ART_IDS.LEGACY_BACKDROP_CREDITS, "./assets/ui/backdrops/credits-archive-v2.webp", "legacy", { active: false })
});
function validateArtCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") throw new TypeError("Art asset catalog must be an object");
  for (const [key, definition] of Object.entries(catalog)) {
    if (!definition || definition.id !== key) throw new Error(`Art asset '${key}' must repeat its stable id`);
    if (typeof definition.src !== "string" || !definition.src.startsWith("./assets/")) {
      throw new Error(`Art asset '${key}' must use a local ./assets/ path`);
    }
    if (/^https?:/i.test(definition.src)) throw new Error(`Art asset '${key}' cannot load a remote runtime URL`);
    if (definition.nineSlice) {
      for (const side of ["left", "right", "top", "bottom"]) {
        if (!(Number(definition.nineSlice[side]) >= 0)) throw new Error(`Art asset '${key}' has an invalid nine-slice ${side}`);
      }
    }
  }
  return catalog;
}

validateArtCatalog(ART_ASSETS);

module.exports = { ART_IDS, MAP_GROUND_ART, ART_ASSETS, validateArtCatalog };
