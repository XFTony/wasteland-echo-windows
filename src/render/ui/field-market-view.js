"use strict";

const { surface, RADIO, focusInk } = require("./radio-materials");
const { drawUpgradeIllustration, drawCoin } = require("./upgrade-illustrations");
const { drawGrantIcon } = require("./item-icons");
const { keyLabel } = require("../../input/key-bindings");
const { weaponSummary } = require("../../content/weapon-expansion");

function drawFieldShop(r, model) {
  r.drawOverlay();
  const ctx = r.ctx, compact = r.width < 1100 || r.height < 630;
  const width = Math.min(1140, r.width - 32), height = Math.min(660, r.height - 24);
  const x = (r.width - width) / 2, y = (r.height - height) / 2, pad = compact ? 16 : 26;
  const market = model.run.fieldMarket, tab = market.tab || "supplies";
  surface(ctx, x, y, width, height, { fill: "#272b22", raised: true });
  r.displayText("余火交易站", x + pad, y + 29, compact ? 24 : 32, RADIO.paperLight);
  r.text("购枪、改装与支援 · 所购物品仅本局保留", x + pad, y + 57, compact ? 12 : 15, "#c6b990", "left", "700");
  drawCoin(ctx, x + width - pad - 152, y + 30, 10);
  r.text(model.run.scrap + " 拾荒币", x + width - pad, y + 30, compact ? 18 : 23, "#f0d298", "right", "900");
  const tabs = [["supplies", "改件补给"], ["arsenal", "武器库"], ["support", "塔台支援"]];
  const tabW = Math.min(180, (width - pad * 2 - 20) / 3);
  tabs.forEach(([id, label], index) => r.button("fieldTab:" + id, label, x + pad + index * (tabW + 10), y + 77, tabW, 34, tab === id ? "primary" : "secondary"));
  const all = tab === "arsenal" ? model.content.ids("weapons") : model.content.ids("fieldGoods").filter(id => (model.content.fieldGoods[id].tab || "supplies") === tab);
  const pageCount = Math.max(1, Math.ceil(all.length / 6)), page = Math.min(pageCount - 1, market.page || 0), ids = all.slice(page * 6, page * 6 + 6);
  const columns = r.width < 780 ? 2 : 3, rows = Math.max(2, Math.ceil(ids.length / columns)), gap = compact ? 10 : 14;
  const header = 125, footer = 98, cardW = (width - pad * 2 - gap * (columns - 1)) / columns;
  const cardH = (height - header - footer - gap * (rows - 1)) / rows;
  ids.forEach((id, i) => {
    const gun = tab === "arsenal", item = model.content.get(gun ? "weapons" : "fieldGoods", id);
    const state = gun ? model.arsenal.state(id) : model.fieldMarket.state(id);
    const cx = x + pad + i % columns * (cardW + gap), cy = y + header + Math.floor(i / columns) * (cardH + gap);
    surface(ctx, cx, cy, cardW, cardH, { material: "paper", raised: true, fill: "#ddc9a0" });
    const icon = Math.min(compact ? 48 : 62, cardH * .5), ix = cx + icon / 2 + 10, iy = cy + Math.min(42, cardH * .35);
    if (gun) drawGrantIcon(r, "weapon", id, ix, iy, icon, "#866240");
    else drawUpgradeIllustration(ctx, tab === "support" ? id : item.icon, ix, iy, icon, item.family);
    const tx = cx + icon + 15, tw = cardW - icon - 26;
    r.fitText(item.name, tx, cy + 21, compact ? 16 : 19, tw, RADIO.ink, "left", "900", 11);
    const lines=gun?(state.tier?[state.tier+"阶 / 调校"+state.calibration,...weaponSummary(item).slice(0,2)]:weaponSummary(item)):item.detail.split(" · ");
    const chars=Math.max(10,Math.floor(tw/(compact?11:12)));
    lines.slice(0,3).forEach((line,j)=>r.text(line.length>chars?line.slice(0,chars-1)+"…":line,tx,cy+43+j*15,compact?11:12,"#54452f","left","700"));
    const by = cy + cardH - 40, bw = Math.min(145, (cardW - 30) * (gun && state.tier ? .49 : .65));
    if (gun) {
      if (!state.tier) r.button("arsenalBuy:" + id, state.status === "insufficient" ? "还差" + (state.price - model.run.scrap) + "币" : state.price + "币 · 购入", cx + cardW - bw - 10, by, bw, 30, state.status === "available" ? "primary" : "secondary");
      else {
        r.button("arsenalEquip:" + id, state.status === "equipped" ? "已装备" : "切换此武器", cx + 10, by, bw, 30, state.status === "equipped" ? "primary" : "secondary");
        if (state.tier < 4) r.button("arsenalImprove:" + id, state.upgradePrice + "币 · 升阶", cx + cardW - bw - 10, by, bw, 30, state.canUpgrade ? "primary" : "secondary");
        else r.text("已达4阶", cx + cardW - 15, by + 15, 11, "#5c472d", "right", "900");
      }
    } else {
      const labels = { fullHealth: "生命已满", capacity: "已达4座", capped: "属性已满", soldOut: "本局已满", cooldown: Math.ceil(state.remaining) + "秒补货", insufficient: "还差" + state.difference + "币" };
      const label = state.affordable ? state.price + "币 · 购买" : labels[state.status] || "不可用";
      r.button("fieldBuy:" + id, label, cx + cardW - bw - 10, by, bw, 30, state.affordable ? "primary" : "secondary");
      r.fitText(Number.isFinite(state.max) ? state.count + "/" + state.max + " 已装配" : "可持续补给", cx + 10, by + 15, 11, cardW - bw - 25, "#5c472d", "left", "800", 10);
    }
  });
  if (tab === "support" && columns === 3) {
    const gx = x + pad + 2 * (cardW + gap), gy = y + header;
    surface(ctx, gx, gy, cardW, cardH, { material: "paper", fill: "#c6b48d" });
    r.text("部署手册", gx + 14, gy + 20, compact ? 16 : 20, RADIO.ink, "left", "900");
    ["T / Y 开始部署", "空地确认 · Esc / B取消", "E / A靠近回收，保留耐久", "受敌攻击会损毁", "工程与维护技能强化塔台"].forEach((line, i) => r.fitText(line, gx + 14, gy + 43 + i * (compact ? 16 : 22), compact ? 11 : 14, cardW - 28, "#54452f", "left", "700", 10));
  }
  if (pageCount > 1) r.button("fieldPage:" + ((page + 1) % pageCount), "更多武器 " + (page + 1) + "/" + pageCount + " ›", x + pad, y + height - 88, 166, 29, "secondary");
  r.fitText(market.message, x + pad, y + height - 43, compact ? 11 : 14, width - pad * 2 - 220, "#e5d7b1", "left", "700", 10);
  r.text("购物暂停计时 · 返回战斗后才会补货", x + pad, y + height - 22, compact ? 11 : 13, "#bcb497", "left", "700");
  r.button("fieldClose", "返回战斗", x + width - pad - 180, y + height - 65, 180, 40, "primary");
}

