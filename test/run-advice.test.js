"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_CONTENT } = require("../src/core/content-registry");
const { buildRunAdvice } = require("../src/core/run-advice");

test("failure advice identifies the main threat and weak run decisions", () => {
  const run = {
    rule: "extract",
    elapsed: 90,
    damageTaken: 100,
    damageTakenBySource: { spitter: 70, runner: 30 },
    projectilesFired: 100,
    hits: 40,
    upgradeOrder: [],
    player: { level: 1 }
  };
  const advice = buildRunAdvice(run, "lose", DEFAULT_CONTENT);
  assert.equal(advice.length, 3);
  assert.match(advice[0], /腐蚀者.*70%/);
  assert.match(advice[1], /撤离节奏/);
  assert.match(advice[2], /40%/);
});

test("wins stay uncluttered and sparse failures receive a safe fallback", () => {
  const run = {
    rule: "survive",
    elapsed: 20,
    damageTaken: 0,
    damageTakenBySource: {},
    projectilesFired: 0,
    hits: 0,
    upgradeOrder: [],
    player: { level: 1 }
  };
  assert.deepEqual(buildRunAdvice(run, "win", DEFAULT_CONTENT), []);
  assert.match(buildRunAdvice(run, "lose", DEFAULT_CONTENT)[0], /退路/);
});
