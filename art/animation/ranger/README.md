# 巡线者 Blender 灰模：镜头与比例关口

状态：2026-09-29 技术及体块样板，**未通过角色造型或跑步动作验收**。本目录的 `.blend` 只包含灰色体块、固定相机和灯光；活动游戏仍使用原有静态巡线者。

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

```powershell
& $env:WASTELAND_BLENDER_BIN --disable-autoexec --background --factory-startup --python scripts/blender/pose-ranger-run-graybox.py
python scripts/qa/make-ranger-run-pose-board.py
```
