# 荒原回响 · Wasteland Echo

Windows 桌面优先的俯视角废土生存射击 Roguelite。当前开发线为 v1.5.0-alpha.1，稳定发布基线为 v1.4.0。游戏运行时仍是零 JavaScript 依赖的 Canvas 2D + CommonJS；既可在 Edge、Chrome 中运行，也可构建 Tauri 2 + WebView2 便携版和 NSIS 安装版。

现行规格：[wasteland-survivor-windows-game-spec.md](./wasteland-survivor-windows-game-spec.md)  
架构说明：[docs/architecture.md](./docs/architecture.md)
组件目录与安全修改指南：[docs/component-catalog.md](./docs/component-catalog.md)
v1.5 路线图：[docs/optimization-roadmap-v1.5.md](./docs/optimization-roadmap-v1.5.md)
2026-09-23 全面复审与优先级计划：[docs/optimization-plan-2026-09-23.md](./docs/optimization-plan-2026-09-23.md)
v1.5 真人试玩记录表：[docs/playtest-v1.5-field-sheet.md](./docs/playtest-v1.5-field-sheet.md)
外部审查逐项复核：[docs/external-review-validation-2026-09-23.md](./docs/external-review-validation-2026-09-23.md)
Git 与版本发布规则：[docs/versioning-and-release.md](./docs/versioning-and-release.md)
玩家可见更新：[CHANGELOG.md](./CHANGELOG.md)
材料与冗余审计：[docs/project-material-audit-v1.5-alpha.md](./docs/project-material-audit-v1.5-alpha.md)
美术方向与界面规范：[docs/art-direction-v1.2-full-page-scenes.md](./docs/art-direction-v1.2-full-page-scenes.md)
美术材料库与版本清单：[art/README.md](./art/README.md)、[art/manifest.json](./art/manifest.json)

## 当前能力

- 键盘鼠标与标准 Gamepad API 手柄可随时热切换；移动、射击、暂停、全屏、重开、退出和升级直选支持持久化重绑定，冲突按键自动交换；
- 手柄支持双摇杆、RT/RB/X 射击、A 确认、B 返回、Menu 暂停、菜单导航和可选震动；
- 径向摇杆死区、断线清零和按钮边沿触发，避免漂移、卡键与菜单连跳；
- 所有菜单、升级卡、暂停和结算页面支持无鼠标操作与焦点高亮；
- 主菜单以原创主题图为整页背景，菜单叠加在渐变阅读区上；作战部署只负责章节、模式和地图，人物、枪械、服饰与头盔/身甲/腿甲/靴子集中在独立“行装与背包”页；
- v1.0 的统一切角厚框与两张破框感染者已保留归档，v1.2 常驻菜单不再加载这些边缘装饰；
- v1.1 将作战部署改为图片化的末日行动日志：日志底板、车组、通用便签、返回页签、行动皮带与连续怪物分别加载和组合；旧部署实现与旧怪物素材保留归档；
- v1.2 为主菜单、部署、行装、商店、设置和档案分别生成 16:9 全出血环境底板；部署页不再显示旧书本或边缘怪物，所有页面共享真实 Alpha 实体铭牌，旧素材只停用不删除；
- 全屏底板按页面懒加载，切换页面时释放上一张底板的解码缓存；九宫格四角强制等比缩放，只允许中心纹理伸展；
- 封面主视觉改用完整主体优先的 contain 构图，16:9 与 1080p 不再裁掉最大变异体头部；
- 正文改用 Windows 系统易读字体，Fusion Pixel Font 仅负责标题和短标签；关键文字组合由自动测试校验至少 4.5:1 对比度；
- 默认仅锁定进入当前枪械有效范围的最近存活敌人；范围外不自动开火，关闭辅助后可手动瞄准；
- 7 把拥有独立像素轮廓、枪声和固有机制的枪械，覆盖近程、中程、远程；另有 8 类敌人、14 项基础升级、6 张事件触发机制卡、6 项需要 Lv6 熟练度许可的终局进化、3 种模式、3 名主角、3 套皮肤；升级时可选四张卡，也可拆解本轮换取废料；
- 3 个关卡与 3 张 3072～4096 单位地图，支持坚守、撤离和不会自动结算的无尽模式；
- 四部位护甲每槽至少两件选择，并同步改变生命、护甲、移动、增伤等实战参数与人物像素外形；背包预览和开局战斗复用同一属性合成函数；
- 幸存者与感染者按头部、躯干、四肢、武器/职业饰件分层组合，升级选择使用可动的收藏卡式表现；
- 枪械后坐、枪口焰、抛壳、伤害数字和分层合成枪声；
- 城市战区由旧城商店街、环城服务区、废弃主干道、南线铁轨货场和拆车场组成；三图分别数据化道路细节，并提供爆炸桶、补给箱和电磁减速区；
- 默认一局为 180 秒，坚守模式按“试探、累积、冲击、喘息、围攻、终局”六个阶段递增敌群；
- 敌人使用 64 单位静态导航网格和复用 typed-array BFS 流场绕开实体障碍，开放区域仍保留直接追击与职业差异；
- 小/中/大型敌人使用三档 clearance；EnemyBrain 只负责寻路混合、冲锋和远程保持距离，CombatSim 负责战斗实体，SpawnSystem 负责波次，BossDefinition/BossSystem 是首领阶段与招式的唯一来源；
- 首次行动提供可跳过的六步战地手册；局后显示伤害、命中率、最长无伤、规则解锁和武器熟练度奖励，并只在本地保留最近 20 局记录；15 条规则可解锁商店蓝图、铁卫和挑战协议；
- 失败结算记录主要承伤来源、升级顺序与 seed，并给出针对性复盘建议；
- 三个章节分别拥有原创主题、压力层与 Boss 动机，章节电台文案、音乐/音效音量和静音状态均数据化；
- 固定 60 Hz 逻辑步、最多 4 步追帧、空间网格、对象池和动态画质；
- 模式、枪械、敌人、机制、Boss、升级、解锁规则、挑战协议、皮肤、主角、地图、关卡、装备与商店项目共用内容注册表；跨目录 ID、Boss 阶段和专属进化映射在启动时校验；
- schema v9 存档保留旧废料、武器、皮肤、设置与战绩，并把 v5 装备迁移到四部位护甲；新增蓝图、挑战协议、已完成规则、已领取熟练度奖励、专属进化权限和精通铭牌，异常数组会安全归一化；
- 10 个当前运行美术资源使用 WebP，约 24.64 MB 的 PNG 原图压缩为约 4.55 MB；PNG 与停用素材只保存在 `art/`，不再重复放进活动 Web 树；
- 可选 FPS、帧耗时、实体数量和补帧丢弃诊断面板；
- 完整离线运行；标题图、地表纹理、页面底板和中文像素标题字体均随本地包提供，不依赖远程图片、字体、音频或接口。