function drawMarketHint(r, model) {
  if (model.screen !== "running") return;
  const run = model.run, station = model.interactives.find(item => item.active && item.type === "tradePost");
  if (!station) return;
  const p = run.player, nearby = model.fieldMarket.nearest(), tower = !nearby && model.structures.nearestRecoverable();
  const width = Math.min(300, r.width - 28), x = r.width - width - 14, y = r.height - 118;
  surface(r.ctx, x, y, width, 66, { material: "paper", raised: true });
  drawCoin(r.ctx, x + 18, y + 20, 8);
  const key = r.activeInputDevice === "gamepad" ? "A" : keyLabel(model.save.keyBindings.interact || "Enter");
  const angle = Math.atan2(station.y - p.y, station.x - p.x);
  const direction = ["东侧", "东南", "南侧", "西南", "西侧", "西北", "北侧", "东北"][(Math.round(angle / (Math.PI / 4)) + 8) % 8];
  const label = run.placement ? (run.placement.valid ? "确认部署 · Esc/B取消" : run.placement.reason)
    : nearby ? key + " · 进入交易站" : tower ? key + " · 回收附近塔台" : "余火交易站 · " + direction;
  r.fitText(label, x + 35, y + 18, 14, width - 44, RADIO.ink, "left", "900", 11);
  r.fitText("塔台 " + run.structures.length + "/4 · 库存 " + run.turretKits + " · " + (r.activeInputDevice === "gamepad" ? "Y" : keyLabel(model.save.keyBindings.deployTurret || "KeyT")) + " 部署", x + 12, y + 43, 12, width - 24, "#625238", "left", "700", 10);
  if (nearby || tower) { r.addRegion("fieldOpen", x, y, width, 66); if (r.focusAction === "fieldOpen") focusInk(r.ctx, x, y, width, 66, "#6f492e"); }
}

module.exports = { drawFieldShop, drawMarketHint };
