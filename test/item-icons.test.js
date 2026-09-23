"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { WEAPONS, EQUIPMENT } = require("../src/config");
const { WEAPON_VISUALS, EQUIPMENT_VISUALS, RANGE_BANDS, drawWeaponIcon, drawEquipmentIcon } = require("../src/render/ui/item-icons");

function drawingContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    fillRect(x, y, w, h) { calls.push([this.fillStyle, x, y, w, h]); }
  };
}

test("every firearm resolves to a distinct reusable pixel silhouette", () => {
  const signatures = new Set();
  for (const weapon of Object.values(WEAPONS)) {
    assert.ok(WEAPON_VISUALS[weapon.visualId], `${weapon.id} visualId must resolve`);
    const ctx = drawingContext();
    drawWeaponIcon(ctx, weapon, 40, 40, 64);
    assert.ok(ctx.calls.length >= 16, `${weapon.id} should draw a layered silhouette and shadow`);
    signatures.add(JSON.stringify(ctx.calls));
  }
  assert.equal(signatures.size, Object.keys(WEAPONS).length);
});

test("every armor item resolves to a distinct reusable physical silhouette", () => {
  const signatures = new Set();
  for (const item of Object.values(EQUIPMENT)) {
    assert.ok(EQUIPMENT_VISUALS[item.visualId], `${item.id} visualId must resolve`);
    const ctx = drawingContext();
    drawEquipmentIcon(ctx, item, 40, 40, 64);
    assert.ok(ctx.calls.length >= 8, `${item.id} should be visibly layered`);
    signatures.add(JSON.stringify(ctx.calls));
  }
  assert.equal(signatures.size, Object.keys(EQUIPMENT).length);
});

test("weapon range taxonomy keeps close, mid and long bands available for future additions", () => {
  assert.deepEqual(Object.keys(RANGE_BANDS).sort(), ["close", "long", "mid"]);
  const used = new Set(Object.values(WEAPONS).map((weapon) => weapon.rangeBand));
  assert.deepEqual([...used].sort(), ["close", "long", "mid"]);
});
