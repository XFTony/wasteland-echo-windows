"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function sourceFiles(directory) {
  const files = [];
  const queue = [directory];
  while (queue.length) {
    const current = queue.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(absolute);
      else if (entry.name.endsWith(".js")) files.push(absolute);
    }
  }
  return files;
}

test("package metadata and browser shell identify the Windows desktop target", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const html = fs.readFileSync(path.join(root, "web", "index.html"), "utf8");
  const styles = fs.readFileSync(path.join(root, "web", "styles.css"), "utf8");
  const server = fs.readFileSync(path.join(root, "scripts", "serve.mjs"), "utf8");
  const tauri = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
  const { GAME_VERSION } = require("../src/version");
  assert.equal(packageJson.name, "wasteland-echo-windows-game");
  assert.match(packageJson.description, /zero-runtime-dependency.*Windows-first/);
  assert.equal(packageJson.dependencies, undefined);
  assert.ok(packageJson.devDependencies["playwright-core"]);
  assert.ok(packageJson.scripts["build:desktop"]);
  assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/);
  assert.equal(GAME_VERSION, packageJson.version);
  assert.equal(tauri.version, packageJson.version);
  assert.match(html, new RegExp(`v${GAME_VERSION.replaceAll(".", "\\.")}`));
  assert.match(html, /WINDOWS DESKTOP/);
  assert.ok(fs.existsSync(path.join(root, "src", "input", "gamepad-source.js")));
  assert.ok(fs.existsSync(path.join(root, "src", "platform", "browser-platform.js")));
  assert.ok(fs.existsSync(path.join(root, "web", "assets", "fonts", "wasteland-fusion-pixel-12-subset.woff2")));
  assert.ok(fs.existsSync(path.join(root, "web", "assets", "fonts", "OFL-Fusion-Pixel-Font-1.1.txt")));
  assert.ok(fs.existsSync(path.join(root, "web", "assets", "wasteland-title-keyart-v1.webp")));
  assert.ok(fs.existsSync(path.join(root, "art", "generated", "v1.0", "runtime-snapshot", "ui-mutant-overhang-v1.png")));
  assert.equal(fs.existsSync(path.join(root, "web", "assets", "ui-mutant-overhang-v1.png")), false);
  assert.match(styles, /font-family:\s*"Fusion Pixel 12"/);
  assert.match(styles, /font-family:\s*"Microsoft YaHei UI"/);
  assert.match(styles, /font-display:\s*swap/);
  assert.match(server, /"\.woff2":\s*"font\/woff2"/);
  assert.match(server, /"\.webp":\s*"image\/webp"/);
});

test("retired deployment implementations live outside the active source tree", () => {
  for (const file of ["deployment-legacy.js", "deployment-journal.js"]) {
    assert.equal(fs.existsSync(path.join(root, "src", "render", "ui", file)), false);
    assert.equal(fs.existsSync(path.join(root, "archive", "code", "ui", file)), true);
  }
});

test("desktop staging contains only active runtime art and a Tauri shell", () => {
  const manifestPath = path.join(root, "dist", "runtime-manifest.json");
  assert.ok(fs.existsSync(manifestPath), "run npm.cmd run stage:desktop before the package test");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.ok(manifest.totalBytes < 6 * 1024 * 1024);
  assert.equal(manifest.files.some((file) => file.path.endsWith(".png")), false);
  assert.equal(manifest.files.some((file) => file.path.includes("deployment-journal")), false);
  assert.ok(fs.existsSync(path.join(root, "src-tauri", "tauri.conf.json")));
  assert.ok(fs.existsSync(path.join(root, "src-tauri", "icons", "icon.ico")));
  assert.ok(fs.existsSync(path.join(root, "docs", "adr-001-windows-desktop-shell.md")));
  const tauri = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
  assert.equal(tauri.bundle.active, true);
  assert.deepEqual(tauri.bundle.targets, ["nsis"]);
  assert.equal(tauri.bundle.windows.webviewInstallMode.type, "downloadBootstrapper");
  assert.equal(tauri.bundle.windows.nsis.installMode, "currentUser");
  assert.ok(fs.existsSync(path.join(root, "scripts", "build-installer.ps1")));
  assert.ok(fs.existsSync(path.join(root, "scripts", "sign-windows.ps1")));
  assert.ok(fs.existsSync(path.join(root, "docs", "release-checklist.md")));
});

test("desktop bundle remains compact and self-contained", () => {
  const bundlePath = path.join(root, "web", "game.bundle.js");
  assert.ok(fs.existsSync(bundlePath));
  assert.ok(fs.statSync(bundlePath).size < 1024 * 1024, "desktop bundle should stay under 1 MB before external assets");
  const files = sourceFiles(path.join(root, "src"));
  const newestSource = Math.max(...files.map((file) => fs.statSync(file).mtimeMs));
  assert.ok(fs.statSync(bundlePath).mtimeMs >= newestSource, "desktop bundle should be rebuilt after source changes");
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    assert.equal(/https?:\/\//.test(source), false, `${relative} should not fetch remote runtime assets`);
  }
});

test("desktop source tree contains no active mobile or WeChat adapter", () => {
  const desktopEntry = fs.readFileSync(path.join(root, "src", "browser-entry.js"), "utf8");
  assert.match(desktopEntry, /createBrowserPlatform/);
  assert.doesNotMatch(desktopEntry, /\bwx\./);
  for (const removedPath of [
    path.join(root, "src", "wechat-entry.js"),
    path.join(root, "game.js"),
    path.join(root, "game.json"),
    path.join(root, "project.config.json"),
    path.join(root, "wasteland-survivor-wechat-mini-game-spec.md")
  ]) {
    assert.equal(fs.existsSync(removedPath), false, path.basename(removedPath) + " must not return to the desktop tree");
  }
  const source = sourceFiles(path.join(root, "src")).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /\bwx\b/i);
  assert.doesNotMatch(source, /showTouchControls|moveTouch|aimTouch|pointerType:\s*["']touch["']/);
});
