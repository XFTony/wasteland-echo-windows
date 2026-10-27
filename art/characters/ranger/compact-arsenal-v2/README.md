# 巡线者：七枪自动战斗样板 v2

日期：2026-10-27。[打开可操作预览](./review.html)。默认只需WASD／方向键移动，自动锁定射程内敌人并开火；鼠标不控制战斗射向。可以切换七把枪、自动走位演示、慢放及人物大小；八方向按钮用于单独检查持枪姿态。

后续已完成[可替换手部与袖口的分层v3](../modular-grips-v3/review.html)：源素材分离，切换外观时缓存合成，沿用统一动作，原默认与本目录组合图逐像素一致。本目录保留认可版对照材料。[方案与实施记录](../../../../docs/hand-weapon-compatibility-plan-2026-10-27.md)。

## 本轮交付

七枪包括废料手枪、蜂群冲锋枪、破门霰弹枪、针刺步枪、锈痕左轮、余烬卡宾枪、荒雷线圈炮。主角与手枪复用上一版，六把新枪逐把绘制持握组件并导入像素规格。前握点、后握点、枪口和枪械尺寸分别校对。

自动选敌剔除死亡、失活、超距和被障碍挡住的目标；目标接近同距离时保留锁定。没有目标时停火。换枪不重置脚步，射击从实际持握组计算；贴身敌人与枪口前的薄墙也参与碰撞检查。

枪托由头部正确遮挡，避免向下瞄准盖住面罩；向上射击会检查后坐状态下的枪口。七把枪沿用主游戏基础射击参数，完整专属机制和局内成长仍由主游戏执行。

## 原图、提示词与编辑源

`source/`保存六张ImageGen源图与同名`.prompt.txt`。`source/layout.json`记录目标规格。`weapons/`保存六张原生PNG及`.aseprite`，手枪和身体只引用`compact-motion-v1/`，没有复制相同资源。`metadata.json`和`arsenal-data.js`保存同批参数与哈希。

绘图参考为本项目已有各枪概念图和已选定的紧凑像素持握风格；步枪最终使用虚构游戏道具描述及像素组件参考。图像模型原画经像素导入，不宣称专业动画师人工逐像素完成。两手与枪为一组，不是每种装备都重绘整个人物。

七张武器图合计约7KB，RGBA解码约28KB；另复用身体图集约6KB。原画、编辑源和[演示视频](../../../../output/compact-arsenal-2026-10-27/seven-weapons.webm)属于本地制作／评审资料，视频在output中，不进入Git。

## 重建与验证

```powershell
python scripts/animation/build-compact-arsenal.py
python scripts/animation/verify-compact-arsenal-assets.py
node --test test/compact-arsenal.test.js test/compact-ranger-motion.test.js
node scripts/qa/verify-compact-arsenal.mjs
```

浏览器脚本检查七枪自动射击、112组方向与后坐、脸部及枪口可见性、只用键盘的走位、暂停和失焦，并生成七枪总览、方向对照和视频。

## 当前边界

这是角色与七枪适配的独立样板，尚未替换主游戏人物。身体仍采用左右翻面，未制作独立背身；枪械像素、持握及整体观感仍待用户评审。主游戏本轮已将新存档的默认自动瞄准和自动开火开启，旧档明确设置保留。

玩法调研、实现规则与后续建议见[土豆兄弟操作与七枪记录](../../../../docs/brotato-controls-and-seven-weapons-2026-10-27.md)。
