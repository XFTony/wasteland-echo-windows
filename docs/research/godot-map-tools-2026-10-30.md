# 《荒原回响》地图工具调研与采用建议

调研日期：2026-10-30。目标引擎为本机 Godot 4.7.2，Windows、GDScript、Compatibility。本文仅调研，没有安装插件或改动游戏。仓库活动时间与版本是查询当日快照，不能等同于本项目实测通过。

## 结论

本轮最合适的组合是 **Godot 内置 TileMapLayer + 外置 TileSet + 独立地图物件节点/场景**。地表、路面、边缘和贴花分层编辑；建筑、交易站、爆桶、补给与可部署塔台分别保留对象身份。当前项目为连续走位、自动射击、拾荒和随时回交易站的开放生存地图，地图工具应服务战斗空间和美术量产。

后续需要更灵活地形连接时，首选小范围验证 Better Terrain；需要独立地图编辑器时，优先评估 **Tiled + YATI 的 GDScript 版**。YATI 是本次候选中找到明确 Godot 4.7.2/Windows 实测说明的一项。Gaea 保留作以后受控变化生成的候选；Terrain Autotiler 已归档，不作为新工具链基础。

工具解决铺图、连接、图层和数据编辑效率；统一像素密度、材质语言、地标和交互可读性仍需要美术规范与逐图检查。

## 工具核实表

