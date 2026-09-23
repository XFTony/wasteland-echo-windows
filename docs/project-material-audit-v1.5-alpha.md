# 《荒原回响》项目材料与冗余审计

审计日期：2026-09-21  
审计基线：v1.4.0 冻结版  
当前开发线：v1.5.0-alpha.1  
机器可读结果：`docs/project-material-audit-1.5.0-alpha.1.json`  
复查命令：`npm.cmd run audit`

## 1. 审计范围

- 活动源码、浏览器 bundle、Tauri staging 和发布脚本；
- `web/assets` 运行素材、`art/generated` 源图/中间稿/历史运行图；
- 字体、许可、素材台账和 manifest；
- `release` 当前发布物、旧版本发布物、历史截图与临时 Playwright 快照；
- `dist`、`src-tauri/target`、`node_modules` 等可再生目录；
- README、规格、ADR、基线、平衡与测试矩阵的一致性。

## 2. 清理前发现

| 项目 | 清理前状态 | 判断 |
|---|---:|---|
| `web/assets` 文件 | 29 | 同时混放活动 WebP、PNG 源副本和停用 UI |
| 与 `art/generated` 逐字节相同的 Web PNG | 17 份 / 32,727,319 bytes | 真冗余；归档中已有完整副本 |
| 活动美术注册表 | 17 项，其中 7 项 inactive | 停用定义仍进入 bundle，属于死配置 |
| 活动 `src/*.js` | 63 个，bundle 收集 63 个 | 无孤儿源码 |
| manifest 缺失路径 | 0 | 完整 |
| `release` | v1.3 与 v1.4 混放 | 应按“当前发布 / 历史归档”分层 |
| 根目录 `.playwright-cli` | 20 个历史 YAML | 工具临时产物，应归入 `output` |
| `src-tauri/target` | 约 1.38 GiB | Rust/Tauri 可再生构建缓存，不是项目素材 |

## 3. 已执行优化

1. 17 份 Web PNG 在删除前逐一校验 SHA-256，确认均有 `art/generated` 完全相同副本后移出活动树；唯一素材没有删除；
2. `asset-catalog.js` 只保留 10 项活动素材；7 个停用稳定 ID 与文件仍由 `art/manifest.json` 和版本归档保存；
3. 移除 Canvas 初始化中两个永远为 `null` 的旧破框怪物读取，以及未被活动页面调用的 overlay 绘制函数；
4. WebP 生成脚本改为直接读取 `art/generated` 原图，`web/assets` 只承担优化运行副本和字体；
5. v1.3 的 exe/setup/zip/说明移动到 `archive/releases/v1.3.0`；`release` 只保留当前稳定版；
6. 20 个根目录 Playwright 快照移动到 `output/playwright/legacy-cli-snapshots`；
7. 素材台账、生成说明、历史美术文档和 README 均改为归档路径；
8. 新增自动材料审计，检查活动源码是否入 bundle、catalog/manifest 路径、未登记 Web 文件、重复哈希与历史发布物混放。

## 4. 当前材料边界

### 活动运行树

- `web/assets`：10 个活动图片 WebP + 字体及许可；
- `src/render/art/asset-catalog.js`：只含活动 ID；
- `dist`：由 staging 重新生成，只复制活动 catalog、字体、HTML/CSS/bundle；
- `release`：只放当前稳定发布物及 SHA。

### 必须保留的归档

- `art/generated/v1.0～v1.2`：源图、透明失败稿、洋红中间稿、提示词和历史运行图；
- `archive/code/ui`：旧部署实现；
- `archive/releases`：历史可执行发布物；
- `output/playwright`：真实视觉验收证据；
- `docs/assets-sources` 与 `docs/licenses`：字体上游包和许可证。

### 可再生但本轮不删除

- `src-tauri/target`：约 1.38 GiB，删除可释放空间，但会显著增加下一次 Rust/NSIS 构建时间；
- `node_modules`：仅开发期 `playwright-core`，不进入运行 bundle、dist 或 exe；
- `dist` 和 `web/game.bundle.js`：构建产物，但测试与桌面封装需要当前副本；
- 历史截图：约 71 MiB，属于视觉回归证据。

## 5. 仍存在但合理的重复

审计剩余的重复哈希只出现在 `art/generated` 内部，主要是：

- ImageGen 原图与当时运行快照内容完全相同；
- 棋盘格失败稿与编辑目标留档；
- source/runtime 语义分层。

这些文件承担生成过程、失败证据和可复现性，不进入发布包，本轮不做破坏性去重。

## 6. 合规结论

- Fusion Pixel Font 的上游包、OFL 与运行许可副本齐全；
- 生成美术均登记到台账，活动与归档路径已一致；
- OpenAI 生成资产仍标记为“商业发布前复核服务条款”，不能误写为已完成商业法律审查；
- 项目 `license` 仍为 `UNLICENSED`，这是发行决策而非技术冗余，留到 W6 由用户确定；
- 当前商业代码签名仍未配置。

## 7. 防误删规则

1. 删除 `web/assets` 文件前必须存在 manifest 对应归档且 SHA 相同；
2. `art/generated`、`docs/licenses`、`docs/assets-sources` 不参与自动清理；
3. 旧版本发布物只移动到 `archive/releases`；
4. `web/game.bundle.js` 禁止手改；
5. `src-tauri/target` 只能由明确的“清构建缓存”操作删除，不能与素材清理混在一起。
