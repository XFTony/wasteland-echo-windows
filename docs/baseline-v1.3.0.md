# 《荒原回响》v1.3.0 冻结基线

日期：2026-09-19  
用途：H0 结束后的可复现起点；后续寻路、安装器、模块拆分和内容包均以本页为比较基线。

## 构建与发布

- package / Tauri / 页面版本：`1.3.0`；
- 浏览器 bundle：426,516 bytes / 54 模块；
- 精简 `dist/`：5,010,540 bytes / 15 个清单文件，活动 WebP/字体/页面资源，不含 PNG 与停用部署素材；
- 便携 exe（历史归档）：`archive/releases/v1.3.0/WastelandEcho-v1.3.0-win-x64.exe`，13,139,968 bytes；
- SHA-256：`4CC0899009BA6F9A0C198F5E0FDFF613098B2A59A592B4E1BB69FFBF71865A4C`；
- exe 文件版本与产品版本均为 `1.3.0`，启动/标准关闭冒烟通过；本页冻结时尚无安装器。随后生成的 v1.3 NSIS 产物与说明一并归档在 `archive/releases/v1.3.0/`，仍未签名。

## 自动验证

- H0 后：137/137 Node 测试通过；
- 固定 seed `20260907`：180 秒坚守获胜，203 击败，最终生命 15.26；
- 固定 seed `20260907`：600 秒无尽保持运行，1510 击败，3 波 Boss；
- 视觉基线：`output/playwright/v13-map-data/`、`v13-settings/`、`v13-gameplay/`。
- H0 设置页基线：`output/playwright/v13-h0/`；
- H0 已将旧部署源码移动到 `archive/code/ui/`，活动 `src/` 与 bundle 均无引用。

## 当前已知限制

1. 敌人有碰撞、分离和局部角色行为，但没有全局绕障流场；
2. 便携 exe 可用，但安装器、代码签名和 Win10 WebView2 缺失引导未完成；
3. 四部位装备共 6 件，腿甲与靴子各只有 1 件；
4. `canvas-renderer.js` 与 `game-model.js` 仍然偏大；
5. 自动代理不是首局真人胜率、实体手柄延迟或 1% low 结论。