## 本地运行

要求 Node.js 20 或更高版本。常规构建与测试没有运行时 npm 依赖；真实 Edge 性能基准需先执行一次 `npm.cmd install` 安装开发依赖。

```powershell
npm.cmd run play
```

打开终端显示的地址，默认是：

```text
http://127.0.0.1:4173/
```

调试时可缩短对局并固定随机种子：

```text
http://127.0.0.1:4173/?duration=60&seed=17
```

视觉验收时可直接打开指定菜单页：`?menu=loadout`、`?menu=inventory`、`?menu=shop`、`?menu=settings` 或 `?menu=credits`。

只构建或只启动服务器：

```powershell
npm.cmd run build
npm.cmd run serve
```

生成精简桌面资源目录：

```powershell
npm.cmd run stage:desktop
```

生成 Windows 便携式 exe（需要 Rust、WebView2 和 Visual C++ Build Tools）：

```powershell
npm.cmd run build:desktop
```

稳定版 v1.4.0 仍位于 `release/`。当前带连字符的 alpha 构建会自动隔离到 `output/builds/v1.5.0-alpha.1/`，不会覆盖稳定发布。生成当前用户 NSIS 安装包与便携 zip：

```powershell
npm.cmd run build:installer
```

当前 alpha 对应产物为 `output/builds/v1.5.0-alpha.1/WastelandEcho-v1.5.0-alpha.1-win-x64-setup.exe` 和同目录 portable zip。外壳与安装分发决策见 [ADR-001](./docs/adr-001-windows-desktop-shell.md) 和 [ADR-002](./docs/adr-002-windows-installer-and-release-layout.md)。

## 操作

| 行为 | 键盘鼠标 | 标准手柄 |
|---|---|---|
| 移动 | WASD / 方向键 | 左摇杆 |
| 瞄准 | 默认锁定最近敌人；关闭辅助后鼠标 | 默认锁定最近敌人；关闭辅助后右摇杆 |
| 射击 | 左键 / Space | RT / RB / X |
| 暂停 | Esc / P | Menu |
| 确认 | Enter / Space | A |
| 返回 | Esc | B / View |
| 菜单导航 | 方向键 / Tab | 十字键 / 左摇杆 |
| 升级直选 | 1～4 | 导航后 A |
| 重开 | R | 导航后 A |
| 全屏 | F / F11 | 设置页按钮 |

