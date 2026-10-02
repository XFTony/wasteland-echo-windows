# 巡线者原生像素制作源与候选

日期：2026-10-02。按最终计划2.0实施；以下候选均未接入活动游戏。

## 工具与密度

LibreSprite官方发行v1.1便携程序自报`1.1-dev`，存放于`output/tooling/`，不进入运行包。子进程配置重定向到同一项目目录。验证报告在`docs/qa/pixel-source-tool-verification-2026-10-01.json`：两帧诊断的80/120ms、RGBA和透明导出一致。彩色诊断仅验证工具。

`ranger-density-38-v1.aseprite`和`ranger-density-76-v1.aseprite`是密度/色板草稿：从已有样稿缩减尺寸和固定32色映射，尚未完整逐像素修画、身体分层或枪械分离。真实轮廓37/75px，名义工作规格38/76px；用2/1整数倍，避免为了凑身高而非整数拉伸。资源数据在`density-study-v1.json`。

## 跑步姿势候选

`ranger-run-keyposes-study-v1.png`由内置ImageGen生成；同目录提示词保存全部要求与输入参考。它包含4×2八个不同姿势，有真实透明通道和半透明暖色边缘；生成结果不能直接视作已验收人体动作。

`run-candidate-v1/`将这组姿势整理为128×128原生网格、共享尺度、固定根和32色的可编辑候选；包含`.aseprite`、八帧图集、GIF与元数据。图集1024×128，RGBA像素估算0.5MiB；GIF循环400ms，每帧50ms。PNG导出与原生帧完全一致，八帧不同。

随后进行了仅针对腿部／下摆的一次参考修订，保留为`ranger-run-keyposes-study-v2.png`及提示词；对应`run-candidate-v2/`为当前默认预览。部分后半周期的腿部身份更明确，但左右支撑、4→5及8→1接缝仍需原生源中逐帧标定与修画，不能宣布完整双步循环已通过。已保留两版，不再继续批量生成来替代该检查。

随后进行了仅针对腿部／下摆的一次参考修订，保留为`ranger-run-keyposes-study-v2.png`及提示词；对应`run-candidate-v2/`为当前默认预览。部分后半周期的腿部身份更明确，但左右支撑、4→5及8→1接缝仍需原生源中逐帧标定与修画，不能宣布完整双步循环已通过。已保留两版，不再继续批量生成来替代该检查。

候选进行过声明的头部横向对齐、固定色板和二值透明转换。它仍是合并层，武器烘焙，支撑脚/步长、循环接缝、角色身份和持续瞄准待审，`complete=false`、`visualApproved=false`、`runtimeIntegrated=false`。文件完整通过只表示可以评审，不能替代G1/G2。

## 重建与查看

```powershell
python scripts/animation/pixel-source-tools.py
python scripts/animation/build-pixel-density-candidates.py
python scripts/animation/build-ranger-run-candidate.py
python scripts/animation/build-ranger-run-candidate.py --version v2
python scripts/animation/build-ranger-run-candidate.py --version v2
python scripts/animation/verify-native-review-assets.py
python scripts/qa/build-pixel-production-review.py
```

打开`output/animation/ranger/pixel-production-review/review.html`：同尺寸密度对照，八帧正常/慢速/逐帧、上一帧叠图和根锚点；下载同源GIF或可编辑源。根锚点不是地面碰撞线。

下一步依据具体帧的评审修整支撑、步相、比例、衣物和双手，完善身体/枪械源，再接实际位移与射击。旧三维实验在独立归档分支保存，不混入这些源。
