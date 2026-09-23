"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  GAME_MODES,
  WEAPONS,
  ENEMIES,
  UPGRADES,
  SKINS,
  HEROES,
  MAPS,
  STAGES,
  EQUIPMENT,
  SHOP_ITEMS
} = require("../src/config");
const { ContentRegistry } = require("../src/core/content-registry");
const { createGameRuntime } = require("../src/runtime/create-game-runtime");
const { WorldRegistry } = require("../src/world/world-registry");
const { MAP_LAYOUTS } = require("../src/world/wasteland-map");

function createContent(world, overrides = {}) {
  return new ContentRegistry({
    modes: overrides.modes || GAME_MODES,
    weapons: overrides.weapons || WEAPONS,
    enemies: overrides.enemies || ENEMIES,
    upgrades: overrides.upgrades || UPGRADES,
    skins: overrides.skins || SKINS,
    heroes: overrides.heroes || HEROES,
    maps: overrides.maps || MAPS,
    stages: overrides.stages || STAGES,
    equipment: overrides.equipment || EQUIPMENT,
    shopItems: overrides.shopItems || SHOP_ITEMS
  }, { world });
}

function createCanvas() {
  const gradient = { addColorStop() {} };
  const context = {
    setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arc() {}, fill() {}, stroke() {},
    save() {}, restore() {}, translate() {}, rotate() {}, fillText() {},
    createLinearGradient() { return gradient; },
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left",
    textBaseline: "middle", globalAlpha: 1, imageSmoothingEnabled: false
  };
  return { width: 0, height: 0, style: {}, getContext: () => context };
}

function createPlatform() {
  return {
    profile: "windows-desktop",
    viewport: () => ({ width: 960, height: 540, dpr: 1 }),
    raf() {},
    now: () => 0
  };
}

function createStorage() {
  const data = new Map();
  return { get: (key) => data.get(key) || null, set: (key, value) => data.set(key, value) };
}

test("composition root gives model and renderer one world registry", () => {
  const world = new WorldRegistry(MAP_LAYOUTS);
  const content = createContent(world);
  const runtime = createGameRuntime({
    canvas: createCanvas(),
    storage: createStorage(),
    platform: createPlatform(),
    content,
    audioContextFactory: () => null
  });

  assert.equal(runtime.world, world);
  assert.equal(runtime.content, content);
  assert.equal(runtime.model.world, world);
  assert.equal(runtime.renderer.world, world);
  assert.equal(runtime.model.content, content);
  assert.equal(runtime.renderer.content, content);
  assert.equal(Object.isFrozen(world.get("echo_district")), true);
  assert.equal(Object.isFrozen(world.get("echo_district").obstacles), true);
  assert.equal(Object.isFrozen(world.get("echo_district").roadDetails), true);
  assert.equal(Object.isFrozen(world.get("echo_district").interactives), true);
  assert.ok(world.get("echo_district").roadDetails.length > 0);
});

test("map IDs resolve through layout IDs in the same composed world", () => {
  const layout = {
    id: "amber_layout",
    worldSize: 512,
    zones: [],
    roads: [],
    tracks: [],
    obstacles: [],
    scenery: [],
    theme: {
      ground: "#3d352c",
      asphalt: "#313638",
      concrete: "#67635d",
      ballast: "#4f4d48",
      accent: "#ffd166",
      haze: "#d6a56c"
    }
  };
  const world = new WorldRegistry({ ...MAP_LAYOUTS, amber_layout: layout });
  const amberMap = {
    ...MAPS.echo_district,
    id: "operation_amber",
    name: "琥珀试验区",
    layoutId: "amber_layout",
    worldSize: 512
  };
  const content = createContent(world, { maps: { ...MAPS, operation_amber: amberMap } });
  const runtime = createGameRuntime({
    canvas: createCanvas(),
    storage: createStorage(),
    platform: createPlatform(),
    content,
    audioContextFactory: () => null
  });

  runtime.model.startRun({ seed: 13, mapId: "operation_amber" });
  runtime.renderer.resize(960, 540, 1);
  runtime.renderer.render(runtime.model);
  assert.equal(runtime.model.mapLayout.id, "amber_layout");
  assert.equal(runtime.renderer.mapLayout.id, "amber_layout");
  assert.equal(runtime.model.worldSize, 512);
});

test("composition root rejects a content registry paired with another world instance", () => {
  const contentWorld = new WorldRegistry(MAP_LAYOUTS);
  const otherWorld = new WorldRegistry(MAP_LAYOUTS);
  const content = createContent(contentWorld);
  assert.throws(() => createGameRuntime({
    canvas: createCanvas(),
    storage: createStorage(),
    platform: createPlatform(),
    content,
    world: otherWorld,
    audioContextFactory: () => null
  }), /same composition/);
});

test("world registry and content registry reject an unresolved map layout", () => {
  assert.throws(() => new WorldRegistry({
    broken: { id: "other", worldSize: 512, zones: [], roads: [], tracks: [], obstacles: [], scenery: [] }
  }), /must match its catalog key/);

  const invalidMap = {
    ...MAPS.echo_district,
    id: "missing_layout_map",
    layoutId: "not_registered"
  };
  assert.throws(
    () => createContent(new WorldRegistry(MAP_LAYOUTS), { maps: { ...MAPS, missing_layout_map: invalidMap } }),
    /layoutId must reference/
  );

  assert.throws(() => new WorldRegistry({
    flat: { id: "flat", worldSize: 512, zones: [], roads: [], tracks: [], obstacles: [], scenery: [] }
  }), /theme/);

  const theme = {
    ground: "#3d352c",
    asphalt: "#313638",
    concrete: "#67635d",
    ballast: "#4f4d48",
    accent: "#ffd166",
    haze: "#d6a56c"
  };
  assert.throws(() => new WorldRegistry({
    outside: {
      id: "outside",
      worldSize: 512,
      zones: [{ id: "too-wide", surface: "pavement", x: 480, y: 0, w: 64, h: 64 }],
      roads: [],
      tracks: [],
      obstacles: [],
      scenery: [],
      theme
    }
  }), /world boundary/);

  assert.throws(() => new WorldRegistry({
    invalid_detail: {
      id: "invalid_detail",
      worldSize: 512,
      zones: [], roads: [], tracks: [], obstacles: [], scenery: [],
      roadDetails: [{ id: "outside", type: "crosswalk", orientation: "vertical", x: 500, y: 30, w: 40, h: 80 }],
      theme
    }
  }), /world boundary/);
});
