# 废土电台与行动手册界面素材

日期：2026-10-28。以项目已经认可的像素主角为参考，用两张复用环境建立菜单身份：营地用于启动／主菜单，桌面用于部署、行装、商店、设置和档案。

## 保存的素材

- `source/camp.png`：内置OpenAI ImageGen生成的像素广播营地原稿。
- `source/desk.png`：同一风格的安静桌面原稿。
- [最终提示词与生成方式](./source/generation-record.json)。原图不含按钮、数值和文字；没有使用商业游戏的原素材。
- 运行图为`web/assets/ui/radio-v1/camp.webp`与`desk.webp`，共492,558 bytes；导出最大归一化RMS约0.0153。源和运行图登记在`art/manifest.json`与素材台账。

## 程序美术与动画

`src/render/ui/radio-materials.js`统一纸签边缘、少量纸纹、布面缝线、旧铜旋钮、回声标记、机械开关和焦点。主要按钮使用浅色纸签＋深色文字，次要按钮使用布面，危险操作保留明确颜色。

片头由`src/core/startup-sequence.js`与`src/render/ui/startup-view.js`驱动：标记亮起、回声扩散、调频指针与标题显现，按真实时间而非显示帧数推进。正常约2.15秒，缺图最多等待3.2秒；随时可跳过。设置可关闭或重播，系统减少动态效果时直接进入菜单。运行包不加载演示录屏。

主菜单采用底部命令区；部署呈现实际人物与连续任务选项；商店两列，并显示真实货币差额；设置采用连续分组与机械拨动反馈。升级、暂停、结算和HUD复用同一材质，保留重要战斗颜色。

## 维护与验收

```powershell
python scripts/animation/stage-radio-ui-assets.py
npm.cmd run check
node scripts/qa/capture-radio-ui.mjs --full
```

修改环境图后重新登记导出；所有界面文字与点击区域继续由代码管理。版本标记写入HTML的`data-game-version`和显示文字，两者均由版本检查核对。

本机证据：`docs/qa/radio-ui-browser-2026-10-28.json`；完整截图和启动演示在`output/radio-ui-2026-10-28/`。覆盖540p／720p／1080p／1440p、120%文字、启动开关持久化、键鼠菜单／部署／暂停、跳过不误触、系统减少动态效果和缺图回退。手柄边沿逻辑有回归；实体手柄、实际Windows显示缩放与最低配置长局另待实测。
