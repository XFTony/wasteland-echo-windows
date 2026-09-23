# 《荒原回响》v1.5-alpha 架构说明

状态：当前实现的唯一架构基线。目标平台为 Windows 10/11；浏览器开发入口与 Tauri 2 + 系统 WebView2 桌面外壳共享同一 `dist/` 运行资源。不包含微信小游戏或移动触控运行时。便携式 exe 与当前用户 NSIS 安装器均可由同一版本配置构建。

## 1. 设计目标

- 规则、内容、输入、平台适配和渲染各自拥有明确边界；
- 一个可选内容或地图的修改，不应要求复制战斗循环或 Canvas 代码；
- 内容数据错误在启动或测试阶段失败，不能进入半可玩状态；
- 战斗热路径保持固定 60 Hz、对象池和硬上限；
- 存档可迁移，并将未知但格式正确的内容 ID 延后交给活动内容注册表解析；
- 每个运行时只组合一份内容注册表和一份世界注册表，模型与渲染器必须共享该组合。

## 2. 运行时关系

~~~text
browser-entry
  -> browser-platform + browser-bindings
  -> create-game-runtime
       -> ContentRegistry + WorldRegistry
       -> GameModel (会话编排与兼容命令入口)
            -> CombatSim -> EnemyBrain / MechanicSystem / BossSystem
            -> SpawnSystem -> SpawnDirector / BossSystem
            -> Progression -> UnlockSystem / MasterySystem / Economy / Campaign
            -> NavigationGrid / RunAdvice
       -> CanvasRenderer
       -> AudioEngine
       -> InputManager
       -> GameApp

浏览器事件 -> GameApp -> InputManager -> canonical gameplay input
GameApp -> FixedStepClock -> GameModel
GameModel events -> AudioEngine / InputManager rumble / CanvasRenderer effects
CanvasRenderer -> hit regions -> ActionRouter -> GameModel commands
CanvasRenderer -> ArtStore -> local ArtAsset catalog
CanvasRenderer -> TerrainView / ObstacleView / ActorView / MenuView / HudView / FxSystem
UI pages -> image-primitives -> contain / cover / nine-slice drawing
stage-desktop -> active ArtAsset catalog -> dist -> Tauri/WebView2
~~~

浏览器入口只负责取得 Canvas、浏览器端口和本地存储，然后调用组合根。它不包含战斗规则。GameApp 是逐帧协调器；GameModel 保存单局聚合状态并提供稳定命令入口，但把刷怪、战斗、Boss、机制、规则解锁和熟练度奖励委托给独立系统；CanvasRenderer 只读取状态并登记可点击区域。

美术图片通过 `asset-catalog.js` 的稳定 ID 注册，`art-store.js` 只预加载封面、地表和必要公共素材；六张页面底板按需加载，切页时通过素材组释放上一张底板的解码缓存。`art/manifest.json` 记录源图、失败中间稿、停用版本和运行图，但不参与运行时规则。

## 3. 层次与允许依赖

| 层 | 职责 | 可依赖 | 禁止依赖 |
|---|---|---|---|
| content / world | 静态可配置内容、地图布局和校验 | 配置数据 | DOM、Canvas、存档、输入 |
| core | 确定性规则、实体、进度、经济、存档 | content / world、纯工具 | DOM、浏览器 API、渲染器 |
| input | 键鼠、手柄、命令和焦点 | core contracts | GameModel 内部、Canvas 绘制 |
| runtime | 组合根与动作路由 | core、input、render、platform | 具体玩法判定 |
| platform | 浏览器事件、全屏、音频、Gamepad API | runtime ports | 战斗规则、直接存档修改 |
| render | Canvas 世界、角色和 UI 表现 | content / world、只读模型快照 | 存档写入、战斗判定 |
| entry | 启动和环境绑定 | runtime、platform | 业务规则 |

## 4. 关键不变量

