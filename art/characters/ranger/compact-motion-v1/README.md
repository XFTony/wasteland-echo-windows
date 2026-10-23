# 紧凑像素巡线者：转向、持枪与移动射击样板

日期：2026-10-23。基于10月22日的大头短身形象，参考原版《元气骑士》的小比例像素表现与公开逐帧制作说明，制作一名主角的独立动作试验。

## 直接体验

打开[可操作预览](./review.html)，默认演示移动和射击。可切换原地环绕瞄准、横移、反向移动，或点击“亲自操作”。WASD／方向键移动，鼠标瞄准，左键／空格开火，P暂停。右侧八方向按钮可固定观察；支持慢放、三种显示尺寸、枪口参考线。十秒[演示视频](../../../../output/compact-motion-2026-10-23/compact-ranger-motion.webm)在本地output中生成，未纳入Git。

本轮参考与证据边界见[设计记录](../../../../docs/compact-ranger-motion-reference-2026-10-23.md)。官方资料证实历史角色由4帧升级8帧及逐帧重画；没有公开完整内部持枪算法。本样板的挂点、角度与层序是我们制定并验证的设计，不宣称完整复刻原版内部系统。

## 制作与实际行为

- 身体使用一张双脚落地待机图、八张源自完整绘画的短步素材；固定64×64原生画布与32色。头部和胸口共用稳定像素，下半身保留各张绘制姿势；没有成人关节求解、简化杆状腿或透明叠化。
- 走步源图经对齐和姿势排序导入，顺序在`metadata.json`中逐张记录。图集0号为待机，1–8号为走步；编辑器中不要把待机当作走步循环的一部分。
- 新绘独立的手枪＋两只持握手，身体源不含枪和垂下的手。持握组一起旋转、镜像和后坐，保持局部握点稳定。
- 身体采用左右翻面；枪械全周连续瞄准。正上／正下附近用方向滞回减少反复翻面，挂点不随身体翻面从一侧瞬移到另一侧。
- 上向枪组位于身体后侧，并沿连续角度函数移到头侧及略抬高；枪口与闪光可读。子弹、枪焰、手枪都由同一个变换计算，瞄准同时补偿肩侧偏移，避免打偏鼠标目标。
- 真实碰撞后的位移推进步相；停止和撞墙使用待机帧。开火不重置脚步。暂停冻结状态，失焦清理键鼠输入，重新开始不继承按住状态。
- 样板含训练靶和障碍箱，仅供检查射击、命中及遮挡。本轮不增加游戏角色、敌人、关卡或存档规则。

## 素材与成本

`source/`保留内置ImageGen的[走步提示词](./source/body-walk.prompt.txt)、[持握组提示词](./source/sidearm-grip.prompt.txt)、[待机提示词](./source/body-idle.prompt.txt)及三个生成原图。正式运行候选为`body-atlas.png`和`sidearm-grip.png`；`.aseprite`保存可编辑的身体上下层和持握组，`body-walk.webp`仅用于观察步态。

两张候选运行图合计约7KiB，RGBA解码约147KiB。生成原图、编辑源与视频均为制作／评审资料；活动游戏目前不加载这些资源。

## 重建与检查

```powershell
python scripts/animation/build-compact-ranger-assets.py
python scripts/animation/verify-compact-ranger-assets.py
node --test test/compact-ranger-motion.test.js
node scripts/qa/verify-compact-ranger-review.mjs
```

`asset-data.js`是同批生成的经典脚本数据，使本地file页面不需要fetch读取JSON。运动模块在`scripts/animation/compact-ranger-motion.js`，样板界面在本目录，未进入活动游戏模块。

## 目前边界

本轮采用紧凑人物的符号化左右翻面，未绘制独立背身、全方向身体和专用后退姿势；左右配饰也随整体镜像。步态、衣摆、手部接合及各角度整体观感仍需视觉评审，按实际位移播放不等于数学锁脚已完成。没有宣称专业人工逐像素修画。

`visualApproved=false`、`runtimeIntegrated=false`。当前交付是可操作动态样板；主游戏仍保持原有角色表现。
