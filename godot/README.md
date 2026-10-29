# 荒原回响 · Godot原生迁移

当前正在迁移，**尚未成为原版完整游戏的替代品**。已完成项、未完成项以[migration_status.json](migration_status.json)为准；执行范围和验收见[迁移计划](../docs/godot-migration-plan.md)。

## 工具和项目结构

- Godot4.7.2标准版，Compatibility，GDScript；固定60Hz，原内容ID、数值与素材保留。
- `content/`：137个原生Resource及统一GameCatalog，支持Inspector查看武器/敌人/地图。
- `scripts/content`、`core`、`persistence`、`presentation`、`ui`：数据、规则、保存和表现分层。
- `scenes/game_root.tscn`：原生应用组合根；菜单使用Control/Button和原生绘制，没有嵌入旧网页。
- `tests/parity_test.gd`：对照由冻结JS基线产生的值，不以原生代码自己计算的结果冒充参考。

## 准备与检查

```powershell
node scripts/godot/export-game.mjs
& 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe' --headless --path godot --editor --import
& 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe' --headless --path godot --script scripts/tools/import_content.gd
& 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe' --headless --path godot --script tests/parity_test.gd
```

素材导入副本与JSON对照夹具可再生，不提交Git。原生`.tres`与脚本UID提交Git。内容导入器默认保留已编辑Resource，只有显式`-- --overwrite`才重建已有定义；迁移期间需要改数值时，应先登记与基线的差异。

目前应用主要用于检查菜单与资源，完整战斗入口尚未接线。不要把菜单可打开当作全部游戏可玩。原游戏运行和打包仍使用原根目录流程。
