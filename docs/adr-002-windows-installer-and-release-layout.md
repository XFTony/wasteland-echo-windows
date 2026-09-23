# ADR-002：Windows 安装器与发布目录

状态：已接受  
日期：2026-09-21  
承接：ADR-001

## 背景

ADR-001 选定 Tauri 2 + WebView2，并以便携 exe 验证桌面外壳。v1.4 需要可卸载、可从开始菜单启动、能在缺少 WebView2 时给出引导的普通 Windows 分发形式，同时保留无需安装的便携版。

## 决策

- 使用 Tauri 2 的 NSIS bundle，安装模式为 `currentUser`，不要求管理员权限；
- WebView2 使用 `downloadBootstrapper`，目标机已安装时跳过；
- `package.json` 是版本号单一来源，构建脚本据此命名 exe、setup、zip 与发布说明；
- `release/` 只放当前版本，旧版本完整移动到 `archive/releases/<version>/`；
- 当前同时输出便携 exe、NSIS setup、便携 zip 与 `SHA256SUMS.txt`；
- 代码签名脚本只接受外部注入证书，不在仓库保存 PFX 或密码；
- `scripts/qa/smoke-installer.ps1` 负责“无已有同名安装”前提下的安装、启动存活和标准卸载测试，不手工删除用户数据。

## 后果

- v1.4.0 已验证当前用户安装、3 秒启动存活、标准卸载和安装目录清理；
- 存档继续位于 `%LOCALAPPDATA%\com.wastelandecho.desktop\EBWebView`，卸载测试不会主动删除；
- 未配置商业证书时 Authenticode 状态仍为 `NotSigned`，SmartScreen 可能提示未知发布者；
- 发布前仍需 Windows 10、Windows 11、实体手柄和签名包人工矩阵。