1. **内容与世界同源。** ContentRegistry 校验每张地图引用的 layoutId、世界尺寸与已注册布局一致。GameModel、CanvasRenderer 和 create-game-runtime 检查它们使用的是同一 WorldRegistry 实例。
2. **地图 ID 与布局 ID 可不同。** map.id 是关卡与解锁使用的内容 ID；map.layoutId 是碰撞和可视地图数据的 ID。任何一方不存在都会明确抛错，不使用默认地图静默掩盖错误。
3. **存档不维护内容白名单。** normalizeSave 只规范结构、数值和迁移字段；LoadoutSelection 再按照当前 ContentRegistry 安全回退。这允许以后重新加入内容时恢复原选择。
4. **输入统一成一帧。** InputManager 输出 moveX、moveY、aimX、aimY、aimActive、firing。GameModel 不读取浏览器事件、键码或手柄 API。
5. **UI 动作集中路由。** 渲染器登记动作字符串，ActionRouter 将其翻译为模型命令；UI 页面不可直接更改存档或实体。
6. **热路径有边界。** 实体经对象池复用，敌人、投射物、敌方投射物和拾取物有硬上限；动态空间网格用于敌群分离、投射物碰撞与锁定查询，静态空间网格用于障碍物宽相查询。
7. **渲染不是规则来源。** 画质降级只减少装饰性绘制和特效，不能修改敌人、伤害、投射物或计时。
8. **导航只提供方向。** NavigationGrid 只烘焙静态障碍与玩家流场；EnemyBrain 计算职业移动，CombatSim 执行实体移动，并始终保留障碍推出与敌群分离作为最终纠错。
9. **统计只在本地结算。** 教学状态、武器熟练度、规则解锁和最近 20 局由 Progression/Save 拥有，不上传、不由 HUD 反写。
10. **Boss 只有一处真相。** EnemyBrain 只负责共享移动倾向；BossDefinition 声明身份、阶段、招式、预警和掉落，BossSystem 执行。HUD/Fx 只读取该定义，不维护第二份阶段表。
11. **Meta 奖励可重放且幂等。** UnlockSystem 与 MasterySystem 通过已完成规则/已领取奖励 ID 防止重复发放；旧档已有商品会回填蓝图，不撤销所有权。
12. **活动素材树无历史副本。** Web 只放活动 WebP/字体，停用 PNG 和生成过程只在 Art Manifest 与归档中保存。

## 5. 游戏循环

每个浏览器帧按以下顺序执行：

1. 读取键鼠与标准 Gamepad 状态，形成规范输入帧与边沿命令；
2. 处理菜单命令与输入设备切换；
3. FixedStepClock 以 1/60 秒推进 GameModel，单帧最多补 4 步；
4. 消费模型事件，更新音频、手柄反馈和渲染特效；
5. 根据帧耗时更新表现质量；
6. 绘制模型快照，并重新登记当前页面的点击区域与无鼠标焦点。

暂停、窗口失焦、页面隐藏、重开和返回主菜单都会清空易粘连的输入状态；暂停时固定步进累积器会重置，避免恢复后补帧爆发。

## 6. 内容、世界与存档

### 内容注册表

ContentRegistry 统一登记模式、武器、敌人、武器机制、Boss、挑战协议、升级、解锁规则、皮肤、英雄、地图、关卡、装备和商店条目。每一类都使用稳定字符串 ID，并在构造时检查必填字段、关联引用、Boss 阶段完整性、蓝图规则、武器精通进化映射和商店授予目标。武器额外声明唯一 `visualId`、`rangeBand`、`weaponClass`、`mechanicId`、枪口反馈与抛壳参数；护具声明合法的 `helmet / chest / legs / boots` 槽位和唯一 `visualId`。商店、背包和人物图层通过同一视觉 ID 解析轮廓，避免页面间复制美术分支。

新增内容时遵循稳定映射：武器定义引用 `mechanicId`；Lv6 专属进化由 `masteryEvolutionRewards` 映射到已有 evolution upgrade；蓝图商品只引用一条奖励目标与商品自身一致的 `unlockRuleId`。任何悬空 ID 在 ContentRegistry 构造时直接失败。

### 菜单与整备页面

