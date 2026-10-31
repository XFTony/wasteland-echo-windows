import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const write = (file, value) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), value);
};
const design = read("art/combat/survival-builds-v1/design.json");
const source = read("godot/data/content_source.json");
const checks = read("output/godot-migration/native-checks.json");
const behavior = read("output/survival-builds/behavior.json");
const legacyCheck = process.argv.includes("--legacy-check-passed")
  ? { command: "npm run check", exitCode: 0, tests: 331, scope: "Original Canvas/Tauri baseline; not new Godot balance acceptance" }
  : null;
assert(checks.passed && !behavior.failures.length);
assert.equal(behavior.selections.length, 42);
assert(behavior.selections.every(row => row.selected && row.stateChanged));
const opening = Object.fromEntries(["legacy", "native", "legacy-build", "native-build"].map(name =>
  [name, read(`output/survival-builds/opening-${name}.json`).reports]));
const ui = read("output/godot-migration/ui-region-comparison.json");
const battle = read("output/godot-migration/battle-region-comparison.json");
const weaponDefinitions = { ...source.catalogs.weapons, ...Object.fromEntries(design.weapons.map(w => [w.id, w])) };
const definitions = { ...source.catalogs.upgrades, ...Object.fromEntries(design.upgrades.map(w => [w.id, w])) };
const special = {
  projectile: "12件远程×8方向：真实发射数量增加、普通多弹角度分离；近战不出卡",
  damage: "16件武器的实际攻击载荷增伤",
  fireRate: "实际射击冷却缩短；近战达到动作上限后过滤基础攻速卡",
  pierce: "对齐目标实弹穿过并多命中一敌；爆破/弹射/近战过滤",
  velocity: "普通弹实测速率及寿命增加；射线只显示范围收益",
  caliber: "真实弹体半径和击退载荷增加",
  critical: "原34项算术回归；额外检查高暴击值不会被基础改件压低",
  armor: "真实受击由10降至9.2；额外检查高护甲不会被基础改件压低",
  magnet: "原半径外的拾取物实际开始吸附",
  recovery: "未满4秒不回复，超过4秒实际回复",
  scavenger: "五枚普通币在20%收益下共得到6币，小数跨币累计",
  executionCapacitor: "十次真实击败蓄能；下次攻击增伤/穿透并消耗蓄能",
  reactivePlating: "真实受击触发近身伤害与冷却",
  salvageOverdrive: "真实拾取触发超频；普通弹/榴弹/锯盘实际弹速增加",
  focusProtocol: "4秒前不强制暴击，4秒后实际必暴击；榴弹/锯盘强化标记",
  cascadeRounds: "真实暴击向附近目标传伤",
  critDamage: "真实暴击攻击载荷应用新增暴伤倍率",
  killMend: "十二次真实击败回复1生命",
  meleeTempo: "近战实际伤害与冷却均改善",
  ricochetCoil: "锯盘载荷实际增加一次弹射",
  chillAmplifier: "普通敌人减速截止时间实际延长",
  blastFocus: "真实爆炸攻击载荷的半径与伤害提高",
  fieldRush: "实际位移增加；攻速状态随选择改变",
  pressureBarrel: "真实多弹夹角减小、弹体寿命增加",
};
const audit = behavior.selections.map(row => ({ ...row,
  detail: definitions[row.id].detail,
  coverage: special[row.id] || "实际选择及状态变化；原34项算术/旧战斗回归覆盖，未新增该项独立实战夹具",
}));
const packagePath = "output/godot-migration/package-smoke.json";
const manifestPath = "output/godot-migration/windows/build-manifest.json";
let packageReport = null;
if (fs.existsSync(path.join(root, packagePath)) && fs.existsSync(path.join(root, manifestPath))) {
  const candidate = read(packagePath), manifest = read(manifestPath);
  if (candidate.passed && candidate.report.weapons === 16 && candidate.sha256 === manifest.sha256 && candidate.sourceCommit === manifest.sourceCommit) {
    assert(!manifest.sourceDirty);
    packageReport = { ...candidate, bytes: manifest.bytes, version: manifest.version };
  }
}
const evidenceFiles = ["godot/content/game_catalog.tres", "godot/scripts/core/survival_rules.gd",
  "godot/scripts/core/weapon_rules.gd", "godot/scripts/core/upgrade_rules.gd",
  "godot/scripts/core/upgrade_draft_system.gd", "godot/scripts/core/workshop_rules.gd",
  "godot/scripts/core/weapon_actions.gd", "godot/scripts/core/combat_system.gd",
  "godot/tests/survival_builds_test.gd"];
