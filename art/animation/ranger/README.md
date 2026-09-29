# 巡线者 Blender 灰模：镜头与比例关口

状态：2026-09-29 技术及体块样板，**未通过角色造型或跑步动作验收**。本目录的 `.blend` 是灰色体块、固定相机及骨架的可编辑源；活动游戏仍使用原有静态巡线者。

## 目的与输入

- 角色身份参考已有 `art/generated/v1.5/source/ranger-base-v1-source.png`，不复制另一份原画。
- 先比较固定相机俯角与人物在地图上的剪影，再决定建模、骨架和跑步关键姿势。体块采用灰色，是为避免把未完成材质误当成美术成果。
- 当前有 35°、42°、50° 三个正交俯角，方位角暂为 35°。65° 首次试渲使面罩和身体过分压缩，已从正式比较板移除。**42° 仅为工作候选，尚未获得玩家审美确认。**

## 可重建步骤

在 PowerShell 中先把 `WASTELAND_BLENDER_BIN` 指向本机 Blender 可执行文件，然后从仓库根目录执行：

```powershell
& $env:WASTELAND_BLENDER_BIN --background --factory-startup --python scripts/blender/build-ranger-camera-graybox.py
python scripts/qa/make-ranger-camera-board.py
```

第一个脚本保存可编辑的 `ranger-graybox-camera-v1.blend`，并在被 Git 忽略的 `output/animation/ranger/camera-v1/` 输出 256×256 透明 PNG。第二个脚本将三张图与当前静态人物按 76px、152px 高度放入同一地图背景比较；需要先有 `scripts/qa/capture-illustrated-slice.mjs` 生成的静态战斗截图。Blender 5.2.2 LTS 已在本机后台渲染成功，两个尺寸比较板均已目视检查。

## 当前发现与下一道门槛

- 35° 保留较多面罩和外套正面；50° 增强俯视感但缩短可见躯干；42° 位于二者之间。
- 初版灰模头太圆、靴子过宽且外套太短；修订版改成尖兜帽、窄靴与更长的下摆。它仍只有粗略体积，不能作为最终人物审美依据。
- `ranger-graybox-run-keys-v1.blend` 是八个跑步关键姿势的失败试验：76px 对照里接触、下沉、经过和腾空不易分辨，双腿常被外套遮住。该源仅用于分析，不是通过验收的动作，也没有进入活动游戏。重建命令见下方；结果与外部动作参考的比较见[动作试验复盘](../../../docs/ranger-motion-reference-review-2026-09-29.md)。
- 下一次先修正骨架和动作设计，明确脚掌接触、双腿剪影、骨盆位移与持枪上身的关系，再制作新的关键姿势。**当前 A 镜头未获玩家确认，B 动作未通过。**未通过前不制作厚涂材质、不导入活动角色素材。

## 固定骨长的骨架基础

`ranger-rig-graybox-v1.blend` 新增 16 根真实 Blender 骨骼：根、骨盆、躯干、头、左右大腿/小腿/脚和上臂/前臂/手。25 件灰模部件绑定到对应骨骼，左右脚由 `foot_ik.L/R` 与 `knee_pole.L/R` 控制；`hand_grip.L/R` 和 `weapon_muzzle` 是后续双手持枪的参考点，**目前尚未形成持枪动作**。整个源文件约 138 KB，不含第三方模型。

用以下命令重建及验证；第二条只核对四个技术姿势的脚踝落点和固定骨长，不能证明跑步好看：

```powershell
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background --factory-startup --python scripts/blender/build-ranger-rig-graybox.py
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background art/animation/ranger/ranger-rig-graybox-v1.blend --python scripts/blender/verify-ranger-rig-graybox.py
```

验证输出为 `RIG_VERIFIED poses=4 bones=16 max_foot_error_m=0.00000`。`output/animation/ranger/rig-v1/technical-poses-76px.png` 的目视结论仍是步态不清晰：当前体块的外套、头肩和手臂仍盖住腿部，尚须重做可变形衣摆、人物比例和人工姿势。该 `.blend` 是下一次建模与动作修整的**技术底座**，不是通过验收的动画。

