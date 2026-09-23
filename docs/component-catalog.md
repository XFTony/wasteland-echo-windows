# 《荒原回响》v1.5-alpha 组件目录与安全修改指南

本文件是后续迭代的结构化索引。任何新需求先定位到所属组件，再只修改该组件的拥有者与对应测试，避免把内容、输入、渲染和平台代码混在同一文件。

## 当前可玩功能

- 沉浸式主菜单、精简作战部署、独立行装背包、商店、设置、制作信息、暂停、升级和结算页面；
- 坚守、撤离、无尽三种模式；三关卡、三张大地图、三名主角；
- 七把独立轮廓和独立机制枪械、近/中/远射程分带、六张机制触发卡、六条精通许可进化、四选一或拆解换废料、分级敌人、皮肤、四部位护具、商店和双货币；
- 最近敌人自动锁定与武器有效射程限制；关闭辅助瞄准后可用鼠标或右摇杆手动瞄准；
- WASD/方向键、鼠标、标准 Xbox 布局手柄、菜单焦点导航和可选手柄震动；
- 首次行动教学、详细局后战绩、最近 20 局记录、15 条规则解锁，以及 Lv2/4/6/8/10 武器熟练度奖励；
- 60 Hz 固定逻辑、对象池、空间网格、BFS 流场绕障、动态画质、离线存档、程序化音效与三章节自适应配乐。

## 顶层目录

| 路径 | 所有权 | 说明 |
|---|---|---|
| src | 游戏源代码 | 唯一的运行时实现 |
| test | 自动回归 | 规则、输入、组合、渲染边界和 bundle 测试 |
| scripts | 开发工具 | 构建、静态服务、模拟、字体子集 |
| web | 发布产物和本地资源 | index.html、样式、图片、字体；game.bundle.js 由构建生成 |
| art | 生成美术归档 | 分版本保存源图、失败中间稿、运行图、提示词与 SHA 清单 |
| docs | 规格、架构、测试、素材许可和数值记录 | 仅文档和许可，不参与运行时 |
| package.json | 命令与版本 | Windows 桌面构建入口 |

web/game.bundle.js 是生成文件，禁止手工编辑。修改 src 后必须执行 build 重新生成。

`scripts/audit-project.mjs` 审计源码/bundle/素材/发布物边界；`simulation-runner.js` 与 `simulate-matrix.js` 运行多策略正常生命矩阵；`browser-fps.mjs` 通过开发依赖 `playwright-core` 驱动系统 Edge。开发依赖不进入运行包。

## 源码组件清单

### 启动与会话协调

| 文件 | 责任 | 不应承担 |
|---|---|---|
| src/browser-entry.js | 取得浏览器 Canvas、存储、参数和 AudioContext，启动运行时 | 战斗、菜单或存档规则 |
| src/app.js | 帧循环、固定步进、事件分发、输入/音频/渲染协调 | 内容定义、浏览器事件细节 |
| src/runtime/create-game-runtime.js | 唯一组合根，注入并检查内容与世界实例一致性 | 玩法判断 |
| src/runtime/action-router.js | 在边界把 Canvas action 解析为显式 command，再由 handler 表调用模型 | Canvas 绘制或字符串前缀业务链 |

### 核心规则

