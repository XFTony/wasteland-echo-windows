# 《荒原回响》v1.1 末日行动日志美术重构

## 1. 本轮目标

本轮集中解决两个已经由截图确认的问题：

1. 封面主视觉使用铺满裁切，导致竖向源图的顶部与底部被截断，最大变异体头部不能完整出现；
2. 部署页把变异体整图放在内容后方，再把手部裁片放在内容前方，身体、手臂和书页之间没有连续遮挡关系，形成悬浮和穿模感。

部署页重构为“可交互的末日行动日志”：左页是车组与整备入口，右页依次放置章节、模式、地图、行动参数与出征操作。游戏内容、动作字符串和核心状态不变，视觉底板由独立图片素材承担。

设计参数：`DESIGN_VARIANCE 8 / MOTION 4 / VISUAL_DENSITY 5`。

## 2. 封面修复

封面图保持现有 `wasteland-title-keyart-v1.png`，不重新设计主题角色。渲染由 `cover` 改为 `contain`：

- 高度最多占视口的 96%；
- 宽度最多占视口的 66%；
- 右侧对齐，顶部和底部保留安全边距；
- 16:9、16:10、21:9 都必须显示完整的最大变异体头部；
- 左侧菜单阅读区不被主体覆盖；
- 图片加载失败继续使用程序化角色展示。

## 3. 素材拆分

所有素材独立生成、独立保存、独立登记，不生成一张包含文字和交互状态的扁平页面。

| 稳定 ID | v1.1 归档文件 | 用途 | 层级 |
|---|---|---|---:|
| `deployment.journal.v1` | `art/generated/v1.1/runtime/deployment-journal-spread-v1.png` | 无文字双页日志底板 | 10 |
| `deployment.convoy.v1` | `art/generated/v1.1/runtime/deployment-convoy-vignette-v1.png` | 左页车组插画；活动版本另有 WebP | 20 |
| `deployment.note.v1` | `art/generated/v1.1/runtime/deployment-note-surface-v1.png` | 章节、模式、地图和返回标签的九宫格便签 | 30 |
| `deployment.action.v1` | `art/generated/v1.1/runtime/deployment-action-strap-v1.png` | 出征按钮的皮革/金属底板 | 30 |
| `deployment.back-tab.v1` | `art/generated/v1.1/runtime/deployment-back-tab-v1.png` | 返回营地的专用深色页签 | 30 |
| `deployment.edge-mutant.v1` | `art/generated/v1.1/runtime/deployment-edge-mutant-v1.png` | 右侧书页外缘的一体式怪物 | 40 |

旧 `ui-mutant-overhang-v1.png` 和 `ui-crawler-overhang-v1.png` 保留在素材库中，但部署页不再裁片组合它们。

## 4. 图层与安全区

~~~text
00  菜单荒原背景
10  日志底板
20  左页车组插画
25  右侧完整怪物，身体与手臂只出现一次
30  便签/行动皮带
40  动态文字、箭头与状态
50  焦点、悬停与按压反馈
60  返回按钮和操作提示
~~~

布局安全区：

- 左页：日志宽度的 6%～47%；
- 装订缝：48%～52%，不放文字和点击区域；
- 右页交互：54%～88%；
- 右侧怪物：88%～102%，允许越过书本外缘，但不能进入交互安全区；
- 720p 隐藏怪物的最低肢体细节，仅保留头肩轮廓；
- 1080p 显示完整头肩和连续手臂，但不单独绘制手部裁片。

## 5. 页面信息结构

### 左页

- 页眉：`作战部署 / FIELD LOG`；
- 中央：高细节车组插画；
- 页脚：当前英雄、枪械、服饰；
- 整页保留 `inventory` 点击区域，点击后进入“行装与背包”。

### 右页

从上到下依次为：

1. 行动章节；
2. 作战规则；
3. 战区地图；
4. 时限、威胁、目标三项文字参数；
5. 确认出征；
6. 键鼠或手柄操作提示。

章节、模式、地图的 `prev / next` action 保持不变；内容继续从 `ContentRegistry` 读取。

## 6. 技术结构

新增模块：

- `src/render/art/asset-catalog.js`：素材 ID、路径、用途、版本和加载策略；
- `src/render/art/art-store.js`：图片加载、查询、可用性与注入接口；
- `src/render/ui/image-primitives.js`：contain、cover、九宫格和按稳定 ID 绘制；
- `archive/code/ui/deployment-journal.js`：已停用部署日志的历史表现组合；
- `art/manifest.json`：源图、运行图、启用状态、生成工具与版本记录。

兼容原则：

- 页面只能读取模型快照并注册 action，不直接写存档；
- 图片缺失时回退到现有程序化框体与车组；
- `GameModel`、`ActionRouter`、输入系统和内容注册表不依赖图片；
- 新地图、新武器、新人物、服饰和装备继续只需扩展内容注册表及对应视觉 ID；
- 生成图片只承担背景和固定叙事，不承担可变装备数值。

## 7. 素材归档

~~~text
art/
  README.md
  manifest.json
  generated/
    v1.0/
      source/
      runtime-snapshot/
    v1.1/
      source/
      runtime/
web/assets/
  ui/deployment/       # 仅放当前运行时使用的优化副本
~~~

规则：

- 不删除旧素材；停用只修改清单状态；
- ImageGen 原始输出进入 `source/`；
- 裁切、缩放、透明通道修复后的文件进入 `runtime/`；
- `web/assets/` 只包含当前客户端需要加载的副本；
- 每项资产登记尺寸、Alpha、SHA-256、提示词摘要和商业复核状态。

## 8. 验收标准

- 封面最大变异体头部完整显示，主角、枪口焰和两侧感染者的关键轮廓仍可见；
- 部署页不再出现脱离身体的单独手爪；
- 怪物不遮挡章节、模式、地图、返回或出征热点；
- 右页为纵向日志结构，不再是等权矩形仪表盘；
- 1280×720 与 1920×1080 均无文字越界、素材穿模或点击区越界；
- 图片缺失测试仍可渲染并操作；
- 素材注册表允许测试注入与未来版本并存；
- 全部自动测试、构建、普通局和无尽压力局通过。
