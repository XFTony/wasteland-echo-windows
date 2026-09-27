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

## 2026-09-24 武器、服饰与护具扩充

下表保留本轮正式采用稿的主体和差异要求。共同约束：OpenAI 内置 ImageGen；风格化厚涂废土、克制纹理、上左方尘光、真实透明背景、单一物件、完整轮廓、无人物/文字/边框/水印/投影。武器均为枪托在左、枪口朝右的水平侧视图，供独立旋转；服饰与护具为正面偏三分之四视角的空物件，缩到 64～70 像素仍须分辨类别。

| 源图 | 最终主体要求 |
|---|---|
| `swarm-smg-v1-source.png` | 折叠线托、短枪管、鼓式弹匣、暗绿锈蚀饰条的紧凑冲锋枪。 |
| `breaker-shotgun-v1-source.png` | 短粗双通气枪管、旧木泵柄、重型钢机匣的破门霰弹枪。 |
| `needle-rifle-v1-source.png` | 瘦长精确步枪，细长铜轨、瞄准镜、细折叠枪托和尖锐枪口。 |
| `rust-revolver-v1-source.png` | 可辨的六发弹巢、短粗枪管、旧木握把和氧化钢面。 |
| `ember-carbine-v1-source.png` | 中长度、折叠枪托、斜弹匣、通气护木和少量余烬红刻痕。 |
| `coil-cannon-v1-source.png` | 重型电磁炮，铜线圈、肩托、下置电池，少量去饱和青色状态窗。 |
| `wanderer-outfit-v1-source.png` | 无人穿着的沙色兜帽披风、煤灰工具外套、旧红布签、长裤和荒原靴。 |
| `mechanic-outfit-v1-source.png` | 无人穿着的灰青工装、胸前工具带、黄铜紧固件与琥珀小信号灯。 |
| `nightwatch-outfit-v1-source.png` | 无人穿着的深蓝夜巡披挂、短肩斗篷、窄蓝色反光条和静音靴。 |
| `field-vest-v1-source.png` | 蜡帆布入门护胸，薄钢衬片、四个口袋和磨旧皮带。 |
| `iron-plate-v1-source.png` | 旧路牌与车门钢板焊成的重胸甲，不对称铆钉和宽肩。 |
| `runner-boots-v1-source.png` | 一双轻便战靴，旧运动鞋底、黑皮鞋面、浅褐绑带。 |
| `magnet-helm-v1-source.png` | 旧矿盔、外露铜线圈和小型青绿拾取定位目镜。 |
| `ammo-rig-v1-source.png` | 成对大腿腿挂，竖排弹匣、黄铜弹环和旧皮带。 |
| `signal-helm-v1-source.png` | 远讯侦测盔，宽幅青绿目镜、侧天线与独立晶振仓，与矿盔轮廓不同。 |
| `servo-greaves-v1-source.png` | 一对钢制小腿护甲，外露助力液压杆、皮带与琥珀色机械关节。 |
| `stormstep-boots-v1-source.png` | 一双厚重绝缘靴，浅色陶瓷鞋底、深皮鞋筒与细蓝色绝缘线。 |

这些是生成要求的可复现摘要，不冒充逐字 API 请求记录。运行图的裁切、尺寸和 SHA 以报告与清单为准。

### 巡线者 × 技师工装 `ranger-mechanic-v1-source.png`

输入图 1 是带防毒面罩的巡线者默认身体，作为编辑目标；输入图 2 是空置的青绿技师工装，只作服饰设计参考。最终要求只替换服装，保留巡线者面罩身份、抬高的三分之四视角、身体比例、手脚和脚底位置、上左方光源；工具带、琥珀肩灯和深色裤子来自工装参考。输出单人完整透明身体，不带武器、文字、背景或烘焙阴影；武器在 Canvas 中独立旋转。源图由内置 ImageGen 编辑生成；76px 剪影与背包、战斗、左右/上瞄准和移动截图已检查。原手枪锚点过高，已从面罩区下调到胸前。

### 巡线者 × 夜巡服 `ranger-nightwatch-v2-source.png`

输入图 1 为巡线者默认身体（编辑目标），输入图 2 为空置夜巡服（服饰参考），要求保留面罩身份、三分之四视角、手脚与脚底位置，改成深蓝披挂、肩斗篷和窄蓝反光条。第一次结果 `ranger-nightwatch-v1-source.png` 虽有真实透明背景，但 76px 下暗部与地图混在一起，未进入运行目录。第二次以第一稿为编辑目标，只提高深蓝布料的明暗层次、外袖和披挂边缘的灰蓝柔和高光、靴子对比；保持无武器、无烘焙阴影及透明背景。第二稿通过 76px 剪影、背包和战斗方向截图。

### 技师英雄 × 信号维修工 `mechanic-mechanic-v2-source.png`

