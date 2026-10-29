# Godot 原生迁移技术样板

本目录用于检验《荒原回响》能否复用现有素材、地图数据和持握结构迁移到 Godot。它不是现有完整游戏的替代版；原游戏仍从原Windows包运行，正式存档不在本样板中读取或改写。

## 运行

本机 Godot：`D:\Godot\Godot_v4.7.2-stable_win64_console.exe`，实测版本 `4.7.2.stable.official.ed1daf0bf`。需要现有 Node.js 来从主项目生成样板数据；游戏运行本身使用 Godot/GDScript。

- 双击[启动样板.cmd](启动样板.cmd)：自动复制所需的现有运行素材、导出原数据、导入Godot，再启动样板。
- 双击[打开编辑器.cmd](打开编辑器.cmd)：同样完成准备后进入Godot编辑器。
- WASD移动，1/2/3切换手枪/激光/重锤，空格切换自动攻击，M切换敌人移动，R重置靶群，Esc暂停。
- 资源缺失时重新运行启动脚本；`imported/`是可再生数据，`.godot/`是编辑器缓存，不提交Git。脚本UID随源代码保存。

## 已实现的验证范围

- 从当前内容注册表导出三武器原数值、握点、身体/手/袖口图层，保留稳定ID。
- 复用16个现有文件共1,163,006 bytes：主角、两类敌人、枪体/手/袖口、地表/部分地图道具、四个短声音；新像素武器直接由现有矩形描述生成原生纹理。
- 导入回声旧城的17个原始障碍矩形，用Godot原生物理形状建立碰撞。道路和地表仅作数据导入展示，尚未移植完整地图绘制效果。
- 使用Sprite2D独立部件、CharacterBody2D、Camera2D与60Hz物理循环，原生运行移动、步相、简化追击、自动目标、手枪弹丸、激光射线和重锤动作。
- 用原JavaScript姿态生成24个参考样例，对照Godot握点与枪口位置，最大误差约0.000018世界单位。
- 社区MCP已在此样板上实际创建场景、添加Sprite2D、加载主角纹理；未将其注册进Codex全局设置。

## 明确没有迁移的内容

完整敌人职业/流场导航、分离和实体池、余下武器、全量技能与进化、击退/消弹全部细节、拾取经济、交易站商店、塔台、Boss、全套菜单、手柄、旧存档导入、完整音频调度、发布构建与低配长局。

UI中的E交互计数仅为位置触达探针，不是购物；敌人只有简化追击与加高耐久，不代表正常难度。画面的道路、地表比例与遮挡尚未做美术一致性迁移，不能按此判断Godot画质上限。

## 复验

```powershell
node scripts/godot/prepare-pilot.mjs
& 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe' --headless --path experiments/godot-pilot --editor --import
& 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe' --headless --path experiments/godot-pilot -- --probe
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/godot/setup-mcp.ps1
node scripts/godot/verify-mcp.mjs
```

日志、截图、MCP结果和可复制的配置示例在 `output/godot-evaluation-2026-10-29/`。MCP及其依赖只在该输出目录，不进入现有游戏、Godot样板或正式发布包。

完整评估见[本机Godot工具与迁移验证报告](../../docs/godot-local-feasibility-2026-10-29.md)。