| 文件 | 责任 |
|---|---|
| src/core/game-model.js | 单局聚合状态、玩家移动/自动锁定、生命周期、系统组合、稳定兼容命令、升级草案与事件队列；不再拥有刷怪或敌人战斗实现 |
| src/core/combat-sim.js | 射击/弹体/伤害/拾取/环境互动、敌人创建与更新、世界碰撞、群体分离和敌人网格 |
| src/core/spawn-system.js | 生成阶段推进、边缘出生、撤离/终局波次与章节/无尽 Boss 调度 |
| src/core/mechanic-system.js | 七把武器固有机制与六张事件触发升级的统一钩子 |
| src/core/boss-system.js | 按 BossDefinition 解析阶段、执行招式、发出预警并结算掉落 |
| src/core/unlock-system.js | 条件值、规则进度、蓝图/角色/协议奖励、旧所有权回填与幂等解锁 |
| src/core/mastery-system.js | 熟练度阈值、五档奖励、旧档回填、永久属性和专属进化许可 |
| src/core/menu-session.js | 设置临时状态、键位绑定会话、背包分页和商店提示；战斗 tick 不依赖这些字段 |
| src/core/tutorial.js | 教学步骤、进度推进和完成判定，不读取输入设备或绘制 UI |
| src/core/enemy-brain.js | 角色寻路混合、冲锋、远程间距与普通敌人动作参数；Boss 招式不得放在这里 |
| src/core/run-advice.js | 根据承伤来源、命中、升级和模式生成失败复盘建议 |
| src/core/entity-factories.js | 实体默认形状、重置函数、对象池上限和限制归一化 |
| src/core/content-registry.js | 校验全部内容目录、跨目录引用与地图布局引用 |
| src/core/loadout-selection.js | 选择、解锁过滤、轮换和存档回退 |
| src/core/run-state.js | 依据模式和选择创建单局状态 |
| src/core/spawn-director.js | 生成阶段、敌人权重与无尽波次 |
| src/core/upgrade-effects.js | 升级 ID 到属性效果的映射 |
| src/core/campaign.js | 关卡完成、解锁和选择联动 |
| src/core/economy.js | 钱包、商店资格、购买原子性 |
| src/core/equipment.js | 四部位槽位、装备/卸下、纯属性计算和开局属性应用 |
| src/core/progression.js | 编排局后经济、战役、成就、MasterySystem、UnlockSystem 与最近 20 局写入 |
| src/core/save.js | schema 9、旧装备槽迁移、规则/熟练度奖励/战绩及桌面设置归一化和本地持久化 |
| src/core/pool.js | 对象池实现 |
| src/core/spatial-grid.js | 动态实体点插入、静态矩形跨格插入、普通/去重局部查询网格 |
| src/world/navigation-grid.js | 三档 clearance 静态可走网格、薄障碍补充烘焙、复用 typed arrays 的 BFS 玩家流场 |
| src/core/fixed-step-clock.js | 固定步进和追帧丢弃 |
| src/core/random.js | 可复现实验随机数 |
| src/core/math.js | 纯数学和碰撞工具 |
| src/core/contracts.js | 屏幕、输入帧、UI 命令和端口契约 |

### 内容与地图

| 文件 | 责任 |
|---|---|
| src/config.js | 模式、武器、敌人、升级、皮肤、英雄、地图、关卡、装备与商店数据 |
| src/content/weapon-mechanics.js | 七把武器的稳定机制身份与说明 |
| src/content/boss-definitions.js | Boss 身份、HUD 色、阶段、招式、预警和掉落的唯一内容源 |
| src/content/unlock-rules.js | 15 条条件与奖励定义 |
| src/content/mastery-rewards.js | Lv2/4/6/8/10 奖励定义和武器专属进化映射 |
| src/content/run-modifiers.js | 可解锁挑战协议定义；后续挑战会话只消费这里的稳定 ID |
| src/world/wasteland-map.js | 城市、道路、铁路、障碍物、道路细节、爆炸桶/补给箱/电磁区和背景道具布局定义 |
| src/world/world-registry.js | 布局校验、布局 ID 查询和默认世界实例 |

map.id 只用于关卡和选择；map.layoutId 才用于定位世界布局。新增地图必须同时增加内容记录和布局记录，并让 worldSize 相等。

### 输入与平台

