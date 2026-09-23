# 《荒原回响》美术材料库

此目录保存可复用源图、处理中间稿、运行时优化图和版本清单。`web/assets/` 只保存当前客户端需要加载的副本；`art/` 不进入浏览器 bundle。

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
~~~

## 状态规则

- `active`：当前运行时加载；
- `inactive`：当前不加载，但保留用于回退、比较或复用；
- `source-only`：生成源图或中间稿，不允许直接进入客户端；
- `provisional`：美术内容已验收，但商业发布前仍须根据生成服务条款复核。

停用素材从活动 `asset-catalog.js` 移出，只在 `manifest.json` 与 `art/generated/` 保留；不得删除唯一源图。`web/assets/` 不保存与归档逐字节重复的 PNG。若要复用旧素材，先从 manifest 恢复为新的活动版本并重新加入测试。

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
