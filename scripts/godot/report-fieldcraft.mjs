import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const write = (file, value) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), value); };
const native = read("output/godot-migration/native-checks.json");
const art = read("art/combat/fieldcraft-v2/manifest.json");
const design = read("art/combat/fieldcraft-v2/design.json");
const test = read("output/fieldcraft-v2/tests.json");
const ui = read("output/godot-migration/ui-region-comparison.json");
const battle = read("output/godot-migration/battle-region-comparison.json");
assert(native.passed && !test.failures.length && native.reports.fieldcraft.checks === test.checks);
const legacyLog = fs.readFileSync(path.join(root, "output/fieldcraft-v2/legacy-check.log"), "utf8");
assert(/tests 331[\s\S]*pass 331[\s\S]*fail 0/.test(legacyLog));
const hoverLog = fs.readFileSync(path.join(root, "output/fieldcraft-v2/extra-ui.log"), "utf8");
assert(/FIELDCRAFT_FIRST_HOVER .*"active":true/.test(hoverLog));
let pack = null;
if (fs.existsSync(path.join(root, "output/godot-migration/package-smoke.json"))) {
  const p = read("output/godot-migration/package-smoke.json");
  const m = read("output/godot-migration/windows/build-manifest.json");
  if (p.passed && p.report.weapons === 20 && p.report.fieldcraftArt === 69 && p.sha256 === m.sha256 && p.sourceCommit === m.sourceCommit && !m.sourceDirty) pack = { ...p, bytes: m.bytes, version: m.version };
}
const runtimeFiles = ["godot/content/game_catalog.tres", "godot/scripts/core/status_weapon_rules.gd", "godot/scripts/core/combat_system.gd", "godot/scripts/core/entity_pool.gd", "godot/scripts/presentation/combat_art.gd", "godot/scripts/presentation/combat_impacts.gd", "godot/scripts/presentation/world_view.gd", "godot/scripts/presentation/character_visual.gd", "godot/scripts/ui/upgrade_card.gd", "godot/scripts/ui/item_presentation.gd"];
const hashes = Object.fromEntries(runtimeFiles.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
const report = { date: "2026-10-31", phase: "fieldcraft-v2", status: pack ? "internal_preview_ready" : "package_pending", definitions: 164, weapons: 20, rangedWeapons: 14, meleeWeapons: 6, upgrades: 42,
  suites: native.reports, legacy: { command: "npm run check", passed: true, tests: 331 },
  bitmaps: { files: art.bitmapFiles, runtimeBytes: art.runtimeBytes, decodedBitmapBytes: test.decodedArtBytes, decodedScope: art.decodedBitmapScope, upgradeIllustrations: 42, refinedExistingWeapons: 9, addedWeapons: 4, deathTypes: 8 },
  ui: { menuLayouts: ui.results.length, menuActions: ui.results.reduce((n, r) => n + r.actions, 0), battleLayouts: battle.results.length, battleActions: battle.results.reduce((n, r) => n + r.actions, 0), firstCardPointerHover: true, screenshotResolutions: ["960x540", "1280x720", "1920x1080", "2560x1440"] },
  limits: { corpses: 40, hitBursts: 112, lowQualityCorpses: 20, lowQualityHitBursts: 56 },
  package: pack, evidenceHashes: hashes, humanAcceptance: { artSignoff: false, balance: false, physicalGamepad: false, dpi: false, lowEndHardware: false, renderedLongSession: false } };
write("docs/qa/fieldcraft-validation.json", JSON.stringify(report, null, 2) + "\n");
const table = (head, rows) => ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|", ...rows.map(row => "| " + row.map(v => String(v).replaceAll("|", "\\|")).join(" | ") + " |")].join("\n");
const md = ["# 战地工坊卡牌、武器与倒地反馈验收", "", "2026-10-31；内部版本1.5.0-alpha.1。未创建新Release或标签。首张地图、既有角色与原有16武器数值保留，Godot原生开发线继续迭代。",
  "", "## 完成内容与核验", "", table(["用户要求", "已完成", "证据与边界"], [
    ["卡牌更精细且有独立特色", "6种实体底板＋42种独立改件插图；布、皮革、铜件、补纸与安静的正文区；无烘焙按钮文字", "全部42项图像字节指纹互异；四分辨率实窗；说明按真实字宽换行，100/120%界面字号检查；第一张卡真实鼠标悬停active=true"],
    ["简化枪体细化", "9件原简化武器替换为独立贴图，手/袖口独立；保留已认可7枪", "13件新/改枪体×8方向共104姿态已截图目视；逻辑尺寸和枪口坐标保留；补透明噪点导致细长武器缩小的回归"],
    ["受击和倒地", "方向性短反应、压缩回弹、普通/装甲与元素碎屑、8类敌人各4张倒地姿态、接地影和淡出", "实际击败立刻停用战斗对象，表现层独立快照；对象复用不改尸体；4秒连续实窗演示；关闭闪烁仍保留方向反馈"],
    ["再扩充近战/远程", "焚尘喷火器、雷索发射器、裂响拳刃、拾荒战镰；总计14远程＋6近战", "实际命中/灼烧/电链次数与衰减/墙体/近战八方向/购买/存档；配套独立枪体、反馈和声音；无新增专属进化蓝图"],
  ]), "", "## 行为与回归结果", "",
  table(["检查", "结果"], [
    ["原生回归", "9套通过；基础125,283次字段比较、164项定义；旧137项兼容合同保留"],
    ["旧战斗保留部分", "72场景、248检查点、154,069次字段比较；与上一轮相同，不把已经替换的12个旧刷怪场景算成数值完全一致"],
    ["生存与改件", `${native.reports["survival-builds"].checks}项；42种实际选择仍有真实状态变化，20件武器`],
    ["本轮美术/武器专项", `${test.checks}项；69张运行图全部解码、42独立插图、13枪体、8倒地图集；既有4件上轮武器逐字段保持`],
    ["组合根/输入音频/存档工具", "12 / 60 / 10项；30项音频实际解码，隔离存档"],
    ["地图与UI", `58 / 155项；菜单24布局${report.ui.menuActions}个动作、战斗28布局${report.ui.battleActions}个动作；旧点击矩形继续核对`],
    ["原版工程", "npm run check通过，331测试、原版模拟和素材/版本审计；不代表新武器平衡已验收"],
  ]), "", "商店前/后页使用语义身份比较，分别核对两颗按钮的矩形，并明确第一页上一页目标为第4页、下一页目标为第2页。避免原参考两按钮都叫shopPage:1时被Map覆盖、漏查上一页。没有跳过旧按钮的矩形检查。原版战斗比较中上一轮已经说明的榴弹/锯盘超频修复投影继续保留，本轮没有新增为了过测而豁免的旧战斗字段。",
  "", "## 新武器初始数值", "", table(["武器", "伤害/间隔", "范围与机制", "形象与反馈"], [
    ["焚尘喷火器", "3 / 0.10秒", "锁定225；穿透2次；1.2秒灼烧，每0.4秒3基础伤害；重复刷新不无限叠层", "燃料罐/隔热喷口，橙色火舌和嘶流声；无普通抛壳"],
    ["雷索发射器", "18 / 0.66秒", "锁定460；初始命中＋最多2跳，每跳145距离/65%伤害；不穿墙、不自递归", "双电极、青蓝弹体及连接电弧，短电流声"],
    ["裂响拳刃", "11 / 0.28秒", "74范围/38°刺击；0.04秒前摇；无剑气，不消弹", "短刃/护指，快速前伸收回和短促刃风"],
    ["拾荒战镰", "33 / 0.90秒", "116范围/205°宽扫；0.22秒前摇；无剑气，仅有效段消弹", "长柄钩刃、宽弧刃迹和较重挥动声"],
  ]), "", "新武器均可在地图交易站武器库第3/4页购买；永久商店购入后可作起始武器。按现有规则升阶、校准和积累通用熟练度。灼烧/电链保留所属武器的伤害与击败统计；灼烧伤害可随伤害改件成长，派生伤害不伪造额外开火数。新数值是本项目样板，不是竞品原始系数。",
  "", "## 美术成本与表现限制", "",
  `- 69张新运行图＋5音效，共${(art.runtimeBytes / 1048576).toFixed(2)}MiB原始运行文件；7张生成原稿留在art，不进入Godot运行树。`,
  `- 全部新运行图RGBA像素数据合计${test.decodedArtBytes.toLocaleString("en-US")}字节，约${(test.decodedArtBytes / 1048576).toFixed(2)}MiB。它不含GPU、驱动和导入缓存开销，不是实际整机内存读数。`,
  "- 缓存按路径共享，菜单不提前解码全部42张插图；保持60Hz规则，无全局停帧。普通尸体约3秒、Boss约4.2秒；死亡时碰撞/攻击/锁敌立即取消。",
  "- 普通/自动画质最多40尸体、112短命中簇；低画质减半为20/56。暂停、升级和交易按模拟时间冻结，过期清理。表现随机使用独立哈希，不消耗掉落/刷怪随机序列。",
  "- 画面已作实窗目视，审美仍待本人确认。最低配置、实体手柄、系统DPI、长局内存和满负荷帧时间未取得本轮认证。",
  "", "## 研究与素材来源", "", "调研与边界见[设计计划](../design/fieldcraft-combat-art-plan.md)。Brotato公开社区资料可核对击退、燃烧与派生攻击分类；未取得可靠的两款参考游戏受击/死亡逐帧内部实现，因此本轮倒地时长和四阶段设计为项目原创，不冒称照搬原作。补充定向检索未提供足够可靠的死亡帧证据，没有采用无来源的0.1秒/若干帧结论。",
  "", "本轮使用内置image_gen制作位图；源图、完整提示词和SHA见art/combat/fieldcraft-v2。Godot工具只裁切、分析透明边缘并最近邻缩放。枪体/手/袖口分离；卡牌文字与真实属性由原生UI绘制；缺图保留操作与兜底。未复制竞品素材或声音。",
  "", "## Windows包与本人体验", "", pack ? `从干净源码${pack.sourceCommit}构建；${(pack.bytes / 1048576).toFixed(2)}MiB；SHA256：${pack.sha256}。独立包已核对3地图、4地图图集、59原登记图片、69本轮贴图、30音频及20武器。` : "独立Windows包待本轮源码提交后重建；旧exe暂不能代表本轮。",
  "", "入口：output/godot-migration/windows/WastelandEcho.exe。画面与倒地视频：output/fieldcraft-v2/review.html。全部截图/视频与生成缓存留output；源图、运行图、来源、代码和摘要入Git。本轮不修改真实用户存档。",
  "", "建议本人先体验一次四卡选择、第一张卡悬停、换三类简化武器与两种新近战，再在密集尸潮中判断倒地残留是否过长。下一步先收敛卡面阅读与枪械握点，再按相同地图/相近构筑比较新武器收益；不继续无边界增加武器或重画已认可地图。", ""];
write("docs/qa/fieldcraft-validation.md", md.join("\n"));
const figure = (name, label) => `<figure><a href="review/${name}"><img src="review/${name}" loading="lazy" alt="${label}"></a><figcaption>${label}</figcaption></figure>`;
const weaponBlocks = design.weapons.map(w => `<article><h3>${w.name}</h3><p>${w.description}</p>${figure(`attack-${w.id}.png`, "实际游戏窗口攻击截图；不是动画视频")}<audio controls preload="none" src="../../godot/assets/audio/fieldcraft-v2/${w.id}.wav"></audio></article>`).join("");
write("output/fieldcraft-v2/review.html", `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>荒原回响 · 战地工坊</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#151c18;color:#e8ddbc;font:16px/1.7 "Microsoft YaHei",sans-serif}main{max-width:1320px;margin:auto;padding:40px 24px}h1{font-size:36px;line-height:1.25}h2{margin-top:52px;color:#dab772}h3{margin-top:0}p,figcaption{color:#b8bea9}a{color:#e3bf7c}img,video{width:100%;display:block;border:1px solid #46503d}video{background:#080e0b}figure{margin:0}figcaption{font-size:14px;margin:9px 0 20px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{padding:20px;background:#222b23;border:1px solid #46503d}audio{width:100%}.tag{font-size:14px;color:#d4ab65}summary{cursor:pointer;color:#e3bf7c;padding:14px 0}details[open] summary{margin-bottom:14px}@media(max-width:780px){.grid{grid-template-columns:1fr}h1{font-size:28px}}
</style><main><p class="tag">2026-10-31 · 原生内部试玩 · 42种改件插图 / 20件武器</p><h1>战地工坊：实体改件与更完整的战斗反馈</h1><p><a href="../godot-migration/windows/WastelandEcho.exe">打开最新版Windows游戏</a> · <a href="../../docs/qa/fieldcraft-validation.md">完整核验与边界</a> · <a href="../../docs/design/fieldcraft-combat-art-plan.md">设计与研究</a></p>
<h2>卡牌：独立插图、实体材质与可读数值</h2><div class="grid">${figure("before-upgrade.png", "你提供的旧版截图；本地对照，不是逐像素同帧比较")}${figure("upgrade-final-720.png", "本轮实际窗口：独立物件与新的正文区域")}</div>${figure("upgrade-first-hover.png", "真实鼠标事件：第一张卡的悬停抬升与焦点反馈")}
<details><summary>展开42项改件的完整卡面合集</summary><p>为检查所有插图和文字，这些截图由隔离测试入口逐组展示全部定义；正常候选仍受武器和解锁条件约束。</p><div class="grid">${Array.from({length:11},(_,i)=>figure(`card-gallery-${String(i).padStart(2,"0")}.png`, `卡面检查 ${i+1}/11`)).join("")}</div></details>
<h2>受击 → 失衡 → 倒地 → 短暂残留</h2><p>以下为实际游戏渲染的4秒连续画面。隔离测试场景按固定时刻触发伤害，便于比较八类敌人；不作为真人战斗录像或性能基准。视频无声。</p><video controls autoplay muted loop playsinline preload="metadata" poster="review/death-24.png"><source src="review/death-review.mp4" type="video/mp4"></video><p>尸体不再攻击或阻挡；普通约3秒、Boss约4.2秒，低画质减半表现数量上限。</p>
<h2>13件枪体与八方向持握</h2><p>细化原有9件简化武器，新增4件。已认可7枪保留；枪体、人物手型与服饰袖口继续独立。</p><div class="grid">${[0,1,2,3].map(i=>figure(`grips-${i}.png`, `持握检查 ${i+1}/4：实际原生角色绘制`)).join("")}</div>
<h2>四件新武器：匹配攻击特点</h2><div class="grid">${weaponBlocks}</div>
<h2>交易站：新远程在第3页，新近战在第4页</h2><div class="grid">${figure("field-2-720.png", "武器库第3页")}${figure("field-3-540.png", "武器库第4页，960×540小窗口")}</div><p>永久商店购入后也可作起始武器；本轮不增加专属进化蓝图。数值为初始调参，仍需本人比较手感和平衡。</p>
<h2>验证与体积</h2><p>9套原生回归、${native.reports["survival-builds"].checks}项改件/生存检查与${test.checks}项本轮专项通过；331项旧版工程测试通过。69张运行图加5音效共${(art.runtimeBytes/1048576).toFixed(2)}MiB文件，新增图像RGBA像素约6.60MiB；不是整机内存实测。未修改真实存档，低配、实体手柄、DPI和长局仍待验收。</p></main></html>`);
console.log(JSON.stringify({ status: report.status, tests: test.checks, bitmaps: art.bitmapFiles, weapons: 20, package: !!pack }));
