# Windows 发布清单

## 自动构建

```powershell
npm.cmd run verify
npm.cmd run build:desktop
npm.cmd run build:installer
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\qa\smoke-installer.ps1 -InstallerPath release\WastelandEcho-v1.4.0-win-x64-setup.exe
```

## 产物

- `WastelandEcho-v1.4.0-win-x64.exe`：便携版；
- `WastelandEcho-v1.4.0-win-x64-portable.zip`：便携版与发布说明；
- `WastelandEcho-v1.4.0-win-x64-setup.exe`：当前用户 NSIS 安装版；
- `SHA256SUMS.txt`：所有公开产物校验和。

## 人工验收

1. Windows 11：安装、开始菜单启动、完成一局、退出、卸载；
2. Windows 10：有/无 WebView2 两种环境，确认 Evergreen 引导可理解；
3. 便携版和安装版分别建立存档，确认不会破坏已有 LocalStorage；
4. 键鼠完整流程；Xbox 有线、蓝牙、热插拔和拔出清零；
5. SmartScreen/未知发布者文案与发布页保持一致；
6. 若使用真实证书，通过 `scripts/sign-windows.ps1` 注入，禁止把 PFX 密码写进仓库。
