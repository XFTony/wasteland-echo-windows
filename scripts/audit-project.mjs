import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const require = createRequire(import.meta.url);

function relative(absolute) {
  return path.relative(root, absolute).split(path.sep).join("/");
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const queue = [directory];
  while (queue.length) {
    const current = queue.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(absolute);
      else files.push(absolute);
    }
  }
  return files;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function directorySummary(name) {
  const files = walk(path.join(root, name));
  return {
    directory: name,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0)
  };
}

export function auditProject() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const artManifest = JSON.parse(fs.readFileSync(path.join(root, "art", "manifest.json"), "utf8"));
  const { ART_ASSETS } = require("../src/render/art/asset-catalog");
  const bundle = fs.readFileSync(path.join(root, "web", "game.bundle.js"), "utf8");
  const bundledModules = new Set(Array.from(bundle.matchAll(/^\/\/ (src\/[^^\r\n]+)$/gm), (match) => match[1]));
  const sourceModules = walk(path.join(root, "src"))
    .filter((file) => file.endsWith(".js"))
    .map(relative)
    .sort();

  const manifestPaths = [];
  const missingManifestPaths = [];
  for (const asset of artManifest.assets) {
    for (const field of ["runtimePath", "sourceRuntimePath", "archivePath"]) {
      if (!asset[field]) continue;
      manifestPaths.push(asset[field]);
      if (!fs.existsSync(path.join(root, asset[field]))) missingManifestPaths.push({ id: asset.id, field, path: asset[field] });
    }
    for (const field of ["sourcePaths", "inactiveVariants"]) {
      for (const assetPath of asset[field] || []) {
        manifestPaths.push(assetPath);
        if (!fs.existsSync(path.join(root, assetPath))) missingManifestPaths.push({ id: asset.id, field, path: assetPath });
      }
    }
  }

  const webAssets = walk(path.join(root, "web", "assets")).map(relative).sort();
  const catalogAssets = Object.values(ART_ASSETS);
  const catalogPaths = new Set(catalogAssets.map((asset) => `web/${asset.src.replace(/^\.\//, "")}`));
  const fontPaths = new Set(webAssets.filter((assetPath) => assetPath.startsWith("web/assets/fonts/")));
  const sourceRuntimePaths = new Set(artManifest.assets.map((asset) => asset.sourceRuntimePath).filter(Boolean));
  const expectedWebAssets = new Set([...catalogPaths, ...fontPaths, ...sourceRuntimePaths]);
  const unregisteredWebAssets = webAssets.filter((assetPath) => !expectedWebAssets.has(assetPath));

  const hashCandidates = [
    ...walk(path.join(root, "web", "assets")),
    ...walk(path.join(root, "art", "generated"))
  ];
  const hashGroups = new Map();
  for (const file of hashCandidates) {
    const hash = sha256(file);
    if (!hashGroups.has(hash)) hashGroups.set(hash, []);
    hashGroups.get(hash).push({ path: relative(file), bytes: fs.statSync(file).size });
  }
  const duplicateGroups = Array.from(hashGroups.entries())
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({ hash, bytes: files[0].bytes, copies: files.length, paths: files.map((file) => file.path).sort() }))
    .sort((a, b) => b.bytes - a.bytes);
  const redundantWebCopies = duplicateGroups
    .filter((group) => group.paths.some((assetPath) => assetPath.startsWith("web/assets/")) && group.paths.some((assetPath) => assetPath.startsWith("art/generated/")))
    .flatMap((group) => group.paths.filter((assetPath) => assetPath.startsWith("web/assets/")).map((assetPath) => ({ path: assetPath, hash: group.hash, bytes: group.bytes })));

  const releasePaths = walk(path.join(root, "release"));
  const releaseVersions = releasePaths
    .map((file) => /v(\d+\.\d+\.\d+)/.exec(path.basename(file)))
    .filter(Boolean)
    .map((match) => match[1]);
  const stableReleaseVersion = releaseVersions.sort((a, b) => {
    const left = a.split(".").map(Number);
    const right = b.split(".").map(Number);
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  })[0] || null;
  const releaseFiles = releasePaths.map((file) => ({
    path: relative(file),
    bytes: fs.statSync(file).size,
    current: Boolean(stableReleaseVersion && path.basename(file).includes(`v${stableReleaseVersion}`)) || path.basename(file) === "SHA256SUMS.txt"
  })).sort((a, b) => a.path.localeCompare(b.path));

  const report = {
    generatedAt: new Date().toISOString(),
    version: packageJson.version,
    summary: {
      sourceModules: sourceModules.length,
      bundledModules: bundledModules.size,
      unbundledSourceModules: sourceModules.filter((module) => !bundledModules.has(module)).length,
      catalogAssets: catalogAssets.length,
      activeCatalogAssets: catalogAssets.filter((asset) => asset.active).length,
      inactiveCatalogAssets: catalogAssets.filter((asset) => !asset.active).length,
      webAssets: webAssets.length,
      unregisteredWebAssets: unregisteredWebAssets.length,
      missingManifestPaths: missingManifestPaths.length,
      duplicateGroups: duplicateGroups.length,
      redundantWebCopies: redundantWebCopies.length,
      redundantWebBytes: redundantWebCopies.reduce((sum, file) => sum + file.bytes, 0),
      stableReleaseVersion,
      historicalReleaseFiles: releaseFiles.filter((file) => !file.current).length
    },
    source: {
      modules: sourceModules,
      bundledModules: Array.from(bundledModules).sort(),
      unbundledModules: sourceModules.filter((module) => !bundledModules.has(module))
    },
    art: {
      catalog: catalogAssets.map((asset) => ({ id: asset.id, path: `web/${asset.src.replace(/^\.\//, "")}`, active: asset.active, eager: asset.eager })),
      unregisteredWebAssets,
      missingManifestPaths,
      redundantWebCopies,
      duplicateGroups
    },
    release: releaseFiles,
    directories: ["src", "test", "scripts", "web", "dist", "art", "archive", "docs", "output", "release", "src-tauri", ".playwright-cli"].map(directorySummary),
    transient: {
      rootPlaywrightSnapshots: walk(path.join(root, ".playwright-cli")).map(relative),
      tauriTarget: fs.existsSync(path.join(root, "src-tauri", "target"))
    }
  };
  return report;
}

const report = auditProject();
if (process.argv.includes("--write")) {
  const output = path.join(root, "docs", "project-material-audit-" + report.version + ".json");
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${relative(output)}`);
}
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.missingManifestPaths > 0) process.exitCode = 1;
