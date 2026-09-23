# ADR-001：Windows 桌面外壳选择

状态：已接受；外壳选择继续有效，安装分发演进见 ADR-002  
日期：2026-09-18

## 背景

游戏运行时是本地 Canvas 2D/CommonJS bundle，需要在 Windows 10/11 上提供无需 Node.js、无需手动启动 HTTP 服务的双击入口，同时保留现有浏览器开发链路、localStorage 存档、标准 Gamepad API 和全屏能力。

## 选项

| 方案 | 优点 | 主要代价 |
|---|---|---|
| Tauri 2 + 系统 WebView2 | 本机已有 Rust 与 WebView2；可直接嵌入 `dist/`；可执行文件较小；无 Node 运行时 | 构建时需要 Rust crates；安装包仍需后续引入 NSIS/WiX |
| 直接 C#/C++ WebView2 | 控制最细，纯 Windows 原生 | 本机没有 .NET SDK/MSBuild；需要自行实现资源协议、窗口生命周期、权限和安装器 |
| Electron | 工具成熟、调试方便 | 自带 Chromium/Node，包体和内存明显偏大，与当前轻量目标冲突 |

## 决策

选择 **Tauri 2 + 系统 WebView2**。第一阶段仅提供便携式 exe：本地资源、窗口标题/尺寸/图标、localStorage、全屏和崩溃日志。暂不开放文件系统、Shell、网络或任意命令权限。

运行资源由 `scripts/stage-desktop.mjs` 从活动素材目录生成到 `dist/`，只复制 Content/Art Catalog 当前引用的 WebP、字体和网页文件；历史 PNG 与停用素材保留在 `art/`，不再重复放入 `web/assets/`，也不嵌入 exe。

## 后果

- 开发仍使用 `npm.cmd run play`，不依赖 Rust；
- 发布构建使用 `npm.cmd run stage:desktop` 后在 `src-tauri` 执行 `cargo build --release`；
- 目标机必须具备 WebView2 Runtime。Windows 11 通常预装，Windows 10 发布包后续应增加 Evergreen Bootstrapper 检测；
- MSI/NSIS、代码签名、自动更新和 Steam 接口不属于本次最小原型。
