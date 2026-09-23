"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Random } = require("../src/core/random");

test("seeded random sequences are reproducible", () => {
  const first = new Random(20260907);
  const second = new Random(20260907);
  const firstValues = Array.from({ length: 8 }, () => first.next());
  const secondValues = Array.from({ length: 8 }, () => second.next());
  assert.deepEqual(firstValues, secondValues);
});

test("weighted selection returns available items", () => {
  const random = new Random(19);
  const items = [{ id: "a", weight: 1 }, { id: "b", weight: 4 }];
  for (let index = 0; index < 30; index += 1) {
    assert.ok(items.includes(random.weighted(items)));
  }
});
