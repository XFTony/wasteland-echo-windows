# 紧凑像素敌人与主游戏接入

日期：2026-10-28。范围：沿用已认可巡线者的像素语言，重新制作现有六类普通感染者与两名首领，并接入三张主游戏地图。主角为巡线者／荒原旅人；七枪复用已完成的分层材料。

[打开动态人物对照](./review.html)。Windows试玩包在项目`output/compact-enemies-2026-10-28/windows/`，进入行装选择“巡线者·黎响／荒原旅人”；默认只需移动，旧档控制设置保留，可在设置中开启自动瞄准／自动开火。

## 素材与制作方法

- 使用内置OpenAI ImageGen，每类敌人独立生成一张4×2八姿势原画。以项目已认可的主角为风格参考、游荡者为同批敌人参考，不使用商业游戏角色原素材。
- [完整最终提示词、参考图与输出来源](./source/generation-record.json)。原始生成图在`source/<enemyId>-walk.png`，供修改与追溯。
- 原画通过既有原生像素导入流程整理：排除透明低Alpha晕边与相邻格残片、固定共享缩放和行基线、映射到有限项目色板。没有用代码摆动整身图或用重复帧冒充新增步态。
- 每类八个实际姿势保存在`<enemyId>.aseprite`，原生预览图为`<enemyId>-atlas.png`；运行图为`web/assets/actors/compact-v1/<enemyId>-atlas.webp`。
- 运行WebP无损回读与原生像素一致。敌人使用完整姿势图集；主角枪体／手型／袖口仍保留独立编辑源与缓存合成结构。

| ID | 可见特征 | 游戏表现 |
|---|---|---|
| drifter | 蓝灰破工作服、伸出的空手 | 蹒跚追击 |
| runner | 暗红背心、前倾瘦轮廓 | 快速奔跑 |
| spitter | 绿色酸囊与背罐 | 驼背短步 |
| brute | 宽肩铁甲与重拳 | 沉重推进 |
| screecher | 紫披挂、喇叭口器与天线 | 支援者行走 |
| crawler | 横向低伏、长前臂 | 交替爬行 |
| warden | 暗红长衣、铁颚和脉冲装置 | 首领行走 |
| iron_colossus | 箱形重装、炉芯与双排气管 | 重型步态 |

## 日常修改与导出

修改各敌人的`.aseprite`后执行：

```powershell
python scripts/animation/build-compact-enemy-assets.py
python scripts/animation/stage-compact-live-assets.py
python scripts/qa/build-compact-enemy-review.py
npm.cmd run check
node scripts/qa/verify-compact-live.mjs
node scripts/qa/verify-compact-live-animation.mjs
```

`--import-generated`只用于首次从大图创建原生源；原生源已经存在时会拒绝覆盖。日常导出不会重新从生成图覆盖人工编辑。改变画布、根点和步幅时同步更新导入规格与描述，不只换图片。

主角运动与持握合成现由`src/shared/compact-ranger-motion.js`、`src/shared/modular-grip-compositor.js`共用；旧`scripts/animation/`入口仅供工具兼容。选择外观时合成，普通帧不重新组装手与枪，缓存上限8套。

## 实际接入与验收

- 主游戏的巡线者默认服饰采用原有认可身体，七枪／原手套／原袖口复用，不改变默认像素。
- 主角和敌人按实际位移推进步相；停步和碰撞后停止跑步，暂停冻结步相。对象池复用、新对局和菜单切换清理采样与缓存。
- 自动瞄准从移动后的持握点校正方向，子弹、枪焰与抛壳使用共享枪口／握点；鼠标手动瞄准考虑摄像机缩放。长枪起始短路径覆盖近身目标。
- 八张原敌人插画保留归档并退出活动构建。缺少新图时仍可操作，使用代码像素回退；不在正式动作路径请求旧敌人插画。
- 248项自动测试、三图、56射向、64个敌人动作帧、多分辨率、缺图回退和缓存释放已验证。证据在`docs/qa/compact-live-browser-2026-10-28.json`和`docs/qa/compact-live-animation-2026-10-28.json`。
- 18张新运行纹理合计45,514 bytes；全部对应RGBA像素约1.47 MiB，是像素数据估算，不能当进程内存。
- 当前同seed六策略正常生命矩阵完成2/6；枪口出生位置变化会影响贴身命中与后续对局轨迹。该结果不是玩家胜率，不依据它顺带调武器或敌人数值。
- 短演示视频`output/compact-enemies-2026-10-28/live-combat-demo.webm`使用脚本走位与压力生命，只展示动作与射击，不冒充正常生命真人试玩。

其他英雄／其他服饰仍使用原插画，护具独立穿戴层、新敌人攻击专用帧、实体手柄与真实低配／WebView2长局另待制作或验收。新敌人最终观感等待你的实际试玩反馈。
