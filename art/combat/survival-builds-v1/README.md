# 连续生存武器与改件工作包

2026-10-30。本工作包包含四件新武器、八个改件图标和四段短声音，均由项目原生像素描述/离线声音算法制作；未使用竞品图片、代码或录音，不调用图像生成服务。

- `design.json`保存明确的武器数值、形状、握点、反馈、图标与解锁要求；制作入口是`scripts/godot/prepare-survival-content.mjs`。
- 四件武器使用小型像素描述，运行时首次选择时缓存成Texture；手与袖口是独立引用，不烘进武器图。
- 战斧采用独立的带刃缘/斧须轮廓，长矛使用对齐实际刺击原点的握点与前伸；不把所有近战都附带军刀剑气。
- `audio/`与`godot/assets/audio/survival-v2/`同字节，总计38,984字节；生成入口`scripts/audio/generate-survival-builds.py`。机械弦锁、冷气、刺击和重挥均为原创合成，不宣称真实录音；原有实录枪声不变。
- `manifest.json`登记声音SHA、原图形描述和活动路径；九件代码绘制武器中本轮新增四件，八个改件图标也保留可编辑图形记录。

将制作数据接入原生项目需显式运行`godot/scripts/tools/install_survival_content.gd`。默认发现同版本已安装便保留编辑；`--apply-design`会重新应用本工作包拥有的资源。后续常规数值编辑以`godot/content/weapons/`和`upgrades/`的Resource为准，不反复重装覆盖人工调整。

原版导入工具现会保留已有整个原生Catalog及新增内容，避免旧JS导入时只保留137项而丢失新武器/图标/声音。仅明确的`--overwrite`才重置为参考基线。
