import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..", "..");
const port = 4187;
const baseUrl = `http://127.0.0.1:${port}/?seed=20260922&qa=meta-progression`;
const outputDir = path.join(root, "output", "playwright", "v15-meta-progression");

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

const scenes = [
  { id: "shop-blueprint-locked-1280x720", width: 1280, height: 720, scene: "shop" },
  { id: "inventory-mastery-1920x1080", width: 1920, height: 1080, scene: "inventory" },
  { id: "archive-unlock-progress-1280x720", width: 1280, height: 720, scene: "credits" },
  { id: "mechanic-upgrade-draft-1280x720", width: 1280, height: 720, scene: "upgrade" },
  { id: "warden-hunt-hud-1280x720", width: 1280, height: 720, scene: "warden" },
  { id: "colossus-frenzy-hud-1280x720", width: 1280, height: 720, scene: "colossus" },
  { id: "result-meta-rewards-1920x1080", width: 1920, height: 1080, scene: "result" }
];

fs.mkdirSync(outputDir, { recursive: true });
const server = spawn(process.execPath, [path.join(root, "scripts", "serve.mjs")], {
  cwd: root,
  env: { ...process.env, GAME_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

let browser = null;
const pageErrors = [];
const artifacts = [];
try {
  await waitForServer();
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (error) => pageErrors.push(String(error && error.stack || error)));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });

  for (const descriptor of scenes) {
    await page.setViewportSize({ width: descriptor.width, height: descriptor.height });
    await page.evaluate((scene) => {
      const runtime = window.__WASTELAND_GAME__;
      if (!runtime || !runtime.model) throw new Error("Game runtime was not exposed");
      const model = runtime.model;
      model.releaseAllEntities();
      model.run = null;
      model.screen = "menu";
      model.menuPage = "main";
      model.shopMessage = null;
      model.tick = () => {};

      if (scene === "shop") {
        model.save.unlockedBlueprints = [];
        model.save.completedUnlockRules = [];
        model.save.totalKills = 0;
        model.shopCategory = "weapon";
        model.setMenuPage("shop");
        return;
      }

      if (scene === "inventory") {
        model.save.weaponMastery.scrap_pistol = { kills: 220, runs: 6, experience: 480, level: 4 };
        model.selectedWeapon = "scrap_pistol";
        model.save.selectedWeapon = "scrap_pistol";
        model.setMenuPage("inventory");
        model.setInventoryPage(0);
        return;
      }

      if (scene === "credits") {
        model.save.totalKills = 60;
        model.save.weaponMastery = {};
        model.save.completedUnlockRules = [];
        model.save.unlockedBlueprints = [];
        model.save.unlockedModifiers = [];
        model.save.masteryBadges = [];
        model.setMenuPage("credits");
        return;
      }

      if (scene === "upgrade") {
        model.startRun({ seed: 20260922, duration: 180, tutorial: false });
        model.releaseAllEntities();
        model.run.player.level = 8;
        model.run.upgradeOptions = [
          model.content.upgrades.executionCapacitor,
          model.content.upgrades.reactivePlating,
          model.content.upgrades.salvageOverdrive,
          model.content.upgrades.cascadeRounds
        ];
        model.screen = "levelup";
        return;
      }

      if (scene === "warden" || scene === "colossus") {
        model.startRun({ seed: 20260922, duration: 180, tutorial: false });
        model.releaseAllEntities();
        model.updateSpawner = () => {};
        const player = model.run.player;
        const type = scene === "warden" ? "warden" : "iron_colossus";
        const boss = model.spawnEnemy(type, player.x + 205, player.y);
        boss.hp = boss.maxHp * (scene === "warden" ? 0.3 : 0.2);
        boss.bossPhase = scene === "warden" ? 2 : 3;
        boss.bossPhaseId = scene === "warden" ? "hunt" : "frenzy";
        return;
      }

      if (scene === "result") {
        model.save.totalKills = 119;
        model.save.completedUnlockRules = [];
        model.save.unlockedBlueprints = [];
        model.save.claimedMasteryRewards = [];
        model.save.unlockedEvolutions = [];
        model.save.masteryBadges = [];
        model.save.weaponMastery.scrap_pistol = { kills: 49, runs: 1, experience: 49, level: 1 };
        model.startRun({ seed: 20260922, duration: 180, tutorial: false });
        Object.assign(model.run, {
          elapsed: 180,
          kills: 1,
          eliteKills: 0,
          scrap: 12,
          shotsFired: 96,
          projectilesFired: 104,
          hits: 72,
          criticalHits: 8,
          damageDealt: 2460,
          maxNoHitTime: 84
        });
        model.finishRun("win");
      }
    }, descriptor.scene);
    await page.evaluate(() => {
      const runtime = window.__WASTELAND_GAME__;
      if (runtime && runtime.renderer && runtime.renderer.banner) runtime.renderer.banner.life = 0;
    });
    await page.waitForTimeout(650);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    const target = path.join(outputDir, `${descriptor.id}.png`);
    await page.screenshot({ path: target, fullPage: true });
    const stat = fs.statSync(target);
    artifacts.push({ ...descriptor, file: path.relative(root, target), bytes: stat.size });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    browser: "Microsoft Edge via playwright-core",
    pageErrors,
    artifacts
  };
  const reportPath = path.join(outputDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (pageErrors.length) throw new Error("Visual QA captured page errors");
  if (artifacts.some((artifact) => artifact.bytes < 20000)) throw new Error("A visual QA screenshot is unexpectedly small");
} finally {
  if (browser) await browser.close();
  if (!server.killed) server.kill();
}
