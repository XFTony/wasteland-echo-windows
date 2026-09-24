import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const output = path.join(root, "output", "playwright", "v15-painted");
const port = 4188;
const server = spawn(process.execPath, [path.join(root, "scripts", "serve.mjs")], {
  cwd: root,
  env: { ...process.env, GAME_PORT: String(port) },
  stdio: "ignore",
  windowsHide: true
});
let browser;
const errors = [];

async function waitForServer() {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/");
      if (response.ok) return;
    } catch (_error) {
      // Local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Local illustrated QA server did not start");
}

try {
  await waitForServer();
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("http://127.0.0.1:" + port + "/?seed=20260923", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__WASTELAND_GAME__?.renderer?.artStore?.ready("menu.backdrop.main.v3"));
  await page.screenshot({ path: path.join(output, "main-1280x720.png") });
  for (const [menu, file] of [
    ["loadout", "deployment-1280x720.png"],
    ["inventory", "inventory-1280x720.png"],
    ["shop", "shop-1280x720.png"],
    ["settings", "settings-1280x720.png"],
    ["credits", "credits-1280x720.png"]
  ]) {
    await page.evaluate((name) => window.__WASTELAND_GAME__.model.setMenuPage(name), menu);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(output, file) });
  }
  await page.evaluate(() => {
    const game = window.__WASTELAND_GAME__;
    game.model.startRun({ seed: 20260923, duration: 180, mapId: "echo_district", heroId: "ranger", weaponId: "scrap_pistol" });
    game.model.run.tutorial = null;
    const player = game.model.run.player;
    game.model.combatSim.spawnEnemy("drifter", player.x + 90, player.y + 30);
    game.model.combatSim.spawnEnemy("iron_colossus", player.x + 220, player.y + 70);
  });
  await page.waitForFunction(() => {
    const store = window.__WASTELAND_GAME__?.renderer?.artStore;
    return store?.ready("world.ground.echo.v1") && store?.ready("actor.ranger.base.v1")
      && store?.ready("weapon.scrap-pistol.v1") && store?.ready("actor.drifter.v1")
      && store?.ready("actor.iron-colossus.v1");
  });
  await page.screenshot({ path: path.join(output, "echo-combat-1280x720.png") });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, "echo-combat-1920x1080.png") });
  const metrics = await page.evaluate(() => ({
    zoom: window.__WASTELAND_GAME__.renderer.camera.zoom,
    visibleWidth: window.__WASTELAND_GAME__.renderer.visibleWorldWidth,
    visibleHeight: window.__WASTELAND_GAME__.renderer.visibleWorldHeight
  }));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    const game = window.__WASTELAND_GAME__;
    game.model.startRun({ seed: 20260924, duration: 180, mapId: "echo_district", heroId: "ranger", weaponId: "scrap_pistol" });
    game.model.run.tutorial = null;
    const player = game.model.run.player;
    for (const [kind, dx, dy] of [
      ["runner", -210, -80], ["spitter", -125, 85], ["brute", -10, -125],
      ["screecher", 85, 90], ["crawler", 185, -50], ["warden", 245, 100]
    ]) game.model.combatSim.spawnEnemy(kind, player.x + dx, player.y + dy);
  });
  await page.waitForFunction(() => ["actor.runner.v1", "actor.spitter.v1", "actor.brute.v1", "actor.screecher.v1", "actor.crawler.v1", "actor.warden.v1"]
    .every((id) => window.__WASTELAND_GAME__?.renderer?.artStore?.ready(id)));
  await page.screenshot({ path: path.join(output, "enemy-roster-1280x720.png") });
  for (const [mapId, heroId, groundId, actorId, file] of [
    ["freight_nexus", "mechanic", "world.ground.freight.v1", "actor.mechanic.base.v1", "freight-combat-1280x720.png"],
    ["red_basin", "bulwark", "world.ground.red-basin.v1", "actor.bulwark.base.v1", "red-basin-combat-1280x720.png"]
  ]) {
    await page.evaluate(({ mapId, heroId }) => {
      const game = window.__WASTELAND_GAME__;
      game.model.startRun({ seed: 20260924, duration: 180, mapId, heroId, weaponId: "scrap_pistol" });
      game.model.run.tutorial = null;
    }, { mapId, heroId });
    await page.waitForFunction(({ groundId, actorId }) => {
      const store = window.__WASTELAND_GAME__?.renderer?.artStore;
      return store?.ready(groundId) && store?.ready(actorId);
    }, { groundId, actorId });
    await page.screenshot({ path: path.join(output, file) });
  }
  console.log(JSON.stringify({ output, screenshots: 11, errors, metrics }));
  if (errors.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
