"use strict";

const ART_IDS = Object.freeze({
  GROUND: "world.ground.v1",
  TITLE_KEY_ART: "cover.keyart.v1",
  BACKDROP_MAIN: "menu.backdrop.main.v2",
  BACKDROP_DEPLOYMENT: "menu.backdrop.deployment.v2",
  BACKDROP_INVENTORY: "menu.backdrop.inventory.v2",
  BACKDROP_SHOP: "menu.backdrop.shop.v2",
  BACKDROP_SETTINGS: "menu.backdrop.settings.v2",
  BACKDROP_CREDITS: "menu.backdrop.credits.v2",
  UI_FIELD_PLATE: "ui.field-plate.v2",
  DEPLOYMENT_CONVOY: "deployment.convoy.v1"
});

function asset(id, src, group, options = {}) {
  return Object.freeze({
    id,
    src,
    group,
    version: options.version || "1.0",
    optional: options.optional !== false,
    active: options.active !== false,
    eager: options.eager === true,
    nineSlice: options.nineSlice ? Object.freeze({ ...options.nineSlice }) : null,
    notes: options.notes || ""
  });
}

const ART_ASSETS = Object.freeze({
  [ART_IDS.GROUND]: asset(ART_IDS.GROUND, "./assets/wasteland-ground-texture-v1.webp", "world", {
    eager: true,
    notes: "Low-opacity ground texture; gameplay geometry remains data-driven."
  }),
  [ART_IDS.TITLE_KEY_ART]: asset(ART_IDS.TITLE_KEY_ART, "./assets/wasteland-title-keyart-v1.webp", "cover", {
    eager: true,
    notes: "Portrait key art rendered with contain-safe framing."
  }),
  [ART_IDS.BACKDROP_MAIN]: asset(ART_IDS.BACKDROP_MAIN, "./assets/ui/backdrops/menu-main-camp-v2.webp", "menu-backdrop", {
    version: "1.2",
    eager: true,
    notes: "Full-bleed 16:9 camp entrance with a protected left-side menu zone."
  }),
  [ART_IDS.BACKDROP_DEPLOYMENT]: asset(ART_IDS.BACKDROP_DEPLOYMENT, "./assets/ui/backdrops/deployment-command-bunker-v2.webp", "menu-backdrop", {
    version: "1.2",
    notes: "Full-bleed command garage; quiet zones match the deployment composition."
  }),
  [ART_IDS.BACKDROP_INVENTORY]: asset(ART_IDS.BACKDROP_INVENTORY, "./assets/ui/backdrops/inventory-armory-v2.webp", "menu-backdrop", {
    version: "1.2",
    notes: "Full-bleed armory with dedicated wardrobe and inventory zones."
  }),
  [ART_IDS.BACKDROP_SHOP]: asset(ART_IDS.BACKDROP_SHOP, "./assets/ui/backdrops/shop-quartermaster-v2.webp", "menu-backdrop", {
    version: "1.2",
    notes: "Full-bleed quartermaster counter with a calm merchandise wall."
  }),
  [ART_IDS.BACKDROP_SETTINGS]: asset(ART_IDS.BACKDROP_SETTINGS, "./assets/ui/backdrops/settings-radio-room-v2.webp", "menu-backdrop", {
    version: "1.2",
    notes: "Full-bleed signal room with protected settings and help zones."
  }),
  [ART_IDS.BACKDROP_CREDITS]: asset(ART_IDS.BACKDROP_CREDITS, "./assets/ui/backdrops/credits-archive-v2.webp", "menu-backdrop", {
    version: "1.2",
    notes: "Full-bleed records room with a central low-detail reading surface."
  }),
  [ART_IDS.UI_FIELD_PLATE]: asset(ART_IDS.UI_FIELD_PLATE, "./assets/ui/shared/ui-field-plate-v2.webp", "shared-ui", {
    version: "1.2",
    eager: true,
    nineSlice: { left: 175, right: 175, top: 125, bottom: 125 },
    notes: "Alpha-correct physical equipment plate; corners scale uniformly and only center bands stretch."
  }),
  [ART_IDS.DEPLOYMENT_CONVOY]: asset(ART_IDS.DEPLOYMENT_CONVOY, "./assets/ui/deployment/deployment-convoy-vignette-v1.webp", "deployment", {
    version: "1.1",
    notes: "Transparent survivor and armored convoy vignette."
  })
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

module.exports = { ART_IDS, ART_ASSETS, validateArtCatalog };
