# 像素废土地图素材包 v2

用途：Godot三图的共享地表与环境物件，配合现有巡线者/敌人像素图集。

- `sources/`保留内置imagegen原始PNG，不改写旧素材。
- `terrain-prompt.txt` / `props-prompt.txt`记录完整生成提示词。
- `prop-regions.json`记录按透明像素连通域检查得到的16物件边界。
- 活动副本在`godot/assets/world/pixel_map_v2/`；TileSet/Profile/Material位于`godot/content/map_art/`。
- 源与活动副本相同字节，由Git去重；没有下载或使用竞品图集。

生成方式：内置imagegen，2026-10-30，为本项目生成。工具/账号的适用条款决定使用权；未将生成结果冒称第三方CC0。源图为1254×1254，未声称生成器准确输出1024或严格18色。

地表是四材质×四变化，TileSet用312区域、1像素margin/separation、Layer缩放为64世界单位。运行Shader按64逻辑像素采样并降低细节对比/边缘接缝。道具在原PNG上使用精确区域，透明背景与2源像素采样；文字、阴影、互动范围及碰撞由原生代码绘制。

新素材只改变表现；所有实体尺寸/身份仍由MapObstacle/MapDefinition提供。新增贴图不能自行改变碰撞。生成脚本`godot/scripts/tools/build_pixel_map_art.gd`是一次性铺图工具，已有GroundTiles会拒绝覆盖；后续请在Godot编辑器修改保存图层与Profile。
