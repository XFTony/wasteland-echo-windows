import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
const destination = path.join(root, "docs/assets");
const slash = value => value.replaceAll("\\", "/");
const relative = value => slash(path.relative(root, value));
const exists = value => fs.existsSync(path.join(root, value));
const json = (value, fallback = null) => { try { return JSON.parse(fs.readFileSync(path.join(root, value), "utf8")); } catch { return fallback; } };
const mediaExtensions = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif", ".ico", ".wav", ".ogg", ".flac", ".woff", ".woff2", ".ttf", ".otf"]);
const sourceExtensions = new Set([".blend", ".ase", ".aseprite", ".kra", ".psd", ".xcf"]);
const scanExcluded = ["docs/assets/", "docs/project-file-guide.md"];
const opaqueNames = new Set(["node_modules", ".git", ".godot", ".codex", ".agents", "target", "ui-test-save", "save-transfer-qa", "saves", "user-data"]);
const files = [];
const opaque = [];
const scanErrors = [];
const directoryMap = new Map();

function classify(name) {
  if (name === "godot") return ["原生活动项目", "后续运行代码、场景、Resource和活动素材的开发主目录", "提交源码/素材/UID/import设置；忽略.godot和builds"];
  if (["src", "web", "src-tauri"].includes(name)) return ["旧版对照与回退", "保留Canvas/Tauri实现、原始内容注册和对应素材", "迁移阶段保留，不与原生目录双改"];
  if (name === "art") return ["美术/音频可编辑源与设计历史", "原图、分层、原采样、生成记录及历史动作研究", "源与来源记录提交；历史不等于活动素材"];
  if (name === "archive") return ["历史归档", "停用版本和历史说明", "按原归档规则保留，不默认删除"];
  if (name === "experiments") return ["隔离技术样板", "历史Godot可行性等实验", "不是正式游戏入口"];
  if (["output", "dist", "release"].includes(name)) return ["可再生输出/本地构建", "截图、录屏、包、SDK模板、QA产物", "不进Git；确认来源和可重建方法后才考虑清理"];
  if (name === "docs") return ["设计/验收/来源文档", "规范、计划、评审、许可、QA摘要", "提交可长期参考的文档，避免完整重复截图"];
  if (name === "scripts") return ["开发与验收工具", "导出、素材制作、构建、检查脚本", "提交工具，不把开发工具依赖带入运行包"];
  if (name === "test") return ["旧版确定性回归", "原JS规则与渲染合同测试", "提交并保留回退检查"];
  if (name === "tools") return ["本地工具配置", "固定版本Godot MCP及配套说明", "提交版本锁和配置样例；忽略node_modules"];
  if (name === ".github") return ["远端CI", "质量与原生Godot回归工作流", "提交；不包含密钥"];
  if (name === ".git") return ["Git内部数据库", "仅读取Git自身聚合统计，不枚举对象内容", "不当作普通目录整理"];
  if (name === "node_modules") return ["可重装依赖", "根开发依赖目录，不枚举内部", "不进Git；由lockfile恢复"];
  if (name === ".codex") return ["本机协作配置", "项目MCP等本机设置，不读取配置内容", "遵循现有ignore，不公开个人配置"];
  if (name === ".gitattributes") return ["Git文件规范", "规定源码换行及图片/音频的二进制保存方式", "提交；原生文本保持LF"];
  if (name === ".gitignore") return ["Git排除规则", "隔离输出、依赖、引擎缓存和本机配置", "提交；不屏蔽活动素材或UID"];
  if (name === "README.md") return ["项目入口说明", "标明当前原生版入口、历史版本与主要文档", "随开发主线更新，避免指向旧包"];
  if (name === "CHANGELOG.md") return ["版本变更记录", "已发布/开发中内容及兼容变更", "提交；内部备份不冒充正式Release"];
  if (name === "CREDITS.md") return ["署名与许可入口", "原创、生成素材、第三方音频/字体/引擎的来源边界", "新增素材时与台账同步"];
  if (["package.json", "package-lock.json"].includes(name)) return ["开发依赖与版本", "旧版工具、迁移对照及构建脚本的Node依赖", "锁文件提交；不等于原生游戏运行依赖"];
  if (name.endsWith(".cmd")) return ["本机启动入口", "开发版、旧版或存档工具的便捷启动脚本，按脚本名称区分", "保留稳定入口；独立包从output/godot-migration/windows启动"];
  if (name.endsWith("-spec.md")) return ["规格文档", "平台与历史玩法规格，原生改造以迁移计划及当前Resource为准", "提交；历史决定不能覆盖已确认的新玩法"];
  return ["项目根文件/其它", "按实际用途进一步登记", "保留现有引用"];
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const name = relative(absolute);
    if (scanExcluded.some(prefix => name === prefix || name.startsWith(prefix))) continue;
    let stat;
    try { stat = fs.lstatSync(absolute); } catch (error) { scanErrors.push({ path: name, error: error.code }); continue; }
    if (stat.isSymbolicLink()) { opaque.push({ path: name, reason: "symlink_or_junction_not_followed", measuredBytes: null }); continue; }
    if (entry.isDirectory()) {
      if (opaqueNames.has(entry.name)) {
        opaque.push({ path: name, reason: "dependency_cache_config_or_save_boundary", measuredBytes: null });
      } else {
        directoryMap.set(name, { path: name, files: 0, bytes: 0 });
        try { walk(absolute); } catch (error) { scanErrors.push({ path: name, error: error.code }); }
      }
      continue;
    }
    if (!stat.isFile()) continue;
    const saveLike = /(?:^|\/)(?:wasteland_echo_save[^/]*|[^/]*save-backup[^/]*)\.json$/i.test(name);
    files.push({ path: name, bytes: stat.size, extension: path.extname(name).toLowerCase(), contentReadBlocked: saveLike });
  }
}

