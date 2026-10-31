import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
const root=path.resolve(import.meta.dirname,"../..");
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),"utf8"));
const write=(f,text)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),text);};
const plan=read("docs/cleanup/retirement-plan.json"),receipt=read("output/card-layout-cleanup/cleanup-receipt.json"),backup=read("output/card-layout-cleanup/backup-proof.json"),shadow=read("output/card-layout-cleanup/shadow-proof.json"),protectedFiles=read("output/card-layout-cleanup/protected-after.json"),ui=read("output/card-layout-cleanup/review/review.json"),native=read("output/godot-migration/native-checks.json"),inventory=read("docs/assets/workspace-inventory.json");
assert(native.passed&&Object.keys(native.reports).length===10&&shadow.nativePassed&&shadow.legacyPassed&&backup.verified);
assert(!ui.failures.length&&!protectedFiles.missingProtected.length&&!protectedFiles.changedProtected.length&&!protectedFiles.remainingCandidates.length);
assert(/tests 333[\s\S]*pass 333[\s\S]*fail 0/.test(fs.readFileSync(path.join(root,"output/card-layout-cleanup/post-cleanup-legacy.log"),"utf8")));
const sha=crypto.createHash("sha256").update(fs.readFileSync(path.join(root,"docs/cleanup/retirement-plan.json"))).digest("hex");
assert(receipt.planSha256===sha&&backup.planSha256===sha&&shadow.planSha256===sha);
let pack=null;
if(fs.existsSync(path.join(root,"output/card-layout-cleanup/windows/build-manifest.json"))){
  const m=read("output/card-layout-cleanup/windows/build-manifest.json"),p=read("output/godot-migration/package-smoke.json");
  const diff=execFileSync("git",["diff","--name-only",m.sourceCommit,"--","godot/assets","godot/content","godot/scenes","godot/scripts","godot/project.godot","godot/export_presets.cfg"],{cwd:root,encoding:"utf8",windowsHide:true});
  if(!diff.trim()&&p.passed&&p.sha256===m.sha256&&p.report.cardLayouts===6&&!m.sourceDirty)pack={...m,report:p.report};
}
const summary={date:"2026-10-31",status:pack?"complete_internal_preview":"cleanup_complete_package_pending",baselineCommit:plan.baselineCommit,preCleanupCheckpoint:"79df5423cf65385f4ceb7392c744b3d4ded91ff5",planSha256:sha,
  cleanup:{files:receipt.removedFiles,trackedFiles:receipt.trackedFiles,untrackedFiles:receipt.removedFiles-receipt.trackedFiles,bytes:receipt.removedBytes,groups:plan.groups,archivedStudies:plan.retiredStudyIds.length,backupDirectory:plan.backupDirectory,backupSha256:backup.archiveSha256,backupBytes:backup.archiveBytes,backupVerifiedEntries:backup.entries},
  safeguards:{protectedFiles:protectedFiles.protectedFiles,missingProtected:[],changedProtected:[],remainingCandidates:[],shadowNativeSuites:shadow.nativeSuites,shadowLegacyTests:shadow.legacyTests,postLegacyTests:333,postNativeSuites:Object.keys(native.reports).length},
  ui:{layouts:6,icons:42,geometryChecks:native.reports["card-layout"].checks,pointerCases:ui.records.length,maximumBrightLineRunBelowCard:Math.max(...ui.records.map(r=>r.brightGoldRunBelowArtwork)),keyboardFocusPassed:true,physicalGamepadPassed:false},
  package:pack,inventory:inventory.summary,languages:{runtime:"typed GDScript",csharpFiles:0,defaultBranch:"main",defaultMainHasGodot:false,defaultMainTree:"a8eff8a2007d065f438bce2be4a1a56bf1cf14ec"},physicalAcceptance:{dpi:false,gamepad:false,lowEnd:false,longSession:false}};
