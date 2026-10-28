"use strict";

const { surface, paperClip, RADIO, focusInk } = require("./radio-materials");
const { drawUpgradeIllustration, drawCoin } = require("./upgrade-illustrations");
const { keyLabel } = require("../../input/key-bindings");

function drawFieldShop(r, model) {
  r.drawOverlay();
  const ctx = r.ctx, compact = r.width < 1100 || r.height < 630;
  const width = Math.min(1140, r.width - 32), height = Math.min(660, r.height - 24);
  const x = (r.width - width) / 2, y = (r.height - height) / 2;
  surface(ctx, x, y, width, height, { fill: "#272b22", raised: true });
  const pad = compact ? 18 : 28, header = compact ? 83 : 107, footer = compact ? 74 : 90;
  r.displayText("余火交易站", x + pad, y + 30, compact ? 24 : 32, RADIO.paperLight, "left");
  r.text("拾荒币换补给与改件 · 本局生效", x + pad, y + (compact ? 57 : 66), compact ? 12 : 15, "#c6b990", "left", "700");
  const walletX = x + width - pad - 40;
  drawCoin(ctx, walletX - (compact ? 114 : 138), y + 35, 10);
  r.text(`${model.run.scrap} 拾荒币`, walletX, y + 35, compact ? 18 : 23, "#f0d298", "right", "900");
  const columns = compact ? 2 : 3, rows = Math.ceil(model.content.ids("fieldGoods").length / columns), gap = compact ? 10 : 16;
  const cardW = (width - pad * 2 - gap * (columns - 1)) / columns;
  const cardH = (height - header - footer - gap * (rows - 1)) / rows;
  model.content.ids("fieldGoods").forEach((id, i) => {
    const item = model.content.get("fieldGoods", id), state = model.fieldMarket.state(id);
    const cx = x + pad + i % columns * (cardW + gap), cy = y + header + Math.floor(i / columns) * (cardH + gap);
    surface(ctx, cx, cy, cardW, cardH, { material: "paper", raised: true, fill: state.affordable ? "#e1cca4" : "#c8b58f" });
    const icon = Math.min(compact ? 54 : 74, cardH * .58);
    drawUpgradeIllustration(ctx, item.icon, cx + icon / 2 + 10, cy + cardH * .42, icon, item.family);
    const tx = cx + icon + 17;
    r.fitText(item.name, tx, cy + 24, compact ? 17 : 21, cardW - icon - 28, RADIO.ink, "left", "900", 12);
    item.detail.split(" · ").forEach((line, index) => r.fitText(line, tx, cy + 47 + index * 14, compact ? 12 : 14, cardW - icon - 28, "#4e442f", "left", "700", 10));
    const buttonW = Math.min(146, cardW * .49), buttonH = compact ? 31 : 37;
    const bx = cx + cardW - buttonW - 12, by = cy + cardH - buttonH - 10;
    const label = state.affordable ? `${state.price} 币 · 购买`
      : state.status === "insufficient" ? `还差 ${state.difference} 币`
        : state.status === "fullHealth" ? "生命已满" : state.status === "capped" ? "属性已满" : "本局已售罄";
    if (state.affordable) r.button(`fieldBuy:${id}`, label, bx, by, buttonW, buttonH, "secondary");
    else {
      surface(ctx, bx, by, buttonW, buttonH, { fill: "#b5a482" });
      r.fitText(label, bx + buttonW / 2, by + buttonH / 2, 12, buttonW - 12, "#564a35", "center", "800", 10);
    }
    r.text(`${state.count}/${state.max} 已装配`, cx + 12, by + buttonH / 2, compact ? 10 : 12, "#554832", "left", "800");
  });
  const messageY = y + height - (compact ? 54 : 68);
  r.fitText(model.run.fieldMarket.message, x + pad, messageY, compact ? 12 : 14, width - pad * 2 - 210, "#e5d7b1", "left", "700", 10);
  r.fitText("战斗与生存计时已暂停", x + pad, y + height - 25, compact ? 11 : 13, width * .55, "#bcb497", "left", "700", 10);
  r.button("fieldClose", "收好改件 · 返回战斗", x + width - pad - 205, y + height - 56, 205, 40, "primary");
}

function drawMarketHint(r, model) {
  const station = model.interactives.find(item => item.active && item.type === "tradePost");
  if (!station || model.screen !== "running") return;
  const p = model.run.player, nearby = model.fieldMarket.nearest();
  const width = Math.min(286, r.width - 28), x = r.width - width - 14, y = r.height - 94;
  surface(r.ctx, x, y, width, 48, { material: "paper", raised: true });
  drawCoin(r.ctx, x + 19, y + 23, 8);
  const binding = model.save.keyBindings.interact || "Enter";
  const key = r.activeInputDevice === "gamepad" ? "A" : binding.startsWith("Unbound") ? "Enter" : keyLabel(binding);
  const angle = Math.atan2(station.y - p.y, station.x - p.x);
  const direction = ["东侧", "东南", "南侧", "西南", "西侧", "西北", "北侧", "东北"][(Math.round(angle / (Math.PI / 4)) + 8) % 8];
  const label = nearby ? `${key} · 进入余火交易站` : `余火交易站 · ${direction}`;
  r.fitText(label, x + 37, y + 17, 14, width - 62, RADIO.ink, "left", "900", 11);
  r.text(nearby ? "拾荒币购买改件／强化枪械" : "沿广播广场寻找锤子与金币招牌", x + 37, y + 35, 10, "#625238", "left", "700");
  if (nearby) { r.addRegion("fieldOpen", x, y, width, 48); if (r.focusAction === "fieldOpen") focusInk(r.ctx, x, y, width, 48, "#6f492e"); }
  else {
    r.ctx.save(); r.ctx.translate(x + width - 14, y + 16); r.ctx.rotate(angle); r.ctx.fillStyle = "#6f5732";
    r.ctx.beginPath(); r.ctx.moveTo(6, 0); r.ctx.lineTo(-4, -4); r.ctx.lineTo(-4, 4); r.ctx.closePath(); r.ctx.fill(); r.ctx.restore();
  }
}

module.exports = { drawFieldShop, drawMarketHint };
