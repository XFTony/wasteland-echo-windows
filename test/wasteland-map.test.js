"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  WASTELAND_WORLD_SIZE,
  WASTELAND_ZONES,
  WASTELAND_ROADS,
  WASTELAND_TRACKS,
  WASTELAND_OBSTACLES,
  WASTELAND_SCENERY,
  MAP_LAYOUTS
} = require("../src/world/wasteland-map");
const { WorldRegistry } = require("../src/world/world-registry");

test("wasteland layout describes concrete city, road, rail, and scrapyard districts", () => {
  const zoneIds = new Set(WASTELAND_ZONES.map((zone) => zone.id));
  assert.ok(zoneIds.has("old-quarter"));
  assert.ok(zoneIds.has("main-road"));
  assert.ok(zoneIds.has("freight-yard"));
  assert.ok(zoneIds.has("breaker-yard"));
  assert.ok(WASTELAND_ROADS.some((road) => road.orientation === "horizontal"));
  assert.ok(WASTELAND_ROADS.some((road) => road.orientation === "vertical"));
  assert.ok(WASTELAND_TRACKS.some((track) => track.lines >= 4));
  assert.ok(WASTELAND_OBSTACLES.some((obstacle) => obstacle.kind === "shop"));
  assert.ok(WASTELAND_OBSTACLES.some((obstacle) => obstacle.kind === "railcar"));
  assert.ok(WASTELAND_SCENERY.some((item) => item.type === "railSignal"));
});

test("all selectable maps are larger, distinct, and remain inside their own boundaries", () => {
  assert.deepEqual(Object.keys(MAP_LAYOUTS), ["echo_district", "freight_nexus", "red_basin"]);
  assert.ok(MAP_LAYOUTS.echo_district.worldSize > WASTELAND_WORLD_SIZE);
  for (const layout of Object.values(MAP_LAYOUTS)) {
    assert.ok(layout.worldSize >= 3072);
    assert.ok(layout.zones.length >= 4);
    assert.ok(layout.obstacles.length >= 15);
    assert.ok(layout.roadDetails.some((detail) => detail.type === "crosswalk"), `${layout.id} has a map-specific crosswalk`);
    assert.ok(layout.roadDetails.some((detail) => detail.type === "crack"), `${layout.id} has map-specific road wear`);
    assert.deepEqual(new Set(layout.interactives.map((item) => item.type)), new Set(["explosiveBarrel", "supplyCache", "electricField"]), `${layout.id} exposes all baseline interaction types`);
    for (const detail of layout.roadDetails) {
      assert.ok(detail.x >= 0 && detail.y >= 0);
      assert.ok(detail.x + detail.w <= layout.worldSize, `${layout.id}/${detail.id} fits width`);
      assert.ok(detail.y + detail.h <= layout.worldSize, `${layout.id}/${detail.id} fits height`);
    }
    for (const obstacle of layout.obstacles) {
      assert.ok(obstacle.x >= 0 && obstacle.y >= 0);
      assert.ok(obstacle.x + obstacle.w <= layout.worldSize, `${layout.id}/${obstacle.kind} fits width`);
      assert.ok(obstacle.y + obstacle.h <= layout.worldSize, `${layout.id}/${obstacle.kind} fits height`);
    }
  }
});

test("road details are distinct per map instead of renderer-level coordinates", () => {
  const signatures = Object.values(MAP_LAYOUTS).map((layout) => layout.roadDetails.map((detail) => `${detail.type}:${detail.x}:${detail.y}`).join("|"));
  assert.equal(new Set(signatures).size, Object.keys(MAP_LAYOUTS).length);
});

test("map landmarks stay inside the playable collision world", () => {
  for (const zone of WASTELAND_ZONES) {
    assert.ok(zone.x >= 0 && zone.y >= 0);
    assert.ok(zone.x + zone.w <= WASTELAND_WORLD_SIZE);
    assert.ok(zone.y + zone.h <= WASTELAND_WORLD_SIZE);
  }
  for (const obstacle of WASTELAND_OBSTACLES) {
    assert.ok(obstacle.x >= 0 && obstacle.y >= 0, `${obstacle.kind} starts in bounds`);
    assert.ok(obstacle.x + obstacle.w <= WASTELAND_WORLD_SIZE, `${obstacle.kind} ends inside world width`);
    assert.ok(obstacle.y + obstacle.h <= WASTELAND_WORLD_SIZE, `${obstacle.kind} ends inside world height`);
  }
  for (const item of WASTELAND_SCENERY) {
    assert.ok(item.x >= 0 && item.x <= WASTELAND_WORLD_SIZE);
    assert.ok(item.y >= 0 && item.y <= WASTELAND_WORLD_SIZE);
  }
});

test("world registry rejects maps split into disconnected walkable regions", () => {
  const blocked = {
    sealed: {
      id: "sealed",
      worldSize: 512,
      theme: {
        ground: "#111111",
        asphalt: "#222222",
        concrete: "#333333",
        ballast: "#444444",
        accent: "#555555",
        haze: "#666666"
      },
      zones: [],
      roads: [],
      tracks: [],
      obstacles: [{ x: 240, y: 0, w: 32, h: 512, kind: "wall" }],
      scenery: [],
      interactives: [
        { id: "left", type: "supplyCache", x: 96, y: 256, radius: 10 },
        { id: "right", type: "supplyCache", x: 416, y: 256, radius: 10 }
      ]
    }
  };
  assert.throws(() => new WorldRegistry(blocked), /disconnected walkable regions/);
});
