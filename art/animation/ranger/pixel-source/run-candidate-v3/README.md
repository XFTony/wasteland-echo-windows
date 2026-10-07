# 巡线者连续跑步 v3

日期：2026-10-07。针对八帧过渡粗糙、循环接缝不连贯的反馈重做。

## 本轮变化

- 8帧升级为20个不同姿势，每帧20ms，总周期400ms；保留原先节奏。
- 采用同一份原生角色上身、靴子及衣摆，不继续以独立生成的全身姿势拼接。
- 固定远／近腿身份，髋、膝、踝使用固定骨长和连续的支撑／摆动轨迹；中间帧重新计算姿势，而非透明叠化或复制静态图。
- 上身轻微起伏、衣摆跟随也使用周期曲线；原配色32色、画布128×128保持。
- `.aseprite`里保存6个独立可编辑层：远腿、远衣摆、近腿、骨盆、上身、近衣摆。上身中的武器尚未独立。

`rig-source.json`记录步相、骨长、源图和部件约定；制作代码中的源多边形、取样位置和关键曲线明确保存，后续可针对源部件修画。

## 连续性检查

- 周期端点phase=0和phase=1的合成像素相同。端点只作验证，没有把重复第一帧追加到播放序列。
- 周期处关节位置与速度连续；固定骨长、可达目标和膝部弯曲检查通过。
- 按片段步长滚动地面时，支撑脚世界位置不漂移；取整后的误差不超过0.5源像素。
- 末帧到首帧的像素变化处于本周期内部变化范围，未形成异常尖峰；此指标不是审美评分。
- 原生源、图集和GIF回读一致，20帧均不同，GIF没有10ms以下的兼容性风险。

图集2560×128，约24KiB压缩PNG，解码像素1.25MiB。此源为离线烘焙；玩家运行时不需要实时骨骼求解。

## 查看与重建

```powershell
python scripts/animation/build-ranger-continuous-run.py
python scripts/animation/verify-ranger-continuous-loop.py
python scripts/animation/verify-native-review-assets.py
python scripts/qa/build-pixel-production-review.py
```

打开`output/animation/ranger/pixel-production-review/review.html`，默认20帧新版，可切回原八帧、慢放、逐帧、叠上一帧，并单独播放19→20→1→2接缝片段。该片段播完暂停，不用2→19的跳转伪装正常循环。

角色服饰接缝、关节阴影及整体观感仍需要用户评审；不将数学闭环写成全美术已批准。`visualApproved=false`、`runtimeIntegrated=false`，活动游戏仍未被替换。
