import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const slash = value => value.replaceAll("\\", "/");
const baseline = execFileSync("git", ["rev-parse", "HEAD"], {cwd:root,encoding:"utf8",windowsHide:true}).trim();
const gitFiles = new Map(execFileSync("git", ["ls-files", "-s", "-z"], {cwd:root,encoding:"utf8",windowsHide:true}).split("\0").filter(Boolean).map(line => {const m=line.match(/^\d+ ([a-f0-9]+) \d\t(.+)$/s);return [m[2],m[1]];}));
const excluded = new Set([".git", ".godot", "node_modules", ".codex", ".agents", "target", "saves", "user-data", "userdata", "ui-test-save", "save-transfer-qa"]);
const files = [], opaque = [];
function walk(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const absolute = path.join(dir,entry.name), name=slash(path.relative(root,absolute));
    if(name.startsWith("output/card-layout-cleanup/")) continue;
    const stat=fs.lstatSync(absolute);
    if(stat.isSymbolicLink()) {opaque.push({path:name,reason:"link not followed"});continue;}
    if(entry.isDirectory()) {if(excluded.has(entry.name)&&!name.startsWith("experiments/godot-pilot/.godot"))opaque.push({path:name,reason:"dependency/cache/config/save boundary"});else walk(absolute);}
    else if(entry.isFile())files.push({path:name,bytes:stat.size});
  }
}
walk(root);
const exact = new Set([
  "scripts/godot/prepare-pilot.mjs",
  "scripts/animation/build-pixel-density-candidates.py", "scripts/animation/build-ranger-run-candidate.py",
  "scripts/animation/build-ranger-continuous-run.py", "scripts/animation/build-ranger-drawn-inbetweens.py",
  "scripts/animation/verify-ranger-continuous-loop.py", "scripts/animation/verify-ranger-drawn-inbetweens.py",
  "scripts/animation/verify-native-review-assets.py",
  "scripts/qa/build-pixel-production-review.py", "scripts/qa/build-ranger-direction-review.py",
  "scripts/qa/build-ranger-pixel-review.py", "scripts/qa/build-ranger-run-review-page.py",
  "scripts/qa/make-ranger-camera-board.py", "scripts/qa/make-ranger-lookdev-board.py",
  "scripts/qa/make-ranger-run-loop-preview.py", "scripts/qa/make-ranger-run-pose-board.py",
  "scripts/qa/verify-ranger-drawn-review.mjs", "scripts/qa/capture-illustrated-slice.mjs",
]);
const roots = ["art/animation/ranger/", "scripts/blender/", "experiments/godot-pilot/", "output/animation/ranger/"];
const sdkArchive = "output/godot-migration/toolchain/Godot_v4.7.2-stable_export_templates.tpz";
const candidates = files.filter(file => exact.has(file.path)||roots.some(p=>file.path.startsWith(p))||file.path===sdkArchive);
const selected = new Set(candidates.map(f=>f.path));
const codeExtensions = new Set([".gd", ".gdshader", ".tscn", ".tres", ".godot", ".js", ".mjs", ".py", ".ps1", ".cmd", ".yml", ".yaml", ".json", ".toml"]);
const codeFiles=files.filter(f=>!selected.has(f.path)&&!f.path.startsWith("output/")&&!f.path.startsWith("dist/")&&!f.path.startsWith("docs/")&&!f.path.startsWith("archive/")&&codeExtensions.has(path.extname(f.path))&&!f.path.endsWith("package-lock.json")&&!f.path.endsWith("game.bundle.js"));
const retiredCode = candidates.filter(f=>[".py",".js",".mjs",".ps1",".gd"].includes(path.extname(f.path))).map(f=>({path:f.path,name:path.basename(f.path),stem:path.basename(f.path,path.extname(f.path))}));
const blockers=[];
const provenance=[];
for(const source of codeFiles) {
  if(source.path.startsWith("scripts/maintenance/"))continue;
  let text=fs.readFileSync(path.join(root,source.path),"utf8");
  if(source.path==="art/manifest.json") {
    const manifest=JSON.parse(text);
    provenance.push(...manifest.assets.filter(a=>JSON.stringify(a).includes("art/animation/ranger")).map(a=>({file:source.path,asset:a.id,status:a.status,kind:"inactive study registry or historical source reference; migrate to archived records before deletion"})));
    text=JSON.stringify({...manifest,archivedAssets:[],assets:manifest.assets.filter(a=>!JSON.stringify(a).includes("art/animation/ranger"))});
  }
  const normalized=text.replaceAll("\\\\","/").replaceAll("\\","/").replace(/https?:\/\/[^\s"'<>]+/g, "");
  for(const prefix of roots)if(normalized.includes(prefix.replace(/\/$/,"")))blockers.push({file:source.path,target:prefix,kind:"remaining code/data prefix reference"});
  for(const old of retiredCode)if(normalized.includes(old.name)||old.stem.includes("_")&&new RegExp(`\\b${old.stem}\\b`).test(normalized))blockers.push({file:source.path,target:old.path,kind:"remaining code import/invocation"});
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,"art/manifest.json"),"utf8"));
const retiredStudies=manifest.assets.filter(a=>a.status==="inactive"&&[a.runtimePath,a.archivePath].filter(Boolean).some(p=>p.startsWith("art/animation/ranger/")));
const preservedStudies=manifest.assets.filter(a=>a.status==="inactive"&&JSON.stringify(a).includes("art/animation/ranger/")&&!retiredStudies.includes(a));
const sha = async filename => {const hash=crypto.createHash("sha256");for await(const chunk of fs.createReadStream(path.join(root,filename)))hash.update(chunk);return hash.digest("hex");};
const groups={};
for(const candidate of candidates){const group=candidate.path===sdkArchive?"extracted-multiplatform-sdk-cache":roots.find(p=>candidate.path.startsWith(p))||"superseded-authoring-qa";groups[group]??={files:0,bytes:0};groups[group].files++;groups[group].bytes+=candidate.bytes;}
const hashed=[];
for(const file of candidates)hashed.push({...file,sha256:await sha(file.path),gitBlob:gitFiles.get(file.path)||null,category:file.path===sdkArchive?"rebuildable SDK distribution; Windows templates retained":file.path.startsWith("output/")?"retired generated review":file.path.startsWith("art/")?"abandoned animation art source":"superseded prototype code"});
const plan={format:1,date:"2026-10-31",workspace:".",baselineCommit:baseline,backupDirectory:"../Wechat games-清理备份/2026-10-31-card-layout-cleanup",
  purpose:"User-approved safe removal of superseded prototypes; active source and provenance remain",roots,exact:[...exact],sdkArchive,
  retiredStudyIds:retiredStudies.map(a=>a.id),preservedStudyIds:preservedStudies.map(a=>a.id),
  files:hashed,
  groups,blockers,provenanceMigrations:provenance,opaque,
  preserved:["godot active project and all 20 weapons/42 upgrades","all 69 approved fieldcraft bitmaps and sources","active compact-motion, modular-grips and enemy authoring inputs","src/web/test reference baseline used by native fixture generation","two archived deployment renderers still imported by legacy tests","tools/godot-mcp current SDK and LibreSprite native-source tool","actual saves, local configuration, engine imports","current and previous playable Windows packages","two SHA-verified Windows export templates"],
  requiredBeforeApply:["zero code/data blockers after retiring study records","legacy and native regression pass in isolated deleted shadow tree","external ZIP and every entry verified by SHA256","fresh source hashes and exact absolute path allowlist"]};
fs.mkdirSync(path.join(root,"docs/cleanup"),{recursive:true});
fs.writeFileSync(path.join(root,"docs/cleanup/retirement-plan.json"),JSON.stringify(plan,null,2)+"\n");
console.log(JSON.stringify({files:plan.files.length,bytes:plan.files.reduce((n,f)=>n+f.bytes,0),groups,retiredStudies:plan.retiredStudyIds,blockers,provenanceRecords:provenance.length}));