| 文件 | 责任 |
|---|---|
| src/input/input-manager.js | 汇总键盘、鼠标和手柄为规范输入帧，处理手柄反馈 |
| src/input/gamepad-source.js | 标准 Gamepad API、死区、热插拔、边沿命令和震动限流 |
| src/input/command-map.js | 键位/手柄动作到 UI 命令的映射 |
| src/input/key-bindings.js | 13 项可绑定动作、默认键、保留键、冲突交换和显示标签 |
| src/input/ui-navigator.js | Canvas 命中区域的焦点与方向导航 |
| src/platform/browser-bindings.js | 浏览器事件监听、焦点、可见性和清理 |
| src/platform/browser-platform.js | 视口、RAF、时钟、手柄与全屏端口 |
| src/platform/audio-engine.js | WebAudio 合成音效，按章节选择主题并叠加压力层与 Boss 动机 |
| src/platform/music-score.js | 三章节不可变编曲数据及稳定的 stageId 回退入口 |

### 渲染与表现

| 文件 | 责任 |
|---|---|
| src/render/canvas-renderer.js | 画布、相机、帧调度、基础绘图原语、命中区域和各视图组合；不拥有具体地形/角色实现 |
| src/render/terrain-view.js | 相机可见范围内的地表、道路、铁轨与场景细节 |
| src/render/obstacle-view.js | 障碍物、环境互动和地图实体道具 |
| src/render/actor-view.js | 主角、敌人、弹体、拾取物和战斗实体表现 |
| src/render/fx-system.js | 战斗事件到粒子、弹壳、枪口焰、飘字和横幅的有界表现 |
| src/render/hud-view.js | HUD、教学铭牌、控制提示、诊断、暂停、详细结算和小窗口提示 |
| src/render/menu-view.js | 菜单页面总入口 |
| src/render/menu-pages.js | 主菜单、设置、制作信息等通用页面布局 |
| src/render/world-view.js | 可视地表纹理源裁切，避免整张世界纹理逐帧缩放 |
| src/render/art/asset-catalog.js | 本地图片素材的稳定 ID、版本、路径、启用状态和九宫格参数 |
| src/render/art/art-store.js | 图片预加载、按需加载、按组释放、缓存、查询和测试注入 |
| src/render/pixel-actors.js | 主角、感染者、头部观察与四部位护具的部件化像素组合 |
| src/render/ui/deployment-page.js | 稳定部署入口；只转发到当前启用的指挥车库实现 |
| src/render/ui/deployment-bunker.js | v1.2 全出血部署页、车组入口、章节/模式/地图和出征组合 |
| src/render/ui/image-primitives.js | contain、cover、四角等比的九宫格和安全图片状态绘制 |
| src/render/ui/field-surfaces.js | 图片化实体铭牌、按钮、文字安全底与程序化失败回退 |
| src/render/ui/inventory-page.js | 人体装备槽、鼠标观察人物、统一属性板与 20 格分页背包 |
| src/render/ui/item-icons.js | 商店、背包和人物层共享的枪械/护具唯一像素视觉定义 |
| src/render/ui/equipment-presentation.js | 护具槽位、稀有度、颜色和属性文案的共享展示规则 |
| src/render/ui/shop-page.js | 商店页和数据驱动商品图标 |
| src/render/ui/upgrade-cards.js | 升级卡牌表现 |
| src/render/ui/theme.js | 实体木/铁/帆布/皮革材质、UI 色板和稀有度令牌 |
| src/render/ui/art-primitives.js | 切角厚框、信息板、回声标记、属性块、焦点括号与可选破框图片层；页面不得各自复制这些基础形状 |

历史部署实现已移出活动源码，保存在 `archive/code/ui/deployment-journal.js` 与 `archive/code/ui/deployment-legacy.js`。它们不进入 bundle；如需复用，应先重新建立独立入口和回归测试，禁止从活动页面直接跨目录引用。

## 所有权与修改矩阵