| 工具 | 已核实能力 | 版本、维护与许可证据 | 本项目判断 |
|---|---|---|---|
| Godot TileMapLayer / TileSet / Terrains | 原生分层铺图、图案复制、随机替代图块、地形连接；图块可带碰撞/遮挡/自定义数据；TileSet 可另存资源跨地图共享 | 当前官方 stable 文档为4.7；引擎MIT。[TileMap文档](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html)、[TileSet文档](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html) | 本轮采用，无新增插件依赖。先用于视觉地表/贴花，沿用当前已验证碰撞与流场的数据来源 |
| Better Terrain | 使用现有 TileMapLayer/TileSet 的自动地形连接，支持多种连接规则与运行时更新API | Asset Library 1.1、标注Godot4.3、2026-02-14提交；源码API明确使用TileMapLayer。Unlicense；仓库未归档，最近推送2026-02-09。[资源库](https://godotengine.org/asset-library/asset/1806)、[源码/README](https://github.com/Portponky/better-terrain) | 可选。4.3标签/使用现代API不等于4.7已测试；本项目安装前须在隔离样板验证。资源库提供固定提交e93040e1cdd9dba0117c87f8f6b2883c83872d5d |
| Terrain Autotiler | 为Godot4 terrain提供确定性连接算法，可扩展匹配与合并 | MIT；仓库明确于2024-04-13归档，已只读；示例仍含旧TileMap工作流。[仓库](https://github.com/dandeliondino/terrain-autotiler) | 排除为新基础。归档状态与4.7/TileMapLayer适配不明，不应因为旧教程推荐而引入 |
| Gaea | 程序化地形、噪声/生成器等，可生成自然地表与洞穴 | MIT；官方仓库默认2.0分支，README目标Godot4.4；4.3及以下指向1.X。最近推送2026-10-18，但API的latest正式Release仍是v1.4.1（2025-04-13）。[仓库](https://github.com/gaea-godot/gaea)、[Release](https://github.com/gaea-godot/gaea/releases/tag/v1.4.1) | 暂缓。2.0分支与正式Release不是同一个版本承诺，4.7兼容仍待实测。现在需要先做好固定地图的战斗结构与素材，程序生成会扩大规则和验证成本 |
| Tiled + YATI | Tiled地形/对象层/自动映射/模板；YATI将TMX/TMJ导入Godot场景，支持碰撞、动画、属性和对象 | YATI MIT；README明确Windows11、Godot4.7.2、Tiled1.12.2实测。GDScript2.2.9、C#2.2.10，要求Godot4.3+；最近推送2026-10-05。[YATI](https://github.com/Kiamo2/YATI)、[Tiled官网](https://www.mapeditor.org/) | 外部编辑器首选备选。使用GDScript版适配当前标准版Godot，不增加.NET。导入器README提示多地图并发导入可能冻结，需实测并按说明处理线程导入设置 |
| LDtk + heygleeson importer | LDtk有IntGrid/AutoLayer规则、实体字段、世界组织与JSON输出；导入器可生成场景、处理图集、实体及Post-Import | LDtk编辑器MIT；导入器MIT，未归档，最近推送2026-10-12；latest Release为2.0.1（2024-09-19），说明采用Godot4.3新翻转方法，并列出EntityRefs/重导入限制。[LDtk](https://ldtk.io/)、[导入器](https://github.com/heygleeson/godot-ldtk-importer)、[Release](https://github.com/heygleeson/godot-ldtk-importer/releases/tag/2.0.1) | 对像素关卡编辑友好，但未找到该发布版明确的4.7.2实测承诺。新增编辑器与导入钩子后维护点更多，放在长期地图量明显增大时评估 |

Tiled本体与导入器须区分许可：Tiled项目的COPYING列出编辑器/插件为GPL、libtiled为BSD 2-clause等多种组成；YATI自身为MIT。本项目若只使用编辑器产出的地图文件，不需要将Tiled编辑器本体编入游戏。素材来源/许可另行登记，不能把工具许可当作素材许可。[Tiled许可清单](https://raw.githubusercontent.com/mapeditor/tiled/master/COPYING)

“最近推送”来自官方GitHub仓库API，仅用来识别归档/陈旧风险；不以星数、推送时间或README性能宣传代替兼容/性能测试。本次未运行上述第三方插件，因此未标记其在本项目安装成功。

## 内置工具具体能做什么

1. 用多个 TileMapLayer 分别编辑基础地面、道路、边缘过渡、地面贴花；TileSet另存`.tres`，同套连接规则在三图复用。
2. Terrain负责边/角/路口的连接。完整图块组合、替代图块和统一像素尺度须先备齐；只装连接插件无法补出缺失的内角或路口素材。
3. 高物体的Y排序原点放在落地基线，分离地面投影/实体底座/上部遮挡；建筑顶盖、树冠等可以有视觉伸出，而碰撞保持实体底座的含义。官方TileSet文档提供Y Sort Origin与多格图块设置。
4. 交易、爆桶、拾取、塔台使用带ID的独立节点/场景或保留现有对象节点；地面图块不直接承载可变库存、一次性拾取或交易状态。
5. 可用自定义图块数据标记surface等美术/声音属性；当前项目的玩法碰撞来自世界数据，新增TileMapLayer先关闭自身collision/navigation，避免两套判定争夺权威。若后续改为图块驱动碰撞，应明确一次性迁移与回归，而不是同时各维护一份。

官方文档也明确指出，TileMap自带导航有性能/路径质量局限。项目已有三档已验证的共享流场，当前地图美术改造不需要同时更换导航系统。[官方导航说明所在页](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html#navigation)

## 对标依据与本项目设计推断

《Brotato》官方商店将其描述为俯视竞技场射击肉鸽；本项目应借鉴可读的开放运动空间、怪物密度下的地面克制与拾取辨识，而连续计时/地图交易的现有规则继续按本项目设计。[官方商店页](https://store.steampowered.com/app/1942280/Brotato/)

《元气骑士》开发者的官方商店描述确认像素地牢、自动瞄准和随机地牢等特点。可参考像素材质和小型交互物的明确剪影；它的房间化空间不等于本项目必须改成逐房推进，也不能据介绍推断其内部地图制作算法。[官方Google Play页面](https://play.google.com/store/apps/details?id=com.ChillyRoom.DungeonShooter&hl=en)

下列是针对本项目的设计判断，不是上述游戏官方制作规范：

- 主角/敌人用清楚的轮廓与较高局部对比；可行走地面使用较少的亮点和低对比细节。金币、爆桶、危险区、交易站各有稳定的颜色与形状职责。
- 保留绕行环路和视线可读的射击空间，建筑/车辆形成可预判的分流；装饰性石块、裂纹、垃圾不伪装成实体障碍。
- 交易站设置专门入口/地坪/灯色/互动标识，并把可交互位置放在柜台可到达一侧；金色地标表示补给，危险物体另用警示轮廓，避免把所有可交互物都画成同一种发光框。
- 碰撞轮廓以实体底座为准，视觉高度与遮挡独立。玩家/敌人经过上部遮挡时，应仍保有必要轮廓或透明反馈；不能只给玩家穿透高亮而让敌人完全不可见。
- 地表图块尺寸、主角像素放大倍率、道具笔触和光源先统一。当前导航格尺寸与美术图块尺寸不是同一个概念，不应直接绑定。
- 三图共享一套基础造型规范，通过旧城地砖/道路、锈轨枕木/货运设施、赤砂龟裂地表/风化物形成主题区别。避免仅给同一套满屏纹理换色。

## 最小采用与后续验证

**本轮：**内置TileMapLayer/TileSet处理视觉地表，既有MapObstacle/交互对象承担实体身份；先完成回声旧城样板，再将共用规范推广到其它两图。需要的交付是可编辑资源、素材清单、显示/碰撞的一致来源、四分辨率截图与原生回归。

**可选增强：**当边角连接的人工成本已实际出现，再在隔离地图验证固定版本Better Terrain。验证清单为编辑器启用、画/擦/边角更新、保存重开、场景/资源引用、headless导入、导出包；同时核对插件是否注册Autoload和导出依赖，不能直接删除addon后假设包仍可运行。

**外部编辑器：**当地图由多个人或大量关卡组成时，优先试Tiled+YATI；地图源文件及图集在同一受控目录，生成场景的手工扩展用后处理或继承场景，不在每次重导入都会重写的节点上保存唯一修改。LDtk适合希望用IntGrid规则统一美术铺设的场景，但要先完成导入器4.7适配样板。

**受控变化：**Gaea以后可生成不影响主环路的小片地表变化/装饰候选。每次生成仍须通过交易站可达性、出生/部署合法性、三档导航与战斗可读性检查，不能替代人工确定的关键地标和战斗空间。

所有对标仅作设计参考，未下载或复用竞品地图/图集。新素材记录作者、来源、许可、原图与运行图；插件若采用需固定提交并把许可一起入库。
