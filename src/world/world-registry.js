"use strict";

const { MAP_LAYOUTS } = require("./wasteland-map");
const { NavigationGrid, NavigationFlowField } = require("./navigation-grid");

const THEME_FIELDS = Object.freeze(["ground", "asphalt", "concrete", "ballast", "accent", "haze"]);
const RECTANGLE_COLLECTIONS = Object.freeze(["zones", "roads", "roadDetails", "tracks", "obstacles"]);
const REQUIRED_LAYOUT_COLLECTIONS = Object.freeze(["zones", "roads", "tracks", "obstacles", "scenery"]);
const OPTIONAL_LAYOUT_COLLECTIONS = Object.freeze(["roadDetails", "interactives"]);
const LAYOUT_COLLECTIONS = Object.freeze([...REQUIRED_LAYOUT_COLLECTIONS, ...OPTIONAL_LAYOUT_COLLECTIONS]);

function requireString(value, label) {
  if (typeof value !== "string" || !value) throw new TypeError(label + " must be a non-empty string");
}

function requireFinite(value, label, minimum = 0) {
  if (!Number.isFinite(Number(value)) || Number(value) < minimum) {
    throw new TypeError(label + " must be a finite number no smaller than " + minimum);
  }
}

function validatePoint(entry, label, worldSize) {
  if (!entry || typeof entry !== "object") throw new TypeError(label + " must be an object");
  requireFinite(entry.x, label + ".x");
  requireFinite(entry.y, label + ".y");
  if (Number(entry.x) > worldSize || Number(entry.y) > worldSize) {
    throw new RangeError(label + " must remain inside the world boundary");
  }
}

function validateRectangle(entry, label, worldSize) {
  validatePoint(entry, label, worldSize);
  requireFinite(entry.w, label + ".w", Number.EPSILON);
  requireFinite(entry.h, label + ".h", Number.EPSILON);
  if (Number(entry.x) + Number(entry.w) > worldSize || Number(entry.y) + Number(entry.h) > worldSize) {
    throw new RangeError(label + " must remain inside the world boundary");
  }
}

function validateCollectionEntry(collection, entry, label, worldSize) {
  if (RECTANGLE_COLLECTIONS.includes(collection)) validateRectangle(entry, label, worldSize);
  else validatePoint(entry, label, worldSize);
  if (collection === "zones") {
    requireString(entry.id, label + ".id");
    requireString(entry.surface, label + ".surface");
  } else if (collection === "roads" || collection === "tracks") {
    requireString(entry.id, label + ".id");
    requireString(entry.orientation, label + ".orientation");
  } else if (collection === "obstacles") {
    requireString(entry.kind, label + ".kind");
  } else if (collection === "scenery") {
    requireString(entry.type, label + ".type");
  } else if (collection === "roadDetails") {
    requireString(entry.id, label + ".id");
    requireString(entry.type, label + ".type");
    if (!new Set(["crosswalk", "crack"]).has(entry.type)) throw new Error(label + ".type is not supported");
    if (entry.type === "crosswalk") requireString(entry.orientation, label + ".orientation");
  } else if (collection === "interactives") {
    requireString(entry.id, label + ".id");
    requireString(entry.type, label + ".type");
    if (!new Set(["explosiveBarrel", "supplyCache", "electricField"]).has(entry.type)) throw new Error(label + ".type is not supported");
    requireFinite(entry.radius, label + ".radius", Number.EPSILON);
    if (Number(entry.x) + Number(entry.radius) > worldSize || Number(entry.y) + Number(entry.radius) > worldSize) {
      throw new RangeError(label + " radius must remain inside the world boundary");
    }
  }
}

function freezeLayout(layout) {
  const snapshot = {
    ...layout,
    worldSize: Number(layout.worldSize),
    theme: Object.freeze({ ...layout.theme })
  };
  for (const collection of LAYOUT_COLLECTIONS) {
    snapshot[collection] = Object.freeze((layout[collection] || []).map((entry) => Object.freeze({ ...entry })));
  }
  return Object.freeze(snapshot);
}

function validateLayoutConnectivity(layout, label) {
  const grid = new NavigationGrid(layout, { cellSize: 64, clearance: 14 });
  const flow = new NavigationFlowField(grid);
  if (!flow.rebuild(Number(layout.worldSize) / 2, Number(layout.worldSize) / 2)) {
    throw new Error(label + " does not contain a reachable center region");
  }
  let walkable = 0;
  let reachable = 0;
  for (let index = 0; index < grid.cellCount; index += 1) {
    if (grid.walkable[index]) walkable += 1;
    if (flow.distances[index] >= 0) reachable += 1;
  }
  if (walkable === 0 || reachable !== walkable) {
    throw new Error(label + " contains disconnected walkable regions");
  }
  for (const interactive of layout.interactives || []) {
    if (flow.sampleIndex(interactive.x, interactive.y) < 0) {
      throw new Error(label + ".interactives." + interactive.id + " is unreachable");
    }
  }
}

function validateLayoutCatalog(layouts) {
  if (!layouts || typeof layouts !== "object" || Array.isArray(layouts)) {
    throw new TypeError("World layouts must be a non-array object");
  }
  const ids = Object.keys(layouts);
  if (!ids.length) throw new Error("World layouts cannot be empty");
  for (const id of ids) {
    const layout = layouts[id];
    const label = "world." + id;
    if (!layout || typeof layout !== "object") throw new TypeError(label + " must be an object");
    if (layout.id !== id) throw new Error(label + ".id must match its catalog key");
    const worldSize = Number(layout.worldSize);
    if (!(worldSize > 0)) throw new Error(label + ".worldSize must be positive");
    if (!layout.theme || typeof layout.theme !== "object" || Array.isArray(layout.theme)) {
      throw new TypeError(label + ".theme must be an object");
    }
    for (const field of THEME_FIELDS) requireString(layout.theme[field], label + ".theme." + field);
    for (const collection of REQUIRED_LAYOUT_COLLECTIONS) {
      if (!Array.isArray(layout[collection])) throw new Error(label + "." + collection + " must be an array");
      for (let index = 0; index < layout[collection].length; index += 1) {
        validateCollectionEntry(collection, layout[collection][index], label + "." + collection + "[" + index + "]", worldSize);
      }
    }
    for (const collection of OPTIONAL_LAYOUT_COLLECTIONS) {
      if (layout[collection] !== undefined && !Array.isArray(layout[collection])) throw new Error(label + "." + collection + " must be an array");
      const entries = layout[collection] || [];
      for (let index = 0; index < entries.length; index += 1) {
        validateCollectionEntry(collection, entries[index], label + "." + collection + "[" + index + "]", worldSize);
      }
    }
    validateLayoutConnectivity(layout, label);
  }
  return layouts;
}

class WorldRegistry {
  constructor(layouts = MAP_LAYOUTS) {
    const source = validateLayoutCatalog(layouts);
    this.layouts = Object.freeze(Object.fromEntries(
      Object.keys(source).map((id) => [id, freezeLayout(source[id])])
    ));
    this.layoutIds = Object.freeze(Object.keys(this.layouts));
    this.defaultLayoutId = this.layouts.echo_district ? "echo_district" : this.layoutIds[0];
    Object.freeze(this);
  }

  has(id) {
    return typeof id === "string" && Boolean(this.layouts[id]);
  }

  get(id) {
    return this.has(id) ? this.layouts[id] : null;
  }

  ids() {
    return this.layoutIds;
  }
}

const DEFAULT_WORLD = new WorldRegistry();

module.exports = { validateLayoutConnectivity, validateLayoutCatalog, WorldRegistry, DEFAULT_WORLD };