const evidenceHashes = Object.fromEntries(evidenceFiles.map(file => [file,
  createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
const report = { date: "2026-10-31", status: packageReport ? "internal_preview_ready_for_human_balance_review" : "package_pending",
  version: "1.5.0-alpha.1", definitions: 154, weapons: 16, upgrades: 42,
  suites: checks.reports, legacyCheck, audit, opening, package: packageReport, evidenceHashes,
  ui: { menuLayouts: ui.results.length, menuActions: ui.results.reduce((n, r) => n + r.actions, 0),
    battleLayouts: battle.results.length, battleActions: battle.results.reduce((n, r) => n + r.actions, 0) },
  humanAcceptance: { difficulty: false, physicalGamepad: false, lowEndHardware: false, dpiMatrix: false, longRenderedSession: false } };
write("docs/qa/survival-builds-validation.json", JSON.stringify(report, null, 2) + "\n");

const escape = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const table = (head, rows) => ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|",
  ...rows.map(row => "| " + row.map(escape).join(" | ") + " |")].join("\n");
const normal = opening["native-build"][0];
const evidence = packageReport ? `已从干净源码提交 \`${packageReport.sourceCommit}\` 重建并完成独立包自检；${(packageReport.bytes / 1048576).toFixed(2)} MiB，SHA256：\`${packageReport.sha256}\`。` : "Windows包尚待重建，旧exe暂不能作为本轮验收结果。";
const md = ["# 生存压力、42项改件与16件武器验证", "", "日期：2026-10-31。内部开发版本1.5.0-alpha.1；不创建新标签或Release。第一张地图的已认可美术保持，原Canvas/Tauri代码保留作对照，本轮规则与内容在Godot原生实现。", "",
  "## 可体验的变化", "", "- 开局生成间隔缩短，额外四只从安全距离进入；血量/伤害/移速成长公式保留。每45秒统计一轮连续尸潮，不增加强制波间休息。",
  "- 修复零散布多弹重叠、特殊武器遗漏通用改件参数、拾荒币逐枚舍入；修正文案、封顶候选与武器适用过滤。",
  "- 新增8项改件及4件武器。行装→战地改件查看档案；局内Esc→本局改件与属性查看真实当前值，返回仍停留在暂停。",
  "- 改件完成第1/2/3/4轮后永久解锁，取现有bestTime；旧档历史记录自动生效，无须重置。解锁代表进入满足条件的随机候选池，并非免费装配。",
  "", "## 自动验证", "", table(["检查", "结果与范围"], [
    ["基础规则", `${checks.reports.foundation.checks.toLocaleString("en-US")}次字段比较，154项定义；原137项内容与ID保留`],
    ["未变旧战斗", `${checks.reports.combat.cases}场景、${checks.reports.combat.checkpoints}检查点、${checks.reports.combat.checks.toLocaleString("en-US")}次字段比较`],
    ["本轮专项", `${behavior.checks}项通过；42项实际选择并检测属性/机制状态确实改变；16件武器`],
    ["组合根/音频/存档工具", `12 / 55 / 10项通过；25音频实际解码；隔离存档`],
    ["地图/交互UI", "58 / 155项通过；六菜单24布局208动作，战斗28布局196动作；旧按钮矩形继续严格对照"],
    ["原版工程", legacyCheck ? "npm run check通过：331项测试、模拟矩阵及素材/版本检查；不代表新原生规则的平衡认证" : "尚待运行npm run check"],
  ]), "",
  "旧战斗原有84场景中，12个三图不同时间的旧刷怪场景已由新压力测试取代，不能写成84场景全部数值一致。榴弹/锯盘两个机制联动场景的projectile.x/vx/empowered记录了旧分支遗漏超频的行为，对这三字段投影比较；新专项核验修复值。新增卡片preview与纠正文案不与旧显示字段逐字比较。其余旧场景字段继续严格对照。",
  "", "## 压力比较及限制", "", "参考《土豆兄弟》的阶段密度、波数成长和攻击形态，不照搬其波间购物。其普通敌100只是并发上限，不能当成每波实际出生总数；未取得可靠的逐波精确出生总量。资料与本项目分段曲线见[研究与设计](../design/survival-builds-arsenal-plan.md)。",
  "", "固定seed88、默认手枪、正常116生命、60秒上限、不购物。站桩/固定绕圈均非熟练玩家策略；拆解升级和选择构筑分开记录。新旧出生消耗随机数不同，不是严格单变量实验。", "",
  table(["第一图策略", "旧版", "本轮"], [
    ["站桩：平均视野敌数 / 峰值存活", "2.83 / 6", "15.45 / 36"],
    ["站桩：首次受伤 / 结束", "60秒内未受伤 / HP116", "29.35秒 / 40.25秒死亡"],
    ["固定绕圈、全拆解", "60秒HP116", "57.02秒死亡"],
    ["固定绕圈、正常选构筑", "60秒HP116、击败50", `60秒HP${normal.hp.toFixed(2)}、击败${normal.kills}`],
    ["正常构筑首次升级 / 首次受伤", "40.53秒 / 60秒内未受伤", `${normal.firstUpgrade.toFixed(2)}秒 / ${normal.firstHit.toFixed(2)}秒`],
  ]), "", "新曲线下其他两图的固定策略约25—44秒死亡；可能含固定路线撞障碍，不能当真人胜率或直接下结论为难度合理。正常构筑只补测了第一图。下一步本人先体验第一图的首分钟，再确认是否调软20—45秒密度；本轮不宣称平衡完成，也未取得低配帧率或内存趋势认证。",
  "", "## 42项逐项记录", "", "“状态改变”检查的是人物属性、机制等级、工程/维护与本局货币，排除了仅改变界面和装配记录的假成功。它不能代替每个组合的完整实战测试；下表单列新增的实际攻击/受击专项，其余有原版算术及旧战斗回归。",
  "", table(["ID / 名称", "轮次解锁", "实际选择/状态", "额外核验"], audit.map(row => [row.id + " / " + row.name, row.unlockWave || "原有条件", row.selected && row.stateChanged ? "通过" : "失败", row.coverage])),
  "", "## 武器数值与表现审查", "", "以下为无改件、无机制触发时的设计基础值；不能只用伤害÷间隔比较清群或控制收益。多弹、射线分流、霰弹近距、穿透/弹射、蓄力暴击和近战有效段另行计算。新武器已接入交易站第三页、永久商店、起始行装和通用精通；本轮没有新增四武器的专属进化蓝图。",
  "", table(["武器", "伤害 / 间隔秒", "基础弹数 / 穿透", "类型"], Object.values(weaponDefinitions).map(w => [w.name + " / " + w.id, `${w.damage} / ${w.interval}`, `${w.attackType === "slash" || w.attackType === "slam" ? "近战" : w.projectileCount} / ${w.pierce}`, w.attackType || "projectile"])),
  "", "- 连弩：28伤害、0.68秒、穿透2、锁定560；弩矢/张弦声，无普通枪焰与弹壳。第四次强化沿用四拍稳压。",
  "- 霜凝：11伤害、0.46秒、锁定430；普通减速30%持续1.2秒；Boss减速10%且持续时间减半。冷状态结束与对象池复用均清理，不能继承上个敌人的状态。",
  "- 长矛：28伤害、0.64秒、126范围、24°窄扇；前伸刺击，无剑气和默认消弹；修复上方/斜上方自动瞄准与近战攻击原点不一致。",
  "- 战斧：34伤害、0.86秒、88范围、145°宽弧；有前摇与收招，无远程剑气，仅有效段消弹。",
  "- 枪体、手型与袖口仍独立；四件×八方向32姿态与四张实战图已目视。新武器图形和改件图标沿用原生像素描述，不追加大型角色图集；四音效合计38,984字节，来源与SHA见art工作包manifest。",
  "", "## 包、来源与回退", "", evidence, "", "完整日志/截图在output/survival-builds；本地预览打开output/survival-builds/review.html。源码、Resource、import、uid、美术设计与音频源进入Git；exe、缓存和完整截图不进入源码历史。默认导入会整体保留已编辑Catalog，防止CI从旧夹具重建并丢失新增内容。",
  "", "本轮未修改真实用户存档。本人体验使用正常入口；自动化验证使用内存/隔离文件目录。回退使用旧分支或新增revert提交，不覆盖历史标签，不重置个人游戏记录。", "",
  "## 本人试玩顺序", "", "1. 先用默认手枪进入回声旧城，体验10秒/30秒/60秒的敌人压力、首次升级和回店机会。",
  "2. 选择‘分流枪机’后比较弹数；按Esc打开本局属性确认。用近战时该纯弹丸卡应不出现。",
  "3. 完成一轮后去行装档案核对解锁，正常结束/重开后应保留最高进度；同时确认卡池仍有武器与前置要求。",
  "4. 在交易站军械第三页比较连弩、寒霜、长矛、战斧；重点反馈矛的命中宽容、斧前摇、减速是否足以换位，以及声音是否合适。",
  "5. 最后再调整中后期数值；实体手柄、DPI、低配、长局和四武器熟练度全解锁仍需真实设备与完整游玩验收。", ""];
write("docs/qa/survival-builds-validation.md", md.join("\n"));

const htmlEscape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const figure = (file, caption) => `<figure><a href="review/${file}"><img src="review/${file}" loading="lazy" alt="${htmlEscape(caption)}"></a><figcaption>${htmlEscape(caption)}</figcaption></figure>`;
const weapons = design.weapons.map(w => `<article><h3>${htmlEscape(w.name)}</h3><p>${htmlEscape(w.description)}</p>${figure(`weapon-${w.id}.png`, "游戏实际攻击截图；非动画视频")}<audio controls preload="none" src="../../godot/assets/audio/survival-v2/${w.id}.wav"></audio></article>`).join("");
write("output/survival-builds/review.html", `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>荒原回响 · 生存与改件内部样板</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#141a17;color:#e8dbb8;font:16px/1.7 "Microsoft YaHei",sans-serif}main{max-width:1240px;margin:auto;padding:36px 24px}h1,h2,h3{line-height:1.3}h1{font-size:34px}h2{margin-top:48px;color:#e6b86c}p{color:#bcbba7}a{color:#e6b86c}figure{margin:0}img{width:100%;height:auto;display:block;border:1px solid #434937}figcaption{font-size:14px;color:#bcbba7;margin:8px 0 20px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{padding:20px;background:#222a22;border:1px solid #434937}audio{width:100%}.tag{color:#e6b86c;font-size:14px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;text-align:left;border-bottom:1px solid #434937}@media(max-width:720px){.grid{grid-template-columns:1fr}h1{font-size:27px}}
</style><main><p class="tag">2026-10-31 · 内部开发版 · 16件武器 / 42项改件</p><h1>更密集的尸潮，可核对的战地改件</h1><p>此页为真实窗口截图与原创短音效试听。当前Windows包：<a href="../godot-migration/windows/WastelandEcho.exe">WastelandEcho.exe</a>。难度仍待本人试玩；截图不代替完整游玩验收。</p><p><a href="../../docs/qa/survival-builds-validation.md">详细审计与验证边界</a> · <a href="../../docs/design/survival-builds-arsenal-plan.md">研究与设计</a></p>
<h2>子弹＋1：实际弹道对照</h2><div class="grid">${figure("one-bullet.png", "同一默认手枪：未装配额外弹丸")}${figure("two-bullets.png", "装配后：两条独立弹道，不再完全重叠")}</div>
<h2>新武器：独立轮廓、握点与攻击形态</h2>${figure("new-weapon-directions.png", "从上到下：连弩、霜凝、长矛、战斧；每件八方向，枪体/手/袖口独立")}<div class="grid">${weapons}</div>
<h2>改件档案与本局真实属性</h2><div class="grid">${figure("codex-locked-540.png", "行装→战地改件：新进度下的解锁轮次，960×540")}${figure("codex-unlocked-720.png", "有历史最高生存记录时直接解锁；仍需满足武器和前置条件")}</div>${figure("run-build-details.png", "Esc→本局改件与属性；返回先回暂停，不继续计时")}
<h2>第三页军械与商店</h2><div class="grid">${figure("field-new-weapons-720.png", "局内交易站军械第三页")}${figure("shop-new-weapons-540.png", "永久商店新武器；局外解锁后可选作起始武器")}</div>
<h2>第一图首分钟：正常生命与升级选择</h2><p>固定seed88、默认手枪、固定绕圈、不购物。按弹数/伤害等优先级正常选择升级；共击败106，60秒剩余37.16/116生命。该脚本会沿固定路线走，不能视为真人胜率。旧版相同策略60秒未受伤。</p><table><thead><tr><th>时间</th><th>同时存活敌人</th><th>累计击败</th><th>剩余生命</th></tr></thead><tbody>${normal.samples.map(s => `<tr><td>${Math.round(s.time)}秒</td><td>${s.enemies}</td><td>${s.kills}</td><td>${s.hp.toFixed(1)}</td></tr>`).join("")}</tbody></table><p>已通过8套原生回归与441项本轮专项；完整42项状态变化审计见上方文档。Windows显示缩放、实体手柄、低配和长局仍待验收。</p></main></html>`);
console.log(JSON.stringify({ status: report.status, auditedUpgrades: audit.length, checks: behavior.checks, package: !!packageReport,
  outputs: ["docs/qa/survival-builds-validation.md", "docs/qa/survival-builds-validation.json", "output/survival-builds/review.html"] }));
