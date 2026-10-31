# 组件目录与安全修改入口

当前玩法、UI和活动素材以`godot/`为准。已有20武器、42升级、3地图；内容数量与参数以Resource和原生测试为准。[旧Canvas组件表](history/canvas-tauri-components.md)保留作历史对照。

| 需求 | 主要文件／目录 | 对应检查 |
|---|---|---|
| 入口与状态协调 | `godot/scripts/game_root.gd`、`core/game_session.gd`、`core/run_simulation.gd` | runtime、foundation |
| 武器数值／攻击 | `godot/content/weapons/`、`core/arsenal.gd`、`core/weapon_actions.gd`、`core/combat_system.gd` | combat、survival-builds、fieldcraft |
| 敌人／刷怪／首领 | `godot/content/enemies/`、`core/enemy_brain.gd`、`core/spawn_system.gd`、`core/boss_system.gd` | foundation、combat、survival-builds |
| 升级与实际效果 | `godot/content/upgrades/`、`core/upgrade_rules.gd`、`core/workshop_rules.gd` | survival-builds、fieldcraft |
| 交易站／塔台 | `core/field_market.gd`、`core/structure_system.gd`、`core/economy_rules.gd` | survival-builds、map-art |
| 角色／武器／受击表现 | `presentation/character_visual.gd`、`combat_impacts.gd`、`weapon_feedback.gd`；`godot/assets/` | fieldcraft、实际方向与倒地截图 |
| 地图／碰撞／遮挡 | `godot/scenes/maps/`、`scripts/world/`、`content/map_art/` | map-art、实际地图窗口 |
| 菜单／HUD／升级卡 | `godot/scripts/ui/`、`content/ui/card_layouts/` | ui-interaction、card-layout |
| 音乐／音效 | `presentation/native_audio.gd`、`godot/assets/audio/` | input-audio、实际听感 |
| 输入／焦点 | `godot/scripts/input/game_input.gd`、`scripts/game_root.gd` | input-audio、ui-interaction、实体手柄 |
| 存档／导入与恢复 | `godot/scripts/persistence/`、`scripts/tools/save_transfer_view.gd` | foundation、save-transfer；隔离路径 |
| 导出／来源与版本 | `scripts/godot/`、`godot/export_presets.cfg` | 原生版本检查、package自检、SHA |

表中`core/`、`presentation/`为`godot/scripts/`下目录；文件未写前缀时沿用同一目录。美术源文件、许可与可编辑材料见[文件导航](project-file-guide.md)和[资源索引](assets/asset-catalog.md)。

## 修改顺序

1. 从最新main创建短期`codex/主题`分支，确认没有未提交的他人改动。
2. 确定唯一权威数据与系统拥有者，修改实际规则或资源，不通过UI虚构数值。
3. 运行相关原生检查，再执行完整合并门槛；改变画面时保存真实截图。
4. PR写清玩家变化、验证范围、风险与回退。通过Quality汇总检查后合并，清理已整合分支。

不要为新功能同时修改旧Canvas与原生两份逻辑，不直接编辑生成bundle，不删除仍服务于回归或素材来源的旧文件。删除流程见[清理报告](cleanup/retirement-report.md)。
