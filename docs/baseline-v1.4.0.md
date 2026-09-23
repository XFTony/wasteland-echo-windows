# 《荒原回响》v1.4.0 冻结基线

冻结日期：2026-09-20  
平台：Windows 10/11 x64，浏览器开发版 + Tauri 2 / WebView2 桌面版  
状态：H0～H5 完成，可进入真人手感与内容扩充阶段

## 版本与构建

- package、页面、Tauri、Cargo、设置页版本：`1.4.0`；
- `web/game.bundle.js`：458,392 bytes，63 个模块；
- `dist/`：5,043,820 bytes，16 个文件；
- 便携版：`release/WastelandEcho-v1.4.0-win-x64.exe`，13,197,312 bytes；
- NSIS 安装版：`release/WastelandEcho-v1.4.0-win-x64-setup.exe`，6,888,067 bytes；
- 便携 zip：`release/WastelandEcho-v1.4.0-win-x64-portable.zip`，7,314,059 bytes；2026-09-21 仅刷新包内发布说明，exe/setup 未变化；
- exe 文件版本与产品版本均为 `1.4.0`，Authenticode 状态为 `NotSigned`。

## 自动验证

- `npm.cmd run verify`：153/153 项测试通过；
- 180 秒正常生命坚守：获胜，235 击败，最终生命 61.18，RSS 峰值 55.82 MiB；
- 600 秒无尽压力：持续运行，1431 击败，3 波 Boss，RSS 峰值 117.41 MiB；
- 安装器：静默安装成功，安装后程序存活运行 3 秒，标准卸载返回 0，卸载项与安装目录均移除；
- 安装/卸载 QA 使用 `scripts/qa/smoke-installer.ps1`，不会覆盖已存在的同名安装，也不会手工删除用户数据目录。

## 真实浏览器视觉验收

- `output/playwright/v14-h5/tutorial-hud-1280x720.png`：六步教学铭牌、HUD 与控制提示无冲突；
- `output/playwright/v14-h5/result-stats-1280x720.png`：九项结算数据、按钮和底层遮罩清晰；
- `output/playwright/v14-h5/inventory-equipment-1920x1080.png`：新增腿甲/靴子、人物图层、属性板和 20 格背包无越界；
- `output/playwright/v14-h5/evolution-cards-1920x1080.png`：动能回路、电弧战术网和既有终局进化卡在 1080p 完整可读。

## 发布物 SHA-256

```text
483DEABF88C7BD92A750DA176D6425700317032D6849F4B3D51C91B5E374D5AF  WastelandEcho-v1.4.0-win-x64.exe
53331136ACB57BD8D63E920484BBED4BF0B144547A9E0C87017DD2C7F0DCFFEF  WastelandEcho-v1.4.0-win-x64-setup.exe
0C36D1B715B8FEDE9B1C3125DAFCD05B837CE6E1F43A1317F5E1B9A68AC4BD7A  WastelandEcho-v1.4.0-win-x64-portable.zip
```

## 已知边界

- 未配置商业代码签名，SmartScreen 可能显示“未知发布者”；
- 实体 Xbox/第三方 XInput 手柄、Windows 10 实机和 8 分钟真人长局仍需人工体验；
- 内置浏览器连接器在当前宿主中报 `failed to write kernel assets`，属于工具临时目录问题；独立 Chromium 已完成本轮真实截图，不以 HTTP 200 或 Canvas mock 代替视觉验收；
- 本地战绩、熟练度和最近 20 局只保存在设备上，不含账号、云同步或遥测上传。
