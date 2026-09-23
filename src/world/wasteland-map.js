"use strict";

function freezeEntries(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

const WASTELAND_WORLD_SIZE = 2048;

// This is world data, not renderer state. Both collision and presentation read
// the same landmarks, so adding a district does not require duplicating its
// coordinates across the game model and the Canvas renderer.
const WASTELAND_ZONES = freezeEntries([
  { id: "old-quarter", label: "旧城商店街", x: 96, y: 112, w: 810, h: 650, surface: "pavement" },
  { id: "service-row", label: "环城服务区", x: 1130, y: 190, w: 690, h: 560, surface: "concrete" },
  { id: "main-road", label: "废弃主干道", x: 0, y: 800, w: 2048, h: 308, surface: "asphalt" },
  { id: "freight-yard", label: "南线货场", x: 100, y: 1234, w: 1710, h: 632, surface: "ballast" },
  { id: "breaker-yard", label: "拆车场", x: 1428, y: 1180, w: 470, h: 610, surface: "scrap" }
]);

const WASTELAND_ROADS = freezeEntries([
  { id: "east-west", orientation: "horizontal", x: 0, y: 800, w: 2048, h: 308, lanes: 2 },
  { id: "service-access", orientation: "vertical", x: 914, y: 0, w: 214, h: 858, lanes: 1 },
  { id: "yard-access", orientation: "vertical", x: 920, y: 1095, w: 166, h: 730, lanes: 1 }
]);

const WASTELAND_TRACKS = freezeEntries([
  { id: "southbound-freight", orientation: "horizontal", x: 126, y: 1328, w: 1694, h: 244, lines: 4, spacing: 48 },
  { id: "yard-spur", orientation: "vertical", x: 1134, y: 1242, w: 250, h: 554, lines: 2, spacing: 48 }
]);

const WASTELAND_OBSTACLES = freezeEntries([
  { x: 174, y: 250, w: 202, h: 130, kind: "shop", sign: "药房" },
  { x: 438, y: 184, w: 190, h: 145, kind: "shop", sign: "机件" },
  { x: 660, y: 346, w: 205, h: 126, kind: "shop", sign: "旅社" },
  { x: 1264, y: 302, w: 268, h: 102, kind: "station", sign: "FUEL 06" },
  { x: 1546, y: 498, w: 168, h: 116, kind: "warehouse", sign: "DEPOT" },
  { x: 568, y: 902, w: 194, h: 58, kind: "bus" },
  { x: 324, y: 1018, w: 128, h: 54, kind: "car" },
  { x: 1320, y: 878, w: 126, h: 54, kind: "wreck" },
  { x: 1470, y: 956, w: 74, h: 176, kind: "fence" },
  { x: 268, y: 1504, w: 250, h: 132, kind: "warehouse", sign: "CARGO" },
  { x: 628, y: 1376, w: 92, h: 190, kind: "railcar" },
  { x: 1032, y: 1454, w: 232, h: 76, kind: "railcar" },
  { x: 1308, y: 1620, w: 126, h: 72, kind: "container" },
  { x: 1454, y: 1548, w: 126, h: 72, kind: "container" },
  { x: 1622, y: 1362, w: 118, h: 98, kind: "scrap" },
  { x: 1744, y: 1514, w: 94, h: 142, kind: "scrap" },
  { x: 382, y: 770, w: 92, h: 150, kind: "sign", sign: "SOUTH 03" }
]);

const WASTELAND_SCENERY = freezeEntries([
  { x: 128, y: 446, type: "streetlight" },
  { x: 394, y: 486, type: "bench" },
  { x: 514, y: 384, type: "dumpster" },
  { x: 736, y: 538, type: "streetlight" },
  { x: 844, y: 206, type: "mailbox", detail: true },
  { x: 1086, y: 338, type: "pump" },
  { x: 1148, y: 338, type: "pump" },
  { x: 1204, y: 642, type: "barrels" },
  { x: 1370, y: 706, type: "warningSign" },
  { x: 1742, y: 740, type: "deadTree" },
  { x: 196, y: 734, type: "rubble", detail: true },
  { x: 492, y: 822, type: "barricade" },
  { x: 802, y: 1044, type: "cone", detail: true },
  { x: 1132, y: 916, type: "hydrant", detail: true },
  { x: 1232, y: 1042, type: "barricade" },
  { x: 1556, y: 1060, type: "tires" },
  { x: 1852, y: 918, type: "warningSign" },
  { x: 208, y: 1306, type: "railSignal" },
  { x: 474, y: 1330, type: "pallet" },
  { x: 808, y: 1306, type: "railSignal" },
  { x: 932, y: 1608, type: "cable", detail: true },
  { x: 1186, y: 1718, type: "barrels" },
  { x: 1392, y: 1292, type: "crate" },
  { x: 1504, y: 1724, type: "tires" },
  { x: 1702, y: 1228, type: "deadTree" },
  { x: 1832, y: 1718, type: "scrub", detail: true },
  { x: 106, y: 1762, type: "scrub", detail: true },
  { x: 570, y: 1782, type: "bones", detail: true },
  { x: 1360, y: 1450, type: "crane", detail: true },
  { x: 1896, y: 1326, type: "antenna" }
]);

function shifted(entries, offsetX, offsetY, predicate = null) {
  const result = [];
  for (const entry of entries) {
    if (!predicate || predicate(entry)) result.push({ ...entry, x: entry.x + offsetX, y: entry.y + offsetY });
  }
  return result;
}

function mapLayout(definition) {
  return Object.freeze({
    ...definition,
    zones: freezeEntries(definition.zones),
    roads: freezeEntries(definition.roads),
    roadDetails: freezeEntries(definition.roadDetails || []),
    interactives: freezeEntries(definition.interactives || []),
    tracks: freezeEntries(definition.tracks),
    obstacles: freezeEntries(definition.obstacles),
    scenery: freezeEntries(definition.scenery),
    theme: Object.freeze({ ...definition.theme })
  });
}

const MAP_LAYOUTS = Object.freeze({
  echo_district: mapLayout({
    id: "echo_district",
    worldSize: 3072,
    zones: [
      ...WASTELAND_ZONES,
      { id: "east-market", label: "东侧霓虹街", x: 2100, y: 180, w: 760, h: 720, surface: "pavement" },
      { id: "signal-campus", label: "旧广播园区", x: 2130, y: 1220, w: 700, h: 720, surface: "concrete" },
      { id: "south-housing", label: "南侧居民区", x: 240, y: 2140, w: 1760, h: 650, surface: "asphalt" }
    ],
    roads: [
      { id: "echo-east-west", orientation: "horizontal", x: 0, y: 800, w: 3072, h: 308, lanes: 2 },
      ...WASTELAND_ROADS.slice(1),
      { id: "echo-east-access", orientation: "vertical", x: 1980, y: 0, w: 190, h: 3072, lanes: 1 },
      { id: "echo-south-ring", orientation: "horizontal", x: 0, y: 2010, w: 3072, h: 180, lanes: 1 }
    ],
    roadDetails: [
      { id: "echo-crosswalk-old-quarter", type: "crosswalk", orientation: "vertical", x: 856, y: 814, w: 111, h: 78, stripes: 7 },
      { id: "echo-crosswalk-east-access", type: "crosswalk", orientation: "horizontal", x: 1988, y: 960, w: 170, h: 88, stripes: 6 },
      { id: "echo-crack-01", type: "crack", x: 246, y: 914, w: 44, h: 18, seed: 11 },
      { id: "echo-crack-02", type: "crack", x: 738, y: 1002, w: 52, h: 16, seed: 23 },
      { id: "echo-crack-03", type: "crack", x: 1214, y: 882, w: 36, h: 20, seed: 37 },
      { id: "echo-crack-04", type: "crack", x: 1710, y: 1036, w: 58, h: 18, seed: 41 },
      { id: "echo-crack-05", type: "crack", x: 2298, y: 856, w: 48, h: 17, seed: 53 },
      { id: "echo-crack-06", type: "crack", x: 2720, y: 1008, w: 42, h: 16, seed: 67 }
    ],
    interactives: [
      { id: "echo-barrel-market", type: "explosiveBarrel", x: 1218, y: 972, radius: 14, effectRadius: 126, damage: 72 },
      { id: "echo-supply-radio", type: "supplyCache", x: 2328, y: 1248, radius: 20, scrap: 8, healing: 28 },
      { id: "echo-grid-campus", type: "electricField", x: 2580, y: 1650, radius: 96, slow: 0.58 }
    ],
    tracks: [
      ...WASTELAND_TRACKS,
      { id: "echo-east-spur", orientation: "vertical", x: 2440, y: 1120, w: 210, h: 1720, lines: 3, spacing: 48 }
    ],
    obstacles: [
      ...WASTELAND_OBSTACLES,
      ...shifted(WASTELAND_OBSTACLES, 940, 1030),
      { x: 2240, y: 310, w: 240, h: 142, kind: "shop", sign: "电台" },
      { x: 2550, y: 570, w: 214, h: 130, kind: "shop", sign: "食堂" },
      { x: 2210, y: 1320, w: 310, h: 150, kind: "warehouse", sign: "RADIO" }
    ],
    scenery: [
      ...WASTELAND_SCENERY,
      ...shifted(WASTELAND_SCENERY, 980, 990),
      { x: 2290, y: 1160, type: "antenna", detail: true },
      { x: 2670, y: 1020, type: "barricade" },
      { x: 2080, y: 2380, type: "streetlight" }
    ],
    theme: { ground: "#514536", asphalt: "#343a3b", concrete: "#696052", ballast: "#5b4d3e", accent: "#ffd166", haze: "#e2a764" }
  }),
  freight_nexus: mapLayout({
    id: "freight_nexus",
    worldSize: 3584,
    zones: [
      { id: "north-depot", label: "北部机务段", x: 260, y: 180, w: 2900, h: 720, surface: "concrete" },
      { id: "rail-maze", label: "锈轨编组场", x: 120, y: 1080, w: 3300, h: 1200, surface: "ballast" },
      { id: "workers-row", label: "铁路宿舍", x: 320, y: 2520, w: 1240, h: 690, surface: "pavement" },
      { id: "container-sea", label: "集装箱海", x: 1840, y: 2460, w: 1380, h: 760, surface: "scrap" }
    ],
    roads: [
      { id: "freight-north-road", orientation: "horizontal", x: 0, y: 860, w: 3584, h: 210, lanes: 1 },
      { id: "freight-south-road", orientation: "horizontal", x: 0, y: 2290, w: 3584, h: 190, lanes: 1 },
      { id: "freight-service-road", orientation: "vertical", x: 1580, y: 0, w: 220, h: 3584, lanes: 1 }
    ],
    roadDetails: [
      { id: "freight-crosswalk-depot", type: "crosswalk", orientation: "horizontal", x: 1595, y: 874, w: 190, h: 92, stripes: 7 },
      { id: "freight-crosswalk-workers", type: "crosswalk", orientation: "vertical", x: 1160, y: 2304, w: 116, h: 156, stripes: 7 },
      { id: "freight-crack-01", type: "crack", x: 330, y: 930, w: 62, h: 20, seed: 71 },
      { id: "freight-crack-02", type: "crack", x: 930, y: 994, w: 48, h: 16, seed: 79 },
      { id: "freight-crack-03", type: "crack", x: 2040, y: 900, w: 56, h: 18, seed: 83 },
      { id: "freight-crack-04", type: "crack", x: 2910, y: 2340, w: 70, h: 18, seed: 97 },
      { id: "freight-crack-05", type: "crack", x: 1630, y: 2760, w: 22, h: 64, seed: 101 }
    ],
    interactives: [
      { id: "freight-barrel-loop", type: "explosiveBarrel", x: 2080, y: 1810, radius: 14, effectRadius: 138, damage: 78 },
      { id: "freight-supply-workers", type: "supplyCache", x: 1120, y: 2680, radius: 20, scrap: 10, healing: 24 },
      { id: "freight-grid-depot", type: "electricField", x: 2820, y: 720, radius: 108, slow: 0.52 }
    ],
    tracks: [
      { id: "freight-main", orientation: "horizontal", x: 130, y: 1140, w: 3240, h: 960, lines: 14, spacing: 62 },
      { id: "freight-loop", orientation: "vertical", x: 2140, y: 340, w: 420, h: 2940, lines: 5, spacing: 58 }
    ],
    obstacles: [
      ...shifted(WASTELAND_OBSTACLES, 610, 650),
      ...shifted(WASTELAND_OBSTACLES, 1510, 140, (item) => ["railcar", "container", "warehouse", "scrap"].includes(item.kind)),
      { x: 370, y: 390, w: 380, h: 160, kind: "station", sign: "NORTH DEPOT" },
      { x: 2680, y: 2740, w: 170, h: 86, kind: "container" },
      { x: 2920, y: 2870, w: 170, h: 86, kind: "container" }
    ],
    scenery: [
      ...shifted(WASTELAND_SCENERY, 600, 620),
      ...shifted(WASTELAND_SCENERY, 1520, 120, (item) => item.type !== "deadTree"),
      { x: 1780, y: 1120, type: "railSignal" },
      { x: 2760, y: 2380, type: "crane", detail: true }
    ],
    theme: { ground: "#4b463d", asphalt: "#30383b", concrete: "#62635f", ballast: "#4b5050", accent: "#62d8ea", haze: "#9bc1bf" }
  }),
  red_basin: mapLayout({
    id: "red_basin",
    worldSize: 4096,
    zones: [
      { id: "red-dunes", label: "赤砂盆地", x: 100, y: 100, w: 3896, h: 3896, surface: "scrap" },
      { id: "research-ring", label: "沉降研究站", x: 1420, y: 1320, w: 1260, h: 1160, surface: "concrete" },
      { id: "evac-highway", label: "旧国道", x: 0, y: 1840, w: 4096, h: 360, surface: "asphalt" },
      { id: "dry-port", label: "风暴旱港", x: 420, y: 2860, w: 1180, h: 760, surface: "ballast" }
    ],
    roads: [
      { id: "basin-highway", orientation: "horizontal", x: 0, y: 1840, w: 4096, h: 360, lanes: 3 },
      { id: "basin-research-road", orientation: "vertical", x: 1900, y: 0, w: 280, h: 4096, lanes: 2 }
    ],
    roadDetails: [
      { id: "basin-crosswalk-research", type: "crosswalk", orientation: "horizontal", x: 1914, y: 1860, w: 248, h: 104, stripes: 8 },
      { id: "basin-crack-01", type: "crack", x: 420, y: 1940, w: 74, h: 21, seed: 107 },
      { id: "basin-crack-02", type: "crack", x: 1040, y: 2080, w: 58, h: 18, seed: 109 },
      { id: "basin-crack-03", type: "crack", x: 2360, y: 1906, w: 66, h: 20, seed: 127 },
      { id: "basin-crack-04", type: "crack", x: 3180, y: 2110, w: 82, h: 22, seed: 131 },
      { id: "basin-crack-05", type: "crack", x: 2030, y: 820, w: 24, h: 72, seed: 149 },
      { id: "basin-crack-06", type: "crack", x: 1980, y: 3320, w: 28, h: 68, seed: 157 }
    ],
    interactives: [
      { id: "basin-barrel-lab", type: "explosiveBarrel", x: 1840, y: 1530, radius: 14, effectRadius: 150, damage: 84 },
      { id: "basin-supply-quarantine", type: "supplyCache", x: 2520, y: 2380, radius: 20, scrap: 12, healing: 34 },
      { id: "basin-grid-ring", type: "electricField", x: 2210, y: 1700, radius: 118, slow: 0.48 }
    ],
    tracks: [
      { id: "basin-dry-rail", orientation: "horizontal", x: 260, y: 3010, w: 3400, h: 260, lines: 4, spacing: 52 }
    ],
    obstacles: [
      ...shifted(WASTELAND_OBSTACLES, 1000, 880, (item) => item.kind !== "shop"),
      ...shifted(WASTELAND_OBSTACLES, 2040, 1490, (item) => ["warehouse", "container", "scrap", "wreck"].includes(item.kind)),
      { x: 1480, y: 1400, w: 340, h: 170, kind: "warehouse", sign: "LAB 04" },
      { x: 2270, y: 2210, w: 280, h: 150, kind: "station", sign: "QUARANTINE" },
      { x: 720, y: 640, w: 190, h: 90, kind: "wreck" }
    ],
    scenery: [
      ...shifted(WASTELAND_SCENERY, 980, 860),
      ...shifted(WASTELAND_SCENERY, 2040, 1480, (item) => ["deadTree", "scrub", "bones", "warningSign", "antenna"].includes(item.type)),
      { x: 1220, y: 1770, type: "warningSign" },
      { x: 2810, y: 2280, type: "antenna", detail: true },
      { x: 3400, y: 900, type: "deadTree" }
    ],
    theme: { ground: "#76503b", asphalt: "#353536", concrete: "#745f55", ballast: "#6b5040", accent: "#ff765f", haze: "#e07a52" }
  })
});

module.exports = {
  WASTELAND_WORLD_SIZE,
  WASTELAND_ZONES,
  WASTELAND_ROADS,
  WASTELAND_TRACKS,
  WASTELAND_OBSTACLES,
  WASTELAND_SCENERY,
  MAP_LAYOUTS
};
