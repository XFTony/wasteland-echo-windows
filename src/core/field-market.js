"use strict";

const { firstObstacleTime } = require("./projectile-geometry");

class FieldMarket {
  constructor(host, content) { this.host = host; this.content = content; }

  nearest() {
    const h = this.host, p = h.run && h.run.player;
    if (!p) return null;
    let nearest = null, distance = Infinity;
    for (const item of h.interactives) {
      if (!item.active || item.type !== "tradePost") continue;
      const next = Math.hypot(p.x - item.x, p.y - item.y);
      if (next <= item.radius && next < distance && !Number.isFinite(firstObstacleTime(h.obstacles, p.x, p.y, item.x - p.x, item.y - p.y))) {
        nearest = item; distance = next;
      }
    }
    return nearest;
  }

  open() {
    const h = this.host, station = this.nearest();
    if (h.screen !== "running" || !station) return false;
    h.run.fieldMarket.stationId = station.id;
    h.run.fieldMarket.message = "改件仅本局生效 · 交易期间战斗与计时暂停";
    h.screen = "fieldShop"; h.emit("fieldMarketOpen", { stationId: station.id });
    return true;
  }

  close() {
    const h = this.host;
    if (!h.run || h.screen !== "fieldShop") return false;
    h.run.fieldMarket.stationId = null;
    h.screen = "running"; h.emit("resume"); return true;
  }

  state(id) {
    const h = this.host, run = h.run, item = this.content.get("fieldGoods", id);
    if (!run || !item) return { status: "missing", affordable: false };
    const count = run.fieldMarket.purchases[id] || 0, price = item.prices[count];
    const balance = Math.max(0, Math.floor(Number(run.scrap) || 0));
    const status = count >= item.prices.length ? "soldOut"
      : item.effect === "heal" && run.player.hp >= run.player.maxHp ? "fullHealth"
        : item.effect === "armor" && run.player.armor >= .55 ? "capped"
          : balance < price ? "insufficient" : "available";
    return { status, count, price: price || 0, balance, max: item.prices.length,
      affordable: status === "available", difference: Math.max(0, (price || 0) - balance) };
  }

  purchase(id) {
    const h = this.host, run = h.run, station = this.nearest();
    if (h.screen !== "fieldShop" || !run || !station || station.id !== run.fieldMarket.stationId) return { ok: false, status: "closed" };
    const item = this.content.get("fieldGoods", id), state = this.state(id);
    if (!item || state.status !== "available") {
      run.fieldMarket.message = { soldOut: "该改件已达到本局上限", fullHealth: "生命已满，无需购买急救包", capped: "护甲已达到上限", insufficient: `还差 ${state.difference} 拾荒币` }[state.status] || "货品不可用";
      return { ok: false, ...state };
    }
    const p = run.player;
    if (item.effect === "weapon") { p.damageMultiplier *= 1.12; p.fireRateMultiplier *= 1.03; }
    else if (item.effect === "heal") p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .3);
    else if (item.effect === "speed") p.speed *= 1.06;
    else if (item.effect === "armor") p.armor = Math.min(.55, p.armor + .04);
    else if (item.effect === "magnet") p.pickupRadius *= 1.15;
    else return { ok: false, status: "missingEffect" };
    run.scrap -= state.price;
    run.fieldMarket.spent += state.price;
    run.fieldMarket.purchases[id] = state.count + 1;
    run.fieldMarket.message = `已装配 ${item.name} · 本局生效`;
    h.emit("fieldPurchase", { id, name: item.name, price: state.price, icon: item.icon });
    return { ok: true, status: "purchased", balance: run.scrap, price: state.price };
  }
}

module.exports = { FieldMarket };