## V2 动作预览：技术已通，画风未定

`ranger-silhouette-v2.blend` 从固定骨长源重建开襟外套、背后衣摆和双臂 IK，保留骨骼与服饰挂点。`ranger-run-ik-v2.blend` 在此基础上保存左右交替的接触、下沉、经过、腾空关键姿势；前一只脚从接触到经过持续接地，飞跃后才由另一只脚接地。灰模仍显简陋，**不能视为最终画风或已经通过玩家动作验收**。所有 PNG、GIF 只在被 Git 忽略的 `output/`，未进入活动游戏素材树。

```powershell
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background --factory-startup --python scripts/blender/refine-ranger-silhouette.py
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background --factory-startup --python scripts/blender/author-ranger-run-ik.py
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background art/animation/ranger/ranger-run-ik-v2.blend --python scripts/blender/verify-ranger-run-ik.py
python scripts/qa/make-ranger-run-pose-board.py --input output/animation/ranger/run-ik-v2
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background art/animation/ranger/ranger-run-ik-v2.blend --python scripts/blender/render-ranger-run-preview.py
python scripts/qa/make-ranger-run-loop-preview.py
python scripts/qa/build-ranger-run-review-page.py
```

本机验证：24 帧骨骼和双手控制点误差为 0，支撑脚每帧匀速后移约 0.08167 米，靴底最深约穿地 0.0085 米，循环首尾一致。双击 `output/animation/ranger/run-ik-v2/review.html` 可暂停、逐帧和切换 76px/152px；也可直接查看 `loop/run-loop-76px.gif`。本地 Edge 已确认预览页可加载、暂停、逐帧及切换尺寸。真实骨骼、控制器和两件 `.blend` 是下一轮细化面罩、衣褶和持枪姿势的源，运行时仍是旧静态图片。

## V2 动作预览：技术已通，画风未定

`ranger-silhouette-v2.blend` 从固定骨长源重建开襟外套、背后衣摆和双臂 IK，保留骨骼与服饰挂点。`ranger-run-ik-v2.blend` 在此基础上保存左右交替的接触、下沉、经过、腾空关键姿势；前一只脚从接触到经过持续接地，飞跃后才由另一只脚接地。灰模仍显简陋，**不能视为最终画风或已经通过玩家动作验收**。所有 PNG、GIF 只在被 Git 忽略的 `output/`，未进入活动游戏素材树。

```powershell
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background --factory-startup --python scripts/blender/refine-ranger-silhouette.py
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background --factory-startup --python scripts/blender/author-ranger-run-ik.py
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background art/animation/ranger/ranger-run-ik-v2.blend --python scripts/blender/verify-ranger-run-ik.py
python scripts/qa/make-ranger-run-pose-board.py --input output/animation/ranger/run-ik-v2
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background art/animation/ranger/ranger-run-ik-v2.blend --python scripts/blender/render-ranger-run-preview.py
python scripts/qa/make-ranger-run-loop-preview.py
python scripts/qa/build-ranger-run-review-page.py
```

本机验证：24 帧骨骼和双手控制点误差为 0，支撑脚每帧匀速后移约 0.08167 米，靴底最深约穿地 0.0085 米，循环首尾一致。双击 `output/animation/ranger/run-ik-v2/review.html` 可暂停、逐帧和切换 76px/152px；也可直接查看 `loop/run-loop-76px.gif`。本地 Edge 已确认预览页可加载、暂停、逐帧及切换尺寸。真实骨骼、控制器和两件 `.blend` 是下一轮细化面罩、衣褶和持枪姿势的源，运行时仍是旧静态图片。

旧姿势仍可用于复盘，重建命令如下：

```powershell
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background --factory-startup --python scripts/blender/pose-ranger-run-graybox.py
python scripts/qa/make-ranger-run-pose-board.py
```