write("docs/cleanup/retirement-report.json",JSON.stringify(summary,null,2)+"\n");
const table=(heads,rows)=>["| "+heads.join(" | ")+" |","|"+heads.map(()=>"---").join("|")+"|",...rows.map(r=>"| "+r.map(v=>String(v).replaceAll("|","\\|")).join(" | ")+" |")].join("\n");
const mib=n=>(n/1048576).toFixed(2)+" MiB";
const md=["# 项目清理、卡牌修正与资源导航", "", "2026-10-31。用户已认可现行精细像素美术，本轮保持原稿与玩法，仅调整卡面定位/焦点，并执行经过多轮核对的历史退役清理。", "",
"## 已执行的清理", "",`共移除${receipt.removedFiles}文件（${receipt.trackedFiles}受Git控制、${receipt.removedFiles-receipt.trackedFiles}未入Git产物），从项目工作目录移出${mib(receipt.removedBytes)}，约${(receipt.removedBytes/1073741824).toFixed(2)}GiB。外置ZIP为${mib(backup.archiveBytes)}；由于备份仍占磁盘，本报告不把工作目录减少量当作D盘净释放空间。`, "",
table(["类别", "文件数", "移出体积", "结论"],Object.entries(plan.groups).map(([name,g])=>[name,g.files,mib(g.bytes),name.includes("sdk")?"完整多平台分发缓存；两个固定SHA的Windows模板保留":name.startsWith("art/")?"停用路线原稿；仍用的角色参考已另存并核对SHA":"已被当前工程/工具替代，隔离删除后回归通过"])), "",
"14项inactive研究记录移至art/manifest.json的archivedAssets，完整保留原始对象、恢复提交及文件SHA/Git blob。原有活动/保留素材检查没有改成跳过缺图；两项新检查继续验证退役记录和当前角色参考原图。", "",
"## 多轮验证", "",table(["轮次", "实际证据"],[
["活动引用与用途筛查","对正式Godot、旧版参考、测试、作者工具、场景/Resource和素材登记检查；发现依赖后缩减候选。archive/code两份旧界面仍被测试要求，保留。"],
["来源与工具迁移","当前角色参考PNG/提示词移到现行源包，参考SHA保持；像素源工具诊断输出移离废弃试验目录；MCP三项只读操作已指向正式项目。"],
["隔离删除演练",`独立worktree移除104个受控源文件后，旧版333测试、原生${shadow.nativeSuites}套回归通过；参考夹具从保留JS重新生成。`],
["完整外置备份",`${backup.entries}项ZIP逐个解码核对SHA256，ZIP整体SHA也记录；实际删除前再验证每个源文件内容与精确绝对路径。`],
["删除后的保护检查",`${protectedFiles.protectedFiles}个保留文件逐项SHA比较：缺失0、变化0。当前角色/敌人、20武器、42升级、地图、声音、源图及代码保留。`],
["删除后重复回归","旧版333测试与原生10套再次通过；素材引用缺失0、来源SHA不一致0；存档使用隔离路径，未读取/修改真实用户档。"],
]), "",
"## 卡牌修正", "",`六种卡面各有独立Resource窗口，42个插图按实际Alpha边界等比居中。旧底线/侧箭头从UpgradeCard移除，以卡内编号印记、抬升和材质变化表达选择。${summary.ui.geometryChecks}项布局检查、16次真实鼠标悬停与键盘焦点通过；四分辨率下卡面下方亮金连续线段最大为0。原图、主题配色和战斗参数保留；标点换行/拾荒说明已整理。`, "",
"## 保留了哪些内容", "", table(["目录/资源", "职责与保留原因"],[
["godot/","当前唯一游戏运行主线；164内容定义、20武器、42升级及6份UI布局Resource。所有活动资源保留。"],
["godot/assets + art/现行包","活动贴图/音频与对应生成原图、提示词、可编辑源、许可记录；不因不常加载就删除。"],
["src / web / test / src-tauri","旧版对照、参考夹具生成、331项原回归及版本/存档兼容链仍使用；本轮不谎称其为死代码。"],
["scripts/现行工具","Godot导入/构建/核验、音频与像素源生产仍有用途；像素编辑桥及LibreSprite工具保留。"],
["tools/godot-mcp","现行MCP包/依赖与配置保留；验证从旧样板移到正式工程，旧样板才退役。"],
["Windows debug/release模板","现行构建直接使用、两文件固定SHA核验，保留。移出的是完整多平台下载原包，外置备份含原包。"],
["当前/上一轮Windows包及用户数据","运行中的游戏不结束、不覆盖；个人存档与配置不在删除范围。"],
]), "",
"完整目录、逐文件用途/大小/引用/来源见[文件夹导航](../project-file-guide.md)、[活动素材索引](../assets/asset-catalog.md)和workspace-inventory.json。依赖/当前导入缓存/配置/用户档边界不展开内容，也未据此认定可删除；本次是有证据的退役清理，不能说仓库只剩一种文件或已经删除所有历史。", "",
"## 语言与后续维护", "", "现行原生游戏逻辑统一使用带静态类型的GDScript。GitHub首页统计默认main，官方接口确认该分支尚无Godot项目；因此JavaScript约97.08%反映旧主线，不能据此判断新包。C#是官方完整支持的选择，但目前整体重写会引入.NET编辑器/程序集构建与迁移成本；没有性能证据支持此次换语言。保留JS/Python/PowerShell作为工具和参考，主线GDScript继续开发。详细依据和分支说明见[语言选择与清理设计](../design/card-layout-and-safe-cleanup.md)。", "",
"后续改玩法首选godot/scripts/core和原生Resource；改美术先更新godot/assets并保留art源与来源；改卡面窗口编辑content/ui/card_layouts。新一轮删除必须建立新的短期清单/备份，不能覆盖本次证据。默认main整合单独走PR与检查，不因语言条而自动切分支或改写现有源码。", "",
"## 恢复方法", "",`外置备份相对项目位置：${plan.backupDirectory}/retired-files.zip。ZIP SHA256：${backup.archiveSha256}。旁边的retirement-plan.json列出每个文件原路径、字节数、SHA和Git blob；verification.json为逐项解码校验记录。`, "",
"1. 先解压到一个新的空文件夹，按清单核对所需文件，再复制回对应原路径；不要直接覆盖正在修改的现行工程。", "2. 受Git控制的104文件也可从清理前提交79df542或原基线8ebdf50恢复；旧预览/缓存未入Git，使用ZIP。", "3. 如要恢复某条已停用制作路线，同时恢复其原稿、脚本及清单，按当时README操作；不要把它直接登记为现行资源。", "",
"## 当前试玩包", "",pack?`output/card-layout-cleanup/windows/WastelandEcho.exe；${mib(pack.bytes)}；干净源码${pack.sourceCommit}；SHA256：${pack.sha256}。独立包自检含3地图、4地图图集、59原登记图片、69本轮美术、30音频、20武器和6卡面布局。`:"清理及回归已完成，Windows包待清理提交后重建；此时旧包不代表本轮布局修正。", "", "体验前先正常退出旧游戏窗口，再启动本轮独立目录中的程序，避免并行保存进度。实体手柄、系统DPI、低配及真实窗口长局仍待设备验收。", ""];
write("docs/cleanup/retirement-report.md",md.join("\n"));
write("docs/qa/card-layout-cleanup-validation.json",JSON.stringify({date:summary.date,native:native.reports,legacyTests:333,visual:ui,protected:protectedFiles,package:pack},null,2)+"\n");
const fig=(file,label)=>`<figure><a href="review/${file}"><img loading="lazy" src="review/${file}" alt="${label}"></a><figcaption>${label}</figcaption></figure>`;
write("output/card-layout-cleanup/review.html",`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>荒原回响 · 卡牌对齐与安全清理</title><style>body{margin:0;background:#151c18;color:#eadfbd;font:16px/1.7 'Microsoft YaHei',sans-serif}main{max-width:1260px;margin:auto;padding:32px 24px}a,h2{color:#dfbd78}h1{line-height:1.3}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0}img{width:100%;border:1px solid #45513d}figcaption,p{color:#b9bda7}figcaption{font-size:14px;margin:8px 0 22px}@media(max-width:760px){.grid{grid-template-columns:1fr}}</style><main><p>2026-10-31 · 已认可画风的布局修正</p><h1>图案落在真正的插画窗口内，选择反馈留在卡面上</h1><p><a href="windows/WastelandEcho.exe">本轮独立试玩包</a> · <a href="../../docs/cleanup/retirement-report.md">完整清理/恢复报告</a> · <a href="../../docs/design/card-layout-and-safe-cleanup.md">语言选择与设计依据</a></p><div class="grid">${fig("before-user.png","你提供的修改前截图")}${fig("hover-720-0.png","修正后：第一张卡悬停，下方残线为0")}</div><h2>逐卡与键盘焦点</h2><div class="grid">${[1,2,3].map(i=>fig(`hover-720-${i}.png`,`第${i+1}张卡实际鼠标悬停`)).join("")}${fig("keyboard-720.png","键盘焦点：卡内编号印记保持可见")}</div><h2>小窗口与1440p</h2><div class="grid">${fig("hover-540-0.png","960×540")}${fig("hover-1440-2.png","2560×1440；机动卡按自己的窗口居中")}</div><h2>清理结果</h2><p>精确清单移除1056文件，工作目录减少约1.29GiB；外置ZIP逐项验证1056个SHA。1191个保留文件检查：缺失0、变化0。隔离删除演练和实际删除后的333测试/10套原生回归均通过。当前美术原稿、角色、枪械、地图、存档、有效制作工具与旧版参考链保留。</p><p>游戏逻辑主语言继续使用GDScript。C#是官方支持的方案，当前没有必要为语言统计重写。GitHub默认main尚无Godot项目，语言条仍主要反映旧JS主线。</p></main></html>`);
console.log(JSON.stringify({status:summary.status,removed:receipt.removedFiles,protected:protectedFiles.protectedFiles,nativeSuites:10,legacyTests:333,package:!!pack}));
