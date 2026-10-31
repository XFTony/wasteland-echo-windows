# 游戏文件夹导航与整理规则

本索引整理用途、权威目录和修改入口，没有移动、删除或批量改名已有文件。全路径/大小/追踪状态见 `docs/assets/workspace-inventory.json`，活动素材见 `docs/assets/asset-catalog.md`。

## 一级目录

| 目录/文件 | 职责 | 本次测得体积 | 保存规则 |
|---|---|---:|---|
| `.codex` | 本机协作配置：项目MCP等本机设置，不读取配置内容 | 至少 0.00 MiB（含未枚举边界） | 遵循现有ignore，不公开个人配置 |
| `.git` | Git内部数据库：仅读取Git自身聚合统计，不枚举对象内容 | 至少 0.00 MiB（含未枚举边界） | 不当作普通目录整理 |
| `.gitattributes` | Git文件规范：规定源码换行及图片/音频的二进制保存方式 | 0.00 MiB | 提交；原生文本保持LF |
| `.github` | 远端CI：质量与原生Godot回归工作流 | 0.00 MiB | 提交；不包含密钥 |
| `.gitignore` | Git排除规则：隔离输出、依赖、引擎缓存和本机配置 | 0.00 MiB | 提交；不屏蔽活动素材或UID |
| `CHANGELOG.md` | 版本变更记录：已发布/开发中内容及兼容变更 | 0.01 MiB | 提交；内部备份不冒充正式Release |
| `CREDITS.md` | 署名与许可入口：原创、生成素材、第三方音频/字体/引擎的来源边界 | 0.01 MiB | 新增素材时与台账同步 |
| `Godot存档导入与备份.cmd` | 本机启动入口：开发版、旧版或存档工具的便捷启动脚本，按脚本名称区分 | 0.00 MiB | 保留稳定入口；独立包按README最新迭代目录启动 |
| `README.md` | 项目入口说明：标明当前原生版入口、历史版本与主要文档 | 0.02 MiB | 随开发主线更新，避免指向旧包 |
| `archive` | 历史归档：停用版本和历史说明 | 26.08 MiB | 按原归档规则保留，不默认删除 |
| `art` | 美术/音频可编辑源与设计历史：原图、分层、原采样、生成记录及历史动作研究 | 247.21 MiB | 源与来源记录提交；历史不等于活动素材 |
| `dist` | 可再生输出/本地构建：截图、录屏、包、SDK模板、QA产物 | 7.32 MiB | 不进Git；确认来源和可重建方法后才考虑清理 |
| `docs` | 设计/验收/来源文档：规范、计划、评审、许可、QA摘要 | 6.32 MiB | 提交可长期参考的文档，避免完整重复截图 |
| `experiments` | 隔离技术样板：历史Godot可行性等实验 | 至少 1.18 MiB（含未枚举边界） | 不是正式游戏入口 |
| `godot` | 原生活动项目：后续运行代码、场景、Resource和活动素材的开发主目录 | 至少 24.14 MiB（含未枚举边界） | 提交源码/素材/UID/import设置；忽略.godot和builds |
| `node_modules` | 可重装依赖：根开发依赖目录，不枚举内部 | 至少 0.00 MiB（含未枚举边界） | 不进Git；由lockfile恢复 |
| `output` | 可再生输出/本地构建：截图、录屏、包、SDK模板、QA产物 | 至少 2898.60 MiB（含未枚举边界） | 不进Git；确认来源和可重建方法后才考虑清理 |
| `package-lock.json` | 开发依赖与版本：旧版工具、迁移对照及构建脚本的Node依赖 | 0.00 MiB | 锁文件提交；不等于原生游戏运行依赖 |
| `package.json` | 开发依赖与版本：旧版工具、迁移对照及构建脚本的Node依赖 | 0.00 MiB | 锁文件提交；不等于原生游戏运行依赖 |
| `release` | 可再生输出/本地构建：截图、录屏、包、SDK模板、QA产物 | 26.13 MiB | 不进Git；确认来源和可重建方法后才考虑清理 |
| `scripts` | 开发与验收工具：导出、素材制作、构建、检查脚本 | 1.12 MiB | 提交工具，不把开发工具依赖带入运行包 |
| `src` | 旧版对照与回退：保留Canvas/Tauri实现、原始内容注册和对应素材 | 0.75 MiB | 迁移阶段保留，不与原生目录双改 |
| `src-tauri` | 旧版对照与回退：保留Canvas/Tauri实现、原始内容注册和对应素材 | 至少 0.56 MiB（含未枚举边界） | 迁移阶段保留，不与原生目录双改 |
| `test` | 旧版确定性回归：原JS规则与渲染合同测试 | 0.26 MiB | 提交并保留回退检查 |
| `tools` | 本地工具配置：固定版本Godot MCP及配套说明 | 至少 0.02 MiB（含未枚举边界） | 提交版本锁和配置样例；忽略node_modules |
| `wasteland-survivor-windows-game-spec.md` | 规格文档：平台与历史玩法规格，原生改造以迁移计划及当前Resource为准 | 0.01 MiB | 提交；历史决定不能覆盖已确认的新玩法 |
| `web` | 旧版对照与回退：保留Canvas/Tauri实现、原始内容注册和对应素材 | 13.74 MiB | 迁移阶段保留，不与原生目录双改 |
| `启动Godot开发版.cmd` | 本机启动入口：开发版、旧版或存档工具的便捷启动脚本，按脚本名称区分 | 0.00 MiB | 保留稳定入口；独立包按README最新迭代目录启动 |