输入图 1 是阿岚本人默认身体（编辑目标），输入图 2 是空置的青绿信号维修工服饰（设计参考）。要求保留成人女性面部、棕色发髻、额前护目镜、手脚与不对称站姿；只替换工装、胸前工具带、琥珀肩灯和加固裤腿，不把她变成带面罩的巡线者。第一稿 `mechanic-mechanic-v1-source.png` 透明度合格，但 76px 时与默认橄榄色外套过近，未进入活动目录。第二稿以第一稿为编辑目标，只提高去饱和海玻璃色青绿布料的亮度与面积，强化肩灯、保持深灰裤子；通过 76px、背包及战斗方向截图。独立武器锚点在 Canvas 中按技师英雄姿态调整。

### 技师英雄 × 夜巡服 `mechanic-nightwatch-v1-source.png`

输入图 1 是阿岚默认身体（编辑目标），输入图 2 是空置的夜巡披挂（服饰参考）。要求保留阿岚可见的面部、棕色发髻和额前护目镜、手脚位置及三分之四视角；兜帽放在头后，只替换为有中等明度灰蓝布料、短肩斗篷、深色护板和窄蓝反光带的夜巡服。无面罩、无武器、无烘焙阴影，透明全身；76px 深色地面仍须可辨。首稿通过透明度、缩图和背包/战斗方向截图。

### 铁卫 × 信号维修工 `bulwark-mechanic-v1-source.png`

输入图 1 是铁卫牧石的重甲全身像（编辑目标），输入图 2 是青绿检修服（服饰参考）。要求保留胡须脸、宽肩、厚胸甲、护膝、双手与靴子，检修服以青绿外层和琥珀肩灯围绕原重甲设计，不能把铁卫变成瘦小技师。输出无武器、真实透明的单人全身图；76px 下仍有重甲职业剪影。游戏内武器锚点按铁卫双侧手单独调整。

### 铁卫 × 夜巡服 `bulwark-nightwatch-v2-source.png`

输入图 1 是铁卫默认重甲全身像（编辑目标），输入图 2 是深蓝夜巡披挂（服饰参考）。要求保留胡须身份和重甲体积，以有中等明度的灰蓝兜帽肩披、深蓝外衣及窄蓝反光带包覆装甲，脸必须可见。第一稿 `bulwark-nightwatch-v1-source.png` 虽构图可用，却把棋盘格画进 RGB 背景；第二次 ImageGen 只去除背景并保留人物，得到真实透明 RGBA。第一稿不进入运行目录，仅归档供溯源。

### 回声旧城药房屋顶 `echo-apothecary-roof-v1-source.png`

生成要求：第一章一栋约 202×130 世界单位的实体药房障碍，严格正上方正交视角、约 3:2 长方屋顶；氧化铁皮、旧帆布、破损天窗、低饱和绿色医疗十字和少量通风口。全部可见实体在碰撞矩形内，门和可进入开口不得出现，阴影由 Canvas 单独绘制；文字、数值和按钮不得烘焙。真正透明背景，克制局部对比，以敌人和危险提示更优先。源图和缩到实际对象尺寸后的 Edge 单栋截图已检查。

### 回声旧城共用小店屋顶 `echo-shop-roof-v1-source.png`

以已验收药房屋顶作材质和上左方光源参考，生成一栋无字、无医疗十字的正上方店铺屋顶：氧化铁皮、不同布局的旧帆布、木板补丁、少量通风口和低对比度锈色。严格正交俯视、近 3:2 水平碰撞矩形，透明边缘，无可进入的门和大投影。药房继续用专属图；其它 `shop` 障碍按世界坐标稳定镜像共用此图，招牌文字单独绘制。

### 回声旧城仓库屋顶 `echo-warehouse-roof-v1-source.png`

以内置 ImageGen 生成，药房屋顶仅作材质与上左方光源参考。新图为正交俯视、无字的工业仓库屋顶：大面积低对比度氧化铁皮、少量锈缝、一个偏置通风机和一块修补天窗。全部实体在矩形碰撞边界内；透明边缘、无地面与烘焙投影，不画门、医疗标志或可交互信息。运行图复用于第一章 `warehouse` 障碍，尺寸取各自世界数据，`DEPOT`、`CARGO`、`RADIO` 等标记由 Canvas 单独绘制。源图 1512×1040 RGBA；运行图经现有裁切与 WebP 流程生成。

### 回声旧城集装箱 `echo-container-v1-source.png`

以内置 ImageGen 生成，仓库屋顶仅作材质和光源参考。主体是一只正交俯视的横向废弃货运集装箱：低饱和蓝灰色波纹钢板、克制锈色边框、端部锁件，无文字、数字、门、天窗或地面阴影。源图 1658×949 RGBA；初次运行图因画布边缘的近零透明像素包含过多空白，126×72 游戏尺寸下箱体过小。优化脚本仅对本图使用 alpha≥8 的可见主体边界裁切，保留透明像素和适量边距。第一章两只箱体共用此图，绘制尺寸取世界碰撞数据；其它地图暂保留各自回退样式。
