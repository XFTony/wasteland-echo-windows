"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EQUIPMENT, SKINS, WEAPONS } = require("../src/config");
const { drawSurvivorActor } = require("../src/render/pixel-actors");

function drawingContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    fillRect(x, y, w, h) { calls.push({ type: "fillRect", color: this.fillStyle, x, y, w, h }); },
    strokeRect(x, y, w, h) { calls.push({ type: "strokeRect", color: this.strokeStyle, x, y, w, h }); },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}
  };
}

function draw(ctx, overrides = {}) {
  drawSurvivorActor(ctx, {
    x: 120,
    y: 110,
    unit: 2,
    skin: SKINS.wanderer,
    skinId: "wanderer",
    heroId: "ranger",
    weapon: WEAPONS.scrap_pistol,
    aimX: 1,
    aimY: 0,
    portrait: true,
    ...overrides
  });
}

test("four equipped armor layers alter the survivor silhouette and the head follows look direction", () => {
  const base = drawingContext();
  draw(base, { lookX: -1, lookY: 0 });
  const equipped = drawingContext();
  draw(equipped, {
    lookX: 1,
    lookY: 0,
    equipment: {
      helmet: EQUIPMENT.signal_charm,
      chest: EQUIPMENT.iron_plate,
      legs: EQUIPMENT.ammo_rig,
      boots: EQUIPMENT.runner_boots
    }
  });
  assert.ok(equipped.calls.length >= base.calls.length + 28, "armor should add visible component layers");
  const leftFace = base.calls.find((call) => call.type === "fillRect" && call.color === "#d2af86" && call.w === 28);
  const rightFace = equipped.calls.find((call) => call.type === "fillRect" && call.color === "#d2af86" && call.w === 28);
  assert.ok(leftFace && rightFace);
  assert.ok(rightFace.x > leftFace.x, "portrait head should shift toward the pointer direction");
});
