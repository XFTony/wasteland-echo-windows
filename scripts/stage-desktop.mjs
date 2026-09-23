import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const webRoot = path.join(root, "web");
const distRoot = path.join(root, "dist");
const require = createRequire(import.meta.url);
const { ART_ASSETS } = require("../src/render/art/asset-catalog");

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });

function copy(relative) {
  const source = path.join(webRoot, relative);
  const target = path.join(distRoot, relative);
  if (!fs.existsSync(source)) throw new Error(`Desktop staging source is missing: ${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

for (const relative of ["index.html", "styles.css", "game.bundle.js"]) copy(relative);
for (const file of fs.readdirSync(path.join(webRoot, "assets", "fonts"))) copy(path.join("assets", "fonts", file));
for (const definition of Object.values(ART_ASSETS)) {
  if (!definition.active) continue;
  copy(definition.src.replace(/^\.\//, ""));
}

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else files.push({ path: path.relative(distRoot, absolute).replaceAll("\\", "/"), bytes: fs.statSync(absolute).size });
  }
}
walk(distRoot);
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
fs.writeFileSync(path.join(distRoot, "runtime-manifest.json"), JSON.stringify({ totalBytes, files }, null, 2) + "\n", "utf8");
console.log(`Staged dist (${files.length} files, ${totalBytes} bytes)`);
