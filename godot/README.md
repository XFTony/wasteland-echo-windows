# 荒原回响 · Godot 原生项目

当前已能完成「出发—连续生存—升级—交易—部署塔台—结算」的主要流程，并生成独立 Windows 测试包。迁移仍处于内部验收：实体手柄、低配电脑、Windows 显示缩放和真实窗口长局尚未全部完成，不能据此宣称完美复刻或正式发布。

## 开始体验

- 独立程序：`../output/godot-migration/windows/WastelandEcho.exe`，双击即可，不需要安装 Godot、Node.js 或浏览器。
- 源码开发：双击根目录的 `启动Godot开发版.cmd`，或用 Godot 4.7.2 打开本目录 `project.godot` 后按 F5。首次导入缓存由 Godot 创建，原生项目所需素材已入 Git。
- 旧进度导入：双击根目录 `Godot存档导入与备份.cmd`。选择旧版导出的 JSON，先核对预览，再确认导入；新版原有进度会自动备份。工具不扫描、修改原版 WebView2 内部数据。

WASD 或方向键移动，默认自动瞄准/射击；E 与交易站交互或回收塔台，T 开始/确认部署，Esc/P 暂停，数字键 1—4 选择升级。手柄左摇杆移动，A 交互/确认，B 返回，Y 部署，Menu 暂停，肩键切换界面焦点；实际设备手感仍待验收。

原版 Canvas/Tauri 代码保留作对照与回退；原生版使用独立的 `WastelandEcho-Godot` 用户目录，不自动覆盖原版进度。

## 资源与开发规则

- `content/`：137 个原生 Resource 及 GameCatalog，原内容 ID 保留。
- `assets/`：活动素材及 `.import` 设置；原Catalog保留59张登记图片、21音频，本轮另有两张原生直接引用的共享地图图集。完整文件数、体积、来源与SHA见 `../docs/assets/asset-catalog.md`。同内容由Git去重；后续原生美术改动在此提交。
- `scenes/maps/`：三张可编辑地图。`GroundTiles`可直接绘制；障碍位置与footprint同时提供真实碰撞，保持轴对齐。表现节点另按脚底排序，高物上部淡化；图块自身物理/导航关闭。
- `content/map_art/`：共享TileSet、ShaderMaterial和三图视觉Profile；图集源图/提示词在 `../art/world/pixel-map-v2/`。编辑操作与边界见 `../docs/design/map-editor-workflow.md`。
- `scripts/`：GDScript 规则、原生 Control/Node2D 表现、AudioStream 音频及输入，没有嵌入旧网页。
- `data/`：可再生参考夹具，不进入发行包。JavaScript 仅在开发阶段导出旧版数据与预期结果。

正常使用 Godot 资源、场景和源码即可开发。重建迁移对照时，`export-game.mjs` 默认保留已有原生素材，仅补缺失文件；`import_content.gd` 默认保留已编辑定义。`--sync-reference-assets` 与 `--overwrite` 都是明确的覆盖操作，使用前先核对差异。

## 验证与构建

```powershell
node scripts/godot/export-game.mjs
node scripts/godot/export-combat-cases.mjs
& 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe' --headless --path godot --editor --import
& 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe' --headless --path godot --script scripts/tools/import_content.gd
node scripts/godot/verify-native.mjs
```

检查器同时核对退出码、日志错误和报告标记，覆盖基础/存档、战斗、实际组合根、原生输入/音频、存档工具及地图美术交互。区域比较脚本为 `verify-ui-regions.mjs` 和 `verify-battle-regions.mjs`；截图和完整日志位于根目录 `output/godot-migration/`，本轮地图局部验收在 `output/map-art/`。

Windows 模板固定为官方 4.7.2，下载归档及提取文件均核对 SHA256。首次准备使用 `scripts/godot/prepare-windows-templates.ps1 -ResumeDownload`；构建运行 `scripts/godot/build-windows.ps1`。模板、导入缓存、大包和完整截图不进 Git；构建记录来源提交、脏工作区、SHA256及许可文件，并核对版本一致性。

构建后运行 `scripts/godot/verify-package.ps1`，自动核对干净源码记录、包的SHA、三张地图与两张共享图集、59张Catalog图片、21音频和12武器。它使用隔离测试存储，带超时退出；不代替真实窗口/DPI/手柄/长局验收。本轮地图验证见 `../docs/qa/map-art-validation.md`。

MCP 安装见 `../tools/godot-mcp/README.md`，本机已直接验证可用。完整计划见 `../docs/godot-migration-plan.md`，验证范围见 `../docs/qa/godot-native-validation.md`，当前状态见 `migration_status.json`。