| 要改什么 | 首要文件 | 需要同步检查 | 必须新增或更新的测试 |
|---|---|---|---|
| 武器数值或枪械 | config.js | item-icons、audio-engine；人物、商店和背包自动读取共享视觉 | 内容校验、射击数值、视觉唯一性、音频与表现槽位 |
| 敌人或生成曲线 | config.js、spawn-director.js、spawn-system.js | combat-sim、enemy-brain | 敌人阶段、上限、长局模拟 |
| 地图或障碍物 | wasteland-map.js、config.js | world-registry、content-registry | 布局边界、layoutId、模型/渲染同源 |
| 寻路权重或网格 | navigation-grid.js、game-model.js | wasteland-map、spatial-grid | 空图方向、墙体绕行、不可达区、三图边界与 600 秒模拟 |
| 敌人移动/普通招式参数 | enemy-brain.js | combat-sim、config 敌人 role | role 独立单测与签名动作 |
| Boss 身份、阶段或招式 | boss-definitions.js | boss-system、HUD、Fx、content-registry | 定义完整性、阶段事件、HUD 名称/颜色与掉落 |
| 英雄、皮肤、装备、商店 | config.js、equipment/economy/progression | loadout-selection、save | 解锁、购买、开局属性、存档回退 |
| 升级或武器机制 | config.js、weapon-mechanics.js、mechanic-system.js、upgrade-effects.js | mastery-rewards、upgrade-cards | 注册、触发钩子、进化许可、四选一/拆解 |
| 规则解锁或熟练度奖励 | unlock-rules.js、mastery-rewards.js | unlock/mastery/progression、save、商店/背包/档案/结算 | 幂等发奖、旧档迁移、规则进度和真实截图 |
| 菜单、部署、背包或卡牌视觉 | src/render/ui | action-router、ui-navigator、loadout-selection | 点击区域、返回层级、键盘/手柄焦点、尺寸边界 |
| 键鼠或手柄控制 | input | command-map、browser-bindings、app | 松键、失焦、断连、边沿触发 |
| 浏览器或桌面壳适配 | platform、browser-entry | create-game-runtime | 组合根与启动 bundle |
| 教学或战绩 | tutorial.js、progression.js | game-model、hud-view、save | 步骤事件、跳过/完成持久化、统计口径、20 局上限 |
| 章节配乐 | music-score.js、audio-engine.js | config 关卡 ID、音量设置 | 章节回退、压力层、Boss 动机和 WebAudio 安全降级 |
| 存档字段 | save.js | loadout、campaign、economy、equipment、progression | 旧 schema 迁移、异常存储 |
| 性能上限 | entity-factories、renderer | game-model、simulate-run | 限制夹紧、对象池、压力模拟 |

## 禁止的快捷做法

- 不在 CanvasRenderer 中写入存档、金币、装备或战斗数值；
- 不在 GameModel 中访问 window、document、HTML 事件或 Gamepad API；
- 不复制地图坐标到 GameModel 和渲染器；
- 不在 save.js 中硬编码当前所有内容 ID；
- 不把新平台的事件处理塞回 browser-entry；应新增平台端口和独立入口；
- 不手改生成 bundle，也不以 HTTP 200 代替真实视觉或手柄验收。
- 不把停用素材继续登记在活动 Art Catalog；历史 ID 和文件由 Art Manifest/归档保存。

## 本轮清理记录

本轮已删除以下已核验的微信/移动端遗留物：game.js、game.json、project.config.json、src/wechat-entry.js、wasteland-survivor-wechat-mini-game-spec.md，以及完成且不再作为现行规范的 docs/v0.6-iteration-plan.md。

删除前已确认浏览器构建器只从 src/browser-entry.js 收集依赖，且桌面源码没有调用微信入口。旧存档迁移字段、素材许可账本、当前 Windows 规格和数值记录均保留，避免误删影响进度、许可或回归依据。

## 每次改动的最低验证

~~~powershell
npm.cmd run build
npm.cmd test
npm.cmd run simulate
npm.cmd run simulate:endless
~~~

对结构、平台或存档改动，额外运行 npm.cmd run verify。对画面、声音和手柄改动，在 Windows 的 Edge 或 Chrome 进行人工试玩；自动 Canvas mock 只能覆盖边界，不能替代视觉验收。
