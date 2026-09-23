"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { UI_COLORS } = require("../src/render/ui/theme");
const { screenFrame } = require("../src/render/ui/art-primitives");

const root = path.resolve(__dirname, "..");

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((part) => Number.parseInt(part, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function inspectPng(relativePath) {
  const absolute = path.join(root, relativePath);
  const bytes = fs.readFileSync(absolute);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return {
    absolute,
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25]
  };
}

function drawingRenderer() {
  const calls = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    fillRect: () => calls.push("fillRect"),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    drawImage: () => calls.push("drawImage")
  };
  return { ctx, calls, uiArt: Object.create(null) };
}

test("primary UI text colors meet normal-text contrast targets", () => {
  assert.ok(contrastRatio(UI_COLORS.white, UI_COLORS.coal) >= 7);
  assert.ok(contrastRatio(UI_COLORS.paper, UI_COLORS.canvasDeep) >= 4.5);
  assert.ok(contrastRatio(UI_COLORS.muted, UI_COLORS.panel) >= 4.5);
});

test("generated overhang art stays memory-bounded and keeps a real alpha channel", () => {
  for (const relativePath of [
    "art/generated/v1.0/runtime-snapshot/ui-mutant-overhang-v1.png",
    "art/generated/v1.0/runtime-snapshot/ui-crawler-overhang-v1.png"
  ]) {
    const image = inspectPng(relativePath);
    assert.ok(image.width <= 768 && image.height <= 768, `${relativePath} should be sized for UI display rather than source resolution`);
    assert.equal(image.colorType, 6, `${relativePath} must use RGBA pixels instead of a painted checkerboard`);
    assert.ok(image.bytes < 1.25 * 1024 * 1024, `${relativePath} should remain compact enough for desktop UI loading`);
  }
});

test("deployment journal asset pack is local, bounded and alpha-correct", () => {
  const alphaAssets = [
    "art/generated/v1.1/runtime/deployment-convoy-vignette-v1.png",
    "art/generated/v1.1/runtime/deployment-note-surface-v1.png",
    "art/generated/v1.1/runtime/deployment-action-strap-v1.png",
    "art/generated/v1.1/runtime/deployment-back-tab-v1.png",
    "art/generated/v1.1/runtime/deployment-edge-mutant-v1.png"
  ].map(inspectPng);
  for (const image of alphaAssets) {
    assert.equal(image.colorType, 6, `${image.absolute} must retain RGBA pixels`);
  }
  const journal = inspectPng("art/generated/v1.1/runtime/deployment-journal-spread-v1.png");
  assert.ok(journal.width / journal.height > 1.7 && journal.width / journal.height < 1.85);
  const totalBytes = [...alphaAssets, journal].reduce((sum, image) => sum + image.bytes, 0);
  assert.ok(totalBytes < 9 * 1024 * 1024, "active deployment art should stay below a bounded desktop download budget");
});

test("v1.2 page backdrops are full-bleed 16:9 and the shared field plate has real alpha", () => {
  const backdrops = [
    "menu-main-camp-v2.png",
    "deployment-command-bunker-v2.png",
    "inventory-armory-v2.png",
    "shop-quartermaster-v2.png",
    "settings-radio-room-v2.png",
    "credits-archive-v2.png"
  ].map((name) => inspectPng("art/generated/v1.2/runtime/" + name));
  for (const image of backdrops) {
    const ratio = image.width / image.height;
    assert.ok(Math.abs(ratio - 16 / 9) < 0.005, `${image.absolute} must stay within a crop-safe 16:9 tolerance`);
    assert.ok(image.bytes < 3.5 * 1024 * 1024, `${image.absolute} should remain bounded for lazy menu loading`);
  }
  const plate = inspectPng("art/generated/v1.2/runtime/ui-field-plate-v2.png");
  assert.equal(plate.colorType, 6, "the reusable field plate must use real RGBA pixels");
  assert.ok(plate.width <= 1200, "the runtime field plate should be smaller than its source generation");
});

test("art primitives draw physical depth without optional legacy overlays", () => {
  const renderer = drawingRenderer();
  screenFrame(renderer, 10, 10, 320, 180, { material: "wood", accent: UI_COLORS.orange });
  assert.ok(renderer.calls.filter((call) => call === "fill").length >= 5);
  assert.equal(renderer.calls.includes("drawImage"), false);
});
