import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourceFont = path.join(projectRoot, "docs", "assets-sources", "fusion-pixel-font-2026.09.01", "fusion-pixel-12px-proportional-zh_hans.otf.woff2");
const outputFont = path.join(projectRoot, "web", "assets", "fonts", "wasteland-fusion-pixel-12-subset.woff2");

function collectFiles(directory, extensions, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolute, extensions, output);
    else if (extensions.has(path.extname(entry.name))) output.push(absolute);
  }
  return output;
}

if (!fs.existsSync(sourceFont)) throw new Error(`Missing source font: ${sourceFont}`);
const files = [
  ...collectFiles(path.join(projectRoot, "src"), new Set([".js"])),
  path.join(projectRoot, "web", "index.html")
];
let corpus = "荒原回响铜币金币0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz，。！？：；·—+-/%()[]<>◆✦¢ ";
for (const file of files) corpus += fs.readFileSync(file, "utf8");
const glyphs = [...new Set(Array.from(corpus).filter((character) => !/[\r\n\t]/.test(character)))].join("");

const args = [
  sourceFont,
  `--output-file=${outputFont}`,
  `--text=${glyphs}`,
  "--flavor=woff2",
  "--layout-features=*",
  "--name-IDs=*",
  "--name-legacy",
  "--glyph-names",
  "--symbol-cmap",
  "--legacy-cmap",
  "--notdef-glyph",
  "--recommended-glyphs"
];
const result = spawnSync("pyftsubset", args, { encoding: "utf8", windowsHide: true });
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "pyftsubset failed");
const sourceBytes = fs.statSync(sourceFont).size;
const outputBytes = fs.statSync(outputFont).size;
console.log(`Subset ${glyphs.length} characters: ${sourceBytes} -> ${outputBytes} bytes`);
