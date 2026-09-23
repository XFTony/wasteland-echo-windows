# 2026-09-23 v1.5.0-alpha.1 本地构建记录

用途：本次优化的可试玩 Windows 预览包；不是正式 v1.5.0 发布。构建目录：`output/builds/v1.5.0-alpha.1/`。`release/` 中 v1.4.0 稳定版未覆盖。

## 验证

- `npm.cmd run verify`：195/195 Node 测试；六策略正常生命矩阵 3/6 通关；600 秒无尽压力模拟保持运行；系统 Edge headless 720p/1080p 快速采样无页面错误。
- `npm.cmd run build:desktop`：Tauri release 编译通过。
- `npm.cmd run build:installer`：NSIS setup、便携 exe、zip 与 SHA 清单生成通过。
- SHA 清单用独立 Node.js SHA-256 计算逐项复核，3/3 一致；zip 含 exe 与本版说明。
- 本轮未执行安装器的实际安装/卸载或实体手柄真人试玩；签名状态和发布门槛仍以发布清单为准。

## 产物

| 文件 | 大小（字节） | SHA-256 |
|---|---:|---|
| `WastelandEcho-v1.5.0-alpha.1-win-x64.exe` | 13,212,160 | `C8806BFD4F11040BCB7FF1F679182B2826AFAE74AD981E9A976C0CFD448BAFA5` |
| `WastelandEcho-v1.5.0-alpha.1-win-x64-setup.exe` | 6,907,084 | `185B7C3079C8C91E7A202F8D66BFAB7128663AF14DEE938A2AFBF195515C20E7` |
| `WastelandEcho-v1.5.0-alpha.1-win-x64-portable.zip` | 7,331,192 | `863DA042C5E9FE1D0DC8CDF375AF0FE24DD72E3E3A6E4431CF5808D4B6649126` |

相同版本号的 alpha 预览包曾在 2026-09-21 构建；本记录的哈希用于准确区分本轮产物。对外分享前建议递增 alpha 版本号，避免旧文件被误认为相同内容。
