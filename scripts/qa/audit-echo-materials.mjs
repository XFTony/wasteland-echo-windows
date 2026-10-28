import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..'), require = createRequire(import.meta.url);
const { MAP_LAYOUTS } = require('../../src/world/wasteland-map');
const { ART_ASSETS } = require('../../src/render/art/asset-catalog');
const { GameModel } = require('../../src/core/game-model');
const { SaveManager } = require('../../src/core/save');
const oldModule = { exports: {} };
const previous = execFileSync('git', ['show', 'a3a3a51:src/world/wasteland-map.js'], { cwd: root, encoding: 'utf8', windowsHide: true });
new Function('module', 'exports', 'require', previous)(oldModule, oldModule.exports, require);
const old = oldModule.exports.MAP_LAYOUTS;
const signature = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const untouched = ['freight_nexus', 'red_basin'].map(id => ({ id, unchanged: signature(old[id]) === signature(MAP_LAYOUTS[id]) }));
for (const map of untouched) assert(map.unchanged, map.id + ' was changed outside the prototype');
const counts = layout => Object.fromEntries(['zones', 'roads', 'tracks', 'obstacles', 'scenery', 'interactives'].map(key => [key, layout[key].length]));
const active = Object.values(ART_ASSETS).filter(asset => asset.active);
const imageBytes = active.reduce((sum, asset) => sum + fs.statSync(path.join(root, 'web', asset.src)).size, 0);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'art/manifest.json'), 'utf8'));
const newImages = manifest.assets.filter(asset => ['world.prop.echo.market.v1', 'world.prop.echo.salvage-kit.v1'].includes(asset.id));
assert.equal(newImages.length, 2);
for (const image of newImages) {
  assert(fs.existsSync(path.join(root, image.runtimePath)) && fs.existsSync(path.join(root, image.archivePath)));
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, image.runtimePath))).digest('hex').toUpperCase();
  assert.equal(actualHash, image.sha256);
}
const m = new GameModel(new SaveManager({ get: () => null, set() {} }));
m.startRun({ mapId: 'echo_district', seed: 23, tutorial: false });
const navigation = Object.fromEntries(Object.entries(m.navigations).map(([id, n]) => [id, {
  walkable: Array.from(n.grid.walkable).filter(Boolean).length, reachable: Array.from(n.flow.distances).filter(value => value >= 0).length
}]));
for (const state of Object.values(navigation)) assert.equal(state.reachable, state.walkable);
const proof = { date: '2026-10-28', baseline: 'a3a3a51', prototypeMap: 'echo_district', deploymentLabel: '回声旧城',
  previous: counts(old.echo_district), current: counts(MAP_LAYOUTS.echo_district), dynamicActorBlockers: m.obstacles.length - MAP_LAYOUTS.echo_district.obstacles.length,
  untouchedMaps: untouched, navigation, activeImages: active.length, activeImageBytes: imageBytes,
  addedRuntimeImages: newImages.map(image => ({ id: image.id, file: image.runtimePath, bytes: image.bytes, decodedRgbaBytes: image.width * image.height * 4,
    source: image.archivePath, sha256: image.sha256 })),
  notes: ['The old whole-block translation was replaced only for echo_district. Reusing individual roof/railcar textures is deliberate modular reuse.',
    'Road and track marking bounds are shared renderer fixes. Other map data are byte-equivalent after JSON serialization.',
    'Procedural card art and world icons have no additional runtime image files. Inactive original assets are retained for rollback.'] };
fs.writeFileSync(path.join(root, 'docs/qa/echo-market-material-audit-2026-10-28.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof));
