import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const args = new Set(process.argv.slice(2));
const full = args.has("--full");
const write = args.has("--write");
const assertThresholds = args.has("--assert");
const port = 4186;
const baseUrl = "http://127.0.0.1:" + port + "/";
const quickScenarios = [
  { id: "720p-80-high", width: 1280, height: 720, enemies: 80, quality: 2 },
  { id: "1080p-120-medium", width: 1920, height: 1080, enemies: 120, quality: 1 }
];
const fullScenarios = [];
for (const [width, height, label] of [[1280, 720, "720p"], [1920, 1080, "1080p"]]) {
  for (const enemies of [40, 80, 120]) {
    for (const quality of [0, 1, 2]) fullScenarios.push({ id: label + "-" + enemies + "-q" + quality, width, height, enemies, quality });
  }
}
const scenarios = full ? fullScenarios : quickScenarios;
const sampleFrames = full ? 180 : 120;
const warmupFrames = 45;

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch (_error) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for local game server");
}

function summarize(samples) {
  const ordered = samples.slice().sort((a, b) => a - b);
  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const p95Ms = ordered[Math.floor((ordered.length - 1) * 0.95)];
  const p99Ms = ordered[Math.floor((ordered.length - 1) * 0.99)];
  const slowCount = Math.max(1, Math.ceil(ordered.length * 0.01));
  const slowestAverageMs = ordered.slice(-slowCount).reduce((sum, value) => sum + value, 0) / slowCount;
  return {
    frames: samples.length,
    averageMs: Number(averageMs.toFixed(3)),
    averageFps: Number((1000 / averageMs).toFixed(2)),
    p95Ms: Number(p95Ms.toFixed(3)),
    p99Ms: Number(p99Ms.toFixed(3)),
    onePercentLowFps: Number((1000 / slowestAverageMs).toFixed(2)),
    overBudgetFrames: samples.filter((value) => value > 1000 / 50).length,
    severeFrames: samples.filter((value) => value > 1000 / 30).length
  };
}

const server = spawn(process.execPath, [path.join(root, "scripts", "serve.mjs")], {
  cwd: root,
  env: { ...process.env, GAME_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});
let browser = null;
const pageErrors = [];
try {
  await waitForServer();
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (error) => pageErrors.push(String(error && error.stack || error)));
  await page.goto(baseUrl + "?seed=20260921", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });

  const results = [];
  for (const scenario of scenarios) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.evaluate((config) => {
      const runtime = window.__WASTELAND_GAME__;
      const model = runtime.model;
      model.startRun({ seed: 20260921, duration: 600, modeId: "endless", tutorial: false });
      model.releaseAllEntities();
      model.updateSpawner = () => {};
      model.run.player.hp = 1000000;
      model.run.player.maxHp = 1000000;
      model.save.settings.autoAim = true;
      model.save.settings.autoFire = true;
      const player = model.run.player;
      const types = ["drifter", "runner", "spitter", "brute", "screecher", "crawler"];
      for (let index = 0; index < config.enemies; index += 1) {
        const angle = index / config.enemies * Math.PI * 2;
        const ring = 130 + index % 5 * 72;
        model.spawnEnemy(types[index % types.length], player.x + Math.cos(angle) * ring, player.y + Math.sin(angle) * ring);
      }
      runtime.renderer.qualityLevel = config.quality;
      runtime.renderer.updatePerformance = () => {};
    }, scenario);
    await page.waitForTimeout(350);
    const samples = await page.evaluate(async ({ warmup, frames }) => {
      const deltas = [];
      let previous = performance.now();
      let seen = 0;
      return new Promise((resolve) => {
        function sample(now) {
          const delta = now - previous;
          previous = now;
          seen += 1;
          if (seen > warmup) deltas.push(delta);
          if (deltas.length >= frames) resolve(deltas);
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    }, { warmup: warmupFrames, frames: sampleFrames });
    const heapBytes = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
    results.push({
      ...scenario,
      ...summarize(samples),
      heapMiB: heapBytes ? Number((heapBytes / 1024 / 1024).toFixed(2)) : null
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    browser: "Microsoft Edge via playwright-core",
    headless: true,
    sampleFrames,
    warmupFrames,
    pageErrors,
    results
  };
  if (write) {
    const target = path.join(root, "docs", "browser-fps-" + packageJson.version + ".json");
    fs.writeFileSync(target, JSON.stringify(output, null, 2) + "\n", "utf8");
    console.log("Wrote " + path.relative(root, target));
  }
  console.log(JSON.stringify(output, null, 2));
  if (assertThresholds) {
    if (pageErrors.length) throw new Error("Browser benchmark captured page errors");
    const failed = results.filter((result) => result.onePercentLowFps < 30);
    if (failed.length) throw new Error("Browser 1% low fell below 30 FPS: " + failed.map((item) => item.id).join(", "));
  }
} finally {
  if (browser) await browser.close();
  if (!server.killed) server.kill();
}
