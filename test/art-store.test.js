"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ART_IDS, ART_ASSETS, validateArtCatalog } = require("../src/render/art/asset-catalog");
const { ArtStore } = require("../src/render/art/art-store");
const { drawAssetContain, drawNineSlice } = require("../src/render/ui/image-primitives");

const root = path.resolve(__dirname, "..");

class FakeImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1200;
    this.naturalHeight = 647;
    this.decoding = "";
    this.src = "";
  }
}

function rendererWith(store) {
  const calls = [];
  return {
    artStore: store,
    calls,
    ctx: {
      globalAlpha: 1,
      imageSmoothingEnabled: false,
      save: () => calls.push(["save"]),
      restore: () => calls.push(["restore"]),
      drawImage: (...args) => calls.push(["drawImage", ...args])
    }
  };
}

test("runtime art catalog contains only active, local assets", () => {
  assert.equal(validateArtCatalog(ART_ASSETS), ART_ASSETS);
  assert.equal(ART_ASSETS[ART_IDS.BACKDROP_DEPLOYMENT].version, "1.2");
  assert.equal(ART_ASSETS[ART_IDS.UI_FIELD_PLATE].version, "1.2");
  assert.match(ART_ASSETS[ART_IDS.BACKDROP_MAIN].src, /\.webp$/);
  assert.match(ART_ASSETS[ART_IDS.GROUND].src, /\.webp$/);
  for (const definition of Object.values(ART_ASSETS)) {
    assert.equal(definition.active, true);
    assert.match(definition.src, /^\.\/assets\//);
    assert.doesNotMatch(definition.src, /^https?:/i);
  }
  assert.ok(fs.existsSync(path.join(root, "archive", "code", "ui", "deployment-legacy.js")));
});

test("art store loads active definitions once and supports injected images", () => {
  const store = new ArtStore({ ImageCtor: FakeImage });
  assert.equal(store.ready(ART_IDS.UI_FIELD_PLATE), true);
  const injected = { complete: true, naturalWidth: 640, naturalHeight: 360 };
  const injectedStore = new ArtStore({ images: { [ART_IDS.BACKDROP_DEPLOYMENT]: injected } });
  assert.equal(injectedStore.get(ART_IDS.BACKDROP_DEPLOYMENT), injected);
});

test("art store releases inactive menu backgrounds while retaining the current page", () => {
  const store = new ArtStore({ ImageCtor: FakeImage });
  store.request(ART_IDS.BACKDROP_DEPLOYMENT);
  store.request(ART_IDS.BACKDROP_INVENTORY);
  const released = store.releaseGroup("menu-backdrop", ART_IDS.BACKDROP_INVENTORY);
  assert.ok(released >= 1);
  assert.equal(store.get(ART_IDS.BACKDROP_DEPLOYMENT), null);
  assert.ok(store.get(ART_IDS.BACKDROP_INVENTORY));
});

test("image primitives contain complete art and preserve nine-slice corners", () => {
  const store = new ArtStore({ ImageCtor: FakeImage });
  const renderer = rendererWith(store);
  const contained = drawAssetContain(renderer, ART_IDS.UI_FIELD_PLATE, 10, 20, 500, 300);
  assert.ok(contained.x >= 10 && contained.y >= 20);
  assert.ok(contained.x + contained.w <= 510 && contained.y + contained.h <= 320);
  const before = renderer.calls.length;
  assert.equal(drawNineSlice(renderer, ART_IDS.UI_FIELD_PLATE, 0, 0, 620, 120), true);
  const drawCalls = renderer.calls.slice(before).filter((call) => call[0] === "drawImage");
  assert.equal(drawCalls.length, 9);
  const topLeft = drawCalls[0];
  assert.ok(Math.abs((topLeft[4] / topLeft[5]) - (topLeft[8] / topLeft[9])) < 0.001, "nine-slice corners must keep their source aspect ratio");
});

test("active deployment page uses the full-bleed bunker composition while legacy pages remain archived", () => {
  const bunker = fs.readFileSync(path.join(root, "src", "render", "ui", "deployment-bunker.js"), "utf8");
  const facade = fs.readFileSync(path.join(root, "src", "render", "ui", "deployment-page.js"), "utf8");
  assert.match(bunker, /UI_FIELD_PLATE|drawFieldPlate/);
  assert.doesNotMatch(bunker, /DEPLOYMENT_JOURNAL|DEPLOYMENT_EDGE_MUTANT|DEPLOYMENT_NOTE/);
  assert.match(facade, /drawDeploymentBunkerPage/);
  assert.doesNotMatch(facade, /deployment-legacy/);
  assert.ok(fs.existsSync(path.join(root, "archive", "code", "ui", "deployment-journal.js")));
});

test("art manifest preserves source, archive and runtime files with verified hashes", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "art", "manifest.json"), "utf8"));
  assert.equal(manifest.policy.deleteInactiveAssets, false);
  const ids = new Set();
  for (const asset of manifest.assets) {
    assert.equal(ids.has(asset.id), false, `${asset.id} must be unique`);
    ids.add(asset.id);
    for (const relativePath of [asset.runtimePath, asset.sourceRuntimePath, asset.archivePath, ...(asset.sourcePaths || []), ...(asset.inactiveVariants || [])].filter(Boolean)) {
      assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must remain available`);
    }
    if (asset.sha256) {
      const bytes = fs.readFileSync(path.join(root, asset.runtimePath || asset.archivePath));
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), asset.sha256);
    }
  }
});

test("optimized runtime art stays below budget with bounded visual error", () => {
  const report = JSON.parse(fs.readFileSync(path.join(root, "docs", "runtime-assets-report.json"), "utf8"));
  assert.equal(report.format, "webp");
  assert.ok(report.runtimeBytes < 5 * 1024 * 1024);
  assert.ok(report.savedPercent > 75);
  for (const asset of report.assets) {
    assert.ok(fs.existsSync(path.join(root, asset.runtime)));
    assert.ok(asset.normalizedRms <= 0.03, `${asset.runtime} exceeds the visual difference budget`);
    const bytes = fs.readFileSync(path.join(root, asset.runtime));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), asset.sha256);
  }
});
