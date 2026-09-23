# 制作与许可

《荒原回响》v1.5-alpha Windows 桌面开发线的游戏设计、战斗内核、程序化像素角色、三章节编曲和程序化合成音效均为本项目原创实现；稳定公开构建仍为 v1.4.0。

## 当前发布内容

- 游戏代码：项目原创，未引入第三方运行时库；
- 程序化美术：地图地标、UI、武器反馈、幸存者和感染者由运行时 Canvas 分层绘制；
- 生成美术：封面、地表、旧破框感染者、v1.1 行动日志素材，以及 v1.2 的六张全页场景底板和实体军需铭牌均由 OpenAI ImageGen 为本项目生成，不含现有游戏的文字、商标、角色或水印；全部登记在 `docs/assets-ledger.csv` 和 `art/manifest.json`。活动 Web 树只保留优化 WebP，PNG 与停用版本保存在 `art/generated`；正式商业发布前须复核生成服务条款；
- 素材处理：透明输出失败的原稿、洋红中间稿和最终 RGBA 均保存在 `art/generated/`；`scripts/process-chroma-key.ps1` 只负责本地 Alpha、裁边和尺寸处理，不生成或改变角色设计；
- 界面字体：`web/assets/fonts/wasteland-fusion-pixel-12-subset.woff2` 来自 TakWolf 的 Fusion Pixel Font 2026.09.01 简体中文比例字体，并按项目实际字符做了子集化；字体软件采用 SIL Open Font License 1.1；
- 字体来源与许可：<https://github.com/TakWolf/fusion-pixel-font>；完整上游发布包、源 WOFF2 与许可证分别保存在 `docs/assets-sources/fusion-pixel-font-2026.09.01/`、`docs/licenses/` 和 `web/assets/fonts/`；
- 音频：由 `src/platform/music-score.js` 和 `src/platform/audio-engine.js` 在运行时合成，不包含外部音乐、MIDI 或音频采样；
- 编曲工具：开发阶段使用 MIT 许可的 `tubone24/midi-agent-skill`（本机安装名 `midi-generation`）的调式、配器和声部间距规则做辅助检查；Skill 不进入桌面运行包；
- 编曲源：`src/platform/music-score.js` 保存三个章节的原创音符、速度、压力层和 Boss 动机；`docs/wasteland-pulse-composition.json` 保留 v1.3“破晓脉冲”草稿作为历史依据；
- Darkest Dungeon、Hunt: Showdown、Slay the Spire、《炉石传说》、《我的世界》和 Into the Breach 仅用于分析剪影、实体材质、卡牌层级、装备信息结构和战术可读性；Terraria 仅用于分析“标题即世界观入口”的呈现思路。项目没有复制其卡框、布局、标题、角色、代码或素材。

未来新增的图片、字体、音乐、音效或第三方代码，必须先登记到 `docs/assets-ledger.csv`，写明来源、作者、许可证、修改情况和署名文本，再进入发布包。
