# 武器扩展音效 v2

日期：2026-10-29。新增 9 个单声道 22,050 Hz、16-bit WAV，共 108,000 bytes。加上原 survival-v1，活动音频共 21 个、650,600 bytes；三段长音乐仍流式播放，短音效按需解码。

| 文件 | 用途 | 制作来源 |
|---|---|---|
| prism_laser.wav | 折光脉冲枪 | 项目原创过滤放电与短共鸣 |
| slag_launcher.wav | 熔渣榴弹器发射 | SnakeF8 已授权霰弹实录的低通剪辑，混合原创压力层 |
| saw_disc.wav | 锯盘弹射器发射 | 项目原创短电机与金属泛音 |
| echo_blade.wav | 军刀挥动 | 项目原创空气风切 |
| shock_hammer.wav | 重锤挥动 | 项目原创低频空气挥动 |
| explosion.wav | 榴弹爆炸 | SnakeF8 已授权霰弹实录剪辑，混合原创噪声与低频冲击 |
| hammer_impact.wav | 锤击落地 | SnakeF8 已授权机械击锤录音，混合原创重击与碎屑 |
| melee_hit.wav | 刃击命中 | 项目原创短金属瞬态 |
| ricochet.wav | 锯盘转向弹射 | 项目原创短金属弹响 |

这些是虚构武器音效，不能统称为全部实录，也不声称与现实某枪型或口径逐一对应。未使用竞品录音。

SnakeF8 原始选用文件已保存在 `../survival-v1/source/`，作者 public domain／CC0 声明见[许可记录](../survival-v1/source-permission.md)。原始与运行文件 SHA-256、处理描述见[source-provenance.json](source-provenance.json)。原创短声由[离线制作脚本](../../../scripts/audio/prepare-weapon-expansion-audio.py)重建；NumPy/SciPy 仅用于制作，不是运行依赖。

声音分别接在攻击、落地、爆炸、命中与弹射事件上；不在挥动开始时提前播放锤击落地声。浏览器检查应验证采样真实解码与播放。耳机、扬声器的响度和长局疲劳仍待本人听审。
