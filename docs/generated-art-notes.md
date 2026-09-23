# 生成美术留档

日期：2026-09-08 至 2026-09-10  
用途：记录项目内生成图片的设计意图、技术属性和复核边界。许可证与发布状态以 `docs/assets-ledger.csv` 为准。

## `wasteland-title-keyart-v1.png`

- 归档路径：`art/generated/v1.0/runtime-snapshot/wasteland-title-keyart-v1.png`；活动副本为 `web/assets/wasteland-title-keyart-v1.webp`
- 技术属性：1230×1278，32-bit ARGB，透明背景，2,308,519 bytes
- SHA-256：`0A7357BC09E2614376090726F594226DB9B14C041E014D87ACA061016DE7C06D`
- 生成工具：OpenAI ImageGen
- 设计目的：让标题页第一眼同时表达“幸存者、枪械、尸潮、变异体和废土”，并可独立叠加在 Canvas 菜单背景上。
- 留档提示词摘要：原创像素游戏标题主视觉；透明背景；中央为戴兜帽与防毒面具的废土幸存者持步枪开火，表现枪口焰与抛壳；周围安排两种轮廓不同的普通感染者，背后是一只带拼装装甲和青色变异组织的大型怪物；暖橙枪火与冷青感染光形成高对比；角色全身或主要轮廓完整；不要文字、商标、水印、UI、现有游戏角色或可识别的既有 IP 构图。
- 修改：生成后未做像素内容重绘；运行时仅按视口等比缩放和裁切。图片加载失败时自动回退到程序化角色展示。
- 复核：已单独检查透明通道、主体完整性、无文字/商标/水印；1280×720 与 1920×1080 浏览器合成截图已在后续版本验收并归档。

## `wasteland-ground-texture-v1.png`

- 归档路径：`art/generated/v1.0/runtime-snapshot/wasteland-ground-texture-v1.png`；活动副本为 `web/assets/wasteland-ground-texture-v1.webp`
- 技术属性：1254×1254，24-bit RGB，3,516,628 bytes
- SHA-256：`F025EE1DE083CCBDCBFACED3B3A29074FA97F680C5291BB100725B469E282AF6`
- 生成工具：OpenAI ImageGen
- 设计目的：提供破裂沥青、沙土、碎石、轮胎印与褪色道路标线的废土地表细节，供街区、道路和货场底层低透明度叠加。
- 修改：作为本地纹理接入，场景结构、商店、道路、铁轨、列车和道具仍由 `src/world/wasteland-map.js` 与 Canvas 程序化绘制决定。
- 复核：已单独检查画面内容；正式商业发布前仍须按素材台账复核生成服务条款。

## `ui-mutant-overhang-v1.png`

- 归档路径：`art/generated/v1.0/runtime-snapshot/ui-mutant-overhang-v1.png`
- 技术属性：768×702，32-bit ARGB，736,053 bytes
- SHA-256：`28618A102DA732F34819D3EE2858857688F513EE57F377DD37774E812D8F1CDE`
- 生成工具：OpenAI ImageGen
- 设计目的：从界面右上角压入前景的大型拼装护甲变异体，以头、肩甲和抓握手臂构成厚度与遮挡；用于部署页等主界面的破框识别。
- 留档提示词摘要：以既有标题主视觉作为色阶与材质参考，不复制角色和构图；原创非对称变异体，旧钢甲、皮带、呼吸器和少量青色感染组织；暖橙轮廓光；透明背景；无文字、商标、水印、既有角色或商业游戏构图。
- 修改：首次生成误把棋盘格绘进背景，随后仅执行背景提取；确认真实 Alpha 后，从 1312×1199 高质量缩放为 768×702，降低运行时解码内存。
- 复核：已检查 `Format32bppArgb`、左上透明像素 Alpha=0、轮廓完整和无文字/水印。

## `ui-crawler-overhang-v1.png`

- 归档路径：`art/generated/v1.0/runtime-snapshot/ui-crawler-overhang-v1.png`
- 技术属性：768×702，32-bit ARGB，1,006,489 bytes
- SHA-256：`23E77043DCF40B28CD768B884D6E4628F3E06C5987F20A94B6C87A35DDBC02C0`
- 生成工具：OpenAI ImageGen
- 设计目的：从界面左下角探入前景的披布感染者，以长手指、头罩和半面罩形成与大型变异体不同的轮廓；用于背包与商店的边缘叙事。
- 留档提示词摘要：原创瘦长感染者，旧帆布头罩、拼装半面罩、皮带和少量琥珀感染结节；低暖光与煤灰阴影；透明背景；无文字、商标、水印、既有角色或商业游戏构图。
- 修改：首次生成误把棋盘格绘进背景，随后仅执行背景提取；确认真实 Alpha 后，从 1312×1199 高质量缩放为 768×702，降低运行时解码内存。
- 复核：已检查 `Format32bppArgb`、左上透明像素 Alpha=0、轮廓完整和无文字/水印。

## `deployment-journal-spread-v1.png`

- 归档路径：`art/generated/v1.1/runtime/deployment-journal-spread-v1.png`
- 技术属性：1672×941，24-bit RGB，2,860,791 bytes
- SHA-256：`8410F358BDEEB0B25D91C27B990C2D8940C16ECF61BD35DFACFA2A649C421C8B`
- 生成工具：OpenAI ImageGen
- 设计目的：作为作战部署页的无文字双页日志底板，提供皮革封套、纸纤维、装订缝、夹件、桌面和统一光源。
- 提示词摘要：16:9 俯视末日行动日志；左页与右页保留清晰安全区，最右侧预留怪物边栏；页面中央无文字、按钮和角色；暖灯与少量冷色反光。
- 修改：源图与归档运行图内容一致；停用后从活动 `web/assets` 去重，保留 `art/generated/v1.1/source/` 与 `runtime/`。
- 复核：书本四边完整，中央装订缝清晰，页面安全区无伪文字；1080p 与 720p 合成检查通过。