依赖/缓存/配置/存档边界不枚举内容；其完整大小未测，不能把“已测文件为0”理解为目录为空。Git只读取自身计数汇总，不打开对象内容。一级体积为所枚举文件的统计，不是磁盘占用/硬链接/Git压缩后的大小。

## 按任务找文件

| 要修改的内容 | 首选入口 | 对照/验证 |
|---|---|---|
| 地图布局/实体碰撞 | godot/scenes/maps + scripts/world/map_scene.gd / map_obstacle.gd | 地图Resource、流场与场景交互检查 |
| 地图素材/地表/道具 | godot/assets/world；源文件art/world或art/generated | 本轮地图美术规范、素材来源与截图 |
| 主角/敌人/枪械表现 | godot/assets/actors + scripts/presentation | 原生图集、独立手/袖口、握点及动作核对 |
| 玩法/武器/敌人/成长 | godot/content + scripts/core | 原生对照测试，变化须说明数值与兼容影响 |
| UI/焦点/升级卡 | godot/scripts/ui | 四分辨率区域与实际截图 |
| 声音与音乐 | godot/assets/audio + scripts/presentation/native_audio.gd | art/audio来源/许可；实际听感 |
| 存档与导入 | godot/scripts/persistence + scenes/tools/save_transfer.tscn | 隔离存档测试，不直接改真实用户档 |
| 打包与Git验证 | scripts/godot、.github/workflows、docs/versioning-and-release.md | 构建manifest/SHA及CI |

## 已明确的历史材料

- 可编辑美术源共 60 份，详细路径在JSON；.blend均不在活动原生素材树。
- art/animation/ranger保留Blender灰模/IK/持枪研究，其README明确未作为成品接入；保留研究证据，不在本轮重做角色动画。
- art/characters和output/animation保存此前精细像素/动作样板；现有compact-v1活动图集另有明确登记，不按目录年代推断它们互相可替代。
- experiments/godot-pilot是历史可行性样板，正式入口为godot/project.godot。

## 后续整理的先后顺序

1. 每轮改动先更新活动引用与来源，再运行索引；让当前原生目录与回退基准保持职责清楚。
2. 把新素材原图/运行图/处理脚本登记成一个工作包，采用稳定文件名，避免final2/final3散落。
3. 先核对未注册与缺失引用，不因精确重复就删旧版对照或原稿。
4. 对output/dist/release另按具体构建批次列可清理清单；SDK模板可再下载，不纳入源码。
5. 真正清理时重新核验绝对路径、用途和Git状态，归档与功能改动分开提交。

## 重建索引

```powershell
node scripts/assets/audit-workspace.mjs
```

脚本只读取项目目录，生成上述三个索引文件；不跟随链接、不读取用户档内容、不修改资源路径，不把本身生成的索引重复计入下次统计。
