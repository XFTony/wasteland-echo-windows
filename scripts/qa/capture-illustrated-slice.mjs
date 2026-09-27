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
  for (const [width, height] of [[960, 540], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    for (const [menu, label, backdropId] of [
      ["main", "main", "menu.backdrop.main.v3"],
      ["loadout", "deployment", "menu.backdrop.deployment.v3"],
      ["inventory", "inventory", "menu.backdrop.inventory.v3"],
      ["shop", "shop", "menu.backdrop.shop.v3"],
      ["settings", "settings", "menu.backdrop.settings.v3"],
      ["credits", "credits", "menu.backdrop.credits.v3"]
    ]) {
      await page.evaluate((name) => window.__WASTELAND_GAME__.model.setMenuPage(name), menu);
      await page.waitForFunction((id) => window.__WASTELAND_GAME__?.renderer?.artStore?.ready(id), backdropId);
      await page.screenshot({ path: path.join(output, `${label}-${width}x${height}.png`) });
    }
  }
  await page.evaluate(() => window.__WASTELAND_GAME__.model.setMenuPage("main"));
  await page.waitForTimeout(100);
  for (const [action, expectedPage] of [["start", "loadout"], ["inventory", "inventory"]]) {
    const region = await page.evaluate((action) => {
      const hit = window.__WASTELAND_GAME__.renderer.regions.find((entry) => entry.action === action);
      return hit ? { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 } : null;
    }, action);
    if (!region) throw new Error(`Missing ${action} region at 1440p`);
    await page.mouse.click(region.x, region.y);
    await page.waitForFunction((expectedPage) => window.__WASTELAND_GAME__?.model?.menuPage === expectedPage, expectedPage);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    const game = window.__WASTELAND_GAME__;
    game.model.setMenuPage("shop");
    game.model.cycleShopCategory(1);
  });
  await page.waitForFunction(() => ["outfit.wanderer.v1", "outfit.mechanic.v1", "outfit.nightwatch.v1"]
    .every((id) => window.__WASTELAND_GAME__?.renderer?.artStore?.ready(id)));
  await page.screenshot({ path: path.join(output, "shop-outfits-1280x720.png") });
  await page.evaluate(() => window.__WASTELAND_GAME__.model.cycleShopCategory(1));
  await page.waitForFunction(() => ["equipment.field-vest.v1", "equipment.iron-plate.v1", "equipment.runner-boots.v1", "equipment.magnet-helm.v1"]
    .every((id) => window.__WASTELAND_GAME__?.renderer?.artStore?.ready(id)));
  await page.screenshot({ path: path.join(output, "shop-equipment-1280x720.png") });
  for (const [heroId, skinId, artId] of [
    ["ranger", "mechanic", "actor.ranger.mechanic.v1"],
    ["ranger", "nightwatch", "actor.ranger.nightwatch.v2"],
    ["mechanic", "mechanic", "actor.mechanic.mechanic.v2"],
    ["mechanic", "nightwatch", "actor.mechanic.nightwatch.v1"],
    ["bulwark", "mechanic", "actor.bulwark.mechanic.v1"],
    ["bulwark", "nightwatch", "actor.bulwark.nightwatch.v2"]
  ]) {
    await page.evaluate(({ heroId, skinId }) => {
      const game = window.__WASTELAND_GAME__;
      game.model.goToMenu();
      if (!game.model.save.unlockedHeroes.includes(heroId)) game.model.save.unlockedHeroes.push(heroId);
      if (!game.model.save.unlockedSkins.includes(skinId)) game.model.save.unlockedSkins.push(skinId);
      game.model.selectHero(heroId);
      game.model.selectSkin(skinId);
      game.model.setMenuPage("inventory");
    }, { heroId, skinId });
    await page.waitForFunction((id) => window.__WASTELAND_GAME__?.renderer?.artStore?.ready(id), artId);
    await page.screenshot({ path: path.join(output, `inventory-${heroId}-${skinId}-1280x720.png`) });
    await page.evaluate(({ heroId, skinId }) => {
      const game = window.__WASTELAND_GAME__;
      game.model.startRun({ seed: 20260924, duration: 180, mapId: "echo_district", heroId, skinId, weaponId: "scrap_pistol", tutorial: false });
    }, { heroId, skinId });
    await page.screenshot({ path: path.join(output, `combat-${heroId}-${skinId}-1280x720.png`) });
    await page.screenshot({ path: path.join(output, `combat-${heroId}-${skinId}-detail.png`), clip: { x: 540, y: 260, width: 200, height: 200 } });
    await page.evaluate(() => { window.__WASTELAND_GAME__.model.save.settings.autoAim = false; });
    await page.mouse.move(535, 360);
    await page.waitForTimeout(90);
    await page.screenshot({ path: path.join(output, `combat-${heroId}-${skinId}-left.png`), clip: { x: 540, y: 260, width: 200, height: 200 } });
    await page.mouse.move(640, 260);
    await page.waitForTimeout(90);
    await page.screenshot({ path: path.join(output, `combat-${heroId}-${skinId}-up.png`), clip: { x: 540, y: 260, width: 200, height: 200 } });
    await page.mouse.move(760, 360);
    await page.keyboard.down("d");
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(output, `combat-${heroId}-${skinId}-moving.png`), clip: { x: 540, y: 260, width: 200, height: 200 } });
    await page.keyboard.up("d");
    await page.evaluate(() => { window.__WASTELAND_GAME__.model.save.settings.autoAim = true; });
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
  for (const [width, height] of [[960, 540], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, `echo-combat-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForFunction(() => Math.abs((window.__WASTELAND_GAME__?.renderer?.camera?.zoom || 0) - 1.5) < 0.01);
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
    for (const [width, height] of [[960, 540], [1920, 1080], [2560, 1440]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: path.join(output, file.replace("1280x720", `${width}x${height}`)) });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await page.evaluate(() => {
    const game = window.__WASTELAND_GAME__;
    game.model.startRun({ seed: 20260924, duration: 180, mapId: "echo_district", heroId: "ranger", weaponId: "scrap_pistol", tutorial: false });
    game.model.run.player.xp = game.model.run.player.xpNext;
    game.model.checkLevelUp();
  });
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(output, "upgrade-1280x720.png") });
  for (const [width, height] of [[960, 540], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(output, `upgrade-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    const game = window.__WASTELAND_GAME__;
    game.model.startRun({ seed: 20260924, duration: 180, mapId: "echo_district", tutorial: false });
    game.model.togglePause();
  });
  for (const [width, height] of [[1280, 720], [960, 540]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, `pause-${width}x${height}.png`) });
  }
  for (const result of ["win", "lose"]) {
    await page.evaluate((result) => {
      const game = window.__WASTELAND_GAME__;
      game.model.startRun({ seed: result === "win" ? 20260925 : 20260926, duration: 180, mapId: "echo_district", tutorial: false });
      const run = game.model.run;
      run.kills = result === "win" ? 25 : 12;
      run.eliteKills = result === "win" ? 2 : 1;
      run.damageDealt = result === "win" ? 2100 : 650;
      run.elapsed = result === "win" ? 180 : 84;
      run.projectilesFired = 100;
      run.hits = result === "win" ? 48 : 28;
      run.maxNoHitTime = result === "win" ? 43 : 25;
      run.scrap = result === "win" ? 12 : 4;
      game.model.finishRun(result);
    }, result);
    for (const [width, height] of [[1280, 720], [960, 540]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: path.join(output, `result-${result}-${width}x${height}.png`) });
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const [weaponId, artId] of [
    ["scrap_pistol", "weapon.scrap-pistol.v1"],
    ["swarm_smg", "weapon.swarm-smg.v1"],
    ["breaker_shotgun", "weapon.breaker-shotgun.v1"],
    ["needle_rifle", "weapon.needle-rifle.v1"],
    ["rust_revolver", "weapon.rust-revolver.v1"],
    ["ember_carbine", "weapon.ember-carbine.v1"],
    ["coil_cannon", "weapon.coil-cannon.v1"]
  ]) {
    await page.evaluate((weaponId) => {
      const game = window.__WASTELAND_GAME__;
      game.model.startRun({ seed: 20260924, duration: 180, mapId: "echo_district", heroId: "ranger", weaponId, tutorial: false });
    }, weaponId);
    await page.waitForFunction((artId) => window.__WASTELAND_GAME__?.renderer?.artStore?.ready(artId), artId);
    await page.screenshot({ path: path.join(output, `weapon-${weaponId}-detail.png`), clip: { x: 540, y: 260, width: 200, height: 200 } });
  }
  console.log(JSON.stringify({ output, screenshots: 91, errors, metrics }));
  if (errors.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