function csv(text) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { field += '"'; index++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if (char === "\n" && !quoted) { row.push(field.replace(/\r$/, "")); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const header = rows.shift() || [];
  return rows.map(values => Object.fromEntries(header.map((key, index) => [key, values[index] || ""])));
}

function imageInfo(buffer, extension) {
  if (extension === ".png" && buffer.length >= 24 && buffer.toString("hex", 0, 8) === "89504e470d0a1a0a") return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: "PNG" };
  if (extension === ".webp" && buffer.length >= 30 && buffer.toString("ascii", 8, 12) === "WEBP") {
    const type = buffer.toString("ascii", 12, 16);
    if (type === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3), format: "WebP" };
    if (type === "VP8L") { const bits = buffer.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, format: "WebP" }; }
    if (type === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, format: "WebP" };
  }
  if (extension === ".gif" && buffer.length >= 10) return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8), format: "GIF" };
  if (extension === ".ico" && buffer.length >= 22) {
    const entries = Array.from({ length: buffer.readUInt16LE(4) }, (_v, index) => ({ width: buffer[6 + index * 16] || 256, height: buffer[7 + index * 16] || 256 }));
    return { ...entries.sort((a, b) => b.width * b.height - a.width * a.height)[0], format: "ICO", embeddedSizes: entries };
  }
  if ([".jpg", ".jpeg"].includes(extension)) {
    let index = 2;
    while (index + 8 < buffer.length) {
      if (buffer[index++] !== 0xff) continue;
      const marker = buffer[index++];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { width: buffer.readUInt16BE(index + 5), height: buffer.readUInt16BE(index + 3), format: "JPEG" };
      if (marker === 0xda || marker === 0xd9) break;
      const size = buffer.readUInt16BE(index); if (size < 2) break; index += size;
    }
  }
  return null;
}

function waveInfo(buffer) {
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") return null;
  let format, data;
  for (let index = 12; index + 8 <= buffer.length;) {
    const kind = buffer.toString("ascii", index, index + 4), size = buffer.readUInt32LE(index + 4);
    if (kind === "fmt " && size >= 16 && index + 24 <= buffer.length) format = { channels: buffer.readUInt16LE(index + 10), sampleRate: buffer.readUInt32LE(index + 12), byteRate: buffer.readUInt32LE(index + 16), bitsPerSample: buffer.readUInt16LE(index + 22) };
    if (kind === "data") data = size;
    index += 8 + size + size % 2;
  }
  return format ? { ...format, seconds: data !== undefined ? data / format.byteRate : null } : null;
}

