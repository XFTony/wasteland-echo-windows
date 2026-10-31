# 《荒原回响》美术材料库

此目录保存可复用原稿、提示词、处理中间稿、可编辑源和来源清单。当前运行素材位于`godot/assets/`；`web/assets/`为旧版对照与回退。活动素材与来源见[素材索引](../docs/assets/asset-catalog.md)，完整用途见[文件导航](../docs/project-file-guide.md)。

2026-10-31：用户已明确停用的三维/精细动作试验及旧迁移样板按逐文件清单备份退役；14项研究记录保存在`manifest.json`的`archivedAssets`中，含原始对象、SHA与恢复提交。原稿没有无备份丢弃。当前compact角色源、手型/袖口、敌人/武器与地图材料均保留；详情与恢复方法见[清理报告](../docs/cleanup/retirement-report.md)。

## 目录

~~~text
art/
  README.md
  manifest.json
  generated/
    v1.0/
      source/             # 旧破框怪物的高分辨率源图
      runtime-snapshot/   # v1.0 当时实际使用的完整快照
    v1.1/
      prompts.md          # 每件素材的最终生成要求
      source/             # ImageGen 原图、棋盘格稿、洋红中间稿
      runtime/            # Alpha 修复和尺寸优化后的可复用版本
    v1.2/
      prompts.md          # 六张页面底板与公共实体铭牌的生成规范
      source/             # 原生 16:9 源图、透明失败稿和洋红源图
      runtime/            # 当前全页底板与 RGBA 公共铭牌
    v1.5/
      prompts.md          # 当前轮次可核实的 ImageGen 提示词
      source/             # 全插画重构原始 PNG；运行图由脚本生成
~~~

## 状态规则

- `active`：当前运行时加载；
- `inactive`：当前不加载，但保留用于回退、比较或复用；
- `source-only`：生成源图或中间稿，不允许直接进入客户端；
- `provisional`：美术内容已验收，但商业发布前仍须根据生成服务条款复核。

停用不等于可删：普通inactive材料仍按现行引用/制作/许可链保留。只有用户指定、引用/隔离回归/ZIP验证均通过的明确退役批次才移出工作树，并保留清单与可恢复备份，不删除唯一未备份原稿。若复用旧素材，先从备份或Git恢复并登记为新的活动版本，再补测试。

## 运行时边界

- `src/render/art/asset-catalog.js` 只登记当前运行时素材 ID 与优化后的本地路径；历史稳定 ID 由 `art/manifest.json` 保存；
- `src/render/art/art-store.js` 只加载 `active` 图片，并允许测试或未来桌面壳注入替代素材；同一时刻只保留当前菜单页的一张全屏底板；
- `src/render/ui/image-primitives.js` 负责 contain、cover 和九宫格绘制；
- 九宫格四角必须使用统一缩放因子，页面只能拉伸中心带；
- 页面组件不得自行 `new Image()` 或写死 `web/assets` 路径；
- 图片加载失败必须有程序化回退，不能影响动作路由、存档或战斗规则。

## 新增内容

### 新地图

在内容注册表和世界注册表增加地图与布局；地图预览图可另加稳定素材 ID。地图碰撞和世界尺寸不能从图片推导。

### 新武器

在内容注册表增加武器数值和唯一 `visualId`；程序化图标或位图素材只负责显示。射程、伤害、枪声、后坐和抛壳仍由武器数据驱动。

### 新人物、服饰、装备

增加稳定内容 ID、解锁条件和视觉 ID；人物属性继续经过 `calculateLoadoutStats` 合成。固定叙事插画不能替代可变装备层。

## 洋红抠图流程

ImageGen 若不能直接返回真实 Alpha，先生成纯 `#FF00FF` 背景，再运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/process-chroma-key.ps1 `
  -InputPath art/generated/v1.2/source/example-chroma.png `
  -OutputPath art/generated/v1.2/runtime/example.png `
  -MaxWidth 1200
```

脚本使用色度优势而非简单全局颜色删除，并保留中间稿；输出后仍需检查 Alpha、边缘污染和实际合成画面。

## v1.5 全插画样板

运行 `python scripts/optimize-illustrated-assets.py` 生成限制尺寸的 WebP 与 `docs/illustrated-assets-report.json`，随后运行 `python scripts/register-illustrated-assets.py` 更新清单和来源台账。新图接入前检查透明度、完整四肢、实际缩小后的剪影、碰撞边界和菜单文字对比。浏览器截图工具为 `node scripts/qa/capture-illustrated-slice.mjs`，输出到被 Git 忽略的 `output/playwright/v15-painted/`。完整视觉状态与下一批阻断项见 `docs/art-direction-v1.5-illustrated.md`。
