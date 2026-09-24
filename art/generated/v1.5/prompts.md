# v1.5 全插画素材生成记录

本目录保留 ImageGen 原始 PNG；`scripts/optimize-illustrated-assets.py` 生成活动 WebP，`scripts/register-illustrated-assets.py` 更新哈希和来源台账。所有生成图仍需人工检查边缘、动作和商业使用条款。

## 2026-09-24 本轮生成

### 突袭者 `runner-v1-source.png`

> Use case: stylized-concept. Asset type: transparent combat enemy sprite for top-down Windows survivor game, Wasteland Echo. Subject: one fast infected raider, lean adult humanoid mutant in torn dark desert scavenger clothes, predatory forward lean, asymmetric arms, BOTH LEGS AND BOTH FEET CLEARLY VISIBLE AND DISTINCT, knees and boots separated; silhouette instantly reads as a fast running enemy at 60 pixel game height. Style/medium: hand-painted stylized thick brush wasteland illustration, cohesive with muted ochre, charcoal and rust infected enemies; detailed but restrained interior texture, clean silhouette. Composition/framing: full body centered, three-quarter elevated view compatible with top-down action game, generous transparent margin around every limb, no ground shadow baked into image. Lighting/mood: consistent upper-left dusty warm light. Constraints: genuinely transparent alpha background, exactly one character, no weapons, no text, no borders, no watermark, no cut-off limbs; legs must remain unmistakable when downscaled.

替换未接入的旧突袭者候选稿；原图有透明通道，双腿可辨。仍需实机动态检视。

### 锈轨地表 `freight-ground-v1-source.png`

> Use case: stylized-concept. Asset type: seamless repeating painted ground texture for top-down Windows action game Wasteland Echo, second map Rust Rail Junction. Scene: abandoned rail yard ground only, weathered dark charcoal ballast, cool slate gravel, sparse oxidized iron fragments, subdued rust dust, tiny oily stains, hints of pale cyan mineral residue; no rails or train structures. Style: hand-painted stylized thick brush texture, restrained contrast. Composition: orthographic straight down, square, filled edge to edge, seamless on all four sides, non-directional scattering, no central landmark. Lighting: upper-left diffuse dusty light. Constraints: no characters, lettering, UI, object shadows, roads, baked collision cues or border; opaque background.

### 赤砂地表 `red-basin-ground-v1-source.png`

> Use case: stylized-concept. Asset type: seamless repeating painted ground texture for top-down Windows action game Wasteland Echo, third map Red Basin Subsidence Zone. Scene: compacted red ochre sand, cracked clay, subtle wind-carved streaks, sparse dark shale and tiny pale mineral flecks; no buildings or roads. Style: hand-painted stylized thick brush texture, muted rusty red and burnt sienna with charcoal accents, restrained contrast. Composition: square orthographic straight down ground, fills all edges, seamlessly repeatable, diffuse irregular texture with no central landmark. Lighting: dusty muted upper-left diffuse light. Constraints: opaque ground, no people, lettering, UI, borders, baked collision information, giant rocks or terrain features that appear solid.

## 前序生成稿

六张菜单场景、封面、第一章地表、巡线者、漂游者、铁幕巨像和起始手枪，以及本轮接入的技师、铁卫、腐蚀者、重甲者、警报者、爬行者、荒原看守来自同一 ImageGen 视觉重构工作流。前序会话未在项目中保留逐字 prompt；此处不补写无法核实的原文。每件源图、运行图及哈希以 `docs/illustrated-assets-report.json` 和 `art/manifest.json` 为准。
