import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const entrypoints = [
  "README.md", "CONTRIBUTING.md", "docs/README.md", "godot/README.md",
  "docs/architecture.md", "docs/component-catalog.md",
  "docs/screenshots/current/README.md", "docs/maintenance/github-integration-2026-10-31.md"
];
const failures = [];
let checked = 0;
function anchors(file) {
  const counts = new Map();
  return new Set([...fs.readFileSync(file, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => {
    const slug = match[1].replace(/`/g, "").toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s/g, "-");
    const count = counts.get(slug) || 0;
    counts.set(slug, count + 1);
    return slug + (count ? `-${count}` : "");
  }));
}
for (const relative of entrypoints) {
  const source = path.join(root, relative);
  const markdown = fs.readFileSync(source, "utf8");
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/g)) {
    const href = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:)/.test(href)) continue;
    checked++;
    const [pathname, fragment] = href.split("#");
    const target = pathname ? path.resolve(path.dirname(source), decodeURIComponent(pathname)) : source;
    if (target !== root && !target.startsWith(root + path.sep)) {
      failures.push({source: relative, href, reason: "outside repository"});
    } else if (!fs.existsSync(target)) {
      failures.push({source: relative, href, reason: "missing target"});
    } else if (fragment && target.endsWith(".md") && !anchors(target).has(decodeURIComponent(fragment))) {
      failures.push({source: relative, href, reason: "missing heading"});
    }
  }
}
console.log(JSON.stringify({entrypoints: entrypoints.length, checked, failures}, null, 2));
if (failures.length) process.exitCode = 1;