浏览器只有在页面获得焦点并检测到手柄活动后才允许读取手柄。若没有反应，先点击画面，再按一次 A 或移动摇杆。部分非标准 DirectInput 手柄可能需要通过 Steam Input、厂商驱动或后续键位映射功能转换为标准布局。

## 自动验证

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run verify
npm.cmd run simulate
node scripts/simulate-run.js 180 --normal-health
npm.cmd run simulate:matrix
npm.cmd run simulate:endless
npm.cmd run benchmark:browser
npm.cmd run audit
```

`simulate:matrix` 使用正常生命运行环绕、风筝、贴脸、撤离优先、无磁吸和随机升级六种策略；`simulate:endless` 使用压力生命检查 600 秒稳定性。`benchmark:browser` 启动系统 Edge 采样真实页面 rAF、1% low 与 JS heap；`benchmark:render` 仅保留为 Canvas 调用微基准，不能代表 FPS。

## 美术与字体许可

- `web/assets/wasteland-title-keyart-v1.webp`：标题主视觉的活动优化副本；PNG 原图归档于 `art/generated/v1.0/runtime-snapshot/`；
- `web/assets/wasteland-ground-texture-v1.webp`：废土路面纹理的活动优化副本；PNG 原图归档于 `art/generated/v1.0/runtime-snapshot/`；
- `web/assets/fonts/wasteland-fusion-pixel-12-subset.woff2`：TakWolf Fusion Pixel Font 2026.09.01 的项目字符子集，采用 SIL Open Font License 1.1；
- 完整许可、上游发布包、修改状态与商业复核边界见 [CREDITS.md](./CREDITS.md) 和 [docs/assets-ledger.csv](./docs/assets-ledger.csv)。

## 项目结构

```text
src/core/       确定性规则、契约、内容注册、升级效果、对象池和空间网格
src/input/      统一输入帧、Gamepad 适配、命令映射和 Canvas UI 导航
src/runtime/    依赖组装与可替换组件入口
src/platform/   Windows 浏览器能力、DOM 事件绑定、音频与编曲
src/render/     Canvas 场景、素材注册与懒加载、HUD、沉浸式主菜单、日志部署/背包/商店、共享物品图标、模块化像素角色、特效和动态画质
src/world/      共享世界布局：街区、道路、铁轨、场景道具和碰撞地标
src/app.js      仅负责编排循环、命令、事件消费者和生命周期
scripts/        构建、本地服务器和自动对局
test/           核心、输入、扩展契约、渲染与 bundle 回归测试
docs/           架构、测试矩阵、平衡记录和素材台账
web/            Windows 浏览器构建产物
```

## 平台说明

项目目录仅保留 Windows 桌面运行链路；微信小游戏和移动触控适配器已移除。稳定版 v1.4.0 已提供未签名的 Tauri 2 / WebView2 便携式 `.exe` 与当前用户 NSIS 安装器；v1.5.0-alpha.1 是继续开发分支。商业代码签名尚未配置，因此公开下载时 Windows SmartScreen 仍可能显示“未知发布者”。

标题主视觉、环境地表纹理和两张破框感染者由项目内生成资产提供，中文像素标题字体来自 OFL 许可的 Fusion Pixel Font；这些资产均已登记到 `docs/assets-ledger.csv`。未来加入第三方素材前，必须同样登记来源、许可和署名要求；生成资产在商业发布前仍需按台账记录复核适用服务条款。

## Git 版本基线

2026-09-23 已在 main 建立首次提交 89652ab 与日期标签 baseline-2026-09-23。源码、测试、文档、许可证、活动素材和美术源图纳入 Git；node_modules、Rust target、dist、output、release 和历史安装包不入库，生成方式及发布文件 SHA 见 docs/build-record-2026-09-23.md。公开远程仓库为 https://github.com/XFTony/wasteland-echo-windows；GitHub 不包含被忽略的安装包和截图，这些资料仍需单独备份。

## 存档与备份

Windows 便携版存档位于 WebView2 用户数据目录：

```text
%LOCALAPPDATA%\com.wastelandecho.desktop\EBWebView
```

备份前先完全退出游戏，再复制整个 `com.wastelandecho.desktop` 文件夹；恢复时在游戏关闭状态下覆盖回原位置。浏览器调试版使用对应浏览器的站点 LocalStorage，与便携版存档不是同一份数据。

从 v1.5 开发版开始，游戏在写入前保留上一份有效存档。若主存档损坏，会尝试读取备份，并将损坏的原始内容留在本地；若无法安全保留或写入失败，画面会显示提示。出现提示时先退出游戏并复制上述整个用户数据文件夹，再尝试修复或继续游玩。自动备份只保存最近一份有效状态，不能替代手动复制整个文件夹。
