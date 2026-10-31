# 回声旧城地面样板 v3

2026-10-30，由内置ImageGen生成两张配套图集。仅以本项目已生成的`pixel-map-v2`物件图集作为风格参考，没有引入竞品图像。源PNG原样保留，活动副本同字节，Git会去重；不冒称第三方CC0，使用权按适用服务条款处理。

- `sources/terrain-generated.png`：四材质原图，实际1254×1254；`terrain-prompt.txt`为完整提示词。
- `sources/decals-generated.png`：八类透明地面细节原图，实际1254×1254；`decals-prompt.txt`为完整提示词。Alpha检查约77.5%像素完全透明，斑马线由多个不相连的条纹构成，使用合并区域。
- `manifest.json`：原图/活动图路径、生成方式、SHA和角色；活动路径为`godot/assets/world/echo_ground_v3/`。
- 区域坐标由Alpha边界检查和原图目视确认，保存在回声旧城的MapArtProfile；没有重新涂抹、切图或缩放原PNG。

运行方式：`EchoGround`按真实道路并集和地块布局混合四种材质；世界坐标连续采样，以平移交叠消除重复边缘，避免镜像万花筒。路缘、掉漆标线、斑马线、裂缝、积尘、油迹、散落铺砖和轨道均引用真实绘画区域。降低地面的明暗反差，把角色和敌弹放在视觉前景；地面贴花不提供额外碰撞。

只给回声旧城接入新材质；另外两图和现有环境物件继续使用上轮资源。旧城原GroundTiles保留为缺图回退，常态隐藏；不是同时叠两层不透明地表。材质、道路布局、交互和碰撞相互独立，后续编辑不需要重做一张整图位图。

制作与验证：[本轮计划](../../../docs/design/echo-ground-ui-polish-plan.md)、[研究与设计依据](../../../docs/research/echo-ground-style-and-ui-2026-10-30.md)。
