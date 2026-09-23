"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { NavigationGrid, NavigationFlowField } = require("../src/world/navigation-grid");
const { MAP_LAYOUTS } = require("../src/world/wasteland-map");

function layout(overrides = {}) {
  return {
    id: "test",
    worldSize: 512,
    obstacles: [],
    ...overrides
  };
}

test("open flow field points toward the player cell", () => {
  const grid = new NavigationGrid(layout(), { cellSize: 64, clearance: 16 });
  const flow = new NavigationFlowField(grid);
  assert.equal(flow.rebuild(448, 256), true);
  const index = flow.sampleIndex(64, 256);
  assert.ok(index >= 0);
  assert.equal(flow.directionX[index], 1);
  assert.equal(flow.directionY[index], 0);
  assert.equal(grid.isWorldWalkable(64, 256), true);
});

test("flow field routes around a wall opening without cutting blocked corners", () => {
  const grid = new NavigationGrid(layout({ obstacles: [{ x: 192, y: 0, w: 64, h: 384 }] }), { cellSize: 64, clearance: 16 });
  const flow = new NavigationFlowField(grid);
  assert.equal(flow.rebuild(448, 64), true);
  const nearWall = flow.sampleIndex(144, 96);
  assert.ok(nearWall >= 0);
  assert.ok(flow.directionY[nearWall] > 0, "the route should descend toward the opening instead of pushing into the wall");
  assert.equal(grid.isWalkable(3, 2), false);
});

test("unreachable cells remain without a direction", () => {
  const grid = new NavigationGrid(layout({ obstacles: [{ x: 224, y: 0, w: 64, h: 512 }] }), { cellSize: 32, clearance: 8 });
  const flow = new NavigationFlowField(grid);
  assert.equal(flow.rebuild(448, 256), true);
  assert.equal(flow.sampleIndex(64, 256), -1);
});

test("thin obstacles intersecting a cell are conservatively baked", () => {
  const grid = new NavigationGrid(layout({
    worldSize: 256,
    obstacles: [{ x: 63, y: 64, w: 2, h: 128 }]
  }), { cellSize: 64, clearance: 0 });
  assert.equal(grid.isWalkable(0, 1), false);
  assert.equal(grid.isWalkable(1, 1), false);
  assert.equal(grid.isWalkable(2, 1), true);
});

test("all production maps bake bounded reusable navigation grids", () => {
  for (const mapLayout of Object.values(MAP_LAYOUTS)) {
    const grid = new NavigationGrid(mapLayout, { cellSize: 64, clearance: 32 });
    assert.equal(grid.cellCount, grid.columns * grid.rows);
    assert.ok(grid.cellCount <= 4096);
    assert.ok(grid.walkable.some((value) => value === 1), `${mapLayout.id} keeps reachable cells`);
    assert.ok(grid.walkable.some((value) => value === 0), `${mapLayout.id} marks blocked cells`);
  }
});
