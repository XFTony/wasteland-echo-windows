# Windows 版本发布核对表

现行版本策略和分支规则见 versioning-and-release.md。每个版本复制此表到对应发布记录，填写实际设备、构建提交和结果；不能把旧 v1.4.0 的验收记录直接沿用到新版本。

## 基本信息

| 项目 | 本次记录 |
|---|---|
| 版本号与源码提交 SHA |  |
| 发布类型：预发布 / 稳定版 |  |
| Windows、CPU、GPU、分辨率与缩放 |  |
| 使用的键鼠与实体手柄 |  |
| 计划发布者与复核日期 |  |

## 自动门槛

- [ ] package、package-lock、游戏、Cargo、Tauri 和版本说明一致：npm run check:version
- [ ] Git 工作区干净；PR 的 Quality/check 已通过，代码已合入 main
- [ ] npm run check 通过：构建、Node 测试、多策略模拟、600 秒无尽压力模拟、素材审计
- [ ] npm run verify 通过：额外运行本机 Edge 快速性能场景
- [ ] 正式候选完成完整浏览器性能矩阵；记录硬件和真实 1% low
- [ ] npm run build:installer 成功；预发布进入 output/builds/v版本号，稳定版进入 release
- [ ] exe、setup、portable zip、SHA256SUMS 与版本说明同号；npm run release:check:candidate 核对 SHA256
- [ ] 确认 Authenticode 状态；未签名就如实写在玩家说明中

## 人工门槛

- [ ] Windows 11：安装、开始菜单启动、退出、重启、卸载；核对存档未被卸载清除
- [ ] Windows 10：已有和缺少 WebView2 的设备各检查一次安装引导
- [ ] 便携版与安装版分别建档、退出、重启，确认旧档与新档可读
- [ ] 键鼠完成菜单、部署、战斗、升级、暂停和结算
- [ ] 标准手柄完成相同流程；检查有线、蓝牙、热插拔和拔出清零
- [ ] 8 分钟以上真实 WebView2 长局记录帧率、内存趋势、音频与操作延迟
- [ ] 检查 720p/1080p/1440p 的关键页面、提示和危险信息
- [ ] 存档迁移、失败复盘、奖励只发一次和重开路径在实际窗口中复验

## GitHub 发布

- [ ] 标签 v版本号 指向本次构建源码提交；npm run release:check 通过，既有标签不移动
- [ ] GitHub Release 与标签同名；alpha/beta/rc 勾选 Pre-release
- [ ] 上传 setup、portable zip、SHA256SUMS 与面向玩家的版本说明；独立 exe 可选
- [ ] 从 GitHub 下载一份附件，重算 SHA256 并启动检查
- [ ] 在 CHANGELOG 和项目执行计划记录下载链接、提交 SHA、手动验收结果与已知限制

安装器烟测脚本 scripts/qa/smoke-installer.ps1 要求测试机器没有同名现存安装；运行前先盘点，避免干扰用户正在使用的安装。真实签名通过 scripts/sign-windows.ps1 注入证书，禁止把 PFX 或密码提交仓库。
