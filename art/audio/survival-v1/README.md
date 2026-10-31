# 余火信号与实录枪声 v1

本批素材用于连续生存内部构建。运行文件12个，共542,600 bytes；只解码短枪声／机械声，三段OGG主题按需流式循环，最多两个音乐声道交叉淡化。

## 来源与制作

- 枪声：SnakeF8自行录制的第二套Authentic Gun Sounds。保留选用的9mm、.308、20 Gauge、手枪拉栓和左轮击锤源WAV。页面允许商业使用且无需署名；作者评论明确public domain并允许按CC0标注。见[许可记录](source-permission.md)。
- 氛围：Juhani Junkala / SubspaceAudio的Horror Atmosphere，CC0 1.0。原长323秒，项目保留43～67秒截段为单声道FLAC，用作低音量环境层。
- 主题《余火信号》：项目原创16小节D小调动机，92 BPM，分别编排营地、战斗、压力三段，共享拨弦、和声、低音与打击节奏。环境层来自上述CC0素材，不把整首写成没有第三方素材的纯原创。
- 离线脚本：[prepare-survival-audio.py](../../../scripts/audio/prepare-survival-audio.py)。NumPy／SciPy和FFmpeg只用于制作，不是游戏运行依赖。选用源文件已随本目录保存；已有source目录时可直接重建，无需重复下载完整上游包。
- 裁去前置静音、滤波、短尾音、归一化峰值；线圈炮增加原创过滤噪声。七把虚构武器使用处理后的实录音色，未声称其现实口径或枪型逐一对应。

## 注册和复核

[source-provenance.json](source-provenance.json)保留来源、修改、动机音符、运行文件大小和SHA-256；`src/content/audio-assets.js`为运行清单，素材台账同步登记。运行文件放在`web/assets/audio/survival-v1/`，源WAV／FLAC不进入Windows活动构建。

浏览器检查须确认短采样实际解码和播放，不能用合成回退的波形测试代替。真实听感、扬声器／耳机响度与长时间重复性仍需本人试听。
