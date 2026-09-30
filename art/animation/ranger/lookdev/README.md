# 巡线者成品质量目标稿

2026-09-30，ImageGen 内置工具生成。`ranger-sidearm-quality-target-v1.png` 是**单帧精细美术参考**，不是动画帧或游戏已接入素材。它包含绘制在图中的手枪，不可直接充当允许独立换枪的运行身体层。

身份、服饰和画风参考：`art/generated/v1.5/source/ranger-base-v1-source.png`。宽松裤腿、兜帽补丁、皮带、面罩、围巾及靴面应向原画的完成度校对。姿势参考只使用 `output/animation/ranger/aim-v2/stand/yaw+000/frame_01.png` 的粗略双手方向，不把几何灰模视作最终比例。完整生成提示词见同目录 prompt 文件。

图像为 1024×1536 RGBA。透明像素真实存在；alpha≥8 的可见边界是 `(248,70,858,1477)`。源 PNG 的透明区域 RGB 带暖色，但 alpha 为 0，游戏合成时不应显示为光晕。SHA-256：`BD4C487CEB9AB9B3124DA3F5AFACE791EBD059EE56C519F94ECA11F0230DDC28`。

原画与目标稿并排的 76px/152px 检查由 `scripts/qa/make-ranger-lookdev-board.py` 生成，结果位于 `output/animation/ranger/lookdev/`。手指、拇指、枪械握法与各个方向的一致性仍需逐件复核；此图不是生成八方向或全部动作的许可/验收替代物。

下一步须将此完成度落实到可编辑 3D 网格、皮肤权重、手部和枪械结构、可变形衣摆及手绘材质；同一源离线渲染，再逐帧修画。生成服务条款沿用项目素材台账的商业复核边界，不把本图标为已完成商业法律审查。