function category(file, registration) {
  const text = `${file.path} ${registration?.id || ""}`;
  if (/\/fonts\//.test(text)) return "字体/许可";
  if (/\/audio\//.test(text)) return registration?.role === "music" ? "音乐" : "音效";
  if (/weapon|cuffs|hands/.test(text)) return "武器/独立握持部件";
  if (/\/actors\//.test(text)) return /drifter|runner-atlas|spitter|brute|screecher|crawler|warden|colossus/.test(text) ? "敌人" : "主角/服饰";
  if (/\/world\//.test(text)) return "地图/地表/道具";
  if (/\/equipment\//.test(text)) return "装备图标";
  if (/\/outfits\//.test(text)) return "服饰图标";
  if (/\/app\//.test(text)) return "应用图标";
  return "界面/封面/其它";
}

walk(root);
const tracked = new Set(slash(execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", windowsHide: true })).split("\0").filter(Boolean));
const manifest = json("art/manifest.json", { assets: [] });
const mapManifestPaths = ["art/world/pixel-map-v2/manifest.json", "art/world/echo-ground-v3/manifest.json", "art/combat/survival-builds-v1/manifest.json"];
const combatDesign = json("art/combat/survival-builds-v1/design.json", { audio: [], visuals: {} });
const nativeAudio = new Map(combatDesign.audio.map(item => ["godot/" + item.src.replace(/^\.\//, ""), item]));
const artRecords = [
  ...manifest.assets.map(item => ({ ...item, registryPath: "art/manifest.json" })),
  ...mapManifestPaths.flatMap(registryPath => {
    const source = json(registryPath, { assets: [] });
    return source.assets.map(item => ({ ...item, runtimePath: item.runtime,
      generator: source.generator, registryPath }));
  })
];
const ledger = csv(fs.readFileSync(path.join(root, "docs/assets-ledger.csv"), "utf8"));
const { ART_ASSETS } = require("../../src/render/art/asset-catalog.js");
const { AUDIO_ASSETS } = require("../../src/content/audio-assets.js");
const { NATIVE_WEAPONS } = require("../../src/content/weapon-expansion.js");
const registered = new Map([...Object.values(ART_ASSETS), ...AUDIO_ASSETS].map(item => ["web/" + item.src.replace(/^\.\//, ""), item]));
const activeImages = Object.values(ART_ASSETS).filter(item => item.active);
const fileByPath = new Map(files.map(file => [file.path, file]));
const nativeReferences = new Map();
for (const file of files.filter(file => file.path.startsWith("godot/") && !file.path.startsWith("godot/data/") && [".gd", ".tscn", ".tres", ".godot", ".cfg"].includes(file.extension))) {
  const text = fs.readFileSync(path.join(root, file.path), "utf8");
  for (const match of text.matchAll(/res:\/\/(assets\/[^"\r\n\)\]]+\.(?:png|webp|jpe?g|gif|ico|wav|ogg|flac|woff2?|ttf|otf))/gi)) {
    const target = "godot/" + match[1];
    const kind = file.path === "godot/content/game_catalog.tres" ? "catalog_resource_path" : "native_scene_script_or_resource";
    if (!nativeReferences.has(target)) nativeReferences.set(target, []);
    if (!nativeReferences.get(target).some(row => row.path === file.path && row.kind === kind)) nativeReferences.get(target).push({ path: file.path, kind });
  }
}

const hashes = new Map();
const digest = file => {
  if (!hashes.has(file.path)) hashes.set(file.path, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file.path))).digest("hex").toUpperCase());
  return hashes.get(file.path);
};

const runtimeAssets = [];
for (const file of files.filter(file => file.path.startsWith("godot/assets/") && !file.path.endsWith(".import"))) {
  const legacy = "web/" + file.path.slice("godot/".length);
  const registration = nativeAudio.get(file.path) || registered.get(legacy);
  const art = artRecords.find(item => (registration?.id && item.id === registration.id) || item.runtimePath === legacy || item.runtimePath === file.path);
  const paths = [legacy, file.path, art?.archivePath, ...(art?.sourcePaths || [])].filter(Boolean);
  const rows = ledger.filter(row => (registration?.id && row.asset_id === registration.id) || (art?.id && row.asset_id === art.id) || paths.some(candidate => row.local_path.split(/;\s*/).includes(candidate)));
  const references = nativeReferences.get(file.path) || [];
  const data = fs.readFileSync(path.join(root, file.path));
  const license = rows.length ? rows.map(row => ({ assetId: row.asset_id, license: row.license, reviewStatus: row.review_status, commercialOk: row.commercial_ok, creator: row.creator, sourceUrl: row.source_url })) : [];
  const nearbyEvidence = files.filter(row => path.posix.dirname(row.path) === path.posix.dirname(file.path) && /(?:readme|license|provenance|source|generation|manifest)/i.test(path.posix.basename(row.path)) && [".md", ".json", ".txt"].includes(row.extension)).map(row => row.path);
  const entry = {
    path: file.path, category: category(file, registration), bytes: file.bytes,
    sha256: digest(file), tracked: tracked.has(file.path),
    dimensions: imageInfo(data, file.extension), audio: file.extension === ".wav" ? waveInfo(data) : registration?.seconds ? { seconds: registration.seconds, role: registration.role } : null,
    contentId: registration?.id || art?.id || null,
    registration: registration ? registration.active === false ? "legacy_registered_inactive" : "registered_runtime" : references.length ? "native_direct_reference" : "native_tree_unregistered_review",
    references, legacyReferencePath: exists(legacy) ? legacy : null,
    sameBytesAsLegacy: fileByPath.has(legacy) ? digest(file) === digest(fileByPath.get(legacy)) : null,
    sourceEvidence: [art?.archivePath, ...(art?.sourcePaths || []), ...nearbyEvidence].filter(Boolean),
    sourceEvidenceExisting: [art?.archivePath, ...(art?.sourcePaths || []), ...nearbyEvidence].filter(Boolean).filter(exists),
    provenanceRecord: art?.registryPath || (file.path.includes("/audio/survival-v1/") ? "art/audio/survival-v1/source-provenance.json" : file.path.includes("/audio/arsenal-v2/") ? "art/audio/arsenal-v2/source-provenance.json" : file.path.includes("/fonts/") ? "docs/licenses/Fusion-Pixel-Font-OFL-1.1.txt" : null),
    generator: art?.generator || registration?.source || null, licenseRecords: license,
    licenseEvidence: ["CREDITS.md", ...(rows.length ? ["docs/assets-ledger.csv"] : []), ...(file.path.includes("/audio/") && !nativeAudio.has(file.path) ? ["art/audio/survival-v1/source-permission.md"] : []), ...(file.path.includes("/fonts/") ? ["docs/licenses/Fusion-Pixel-Font-OFL-1.1.txt"] : [])],
    review: rows.length ? "See the recorded review status; no new legal approval inferred" : "Source/license registration needs review; tree presence does not establish permission",
    declaredSha256Matches: art?.sha256 ? art.sha256.toUpperCase() === digest(file) : null
  };
  runtimeAssets.push(entry);
}

const duplicateCandidates = files.filter(file => !file.contentReadBlocked && mediaExtensions.has(file.extension) && ["godot/assets/", "web/assets/", "art/"].some(prefix => file.path.startsWith(prefix)) && file.bytes <= 64 * 1024 * 1024);
const groups = new Map();
for (const file of duplicateCandidates) { const key = digest(file); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(file); }
const duplicates = [...groups].filter(([_hash, members]) => members.length > 1).map(([sha256, members]) => ({ sha256, bytesEach: members[0].bytes, files: members.map(file => file.path), classification: members.some(file => file.path.startsWith("godot/assets/")) && members.some(file => file.path.startsWith("web/assets/")) ? "intentional_native_and_legacy_reference_pair" : "source_history_or_exact_duplicate_review", deletionRecommended: false })).sort((a, b) => b.bytesEach * b.files.length - a.bytesEach * a.files.length);
const legacyAssets = Object.values(ART_ASSETS).filter(item => !item.active).map(item => ({ id: item.id, path: "web/" + item.src.replace(/^\.\//, ""), exists: exists("web/" + item.src.replace(/^\.\//, "")), nativeCopy: exists("godot/" + item.src.replace(/^\.\//, "")), status: "registered_inactive_legacy_reference" }));
const sourceFiles = files.filter(file => sourceExtensions.has(file.extension)).map(file => ({ ...file, tracked: tracked.has(file.path), inNativeRuntimeTree: file.path.startsWith("godot/assets/") }));
const missingNativeReferences = [...nativeReferences.keys()].filter(name => !fileByPath.has(name));
const missingRegisteredLegacy = [...registered.keys()].filter(name => !fileByPath.has(name));
const topNames = [...new Set([...files.map(file => file.path.split("/")[0]), ...opaque.map(item => item.path.split("/")[0])])].sort();
const topLevel = topNames.map(name => {
  const members = files.filter(file => file.path.split("/")[0] === name);
  const boundaries = opaque.filter(item => item.path.split("/")[0] === name);
  const [category, purpose, policy] = classify(name);
  return { path: name, category, purpose, policy, measuredFiles: members.length, measuredBytes: members.reduce((sum, file) => sum + file.bytes, 0), partial: boundaries.length > 0, opaqueChildren: boundaries.map(item => item.path) };
});
let gitStorage = null;
try {
  const counters = Object.fromEntries(execFileSync("git", ["count-objects", "-v"], { cwd: root, encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/).map(line => line.split(": ")));
  gitStorage = { source: "git count-objects -v (aggregate only)", counters, allocatedObjectBytes: (Number(counters.size) + Number(counters["size-pack"])) * 1024, directoryTotalMeasured: false };
} catch { gitStorage = { source: "Git aggregate not available", directoryTotalMeasured: false }; }
const procedural = Object.entries({...NATIVE_WEAPONS, ...combatDesign.visuals}).map(([id, spec]) => ({ id, category: "原生代码绘制武器", dimensions: { width: spec.width, height: spec.height }, rectangles: spec.shapes.length, bytes: null, sha256: null, registration: "runtime_generated_texture", references: ["godot/content/game_catalog.tres", "godot/scripts/presentation/asset_store.gd", ...(combatDesign.visuals[id] ? ["art/combat/survival-builds-v1/design.json", "scripts/godot/prepare-survival-content.mjs"] : ["src/content/weapon-expansion.js"])], licenseEvidence: ["docs/assets-ledger.csv", "CREDITS.md"], note: "No separate PNG exists; metadata and native drawing code are the source" }));
const report = {
  format: 1, generatedAt: new Date().toISOString(), authority: "godot is active; original implementation retained as reference",
  scanPolicy: { excludedGeneratedOutputs: scanExcluded, opaqueDirectoryNames: [...opaqueNames].sort(), followsSymlinks: false, actualUserProfileScanned: false, opaqueSizePolicy: "Unknown directory size is null; no dependency/cache walk was performed merely to estimate it", duplicatePolicy: "Exact-byte groups are evidence, never automatic deletion permission" },
  summary: { measuredFiles: files.length, measuredBytes: files.reduce((sum, file) => sum + file.bytes, 0), opaqueDirectories: opaque.length, nativeMaterialFiles: runtimeAssets.length, nativeMaterialBytes: runtimeAssets.reduce((sum, file) => sum + file.bytes, 0), registeredActiveImages: activeImages.length, registeredAudio: AUDIO_ASSETS.length + nativeAudio.size, proceduralWeapons: procedural.length, retiredArtRegistrations: legacyAssets.length, editableSourceFiles: sourceFiles.length, nativeBlendFiles: sourceFiles.filter(file => file.inNativeRuntimeTree && file.extension === ".blend").length, exactDuplicateGroups: duplicates.length },
  topLevel, opaqueDirectories: opaque, gitStorage, runtimeAssets, procedural, legacyAssets, sourceFiles, duplicates,
  findings: { missingNativeReferences, missingRegisteredLegacy, sourceHashMismatches: runtimeAssets.filter(asset => asset.declaredSha256Matches === false).map(asset => asset.path), nativeRetiredCopies: legacyAssets.filter(asset => asset.nativeCopy), nativeWithoutRegistration: runtimeAssets.filter(asset => !asset.contentId).map(asset => asset.path), nativeWithoutLedgerMatch: runtimeAssets.filter(asset => !asset.licenseRecords.length).map(asset => asset.path), scanErrors },
  files: files.map(file => ({ ...file, tracked: tracked.has(file.path) }))
};
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, "workspace-inventory.json"), JSON.stringify(report, null, 2) + "\n");

const mb = bytes => (bytes / 1024 / 1024).toFixed(2) + " MiB";
const link = value => `[${value}](../../${value.replaceAll(" ", "%20")})`;
const escape = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const categoryNames = [...new Set(runtimeAssets.map(asset => asset.category))];
const catalogLines = ["# 活动素材索引", "", "由 `node scripts/assets/audit-workspace.mjs` 生成。原生 `godot/assets` 为活动树；登记表示可加载或可追溯，不等于每个文件在每个场景实际绘制。完整尺寸、SHA256、引用及许可记录见本目录 `workspace-inventory.json`。", "", `本次活动树原始文件 **${runtimeAssets.length}** 个 / **${mb(report.summary.nativeMaterialBytes)}**，另有 ${procedural.length} 件运行时原生绘制武器。`.trim(), "", "`.import` 是导入设置，不重复计为美术原文件；它们保留在完整文件索引中。动态拼接的 ID/路径无法仅凭静态查找证明未使用，因此未注册项一律列为复核项。", ""];
for (const name of categoryNames) {
  const items = runtimeAssets.filter(asset => asset.category === name);
  catalogLines.push(`## ${name}`, "", "| 文件 | 内容ID/登记 | 尺寸或时长 | 字节 | 来源与许可核对 |", "|---|---|---|---:|---|");
  for (const item of items) {
    const shape = item.dimensions ? `${item.dimensions.width}×${item.dimensions.height}` : item.audio?.seconds ? `${Number(item.audio.seconds).toFixed(3)}s` : "—";
    const evidence = [...new Set([item.provenanceRecord, ...item.sourceEvidenceExisting, ...item.licenseEvidence].filter(Boolean))].slice(0, 4);
    catalogLines.push(`| ${link(item.path)} | ${escape(item.contentId || item.registration)} | ${shape} | ${item.bytes} | ${evidence.map(link).join("、")} |`);
  }
  catalogLines.push("");
}
catalogLines.push("## 没有独立图片文件的活动素材", "", "| 内容 | 类型 | 源与引用 |", "|---|---|---|");
for (const item of procedural) catalogLines.push(`| ${item.id} | ${item.dimensions.width}×${item.dimensions.height}，${item.rectangles}条像素矩形 | ${item.references.map(link).join("、")} |`);
catalogLines.push("", "升级/商品的原生图形、地图程序化装饰和UI材质也可能来自Resource/代码，不能用PNG文件数判断内容缺失。", "", "## 精确重复与历史边界", "", `检测到 ${duplicates.length} 组精确字节重复。Godot与旧版相同字节的素材是有意对照/回退，Git对象会去重，本次不建议删除任何一组。完整成员及SHA见JSON。`, "", `旧版注册表标记 inactive 的美术 ${legacyAssets.length} 项；其中活动原生树副本 ${report.findings.nativeRetiredCopies.length} 项。可编辑源文件 ${sourceFiles.length} 份，活动树中的.blend为 ${report.summary.nativeBlendFiles} 份。`, "", "历史Blender/精细像素动作研究保留于art、experiments和相应output目录，不把技术样板标为当前游戏完成品。", "", "## 登记复核项", "", `- 原生路径/场景引用缺失：${missingNativeReferences.length}。`, `- 旧版已登记路径缺失：${missingRegisteredLegacy.length}。`, `- 原生活动树无旧注册ID：${report.findings.nativeWithoutRegistration.length}。新地图或应用图标可以采用原生直接引用，须另补来源记录，不据此认定未使用。`, `- 未精确匹配旧许可台账的原生文件：${report.findings.nativeWithoutLedgerMatch.length}。完整列表见JSON；已有manifest/CREDITS/provenance可能提供证据，不能自动判为未授权。`, "", "## 新增素材的保存步骤", "", "1. 活动图片/音频放Godot功能子目录，保留稳定ID和.import设置；源图、分层文件、原采样放art相应工作包。", "2. 同步来源/许可记录，声明生成原图、参考输入、处理脚本与运行图关系；未核实的许可标为待核实。", "3. 把真实路径登记到原生Resource或场景，按运行尺寸检查边缘、接缝和交互可读性。", "4. 运行本脚本重建索引；在Git提交中保存源码/素材与来源，完整截图/大包留output。", "5. 只有引用检查和实际验收均确认停用后，再单列归档/删除清单，避免改路径破坏存档或场景引用。", "");
fs.writeFileSync(path.join(destination, "asset-catalog.md"), catalogLines.join("\n"));

const guide = ["# 游戏文件夹导航与整理规则", "", "本索引整理用途、权威目录和修改入口，没有移动、删除或批量改名已有文件。全路径/大小/追踪状态见 `docs/assets/workspace-inventory.json`，活动素材见 `docs/assets/asset-catalog.md`。", "", "## 一级目录", "", "| 目录/文件 | 职责 | 本次测得体积 | 保存规则 |", "|---|---|---:|---|"];
for (const item of topLevel) guide.push(`| \`${escape(item.path)}\` | ${item.category}：${item.purpose} | ${item.partial ? "至少 " : ""}${mb(item.measuredBytes)}${item.partial ? "（含未枚举边界）" : ""} | ${item.policy} |`);
guide.push("", "依赖/缓存/配置/存档边界不枚举内容；其完整大小未测，不能把“已测文件为0”理解为目录为空。Git只读取自身计数汇总，不打开对象内容。一级体积为所枚举文件的统计，不是磁盘占用/硬链接/Git压缩后的大小。", "", "## 按任务找文件", "", "| 要修改的内容 | 首选入口 | 对照/验证 |", "|---|---|---|", "| 地图布局/实体碰撞 | godot/scenes/maps + scripts/world/map_scene.gd / map_obstacle.gd | 地图Resource、流场与场景交互检查 |", "| 地图素材/地表/道具 | godot/assets/world；源文件art/world或art/generated | 本轮地图美术规范、素材来源与截图 |", "| 主角/敌人/枪械表现 | godot/assets/actors + scripts/presentation | 原生图集、独立手/袖口、握点及动作核对 |", "| 玩法/武器/敌人/成长 | godot/content + scripts/core | 原生对照测试，变化须说明数值与兼容影响 |", "| UI/焦点/升级卡 | godot/scripts/ui | 四分辨率区域与实际截图 |", "| 声音与音乐 | godot/assets/audio + scripts/presentation/native_audio.gd | art/audio来源/许可；实际听感 |", "| 存档与导入 | godot/scripts/persistence + scenes/tools/save_transfer.tscn | 隔离存档测试，不直接改真实用户档 |", "| 打包与Git验证 | scripts/godot、.github/workflows、docs/versioning-and-release.md | 构建manifest/SHA及CI |", "", "## 已明确的历史材料", "", `- 可编辑美术源共 ${sourceFiles.length} 份，详细路径在JSON；.blend均不在活动原生素材树。`, "- art/animation/ranger保留Blender灰模/IK/持枪研究，其README明确未作为成品接入；保留研究证据，不在本轮重做角色动画。", "- art/characters和output/animation保存此前精细像素/动作样板；现有compact-v1活动图集另有明确登记，不按目录年代推断它们互相可替代。", "- experiments/godot-pilot是历史可行性样板，正式入口为godot/project.godot。", "", "## 后续整理的先后顺序", "", "1. 每轮改动先更新活动引用与来源，再运行索引；让当前原生目录与回退基准保持职责清楚。", "2. 把新素材原图/运行图/处理脚本登记成一个工作包，采用稳定文件名，避免final2/final3散落。", "3. 先核对未注册与缺失引用，不因精确重复就删旧版对照或原稿。", "4. 对output/dist/release另按具体构建批次列可清理清单；SDK模板可再下载，不纳入源码。", "5. 真正清理时重新核验绝对路径、用途和Git状态，归档与功能改动分开提交。", "", "## 重建索引", "", "```powershell", "node scripts/assets/audit-workspace.mjs", "```", "", "脚本只读取项目目录，生成上述三个索引文件；不跟随链接、不读取用户档内容、不修改资源路径，不把本身生成的索引重复计入下次统计。", "");
fs.writeFileSync(path.join(root, "docs/project-file-guide.md"), guide.join("\n"));
console.log(JSON.stringify({ summary: report.summary, missingNativeReferences, missingRegisteredLegacy, opaqueDirectories: opaque.length, output: ["docs/assets/workspace-inventory.json", "docs/assets/asset-catalog.md", "docs/project-file-guide.md"] }));
