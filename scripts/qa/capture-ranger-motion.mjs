import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const output = path.join(root, "output", "playwright", "ranger-motion-pilot");
const port = 4188;
const server = spawn(process.execPath, [path.join(root, "scripts", "serve.mjs")], {
  cwd: root,
  env: { ...process.env, GAME_PORT: String(port) },
  stdio: "ignore",
  windowsHide: true
});
let browser;
const errors = [];

try {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break;
    } catch (_error) {
      // Wait for the local QA server.
    }
    if (attempt === 74) throw new Error("Ranger motion QA server did not start");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/?seed=20260928`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const game = window.__WASTELAND_GAME__;
    game.model.startRun({ seed: 20260928, duration: 180, mapId: "echo_district", heroId: "ranger", skinId: "wanderer", weaponId: "scrap_pistol", tutorial: false });
    game.model.run.player.x = 1030;
    game.model.run.player.y = 1110;
    game.model.run.tutorial = null;
  });
  await page.waitForFunction(() => {
    const store = window.__WASTELAND_GAME__?.renderer?.artStore;
    return store?.ready("actor.ranger.wanderer.upper.v1") && store?.ready("actor.ranger.wanderer.walk.v1");
  });
  await page.waitForTimeout(100);
  const clip = { x: 540, y: 260, width: 200, height: 200 };
  await page.screenshot({ path: path.join(output, "idle.png"), clip });
  await page.keyboard.down("d");
  const samples = [];
  for (let index = 0; index < 16; index += 1) {
    await page.waitForTimeout(45);
    await page.screenshot({ path: path.join(output, `walk-${String(index).padStart(2, "0")}.png`), clip });
    samples.push(await page.evaluate(() => {
      const game = window.__WASTELAND_GAME__;
      return {
        x: game.model.run.player.x,
        y: game.model.run.player.y,
        elapsed: game.model.run.elapsed,
        phase: game.renderer.rangerMotionState?.phase,
        moving: game.renderer.rangerMotionState?.moving
      };
    }));
  }
  await page.keyboard.up("d");
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(output, "stopped.png"), clip });
  if (errors.length || new Set(samples.map((sample) => Math.floor((sample.phase || 0) * 12))).size < 4) {
    throw new Error(`Motion QA failed: ${JSON.stringify({ errors, samples })}`);
  }
  fs.writeFileSync(path.join(output, "samples.json"), JSON.stringify(samples, null, 2) + "\n");
  console.log(JSON.stringify({ output, frames: samples.length, phaseSteps: new Set(samples.map((sample) => Math.floor((sample.phase || 0) * 12))).size, errors }));
} finally {
  if (browser) await browser.close();
  server.kill();
}
