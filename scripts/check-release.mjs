import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const candidate = process.argv.includes("--candidate");
const prerelease = version.includes("-");
const directory = path.join(root, prerelease ? path.join("output", "builds", "v" + version) : "release");
const names = [
  "WastelandEcho-v" + version + "-win-x64.exe",
  "WastelandEcho-v" + version + "-win-x64-setup.exe",
  "WastelandEcho-v" + version + "-win-x64-portable.zip"
];
const manifestPath = path.join(directory, "SHA256SUMS.txt");
const errors = [];

if (!fs.existsSync(manifestPath)) {
  errors.push("SHA256SUMS.txt is missing from " + path.relative(root, directory));
} else {
  const entries = new Map();
  for (const line of fs.readFileSync(manifestPath, "ascii").trim().split(/\r?\n/)) {
    const match = /^([A-Fa-f0-9]{64})  (.+)$/.exec(line);
    if (!match || entries.has(match[2])) {
      errors.push("Malformed or duplicate SHA256SUMS entry: " + line);
      continue;
    }
    entries.set(match[2], match[1].toUpperCase());
  }
  for (const name of names) {
    const artifact = path.join(directory, name);
    if (!fs.existsSync(artifact) || fs.statSync(artifact).size === 0) {
      errors.push("Missing or empty artifact: " + name);
      continue;
    }
    if (!entries.has(name)) {
      errors.push("SHA256SUMS is missing: " + name);
      continue;
    }
    const actual = crypto.createHash("sha256").update(fs.readFileSync(artifact)).digest("hex").toUpperCase();
    if (actual !== entries.get(name)) errors.push("SHA-256 mismatch: " + name);
  }
  for (const name of entries.keys()) {
    if (!names.includes(name)) errors.push("Unexpected artifact in SHA256SUMS: " + name);
  }
}

if (!candidate) {
  try {
    const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    if (git(["status", "--porcelain"])) errors.push("Git working tree is not clean");
    const head = git(["rev-parse", "HEAD"]);
    const tagged = git(["rev-parse", "v" + version + "^{}"]);
    if (head !== tagged) errors.push("Tag v" + version + " does not point to HEAD");
  } catch (_error) {
    errors.push("Tag v" + version + " is missing or Git could not be checked");
  }
}

if (errors.length) {
  for (const error of errors) console.error("Release check failed: " + error);
  process.exitCode = 1;
} else {
  console.log((candidate ? "Candidate artifacts" : "Tagged release") + " verified: " + version + " (" + names.length + " SHA-256 matches)");
}
