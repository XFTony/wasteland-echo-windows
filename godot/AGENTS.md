# Godot迁移实施规则

- 这是正式原生迁移目录，参考`../docs/godot-migration-plan.md`与活动JS实现；历史样板不是完整玩法依据。
- 使用已安装的godot Skill，遵循Godot官方4.7文档；UTF-8无BOM、LF、Tab缩进、静态类型、snake_case脚本和PascalCase节点。
- 原生场景/Resource/Control/AudioStream/GDScript，不嵌入网页、不运行JavaScript规则替代移植。
- 当前基线的内容ID、数值和存档字段属于兼容合同，字典外部字段可保留旧名；新GDScript代码使用snake_case。
- data/content_source.json和assets是导入副本，不手改；源数据导入必须显式运行并带来源hash。可编辑Resource通过后成为后续开发权威来源，避免反复覆盖人工修改。
- 代码变更验证对应Godot原生测试；UI改动保存并目视检查同分辨率对照。迁移状态不得把仅有资源登记的内容标为玩法完成。
- `res://`仅放运行资源，存档通过FileAccess放`user://`；测试使用隔离路径。脚本`.uid`入Git，`.godot`缓存不入Git。
