"use strict";

const UPGRADE_FAMILY_STYLES = Object.freeze({
  firepower: Object.freeze({ label: "火力", color: "#d09a43", fill: "#89462f", dark: "#3d271f" }),
  mobility: Object.freeze({ label: "机动", color: "#779b91", fill: "#496c65", dark: "#263b37" }),
  survival: Object.freeze({ label: "生存", color: "#b65a48", fill: "#743a35", dark: "#382523" }),
  utility: Object.freeze({ label: "搜集", color: "#929769", fill: "#5f6546", dark: "#303326" })
});

const UPGRADE_RARITIES = Object.freeze({
  standard: Object.freeze({ label: "标准改件", color: "#cdbb8c", gem: "#b9853e" }),
  advanced: Object.freeze({ label: "精制组件", color: "#8ba4a0", gem: "#607f7c" }),
  prototype: Object.freeze({ label: "原型科技", color: "#d0b461", gem: "#9d7734" }),
  evolution: Object.freeze({ label: "终局进化", color: "#df7048", gem: "#c04d35" })
});

const UI_COLORS = Object.freeze({
  void: "#100f0c",
  backdrop: "#15130f",
  coal: "#1b1914",
  panel: "#2b2821",
  panelRaised: "#3b362b",
  panelDeep: "#1b1915",
  ink: "#211b14",
  paper: "#ead9ad",
  paperMuted: "#c8b789",
  white: "#f6e9c7",
  muted: "#c1b28d",
  mutedDark: "#94886e",
  amber: "#d2a64f",
  orange: "#b55238",
  cyan: "#76a39a",
  green: "#879468",
  danger: "#c05445",
  copper: "#b87343",
  gold: "#d7b75b",
  iron: "#5f5d54",
  ironLight: "#969080",
  ironDark: "#2b2b27",
  wood: "#58402d",
  woodLight: "#76573b",
  woodDark: "#281e17",
  leather: "#70462f",
  canvas: "#817151",
  canvasDeep: "#514936",
  shadow: "#0b0a08"
});

const MATERIALS = Object.freeze({
  iron: Object.freeze({ fill: UI_COLORS.panel, raised: UI_COLORS.panelRaised, edge: UI_COLORS.iron, highlight: UI_COLORS.ironLight, shadow: UI_COLORS.ironDark }),
  wood: Object.freeze({ fill: UI_COLORS.wood, raised: UI_COLORS.woodLight, edge: "#8b6844", highlight: "#aa8355", shadow: UI_COLORS.woodDark }),
  canvas: Object.freeze({ fill: UI_COLORS.canvasDeep, raised: UI_COLORS.canvas, edge: "#9a8963", highlight: "#b6a476", shadow: "#332e23" }),
  leather: Object.freeze({ fill: UI_COLORS.leather, raised: "#89583a", edge: "#a9784c", highlight: "#bd8c58", shadow: "#38251b" })
});

module.exports = { UPGRADE_FAMILY_STYLES, UPGRADE_RARITIES, UI_COLORS, MATERIALS };
