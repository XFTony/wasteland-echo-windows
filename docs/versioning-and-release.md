# 《荒原回响》Git 与版本发布规则

状态：现行规则。适用于 Windows 桌面版源码仓库 XFTony/wasteland-echo-windows。此文档管理以后每一次迭代；旧版基线文档保留为历史证据。

## 1. 各类文件放在哪里

| 内容 | 存放位置 | 规则 |
|---|---|---|
| 源码、测试、脚本、规格、许可、美术源图和少量精选截图 | Git main 与功能分支 | 每次修改留下可说明的提交 |
| 游戏 bundle、dist、Rust target、node_modules | 本地构建或 CI 缓存 | 可以再生，不提交 |
| 安装器、便携版 zip、SHA256SUMS、版本说明 | 对应版本的 GitHub Release | 文件名、版本号、标签必须一致 |
| 完整 QA 截图和录屏 | output 本地目录；需要长期保存的关键证据可打包为 Release 附件 | 不把每次自动截图全部放进 Git |
| README 展示图 | 精选、压缩、去除个人信息后放进 docs/screenshots | 只保留能说明实际游戏体验的少数图片 |
| 证书与密码、用户存档 | 不进入 Git、Actions 日志或 Release | 签名时从安全凭据来源注入 |

GitHub 上的安装包不能代替源码标签；本地 Git、远端 Git 和 Release 附件也不能代替对用户存档的独立备份。

## 2. 分支与提交

- main 始终保持可构建。涉及玩法、存档、输入、发布脚本或较大 UI 变更时，从 main 建短期分支，命名为 feat/主题、fix/主题、docs/主题或 chore/主题。
- 每个分支只解决一个可描述的问题；通过 Pull Request 汇总变更、验证证据、风险与回退方法，再合并 main。不要长期保留独立 develop 分支。
- 提交标题使用 feat:、fix:、docs:、test:、chore: 或 refactor: 前缀，正文解释原因和兼容影响。修改存档 schema 或稳定内容 ID 时，单独指出迁移策略。
- 不强推共享分支，不移动已发布的版本标签，不把安装包、用户数据、个人路径或凭据塞进源码历史。回退已合并改动时新增 revert 提交。
- 每次提交或 PR 运行 npm run check；画面和操控改动另附真实截图或试玩记录。GitHub Quality 工作流是远端确定性门槛，不把本机 Edge 帧率视为 CI 通用门槛。
- 当前仓库由单人维护。待 Quality 工作流首次跑通后，建议为 main 启用 PR 与名为 check 的必过状态检查，并禁止强推和删除。

## 3. 版本号与标签

- 采用 MAJOR.MINOR.PATCH；开发预览按 1.5.0-alpha.2、1.5.0-beta.1、1.5.0-rc.1 递进，稳定版为 1.5.0。影响旧存档或玩法的重大兼容改变须在版本说明中写明。
- package.json 是版本号编辑入口。package-lock.json、src/version.js、web/index.html、src-tauri/Cargo.toml、src-tauri/Cargo.lock、src-tauri/tauri.conf.json 和对应版本说明必须一致；npm run check:version 会核对。
- 先合并已验证的源码，再从该提交构建、安装测试、打 v版本号 标签，并创建同版本 GitHub Release。标签必须指向实际用于构建的源码提交；发布后不移动标签。修复发布包使用下一个版本号。
- 现有 baseline-2026-09-23 只是日期基线，不是玩家版本标签。当前 Git 历史起始于 v1.5 开发状态；没有能准确代表历史 v1.4.0 安装包的源码提交，不能把当前提交伪装成 v1.4.0。
- 本地同名 v1.5.0-alpha.1 预览包曾重建多次，因此建议首次正式 GitHub 预发布使用新的 v1.5.0-alpha.2，而不是补用 alpha.1 标签。

## 4. 一次普通迭代

