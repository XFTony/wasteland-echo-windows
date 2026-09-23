# 《荒原回响》v1.1 架构复审与扩展指南

> 历史快照：本文描述 v1.1 当时的部署日志与 schema v6，不是当前架构基线。现行说明见 `docs/architecture.md`；旧部署源码现保存在 `archive/code/ui/`。

日期：2026-09-10  
结论：当前结构适合继续迭代；本轮没有让图片素材进入战斗规则、存档或输入层。新地图、武器、英雄、服饰和装备仍由内容注册表扩展，部署日志只是读取这些状态。

## 1. 当前运行关系

~~~text
browser-entry
  -> browser-platform / browser-bindings
  -> create-game-runtime
       -> ContentRegistry + WorldRegistry
       -> GameModel
       -> InputManager
       -> ArtStore
       -> CanvasRenderer
            -> world / HUD / actors
            -> deployment-page facade
                 -> deployment-journal
                 -> image-primitives
                 -> stable art asset IDs
            -> inventory / shop / upgrade cards
       -> AudioEngine
       -> GameApp

Canvas hit region -> ActionRouter -> GameModel command
GameModel snapshot -> renderer; renderer never writes save state directly
~~~

## 2. 本轮结构调整

### 素材层

- `asset-catalog.js`：本地图片的稳定 ID、版本、启用状态、加载组和九宫格参数；
- `art-store.js`：封面和地表预加载，部署组首次进入时按需加载，之后缓存复用；
- `image-primitives.js`：完整主体 `contain`、背景 `cover`、九宫格绘制和统一图片状态；
- `art/manifest.json`：开发与发布清单，记录 active/inactive、源图、运行图和 SHA，不参与规则运算。

### 页面层

- `deployment-page.js` 保持稳定入口，其他模块不需要知道当前部署主题；
- `deployment-journal.js` 只组合日志、车组、便签、连续怪物和动态文字；
- `deployment-legacy.js` 保存 v1.0 程序化实现，但当前入口不引用，因此不会进入活动 bundle；
- 旧怪物素材标记 inactive 或继续供其他页面使用，不被删除。

### 封面

`drawTitleKeyArt()` 改为 contain 安全构图。测试不再要求图片铺满 75% 宽度，而是要求完整图片四边都留在视口内，防止再次为了“更大”而裁掉怪物头。

## 3. 保持不变的契约

| 契约 | 状态 |
|---|---|
| 部署页 action：`inventory / stagePrev / stageNext / modePrev / modeNext / mapPrev / mapNext / deploy / back` | 保持不变 |
| 模型选择：`selectedStage / selectedMode / selectedMap / selectedHero / selectedWeapon / selectedSkin` | 保持不变 |
| 四部位装备与 `calculateLoadoutStats` | 保持不变 |
| 存档 schema v6 | 保持不变 |
| 固定 60 Hz、对象池、空间网格和实体上限 | 保持不变 |
| 键鼠、手柄导航和失焦清理 | 保持不变 |

因此本轮美术替换不会改变难度、射击、胜负、奖励或存档。

## 4. 新内容接入

### 4.1 新地图

1. 在 `src/world/wasteland-map.js` 增加布局；
2. 在 `WorldRegistry` 注册稳定 `layoutId`；
3. 在内容注册表添加地图 ID、名称、威胁、尺寸和 `layoutId`；
4. 如需地图缩略图，在素材注册表增加独立 art ID；
5. 更新地图边界、地标和内容引用测试。

图片不能决定碰撞、出生点和世界大小，避免换图后规则漂移。

### 4.2 新武器

1. 添加稳定武器 ID、数值、射程带、枪声、后坐、枪口和抛壳参数；
2. 添加唯一 `visualId`，或在素材注册表登记位图；
3. 商店和背包继续从同一内容记录读取；
4. 更新内容校验、视觉唯一性、射击和音频测试。

### 4.3 新英雄与服饰

1. 添加英雄/皮肤稳定 ID、解锁条件和角色部件视觉；
2. 部署日志自动显示名称，背包人物继续显示实际可变外观；
3. 若增加固定宣传插画，使用新的 art ID，不能替代可变人物层；
4. 更新选择、存档回退和人物绘制测试。

### 4.4 新装备

1. 指定合法槽位 `helmet / chest / legs / boots`；
2. 添加唯一装备 ID、`visualId` 和属性；
3. 保持 `calculateLoadoutStats` 为预览和战斗的唯一公式；
4. 更新迁移、装备、属性和人物部件测试。

## 5. 素材兼容策略

- 页面引用稳定 ID，不引用文件名；文件升级可保留 ID 或增加新版本 ID；
- active 控制运行时加载，inactive 控制停用但保留；
- 源图、中间稿和失败变体不进入 `web/assets`；
- 当前运行图全部使用本地路径，不依赖网络；
- 图片缺失或尚未完成异步加载时，页面使用程序化纸面/人物回退并继续注册所有 action；
- 九宫格保护便签和皮带端帽，内容长度变化只拉伸中央区域；
- 部署图片懒加载，避免启动封面同时解码整套日志素材。

## 6. 目录清洁结果

- 活动部署入口只有一条：`deployment-page -> deployment-journal`；
- 旧部署代码改名保存，没有复制到活动模块；
- `web/game.bundle.js` 仍由构建脚本生成，未手工编辑；
- v1.0 和 v1.1 生成素材均有归档，不存在仅保存在 Codex 临时目录的运行资源；
- Playwright 最终截图集中到 `output/playwright/v11-journal-ui/`；
- 根目录临时 Playwright 会话已移动到输出目录；
- 未引入第三方运行时依赖或远程图片 URL。

## 7. 已知边界

1. 部署页车组插画是一张固定叙事图，不会逐件反映当前头盔、身甲、腿甲和靴子；实际装备外观以“行装与背包”和战斗角色为准，部署页通过动态名称保持状态一致。
2. 第一次进入部署页时图片按需加载，极慢磁盘环境可能短暂看到程序化回退；加载完成后会缓存，不重复请求。
3. PNG 保留无损透明和像素边缘，但解码内存高于 WebP。当前仅在首次打开部署页后常驻；若未来扩展到数十张大图，应增加分组释放或桌面壳纹理压缩。
4. Figma/可画适合概念板和人工调整，但整页扁平导出不适合作为运行时交互层；当前采用独立 ImageGen 素材和代码热点是兼容性更好的实现。

## 8. 验证证据

- 110 项 Node 自动测试通过；
- 素材清单路径与声明 SHA-256 自动校验；
- 活动部署源码自动检查不包含 source crop 或旧部署引用；
- 1280×720 和 1920×1080 Chromium 截图通过；
- 左页鼠标点击进入背包，Esc 返回部署；
- 模式箭头实测从 `survival` 切换到 `extraction`；
- Chromium 控制台 0 errors / 0 warnings；
- 180 秒普通坚守模拟获胜；
- 600 秒无尽压力模拟保持运行并完成 3 波 Boss。
