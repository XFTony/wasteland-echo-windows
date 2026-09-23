"use strict";

const { SaveManager } = require("../src/core/save");
const { GameModel } = require("../src/core/game-model");
const { CanvasRenderer } = require("../src/render/canvas-renderer");

function createCanvas() {
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (value) => ({ width: String(value).length * 8 }),
    imageSmoothingEnabled: false,
    globalAlpha: 1
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    }
  });
  return { width: 0, height: 0, style: {}, getContext: () => context };
}

const saveManager = new SaveManager({ get: () => null, set: () => {} });
const model = new GameModel(saveManager, { seed: 20260918, duration: 180 });
const renderer = new CanvasRenderer(createCanvas());
renderer.resize(1920, 1080, 1);
model.startRun({ seed: 20260918, mapId: "echo_district", duration: 180 });
for (let index = 0; index < 80; index += 1) {
  const angle = index / 80 * Math.PI * 2;
  model.spawnEnemy(index % 9 === 0 ? "brute" : "drifter", model.run.player.x + Math.cos(angle) * (160 + index), model.run.player.y + Math.sin(angle) * (160 + index));
}

const frames = 600;
const startMemory = process.memoryUsage().heapUsed;
const start = process.hrtime.bigint();
for (let frame = 0; frame < frames; frame += 1) {
  model.run.elapsed = frame / 60;
  renderer.render(model, { activeDevice: "keyboardMouse", metrics: { fps: 60, frameMs: 16.67, simulationSteps: 1, droppedCatchUps: 0 } });
}
const runtimeMs = Number(process.hrtime.bigint() - start) / 1e6;
const endMemory = process.memoryUsage().heapUsed;
console.log(JSON.stringify({
  frames,
  viewport: "1920x1080",
  enemies: model.enemies.length,
  totalMs: Number(runtimeMs.toFixed(2)),
  averageMs: Number((runtimeMs / frames).toFixed(4)),
  heapDeltaMiB: Number(((endMemory - startMemory) / 1048576).toFixed(2))
}, null, 2));