1. 在 main 更新后创建短期分支，先写清目标和可观察的完成标准。
2. 实现一组相关改动；存档、经济、战斗、输入要有对应回归。修改 UI 时保存同分辨率前后截图，并记录真实设备待验事项。
3. 运行 npm run check。失败先修复，再提交；不要为使流程变绿而降低产品门槛。
4. 提交分支、发 PR，按模板填写玩家变化、验证、风险与回退；等待 GitHub Quality 检查通过。
5. 合并 main，删除已合并短期分支；把玩家可见变化记在 CHANGELOG.md 的“未发布”。

## 5. 一次预发布或稳定发布

1. 冻结范围，填写 CHANGELOG.md 与对应 docs/release-notes/README-v版本号.txt；明确新功能、修复、兼容和已知问题。
2. 修改 package.json 版本并同步 package-lock.json、src/version.js、Cargo.toml、Cargo.lock 与 tauri.conf.json。运行 npm run check:version 和 npm run check。
3. 运行 npm run verify，包含系统 Edge 快速性能场景；正式候选再跑完整浏览器矩阵和 WebView2 长局。单机模拟只证明可复现性，不证明真人胜率。
4. 在干净的同一提交上运行 npm run build:installer，生成 exe、setup、portable zip 和 SHA256SUMS。运行 npm run release:check:candidate 核对文件与校验值，保留构建记录与签名状态。
5. 按 docs/release-checklist.md 完成安装、启动、退出、重启存档、卸载、键鼠与实体手柄检查。发布门槛未过则继续修复并递增预发布号。
6. 确认源码提交与构建一致，再打不可移动的 v版本号 标签；运行 npm run release:check 确认标签、干净工作区和附件校验值，然后推送标签。创建同名 GitHub Release；alpha、beta、rc 标记为 Pre-release，稳定版才标 Latest。附件包含安装器、便携 zip、SHA256SUMS 和面向玩家的版本说明；独立 exe 可选。
7. 从 GitHub 下载一份附件，复算 SHA256 并启动验证；在项目计划中记录 Release URL、提交 SHA、设备验收和已知限制。

不要用 GitHub Release 自动生成的源码压缩包冒充 Windows 安装包。不要因为构建和自动测试通过就宣称实体手柄、低配机或签名已验收。

## 6. 故障与回退

- 发现未发布问题：在短期分支修复，继续使用当前开发版本；对外发布前重新检查。
- 预发布后发现问题：保留旧 Release 与标签，发布下一个 alpha/beta/rc；在旧 Release 标明已知问题并指向新版本。
- 稳定版重大故障：从稳定标签建立 fix/主题，修复后发布 PATCH 版本；不覆盖原安装包或移动旧标签。
- 任何存档 schema 调整都保留旧档迁移测试，并先备份真实用户数据。仅回退代码不保证新存档能被旧程序读取。
- GitHub 服务不可用时，本地已提交分支继续开发；恢复后检查远端差异再推送，不强推解决冲突。

## 7. 计划中的版本台阶

这些是范围和验收门槛，不是承诺日期。具体功能优先级以 optimization-plan-2026-09-23.md 和真人试玩记录为准。

| 建议版本 | 焦点 | 必须有的证据 |
|---|---|---|
| v1.5.0-alpha.2 | 固定 Git/CI/发布流程，推进存档与首局问题，取得真人七局初始记录 | Quality 通过、安装/卸载演练、记录到具体局号的反馈 |
| v1.5.0-beta.1 | 首局可读性、战斗危险反馈、撤离目标语言、手柄手感和多 seed 平衡 | 键鼠与实体手柄完成全流程，失败原因可解释 |
| v1.5.0-rc.1 | 冻结功能，以兼容、性能、长局、存档和安装分发为主 | Windows 10/11 与 WebView2 人工矩阵、版本与 SHA 完整 |
| v1.5.0 | 稳定发布 | 所有阻断项关闭；未签名、素材条款等状态如实说明 |
| v1.6.0 及以后 | 依据玩家数据选择无尽中期、英雄身份、地图遭遇和本地挑战 | 每个新机制有独立设计、回归和真人反馈 |
