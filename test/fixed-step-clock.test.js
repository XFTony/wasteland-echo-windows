"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { FixedStepClock } = require("../src/core/fixed-step-clock");

test("fixed clock advances deterministically and reports catch-up drops", () => {
  const clock = new FixedStepClock({ step: 0.01, maxCatchUpSteps: 3, maxFrameDelta: 0.1 });
  clock.reset(0);
  const steps = [];
  const result = clock.advance(100, true, (dt) => steps.push(dt));
  assert.deepEqual(steps, [0.01, 0.01, 0.01]);
  assert.equal(result.dropped, true);
  assert.equal(clock.accumulator, 0);
  assert.equal(clock.droppedCatchUps, 1);
});

test("fixed clock drops paused wall time and resumes without a spiral", () => {
  const clock = new FixedStepClock({ step: 0.02 });
  clock.reset(100);
  assert.equal(clock.advance(5100, false, () => {}).steps, 0);
  const steps = [];
  clock.advance(5120, true, (dt) => steps.push(dt));
  assert.equal(steps.length, 1);
});
