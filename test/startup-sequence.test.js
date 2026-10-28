"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { StartupSequence } = require("../src/core/startup-sequence");
const { normalizeSettings } = require("../src/core/save");
const { RADIO } = require("../src/render/ui/radio-materials");

test("startup uses elapsed time, exits once ready, and has a bounded missing-art fallback", () => {
  const startup = new StartupSequence({ enabled: true });
  assert.equal(startup.advance(1000, true).active, true);
  assert.equal(startup.advance(2000, true).active, true);
  assert.equal(startup.advance(3200, true).active, false);
  const missing = new StartupSequence({ enabled: true });
  missing.advance(0, false);
  assert.equal(missing.advance(3000, false).active, true);
  assert.equal(missing.advance(3300, false).active, false);
});

test("startup skip is immediate and cannot reactivate when assets arrive", () => {
  const startup = new StartupSequence({ enabled: true });
  startup.advance(0, false);
  startup.skip();
  assert.equal(startup.state.active, false);
  assert.equal(startup.advance(100, true).active, false);
  assert.equal(startup.skipped, true);
});

test("reduced-motion users and explicitly disabled startup never enter the animation", () => {
  assert.equal(new StartupSequence({ enabled: true, reducedMotion: true }).active, false);
  assert.equal(new StartupSequence({ enabled: false }).active, false);
  assert.equal(normalizeSettings({ introAnimation: false }).introAnimation, false);
  assert.equal(normalizeSettings({}).introAnimation, true);
  assert.equal(normalizeSettings({ autoAim: false, autoFire: false }).autoFire, false);
});

test("paper buttons keep ink and explanatory text readable", () => {
  const luminance = hex => {
    const rgb = hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  assert.ok(ratio(RADIO.ink, RADIO.paper) >= 7);
  assert.ok(ratio("#5c4b35", RADIO.paper) >= 4.5);
});
