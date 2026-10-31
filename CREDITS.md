# 制作与许可

《荒原回响》v1.5-alpha Windows 桌面开发线的游戏设计、战斗内核、程序化像素角色、主题编曲和程序化回退音效为本项目原创实现；本轮另加入下列已注明来源的CC0实录与环境采样；稳定公开构建仍为 v1.4.0。

## 当前发布内容

- 连续生存扩展：`art/combat/survival-builds-v1/`记录本轮四件原生像素武器、八个改件图标与四段原创短声音；枪体、手、袖口独立。制作数据、生成工具、原声音与SHA完整保留；没有复制《土豆兄弟》《元气骑士》素材或代码。
- Godot原生内部开发版：使用Godot 4.7.2，许可证和版权说明保存在`godot/licenses/`并随独立包提供；以下原版零运行依赖说明不适用于Godot引擎本体。本轮共享地表/道具图集由内置ImageGen生成，原图、提示词、SHA和使用条款边界见[地图素材包](art/world/pixel-map-v2/README.md)及其manifest，已登记中央素材台账；未使用竞品地图或图集。
- 回声旧城地面样板v3：两张地面/透明细节图集由内置ImageGen生成，仅将本项目既有环境物件图作为风格参考；原图、提示词、SHA与活动路径见[旧城地面素材包](art/world/echo-ground-v3/README.md)。未使用Nuclear Throne或Enter the Gungeon素材，其公开页面仅作游戏类型/设计研究参考。
- 游戏代码：项目原创，未引入第三方运行时库；
- 程序化美术：地图地标、界面材质、回声标记、启动动画、武器反馈和缺图回退由Canvas绘制；活动巡线者与八类敌人使用项目原生像素图集；
- 生成美术：封面、地表、旧破框感染者、v1.1 行动日志素材，以及 v1.2 的六张全页场景底板和实体军需铭牌均由 OpenAI ImageGen 为本项目生成，不含现有游戏的文字、商标、角色或水印；全部登记在 `docs/assets-ledger.csv` 和 `art/manifest.json`。活动 Web 树只保留优化 WebP，PNG 与停用版本保存在 `art/generated`；正式商业发布前须复核生成服务条款；
- 素材处理：透明输出失败的原稿、洋红中间稿和最终 RGBA 均保存在 `art/generated/`；`scripts/process-chroma-key.ps1` 只负责本地 Alpha、裁边和尺寸处理，不生成或改变角色设计；
- 界面字体：`web/assets/fonts/wasteland-fusion-pixel-12-subset.woff2` 来自 TakWolf 的 Fusion Pixel Font 2026.09.01 简体中文比例字体，并按项目实际字符做了子集化；字体软件采用 SIL Open Font License 1.1；
- 当前菜单环境：`art/ui/radio-v1/`的像素广播营地与桌面由内置OpenAI ImageGen为本项目生成，提示词与原稿保存于该目录；控件文字、焦点、材质和动画保持可编辑代码。品牌字标采用Fusion Pixel，中文正文使用系统字体；
- 字体来源与许可：<https://github.com/TakWolf/fusion-pixel-font>；完整上游发布包、源 WOFF2 与许可证分别保存在 `docs/assets-sources/fusion-pixel-font-2026.09.01/`、`docs/licenses/` 和 `web/assets/fonts/`；
- 当前枪声：SnakeF8第二套Authentic Gun Sounds，作者实录，按作者public domain／CC0声明取用；裁切、滤波与响度处理后用于七把虚构武器，机械声独立。原振荡器音色保留为缺API／加载失败回退；
- 武器扩展：五件新武器轮廓由项目原生像素描述绘制，手、袖口与武器独立；新增九个短音效以项目原创合成为主，榴弹发射、爆炸与锤击落地另混合已有许可的SnakeF8录音。制作方法、源文件和SHA见[扩展音频说明](art/audio/arsenal-v2/README.md)；未使用《元气骑士》《土豆兄弟》的美术、代码或录音；
- 当前主题《余火信号》：项目原创16小节D小调动机、92 BPM和三种编排；低音量氛围层来自Juhani Junkala / SubspaceAudio的Horror Atmosphere（CC0）。短音效解码缓存，长主题流式播放；
- 音频来源、作者声明、修改和文件SHA：[音频材料说明](art/audio/survival-v1/README.md)、[许可记录](art/audio/survival-v1/source-permission.md)、[来源清单](art/audio/survival-v1/source-provenance.json)；
- 编曲工具：开发阶段使用 MIT 许可的 `tubone24/midi-agent-skill`（本机安装名 `midi-generation`）的调式、配器和声部间距规则做辅助检查；Skill 不进入桌面运行包；
- 当前编曲源：`scripts/audio/prepare-survival-audio.py`保存原创动机、和声和离线制作流程；`src/platform/music-score.js`保留旧章节合成曲供回退；`docs/wasteland-pulse-composition.json` 保留 v1.3“破晓脉冲”草稿作为历史依据；
- Darkest Dungeon、Hunt: Showdown、Slay the Spire、《炉石传说》、《我的世界》和 Into the Breach 仅用于分析剪影、实体材质、卡牌层级、装备信息结构和战术可读性；Terraria 仅用于分析“标题即世界观入口”的呈现思路。项目没有复制其卡框、布局、标题、角色、代码或素材。

- 战地工坊v2：6种卡面、42个改件物件、13件枪体和8类敌人倒地帧由OpenAI内置ImageGen原创生成；已有项目敌人仅用作形象参考。原图、完整提示词、技术裁切与SHA见[工作包](art/combat/fieldcraft-v2/README.md)。生成素材记录适用服务条款，不标为第三方CC0；不含《元气骑士》或《土豆兄弟》的拆包素材。另有5段项目原创离线合成短音效，源及SHA单列保存。

未来新增的图片、字体、音乐、音效或第三方代码，必须先登记到 `docs/assets-ledger.csv`，写明来源、作者、许可证、修改情况和署名文本，再进入发布包。
