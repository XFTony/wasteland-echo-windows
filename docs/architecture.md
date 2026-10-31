# 《荒原回响》原生架构

当前开发权威是 `godot/`。Godot 4.7.2、CanvasItem/Control、GDScript、AudioStream与Resource组成独立Windows游戏；旧Canvas/Tauri实现仅用于回归、迁移对照和回退。旧架构全文见[历史归档](history/canvas-tauri-architecture.md)。

## 组合与数据流

```text
scenes/game_root.tscn + scripts/game_root.gd
  ├─ GameCatalog：content/中的原生定义、素材登记与metadata
  ├─ GameSession：菜单选择、个人进度、商店、界面与存档协调
  ├─ GameInput：键鼠／手柄 → 规范化输入
  ├─ RunSimulation：60Hz局内状态与系统编排
  │    ├─ CombatSystem / Arsenal / WeaponActions
  │    ├─ EnemyBrain / BossSystem / MechanicSystem
  │    ├─ ProgressionSystem / UpgradeRules / FieldMarket / StructureSystem
  │    └─ GeometryRules / FlowNavigation / EntityPool / SpatialGrid
  ├─ WorldView：MapScene、角色、武器、受击与层级表现
  ├─ MenuView / BattleView：原生Control、焦点与交互
  └─ NativeAudio：事件声音、主题音乐与混音

输入 → RunSimulation.tick → 规则状态 + 事件
事件 → WorldView / NativeAudio / 操控反馈
界面动作 → GameSession或RunSimulation的命令入口
个人进度 → SaveStore → SaveCodec + FileStorage → user://
```

## 权威边界

| 内容 | 修改位置 | 约束 |
|---|---|---|
| 武器／敌人／升级定义 | `godot/content/` | 稳定ID与存档字段保持兼容；新增字段验证实际效果 |
| 规则与时间推进 | `godot/scripts/core/` | 固定60Hz；表现不直接改战斗状态 |
| 地图布局与阻挡 | `godot/scenes/maps/`、`scripts/world/` | 障碍footprint同步碰撞／导航；贴图不充当碰撞依据 |
| 画面与声音 | `godot/assets/`、`scripts/presentation/`、`scripts/ui/` | 原图在art保留；材质、枪口、握点和焦点分别验收 |
| 存档 | `godot/scripts/persistence/` | `res://`只读；通过`user://`写入；测试使用隔离存储 |
| 迁移参考 | `src/`、`web/`、`test/`、`godot/data/` | 不与原生玩法双线实现；参考重建须显式执行 |

`export-game.mjs`和内容导入器默认保留已编辑的原生资源。`--sync-reference-assets`、`--overwrite`和`--apply-design`会覆盖指定内容，不能作为普通启动步骤。

## 变更验证

- `npm run check`：旧参考规则、构建合同、版本与确定性模拟。
- `node scripts/godot/verify-native.mjs`：十套原生回归；包含存档、战斗、输入、地图、改件和卡牌布局。
- Windows包：固定官方模板与SHA，干净源码导出，运行`verify-package.ps1`。
- 画面：真实窗口截图；实体手柄、系统缩放、低配与长局仍需设备验收。

具体方法见[开发指南](../CONTRIBUTING.md)、[原生项目说明](../godot/README.md)与[组件入口](component-catalog.md)。