主菜单、作战部署、行装背包、商店、设置和档案拥有独立全页底板，交互文字与热点保持实时图层。主菜单只负责顶层入口；部署页只改变章节、模式和地图；背包页通过动作路由直接选择已解锁人物、枪械、服饰或四部位护甲，并可从人体槽位卸下装备；商店只负责购买和装备资格。设置临时状态、键位绑定、`inventoryPage` 与商店提示集中在 `MenuSession`，不进入战斗状态；实际选择仍通过 LoadoutSelection 与 Equipment 校验后持久化。背包属性板调用 `createBasePlayerStats + calculateLoadoutStats`，开局调用同一计算结果，因此渲染层不会复制战斗数值公式。

### 世界注册表

WorldRegistry 是地图几何的单一来源。布局包含 zones、roads、tracks、obstacles、scenery、worldSize 和主题色。模型从中复制碰撞障碍物，渲染器读取同一布局绘制街道、商店、铁路、货场和背景道具。

### 存档

存档版本当前为 schemaVersion 9。它保留旧废料向铜币的一次性迁移、双货币、英雄、地图、关卡、装备和桌面设置，并记录教学、按武器熟练度、最近 20 局、键位、静音、UI 缩放、成就、已取得蓝图、已解锁挑战协议、已完成规则、已领取熟练度奖励、已开放进化和精通铭牌。v5 的 `armor` 迁移到 `chest`，旧 `tool / charm` 按稳定物品 ID 迁移到 `helmet / legs`；发生槽位竞争时未穿戴物仍保留所有权。未知选择 ID 在存档归一化时保留，在启动模型时根据当前内容安全选择可用默认值。

熟练度 Lv2/4/6/8/10 分别提供经济、伤害、专属进化权限、暴击/金币和铭牌/废料收益。所有永久战斗加成都在 `startRun` 完成人物与装备合成后由 MasterySystem 追加，不污染装备预览公式。

写入主存档前，SaveManager 将旧的有效主档复制到本地备份槽。主档解析失败时先保留原始字符串，再尝试备份；保留失败时进入只读状态，禁止启动时的规范化写盘覆盖原文。写入失败或自动恢复会在 Canvas 上显示状态。备份槽只有最近一份，人工备份仍以完整 WebView2 用户数据目录为准。

## 7. 性能边界

| 项目 | 当前策略 |
|---|---|
| 战斗步进 | 60 Hz 固定步长，最大 4 次追帧 |
| 实体内存 | Pool 复用，运行时上限经过 normalizeLimits 夹紧 |
| 碰撞与锁定 | 动态/静态 SpatialGrid 分区查询，复用候选数组与去重 Set；敌人障碍推出和两轮确定性群体分离不产生逐帧临时向量 |
| 导航 | 每图缓存 small/medium/large 三档 64 单位网格；玩家跨格时以预分配 typed arrays 重建 BFS 流场；薄障碍采用格子相交补充烘焙 |
| UI | 可点击区域使用预分配池，焦点由 UiNavigator 管理；六张全页底板只缓存当前页 |
| 渲染 | Canvas 2D、动态画质、可视区域裁剪、效果槽位上限 |
| 音频 | 可选 WebAudio；按 stageId 选择三章节主题并按压力/Boss 状态叠层；初始化失败不影响游戏 |
| 离线能力 | 运行时不下载远程资源，字体和图片随本地包提供 |

开发期 `playwright-core` 只用于系统 Edge 的真实 rAF/1% low 采样，不进入自定义 CommonJS bundle、`dist`、Tauri exe 或安装包。

## 8. 修改门槛

改动规则、输入、存档、世界注册表或组合根时，至少执行：

~~~powershell
npm.cmd run build
npm.cmd test
npm.cmd run simulate
npm.cmd run simulate:endless
npm.cmd run benchmark:browser
npm.cmd run audit
npm.cmd run verify
~~~

涉及实际显示、音频或手柄手感时，自动测试不能替代 Windows 浏览器人工试玩。完整模块清单、变更矩阵和清理记录见 [组件目录](./component-catalog.md)。
