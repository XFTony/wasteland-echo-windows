"use strict";

const { GUN_PRICES, getSurvivalPressure } = require("../content/survival");
const { createMechanicState } = require("./mechanic-system");

function weaponModifiers(run, id = run.player.weaponId) {
  const entry = run.arsenal && run.arsenal[id];
  return { damage: entry ? 1.32 ** (entry.tier - 1) * 1.12 ** entry.calibration : 1,
    rate: entry ? 1.03 ** entry.calibration : 1 };
}

class Arsenal {
  constructor(host, content) { this.host = host; this.content = content; }
  state(id) {
    const run = this.host.run, weapon = this.content.get("weapons", id);
    if (!run || !weapon) return { status: "missing" };
    const entry = run.arsenal[id], inflation = run.endless ? getSurvivalPressure(run.elapsed).price : 1;
    const price = Math.round((GUN_PRICES[id] || 20) * inflation);
    const upgradePrice = entry ? Math.round((GUN_PRICES[id] || 20) * (entry.tier + .5) * inflation) : 0;
    return { status: !entry ? run.scrap >= price ? "available" : "insufficient" : run.player.weaponId === id ? "equipped" : "owned",
      price, upgradePrice, tier: entry ? entry.tier : 0, calibration: entry ? entry.calibration : 0,
      canUpgrade: Boolean(entry && entry.tier < 4 && run.scrap >= upgradePrice) };
  }
  accessible() { const h = this.host; return h.run && h.screen === "fieldShop" && h.fieldMarket.nearest()?.id === h.run.fieldMarket.stationId; }
  applyMastery(id) {
    const h = this.host, p = h.run.player;
    const previous = h.run.activeMasteryPerks || { damageMultiplier: 1, copperMultiplier: 1, scrapMultiplier: 1, criticalChance: 0 };
    const next = { damageMultiplier: 1, copperMultiplier: 1, scrapMultiplier: 1, criticalChance: 0 };
    h.masterySystem.applyPerks(next, h.save, id);
    for (const key of ["damageMultiplier", "copperMultiplier", "scrapMultiplier"]) p[key] = p[key] / previous[key] * next[key];
    p.criticalChance = Math.max(0, Math.min(.75, p.criticalChance - previous.criticalChance + next.criticalChance));
    h.run.activeMasteryPerks = next;
  }
  buy(id) {
    const h = this.host, state = this.state(id);
    if (!this.accessible()) return false;
    if (state.status !== "available") { h.run.fieldMarket.message = state.status === "insufficient" ? `还差 ${state.price - h.run.scrap} 拾荒币` : "这把枪已在本局军械库中"; return false; }
    h.run.scrap -= state.price; h.run.fieldMarket.spent += state.price;
    h.run.arsenal[id] = { tier: 1, calibration: 0 };
    this.equip(id); h.run.fieldMarket.message = `已购买并装备 ${this.content.weapons[id].name} · 本局保留`;
    h.emit("fieldPurchase", { id, name: this.content.weapons[id].name, price: state.price }); return true;
  }
  equip(id) {
    const h = this.host;
    if (!this.accessible() || !h.run.arsenal[id] || !this.content.has("weapons", id)) return false;
    this.applyMastery(id);
    h.run.player.weaponId = id; h.run.player.aimTargetId = null;
    h.run.player.weaponCooldown = Math.max(h.run.player.weaponCooldown, .12);
    h.run.mechanics = createMechanicState();
    h.run.fieldMarket.message = `已装备 ${this.content.weapons[id].name} · 升阶与校准按枪保留`;
    h.emit("weaponChanged", { weaponId: id }); return true;
  }
  improve(id) {
    const h = this.host, state = this.state(id);
    if (!this.accessible()) return false;
    if (!state.canUpgrade) { h.run.fieldMarket.message = state.tier >= 4 ? "此枪已达到4阶" : `升阶还差 ${Math.max(0, state.upgradePrice - h.run.scrap)} 拾荒币`; return false; }
    h.run.scrap -= state.upgradePrice; h.run.fieldMarket.spent += state.upgradePrice;
    h.run.arsenal[id].tier++;
    h.run.fieldMarket.message = `${this.content.weapons[id].name} 已升至 ${h.run.arsenal[id].tier} 阶`;
    h.emit("fieldPurchase", { id, name: "枪械升阶", price: state.upgradePrice }); return true;
  }
}

module.exports = { weaponModifiers, Arsenal };
