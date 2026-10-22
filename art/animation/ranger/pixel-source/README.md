# 巡线者原生像素制作源与候选

> 2026-10-22：本目录保存的高精细成人比例人物与动画已退出当前制作路线。现行方向见[紧凑像素主角形象v1](../../../characters/ranger/compact-pixel-v1/README.md)。以下内容保留为2026-10-09的历史记录。

更新时间：2026-10-09。按最终计划2.0与用户本轮纠正实施；以下候选均未接入活动游戏。

## 当前制作路线

用户明确要求：按照原八帧的完整人物绘画方法，补绘更细致的中间步态，再顺序合成循环。当前默认为[24帧逐帧补绘样板v4](./run-candidate-v4/README.md)。

v4保留原v2八张关键帧的原生像素，在每对相邻帧之间补绘两张完整人物，共24帧。第8→1帧也补两张，末尾不复制第一张。正常预览、源与WebP保持400ms；兼容GIF为480ms。原图、提示词、逐帧来源、对齐量、原生源和所有导出文件均保留。

新增姿态来自内置ImageGen绘图。导入代码只整理分辨率、整张人物对齐、透明边缘及色板；不以骨骼变形、简化腿部或透明叠化生成动作。原画细节与游戏像素尺寸可在同一预览切换。文件通过不代表自然步态、服饰纹理及配饰一致性已获视觉批准。

## 历史候选

- v1/v2：4×2八张完整人物生成参考，导入128×128原生网格、32色、共享尺度，保存合并层`.aseprite`、PNG、GIF和元数据。v2八张原帧作为v4关键帧保留。
- v3：[20帧连续关节试验](./run-candidate-v3/README.md)，六层部件、固定骨长、数学闭环。用户于2026-10-09指出制作方法偏离要求，因此退出当前路线，保留供历史对照；不能把闭环验证当作当前人物动画已完成。
- v4：八张原关键帧＋16张完整人物补绘，当前默认样板；依然`visualApproved=false`、`runtimeIntegrated=false`、`complete=false`。

## 工具与密度

LibreSprite官方发行v1.1便携程序自报`1.1-dev`，存放于`output/tooling/`，不进入运行包；子进程配置重定向到项目目录。验证报告`docs/qa/pixel-source-tool-verification-2026-10-01.json`证明两帧工具诊断的时序、RGBA和透明导出一致，不代表人物动作已经完成。

两份38/76px密度草稿仍保留。真实轮廓37/75px，名义工作规格38/76px，用2/1整数倍；尚非专业人工逐像素修画主源。数据在`density-study-v1.json`。v4同时保存较大原画图集以便检查绘画细节。

## 重建与查看

```powershell
python scripts/animation/build-ranger-drawn-inbetweens.py
python scripts/animation/verify-native-review-assets.py
python scripts/animation/verify-ranger-drawn-inbetweens.py
python scripts/qa/build-pixel-production-review.py
node scripts/qa/verify-ranger-drawn-review.mjs
python scripts/qa/build-pixel-production-review.py
```

打开`output/animation/ranger/pixel-production-review/review.html`。默认新版24帧，支持原画／游戏尺寸、新旧对比、逐帧／慢放／叠图、接缝片段，并提供视频、WebP、GIF、逐帧源和总览链接。根锚点是绘制参考，不是地面碰撞线。

## 待办边界

仍需依据具体帧修整腿部身份、支撑、步态、衣物纹理和双手；必要时修改原关键帧，而非无限增加中间帧。随后再做身体／枪械源、射击、实际位移步相和其他方向。人物与枪械当前仍是合并画面。旧三维实验在独立归档分支保存。

绘图模型补绘、程序整理及工具检查不宣称专业人工逐像素完成。当前游戏仍使用原静态插画。
