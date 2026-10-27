# 可替换手部与袖口：七枪材料分层 v3

日期：2026-10-27。按[兼容性方案](../../../../docs/hand-weapon-compatibility-plan-2026-10-27.md)实施，认可版基线为`7510e71`。

## 直接体验

[打开分层材料动态预览](./review.html)。默认使用原布手套与原沙色袖口，画面与旧组合图逐像素一致。可切换较宽金属护手、钢灰护腕，或选择“旧图对照”；支持七枪、自动战斗、WASD走位、八方向、后坐、慢放和材料图层查看。

[外观对照图](../../../../output/modular-grips-2026-10-27/hand-styles.png)按旧图、原手套分层合成、宽护手、宽护手＋护腕四列显示；[动态切换视频](../../../../output/modular-grips-2026-10-27/hand-switching.webm)保存在本地output中。

护手与护腕是结构测试外观，不是已完成的新英雄。当前身体仍为巡线者；第二名不同体型人物需要其身体美术、握姿与挂点验收。

## 材料分别属于谁

| 材料 | 可编辑源位置 | 说明 |
|---|---|---|
| 七把完整枪体 | `art/weapons/compact-modular-v1/<weaponId>/weapon-base.aseprite` | 只含武器，无人物手套／袖口；隐藏握把和护木已补绘 |
| 原手型 | `art/characters/hand-sets/compact-v1/ranger-cloth/poses.aseprite` | 按枪保留原像素作为兼容覆盖，独立图集 |
| 宽护手 | `art/characters/hand-sets/compact-v1/plated-test/poses.aseprite` | 短枪、长枪、重炮三类模板，手背／手指前后层 |
| 沙色袖口 | `art/characters/cuff-sets/compact-v1/ranger-coat/poses.aseprite` | 独立服饰材料 |
| 护腕测试 | `art/characters/cuff-sets/compact-v1/steel-test/poses.aseprite` | 保留原袖口轮廓，腕部采用金属材质 |
| 身体、挂点和头部遮挡 | `metadata.json`中的`characters` | 与武器自身的枪口、握点分别管理 |

`metadata.json`记录独立资产、图集区域、主握点／托枪点、外观ID和版本。`modular-data.js`是同批导出的本地预览数据。

## 本轮美术处理

现有武器已有可编辑原生像素源，因此采用原生区域标注与补绘，没有重新生成整套枪图。`source/regions.json`逐行标记手、袖口、保护的武器区域和隐藏结构补绘；不以棕色等RGB条件猜测木枪柄和手套。

原手部保留各枪差异，以便恢复认可版。测试护手在原生手型上扩展上方／外侧轮廓，加入分节金属护板，形状与材质都不同；护腕采用独立袖口纹理。其配方在`build-modular-grips.py`中保留，供复建初始迁移。

原手套、测试护手与两套袖口也都提供短枪／长枪／重炮的类别默认姿势；七枪原样覆盖优先，后续同类别武器可复用类别资源。每个人物配置可指定自己的默认手部与袖口，未知或缺失资源会明确报错。

人物必须明确绑定默认手部／袖口，或由调用者显式指定。新人物缺少绑定时会报错，不会静默继承巡线者的手套。

本目录`source/<weaponId>.aseprite`是五层迁移快照，适合对照拆分过程。日常修改应编辑上表中的独立材料源，避免把迁移快照当作唯一运行源。

## 合成与动作

运行时选定人物／手套／袖口／枪械后生成一张小Canvas，继续用现有持握组的统一转向、镜像、后坐和枪口变换。普通播放不重新合成。缓存最多保留8套，版本与握点变化会使相应缓存失效。

手背可在枪后，手指可在枪前。合成器计算联合边界，扩边时同时修正枢轴和枪口，避免裁手或弹道漂移。切换外观不调用换枪或重开，不重置步相、目标和射击冷却。

核心在`scripts/animation/modular-grip-compositor.js`。预览通过一个可选外观接口复用v2操作逻辑；旧v2页面未启用该接口，继续使用原组合图。

## 日常编辑与导出

1. 修改上表的独立`.aseprite`材料。图集内各部件区域和锚点在`metadata.json`中；扩展部件区域时同步更新描述。
2. 运行`python scripts/animation/export-modular-grip-sources.py`。它先在output暂存全部导出，检查原默认组合仍与基线一致，再更新PNG、哈希、版本和预览数据。
3. 运行下列验证命令。新手套应使用新的外观ID；改变认可默认外观的编辑会被基线检查拦截，需要另作新版本和视觉验收。

```powershell
python scripts/animation/export-modular-grip-sources.py
python scripts/animation/verify-modular-grips.py
node --test test/modular-grip.test.js
node scripts/qa/verify-modular-grips.mjs
```

`build-modular-grips.py`用于从原合并图和语义配方进行初始迁移，不是日常编辑导出命令。它会检查人工修改过的源文件和挂点配置，拒绝静默覆盖。`--reseed`明确表示丢弃后续源编辑、从初始配方复建；正常制作使用上面的导出流程。

## 本轮证据与资源规模

- 两枪试验先完成：手枪＋步枪、两种手型／两种袖口，128组姿态检查通过。
- 七枪原默认组合：原生像素及实际渲染A/B一致；11份独立材料编辑源与PNG回读一致，7份五层迁移快照恢复原图。
- 七枪×两种手型×两种袖口×八方向×静止／最大后坐，448组检查通过；头部与枪口可见，外观切换保持枪口位置。
- 连续300帧播放未增加合成次数；缓存淘汰不破坏仍被画面持有的图像。
- 本轮11张独立材料PNG合计8990字节，较旧七张合并图增加2048字节；元数据和程序另计。材质纹理解码41796字节，浏览器案例中的8套缓存为38592字节，均为像素统计，不是整个进程内存。身体仍复用；A/B预览额外加载旧图作对照。
- 浏览器就绪耗时是本机一次headless本地样本，不作为实体Windows启动性能保证。

证据：`docs/qa/modular-grips-assets-2026-10-27.json`、`docs/qa/modular-grips-browser-2026-10-27.json`及试验记录。新护手的美术观感待审，未声称新身体兼容已验收；新角色美术仍未接入主游戏。
