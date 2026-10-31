import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { GameModel } = require("../../src/core/game-model.js");
const { SaveManager } = require("../../src/core/save.js");
const { drawUpgradeDraft } = require("../../src/render/ui/upgrade-cards.js");
const { drawFieldShop } = require("../../src/render/ui/field-market-view.js");
const { HUD_METHODS } = require("../../src/render/hud-view.js");
const { DEFAULT_CONTENT } = require("../../src/core/content-registry.js");
const root = path.resolve(import.meta.dirname, "../..");
const noop = () => {};
const copy = value => JSON.parse(JSON.stringify(value));

// Drawing is suppressed; original layout functions still calculate every hit region.
function renderer(width, height, scaled = true) {
  const factor = scaled ? Math.max(1, Math.min(2, width / 1280, height / 720)) : 1;
  const ctx = new Proxy({ globalAlpha: 1, createLinearGradient: () => ({ addColorStop: noop }) },
    { get: (object, key) => key in object ? object[key] : noop });
  const result = {
    ctx, width: width / factor, height: height / factor, content: DEFAULT_CONTENT,
    pointerState: { x: -1000, y: -1000 }, focusAction: null, uiTime: 1, regions: [],
    artStore: { ready: () => false }, reducedMotion: false,
    drawOverlay: noop, text: noop, displayText: noop, fitText: noop, panel: noop,
    addRegion(action, x, y, w, h) {
      this.regions.push({ action, x: x * factor, y: y * factor, w: w * factor, h: h * factor });
    },
    button(action, _label, x, y, w, h) { this.addRegion(action, x, y, w, h); }
  };
  return new Proxy(result, { get: (object, key) => key in object ? object[key] : noop });
}

const records = [];
let initialSave;
let upgradeIds;
let upgradePlayer;
for (const [width, height] of [[960, 540], [1280, 720], [1920, 1080], [2560, 1440]]) {
  const model = new GameModel(new SaveManager({ get: () => null, set() {} }));
  initialSave ??= copy(model.save);
  model.startRun({ seed: 88, tutorial: false });
  model.run.player.xp = model.run.player.xpNext;
  model.checkLevelUp();
  upgradeIds ??= model.run.upgradeOptions.map(option => option.id);
  upgradePlayer ??= copy(model.run.player);
  let view = renderer(width, height);
  drawUpgradeDraft(view, model);
  view.uiTime = 2;
  view.draftStarted = 0;
  view.draftHovers = [1, 0, 0, 0];
  view.focusAction = "upgrade:" + model.run.upgradeOptions[0].id;
  view.draftLastFocus = view.focusAction;
  view.draftPointerPriority = false;
  drawUpgradeDraft(view, model);
  const legacyAnimatedActions = copy(view.regions);
  // The native fix keeps hit slots still while moving artwork. Measure the
  // original layout at rest, rather than asserting its moving hit-box defect.
  view.reducedMotion = true;
  view.focusAction = null;
  view.draftLastFocus = null;
  view.draftHovers = [0, 0, 0, 0];
  view.draftPointerPriority = true;
  view.uiTime = 3;
  drawUpgradeDraft(view, model);
  records.push({ kind: "upgrade", width, height, actions: view.regions, legacyAnimatedActions });
  model.screen = "running";
  const station = model.interactives.find(item => item.type === "tradePost");
  Object.assign(model.run.player, { x: station.x, y: station.y + 20 });
  model.run.scrap = 300;
  model.fieldMarket.open();
  for (const tab of ["supplies", "arsenal", "support"]) {
    for (const page of tab === "arsenal" ? [0, 1] : [0]) {
      Object.assign(model.run.fieldMarket, { tab, page });
      view = renderer(width, height);
      drawFieldShop(view, model);
      records.push({ kind: `field-${tab}-${page}`, width, height, actions: view.regions });
    }
  }
  view = renderer(width, height, false);
  HUD_METHODS.drawPause.call(view, model);
  records.push({ kind: "pause", width, height, actions: view.regions });
  model.finishRun("retire");
  view = renderer(width, height, false);
  HUD_METHODS.drawResult.call(view, model);
  records.push({ kind: "result", width, height, actions: view.regions });
}
const output = path.join(root, "output/godot-migration/reference-battle-regions.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({
  scope: "Original layout functions: stable upgrade slots measured with settled reduced motion and no hover/focus; legacy animated AABBs retained separately. Not screenshot acceptance.",
  setup: { initialSave, seed: 88, tutorial: false, upgradeIds, upgradePlayer,
    fieldScrap: 300, arsenal: { scrap_pistol: { tier: 1, calibration: 0 } },
    note: "Native upgrade art animates inside stable hit slots. Allow at least 0.6 seconds for reveal; combat time stays paused." },
  records
}, null, 2) + "\n");
console.log(JSON.stringify({ layouts: records.length,
  actions: records.reduce((sum, record) => sum + record.actions.length, 0), upgradeIds }));
