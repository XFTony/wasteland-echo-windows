"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SpatialGrid } = require("../src/core/spatial-grid");

test("spatial grid returns entities from every cell touched by a query", () => {
  const grid = new SpatialGrid(100, 32);
  const left = { id: 1, x: 96, y: 50 };
  const right = { id: 2, x: 104, y: 50 };
  const far = { id: 3, x: 350, y: 50 };
  grid.insert(left);
  grid.insert(right);
  grid.insert(far);

  const output = [];
  const result = grid.queryCircle(100, 50, 8, output);
  assert.equal(result, output, "the caller-provided buffer should be reused");
  assert.deepEqual(new Set(result), new Set([left, right]));
  assert.equal(grid.activeCellCount, 3);
});

test("clearing a spatial grid removes stale entities while retaining buckets", () => {
  const grid = new SpatialGrid(64, 32);
  const first = { id: 1, x: 20, y: 20 };
  const second = { id: 2, x: 24, y: 24 };
  const output = [first];
  grid.insert(first);
  grid.clear();

  assert.equal(grid.activeCellCount, 0);
  assert.deepEqual(grid.queryCircle(20, 20, 10, output), []);

  grid.insert(second);
  assert.equal(grid.activeCellCount, 1);
  assert.deepEqual(grid.queryCircle(20, 20, 10, output), [second]);
});

test("bounded entries can span cells and unique queries return them once", () => {
  const grid = new SpatialGrid(32, 16);
  const wall = { id: "wall" };
  const crate = { id: "crate" };
  const output = [];
  const seen = new Set();
  grid.insertBounds(wall, 24, 24, 104, 104);
  grid.insertBounds(crate, 120, 120, 140, 140);

  grid.queryCircleUnique(64, 64, 28, output, seen);
  assert.deepEqual(output, [wall]);
  grid.queryCircleUnique(128, 128, 8, output, seen);
  assert.deepEqual(new Set(output), new Set([wall, crate]), "broad-phase queries may include adjacent-cell candidates but not duplicates");
});
