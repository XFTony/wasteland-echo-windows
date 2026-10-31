"use strict";

// Hand-authored prototype: one landmark and connected escape loops. Coordinates
// describe the same solid footprint used by the renderer, actors and navigation.
const ECHO_DISTRICT = {
  id: "echo_district", worldSize: 3072, blocksProjectiles: true, scrapChanceFloor: .2,
  zones: [
    { id: "old-quarter", label: "西侧旧铺", x: 240, y: 300, w: 760, h: 650, surface: "pavement" },
    { id: "radio-yard", label: "旧广播园区", x: 1220, y: 280, w: 790, h: 560, surface: "concrete" },
    { id: "signal-square", label: "广播广场 · 战地交易", x: 1190, y: 1110, w: 790, h: 760, surface: "concrete" },
    { id: "service-row", label: "东侧修配巷", x: 2240, y: 560, w: 570, h: 1210, surface: "pavement" },
    { id: "freight-yard", label: "南线货场", x: 300, y: 2200, w: 1620, h: 560, surface: "ballast" },
    { id: "south-housing", label: "南侧避难街", x: 2210, y: 2260, w: 570, h: 480, surface: "scrap" }
  ],
  roads: [
    { id: "echo-north-loop", orientation: "horizontal", x: 240, y: 940, w: 2570, h: 150, lanes: 1 },
    { id: "echo-south-loop", orientation: "horizontal", x: 240, y: 1960, w: 2570, h: 160, lanes: 1 },
    { id: "echo-west-loop", orientation: "vertical", x: 1030, y: 270, w: 150, h: 2500, lanes: 1 },
    { id: "echo-east-loop", orientation: "vertical", x: 2040, y: 270, w: 160, h: 2500, lanes: 1 },
    { id: "echo-square-crossing", orientation: "horizontal", x: 1180, y: 1530, w: 860, h: 130, lanes: 1 }
  ],
  roadDetails: [
    { id: "echo-crosswalk-square", type: "crosswalk", orientation: "horizontal", x: 2050, y: 1500, w: 140, h: 104, stripes: 6 },
    { id: "echo-crosswalk-old-quarter", type: "crosswalk", orientation: "vertical", x: 1000, y: 956, w: 150, h: 112, stripes: 7 },
    { id: "echo-crack-01", type: "crack", x: 1320, y: 1010, w: 46, h: 18, seed: 11 },
    { id: "echo-crack-02", type: "crack", x: 1054, y: 1750, w: 20, h: 48, seed: 23 },
    { id: "echo-crack-03", type: "crack", x: 2460, y: 2034, w: 58, h: 17, seed: 37 }
  ],
  interactives: [
    { id: "echo-trade-post", type: "tradePost", x: 1570, y: 1390, radius: 78, name: "余火交易站", obstacleId: "echo-market-booth" },
    { id: "echo-barrel-west", type: "explosiveBarrel", x: 918, y: 1300, radius: 14, solidRadius: 12, effectRadius: 126, damage: 72 },
    { id: "echo-supply-radio", type: "supplyCache", x: 1810, y: 820, radius: 20, solidRadius: 16, scrap: 8, healing: 28 },
    { id: "echo-grid-service", type: "electricField", x: 2330, y: 1850, radius: 96, slow: 0.58 }
  ],
  tracks: [{ id: "echo-southbound-freight", orientation: "horizontal", x: 300, y: 2240, w: 1620, h: 360, lines: 5, spacing: 60 }],
  obstacles: [
    { id: "echo-market-booth", x: 1475, y: 1200, w: 190, h: 136, kind: "tradePost", sign: "余火交易站" },
    { x: 360, y: 390, w: 210, h: 135, kind: "shop", sign: "旧药房" },
    { x: 680, y: 590, w: 224, h: 140, kind: "shop", sign: "封闭旧铺" },
    { x: 360, y: 780, w: 190, h: 110, kind: "warehouse", sign: "仓储" },
    { x: 1350, y: 430, w: 280, h: 142, kind: "warehouse", sign: "广播机房" },
    { x: 1780, y: 570, w: 154, h: 96, kind: "container" },
    { x: 2310, y: 710, w: 222, h: 130, kind: "shop", sign: "旧修理间" },
    { x: 2590, y: 1140, w: 170, h: 100, kind: "warehouse", sign: "配件库" },
    { x: 2290, y: 1420, w: 154, h: 82, kind: "container" },
    { x: 650, y: 1370, w: 184, h: 66, kind: "bus" },
    { x: 450, y: 1730, w: 150, h: 56, kind: "wreck" },
    { x: 1745, y: 1770, w: 122, h: 62, kind: "car" },
    { x: 530, y: 2300, w: 250, h: 76, kind: "railcar" },
    { x: 1010, y: 2490, w: 260, h: 80, kind: "railcar" },
    { x: 1560, y: 2320, w: 155, h: 84, kind: "container" },
    { x: 2370, y: 2390, w: 226, h: 140, kind: "shop", sign: "旧宿舍" },
    { x: 2700, y: 2630, w: 120, h: 74, kind: "scrap" }
  ],
  // Low scenery is deliberately walkable; no decorative wall/large crate impostors.
  scenery: [
    { x: 1680, y: 720, type: "antenna" },
    { x: 1240, y: 1160, type: "streetlight" },
    { x: 1900, y: 1770, type: "streetlight" },
    { x: 520, y: 1000, type: "rubble", detail: true },
    { x: 860, y: 1820, type: "tires", detail: true },
    { x: 1480, y: 1820, type: "cable", detail: true },
    { x: 1700, y: 2170, type: "railSignal" },
    { x: 330, y: 2640, type: "scrub", detail: true },
    { x: 2800, y: 1840, type: "scrub", detail: true }
  ],
  theme: { ground: "#514b39", asphalt: "#333b37", concrete: "#64604e", ballast: "#534c3f", accent: "#d8bb76", haze: "#bfa878" }
};

module.exports = { ECHO_DISTRICT };
