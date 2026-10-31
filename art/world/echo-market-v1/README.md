# 回声街区交易站素材包 v1

用途：唯一局内购买地标，匹配已认可的紧凑像素巡线者；由内置ImageGen生成原创位图。参考图仅是本项目人物图集与游戏截图，未复制竞品资产。

- 原始透明图：`source/trade-post.png`；生成提示词／来源：`source/generation-record.json`。
- 车辆／废铁源图：`source/salvage-kit.png`；提示词、核对后的来源区域：`source/salvage-kit-generation.json`。四个物件按Alpha边界裁出，最近邻打包到512×384图集并保留间隔；运行图`web/assets/world/echo-market-v1/salvage-kit.webp`，UV表为`src/content/echo-props.js`。仅本次地图使用，其他地图原表现保留。
- 运行图：`web/assets/world/echo-market-v1/trade-post.webp`，去掉透明外边距，最近邻导出380像素宽、保留Alpha、无损WebP。通过`scripts/animation/stage-echo-market-assets.py`重复导出与登记。
- 世界配置：`src/world/echo-district.js`；建筑实体`echo-market-booth`，柜台交互`echo-trade-post`。建筑图像按同一实体矩形绘制，不把透明画布边距当碰撞。
- 招牌名称、金币／工具提示、价格、库存、交互键均由程序绘制；位图不包含文字与碰撞信息。
- 爆炸桶、补给箱、电场、金币和升级卡继续使用可编辑Canvas图形，不重复生成大图。旧地图仍引用的地表／屋顶图保留；不删除被其他地图使用的公共数据。
- 资产已记入`art/manifest.json`与`docs/assets-ledger.csv`；正式商用前沿用项目现有生成素材条款复核流程。