## `deployment-convoy-vignette-v1.png`

- 归档路径：`art/generated/v1.1/runtime/deployment-convoy-vignette-v1.png`；活动副本为 `web/assets/ui/deployment/deployment-convoy-vignette-v1.webp`
- 技术属性：1100×768，32-bit ARGB，1,380,647 bytes
- SHA-256：`35E86D5E0853F83263CFC7A65A4E52582A1FBB09025E93503B5C02EA81388DD0`
- 生成工具：OpenAI ImageGen + 本地色度抠图脚本
- 设计目的：替换部署页原有几何块运输车，以一名原创幸存者和一辆装甲皮卡构成左页固定叙事插画。
- 提示词摘要：兜帽、呼吸器、拼装护甲、通用步枪与装甲皮卡；人物、车辆、天线、车轮完整；真实钢、皮革、帆布和尘土材质；暖橙主光与少量青色反射。
- 修改：直接透明输出两次失败并返回不透明棋盘格；原稿均保留。随后生成纯 `#FF00FF` 背景，通过 `scripts/process-chroma-key.ps1` 转为 RGBA、清除溢色、裁边并缩至 1100×768。第一版距离抠图作为 inactive 变体保留。
- 复核：角落 Alpha=0，无棋盘格，无明显洋红边缘；左页合成和点击区域通过。

## `deployment-note-surface-v1.png`

- 归档路径：`art/generated/v1.1/runtime/deployment-note-surface-v1.png`
- 技术属性：1200×312，32-bit ARGB，859,669 bytes
- SHA-256：`51A52A0CFC4006C4178DBBFE2E98FF57D5C0C7980802C0F951FC27FD9F1A211F`
- 生成工具：OpenAI ImageGen + 本地色度抠图脚本
- 设计目的：章节、模式、地图和人物说明共用的九宫格旧纸便签，端帽和布带在缩放时保持比例。
- 提示词摘要：3.2:1 分层旧纸、布带、缝线和小型黄铜夹片，中央空白，重要细节限制在外侧 16%，纯洋红背景。
- 修改：色度抠图、透明裁边和 1200px 宽运行优化；九宫格参数由素材注册表集中声明。
- 复核：RGBA、角落 Alpha=0；多种高度下九宫格中心保持可拉伸，三条说明增加低透明纸面擦痕以保障可读性。

## `deployment-action-strap-v1.png`

- 归档路径：`art/generated/v1.1/runtime/deployment-action-strap-v1.png`
- 技术属性：1200×250，32-bit ARGB，735,261 bytes
- SHA-256：`DCF5A54F1EE43A6C700B25E0FBB2BA99F2652468DC4BCC2D1993B2A7F2B82E31`
- 生成工具：OpenAI ImageGen + 本地色度抠图脚本
- 设计目的：作战部署页唯一高饱和主操作，替换程序化红色矩形按钮。
- 提示词摘要：4.5:1 氧化红皮革、暗钢背板、黄铜端帽和厚缝线，中央无字，纯洋红背景。
- 修改：色度抠图、透明裁边和九宫格运行优化；键盘/手柄焦点使用自然黄铜短线，不使用外包围方框。
- 复核：RGBA、角落 Alpha=0；正常、悬停、按压和焦点状态均不遮挡文字。

## `deployment-back-tab-v1.png`

- 归档路径：`art/generated/v1.1/runtime/deployment-back-tab-v1.png`
- 技术属性：700×142，32-bit ARGB，234,969 bytes
- SHA-256：`EE743CDEE8A4C2AA55B9227A2A7D62ED5EC3657153CC9C1EF64B5419BC22C4F4`
- 生成工具：OpenAI ImageGen + 本地色度抠图脚本
- 设计目的：解决通用便签缩成小型返回控件后端帽挤占文字区的问题。
- 提示词摘要：3.6:1 深橄榄棕皮革、薄钢和窄黄铜端夹，至少 72% 中央留空，纯洋红背景。
- 修改：色度抠图、透明裁边和 700px 宽运行优化；作为独立九宫格素材注册。
- 复核：720p 下“返回营地”保持清晰，不与右侧怪物重叠。

## `deployment-edge-mutant-v1.png`

- 归档路径：`art/generated/v1.1/runtime/deployment-edge-mutant-v1.png`
- 技术属性：620×1525，32-bit ARGB，1,650,724 bytes
- SHA-256：`1CA47F7A5CE3DCCABBC11EF75C6707CE0072EFB1225378F8C1D752D50D691BB0`
- 生成工具：OpenAI ImageGen + 本地色度抠图脚本
- 设计目的：以单一连续怪物替换 v1.0 的“完整怪物后层 + 独立手爪前层”组合，消除身体截断和手部脱节。
- 提示词摘要：原创变异拾荒者；头、肩、上臂、前臂和抓握手形成连续身体；呼吸器、拼装肩甲、皮带和少量青色结节；纯洋红背景；禁止脱离肢体和重复手臂。
- 修改：色度抠图、透明裁边和 620px 宽运行优化；页面只绘制一次完整素材，不使用 source crop。
- 复核：RGBA、角落 Alpha=0，头至手连续；1080p 与 720p 均不遮挡返回、箭头、说明或出征按钮。

完整提示词摘要和源图路径见 `art/generated/v1.1/prompts.md` 与 `art/manifest.json`。
