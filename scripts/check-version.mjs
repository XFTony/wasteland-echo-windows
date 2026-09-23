import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
const cargoManifest = read("src-tauri/Cargo.toml");
const cargoLock = read("src-tauri/Cargo.lock");
const sourceVersion = read("src/version.js");
const html = read("web/index.html");
const version = packageJson.version;
const errors = [];

function captured(source, expression, label) {
  const match = expression.exec(source);
  if (!match) errors.push(label + ": version field not found");
  return match && match[1];
}

if (!/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(version)) {
  errors.push("package.json: unsupported version " + version);
}

const versions = {
  "package-lock.json": packageLock.version,
  "package-lock.json root package": packageLock.packages?.[""]?.version,
  "src/version.js": captured(sourceVersion, /\bGAME_VERSION\s*=\s*["']([^"']+)["']/, "src/version.js"),
  "web/index.html": captured(html, /WINDOWS DESKTOP\s*·\s*v([^\s<]+)/, "web/index.html"),
  "src-tauri/tauri.conf.json": tauri.version,
  "src-tauri/Cargo.toml": captured(cargoManifest, /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m, "src-tauri/Cargo.toml"),
  "src-tauri/Cargo.lock": captured(cargoLock, /^\[\[package\]\]\r?\nname = "wasteland-echo"\r?\nversion = "([^"]+)"/m, "src-tauri/Cargo.lock")
};

for (const [file, found] of Object.entries(versions)) {
  if (found && found !== version) errors.push(file + ": " + found + " differs from package.json " + version);
}

const notes = path.join(root, "docs", "release-notes", "README-v" + version + ".txt");
if (!fs.existsSync(notes)) errors.push("release notes missing: " + path.relative(root, notes));

if (errors.length) {
  for (const error of errors) console.error("Version check failed: " + error);
  process.exitCode = 1;
} else {
  console.log("Version check passed: " + version + " across package, lockfiles, game, HTML, Tauri, and release notes");
}
