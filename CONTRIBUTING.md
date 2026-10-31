# 开发与协作指南

## 当前开发线

从最新`main`建立短期`codex/主题`分支。玩法、UI、地图和运行素材以`godot/`为准，GDScript使用静态类型与Godot官方风格；具体约束见[Godot实施规则](godot/AGENTS.md)。旧JS实现用于对照与测试，不能反过来覆盖原生Resource。

运行游戏只需普通版Godot 4.7.2，导入`godot/project.godot`后按F5。开发验证另需Node.js 22及npm。

## 合并前验证

在仓库根目录运行；`GODOT_PATH`应指向本机Godot控制台程序，不能提交个人安装路径或凭据。

```powershell
npm.cmd ci
npm.cmd run check
node scripts/maintenance/check-doc-entrypoints.mjs
node scripts/godot/export-game.mjs
node scripts/godot/export-combat-cases.mjs
& $env:GODOT_PATH --headless --path godot --editor --import
node scripts/godot/verify-native.mjs
```

`export-game`默认只补缺失原生素材；现有Resource由正式工程维护。不要在日常验证中随意使用覆盖参数。测试使用隔离存储，不读取或修改真实玩家存档。

GitHub的`Quality / check`汇总旧版参考检查和原生Godot回归。任一失败、取消或跳过都会阻止汇总通过；仅文档PR也经过同一合并门槛。画面、音效或操作改动另附真实截图、试听或试玩记录，自动检查不等同于设备验收。

## 文件保存规则

| 应提交 | 不提交 |
|---|---|
| GDScript、场景、Resource、稳定UID、`.import`设置 | `.godot/`导入缓存、引擎／模板、依赖目录 |
| 活动素材及源图、提示词、来源、许可记录 | 全量截图、录屏、临时裁切与日志 |
| 少量精选主页截图、设计文档、检查脚本 | 安装包／exe、真实存档、个人配置与凭据 |

当前素材编辑入口见[组件表](docs/component-catalog.md)与[地图流程](docs/design/map-editor-workflow.md)。枪体、手型、服饰袖口继续独立；地图可视位置与碰撞footprint必须一起核对。

## 一次有序迭代

1. 更新main，创建一个目标明确的短期分支；写清可观察的完成条件。
2. 实现并验证；稳定内容ID和存档schema变更须明确迁移策略。
3. 只提交本轮文件；提交标题使用`feat:`、`fix:`、`docs:`、`chore:`等前缀。
4. 上传分支并发PR，填写验证证据和已知限制，等待Quality成功。
5. 使用squash或rebase满足主分支线性历史；完成后删除已整合分支。长期归档使用说明明确、不可移动的`archive/日期或主题`标签，不堆积已完成开发分支。

不强推共享分支，不移动已发布标签，不为改变语言占比删改参考代码。重大整合先保留归档标签及独立Git备份。

## Windows打包与发布

固定官方引擎与模板校验，使用干净源码执行`scripts/godot/build-windows.ps1`，再运行`verify-package.ps1`。有旧游戏运行时，使用新的输出目录，避免覆盖正在运行的程序。

内部包不等于公开Release。冻结范围后统一递增预发布版本、同步版本文件、完成设备矩阵，再从准确源码提交构建，上传便携包／安装器、版本说明、SHA256SUMS和来源manifest。[完整发布规则](docs/versioning-and-release.md)
