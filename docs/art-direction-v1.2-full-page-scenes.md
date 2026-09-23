# 《荒原回响》v1.2 全页场景美术重构

## 目标

v1.2 不再把一张局部插画盖在通用菜单背景上。主菜单、部署、行装、商店、设置和档案各自拥有一张与布局同步设计的全出血环境底板；互动内容仍为独立 Canvas 图层，因此任务、枪械、装备、货币和存档逻辑没有进入图片。

## 页面与场景

| 页面 | 稳定素材 ID | 场景职责 | 主要文字安全区 |
|---|---|---|---|
| 主菜单 | `menu.backdrop.main.v2` | 营地入口 | 左侧菜单墙 |
| 作战部署 | `menu.backdrop.deployment.v2` | 指挥车库 | 左侧车组、右侧行动墙 |
| 行装与背包 | `menu.backdrop.inventory.v2` | 军械整备室 | 左侧换装位、右侧军需墙 |
| 商店 | `menu.backdrop.shop.v2` | 军需交易室 | 中央商品区、右上钱包 |
| 设置 | `menu.backdrop.settings.v2` | 信号控制室 | 中央双列控制墙、底部帮助区 |
| 档案 | `menu.backdrop.credits.v2` | 生存档案室 | 中央记录板 |

## 尺寸与缩放规则

- 六张源图和运行图均为 1672×941，接近原生 16:9；
- 1280×720 与 1920×1080 使用等比 `cover`，不允许分别修改宽高；
- 非 16:9 窗口只从构图安全边缘裁切，严禁用 `drawImage(image, x, y, w, h)` 直接非等比压缩；
- 独立人物、车辆和 UI 表面用 `contain` 或九宫格，不允许把整件素材硬塞进不同比例矩形；
- 九宫格四角共用一个统一缩放因子，只拉伸中心带，避免黄铜角夹和铆钉变形。

## 图层顺序

~~~text
page-specific full-bleed backdrop
  -> optional independent character/vehicle art
  -> generated physical field surfaces
  -> live text, icons, focus and hit regions
~~~

生成图片不含任何运行文字。页面动作 ID、键鼠/手柄焦点、装备选择和状态读取仍由原模块负责。图片加载失败时继续走程序化回退，不影响导航与游戏规则。

## 内存边界

`ArtStore.releaseGroup("menu-backdrop", currentId)` 保证六张 2K 底板中只有当前页面的一张保留解码缓存。返回某页时按需重新加载；封面人物、地表和公共铭牌仍按各自策略缓存。被 v1.2 替换的 v1.0/v1.1 资源保留在 `art/generated` 和 `web/assets`，但在运行目录中标记为 `inactive`。

## 验收基线

- 112 项自动测试全部通过；
- 1280×720：主菜单、部署、行装、商店、设置、档案逐页截图；
- 1920×1080：部署与行装重点截图；
- 截图目录：`output/playwright/v12-full-page-art/`；
- HTTP 200 仅用于确认服务在线，不代替截图审查。
