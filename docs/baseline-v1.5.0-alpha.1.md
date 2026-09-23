# 《荒原回响》v1.5.0-alpha.1 开发基线

冻结日期：2026-09-21  
性质：技术与玩法预览，不替代 v1.4.0 稳定发布  
正式 v1.5.0 阻断项：真人键鼠/手柄三章、CombatSim/SpawnSystem 继续拆分、机制化升级与 BossDefinition

## 构建

- package / 页面 / Tauri / Cargo：`1.5.0-alpha.1`；
- 浏览器 bundle：466,259 bytes / 65 个活动源码模块；
- `dist/`：5,051,695 bytes / 16 个文件；
- 活动美术：10 个 WebP，字体与许可 2 项；无未登记 Web 文件；
- 开发依赖：`playwright-core`，不进入 bundle、dist、exe 或安装包；
- 稳定发布物仍为 `release/WastelandEcho-v1.4.0-*`；exe/setup 未覆盖，便携 zip 仅因 W0 规则说明同步而刷新 README 与对应 SHA。
- alpha 便携 exe：`output/builds/v1.5.0-alpha.1/WastelandEcho-v1.5.0-alpha.1-win-x64.exe`，13,199,872 bytes；
- alpha NSIS setup：6,889,007 bytes；便携 zip：7,318,564 bytes。

## 验证

- `npm.cmd run verify` 全链通过；
- Node：171/171；
- 六策略正常生命矩阵：2/6 通关；
- 600 秒压力无尽：保持 running，2207 击败，3 波 Boss，峰值 104 敌人，RSS 峰值 103.37 MiB；
- Edge 快速门槛：720p/80 敌人和 1080p/120 敌人均无页面错误；
- Edge 完整矩阵：18 场景最低 1% low 72.46 FPS，无 >33.3 ms 严重帧；
- 材料审计：65/65 源码模块入 bundle，10/10 运行图片登记，0 缺失 manifest，0 冗余 Web 副本。
- alpha 安装器：安装版本 `1.5.0-alpha.1`，程序存活 3 秒，官方卸载返回成功，卸载项与安装目录已移除。

## Alpha SHA-256

```text
353AD245D1940E3CD40A5CB5A8ADB4E6B1B0625C363E32D00202B7EA76F5B820  WastelandEcho-v1.5.0-alpha.1-win-x64.exe
7435FA0BECCA8B4947B52DF7D12900695C642DCF6A758F3101A52527B3E95FEC  WastelandEcho-v1.5.0-alpha.1-win-x64-setup.exe
F1B832FD6CF3EE2AC4AF939547E222EF37E49675A18F901DA8637278FA2C29BA  WastelandEcho-v1.5.0-alpha.1-win-x64-portable.zip
```

## 本轮结构变化

- EnemyBrain 抽离角色移动/动作参数；
- action 字符串只在 UI 边界解析，handler 表接收显式 command；
- 玩家碰撞使用障碍空间网格；
- 穿透弹使用池内 Set 记录命中；
- 三档体型导航、薄障碍补充烘焙和世界连通性验证；
- 多策略模拟、承伤来源、升级顺序、Boss 时长和铜币曲线；
- 失败结算显示 seed 与针对性复盘建议；
- blur 与 visibilitychange 统一暂停；
- 活动素材树与历史归档分离。

## 真实截图

- `output/playwright/v15-alpha/settings-policy-1280x720.png`；
- `output/playwright/v15-alpha/failure-advice-wide-1280x720.png`；
- `output/playwright/v15-alpha/failure-advice-wide-1920x1080.png`。

## 已知边界

- W0.1 真人记录与实体手柄仍待用户完成；
- Edge 基准为当前机器 headless 数据，不是低配机承诺；
- 三档流场改变敌群路径，v1.4 平衡数字不再作为 alpha 调参依据；
- 动态障碍、撤离目标流场、完整 Boss 定义表、机制升级、规则解锁和熟练度奖励仍在 v1.5 路线中；
- Authenticode 仍未签名，license 仍为 `UNLICENSED`，生成资产商业条款仍待发行前复核。
