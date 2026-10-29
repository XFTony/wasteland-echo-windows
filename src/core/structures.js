"use strict";

const { TURRET } = require("../content/survival");
const { firstObstacleTime } = require("./projectile-geometry");
const { createNavigation } = require("../world/navigation-grid");

function turretMuzzle(t) { return { x: t.x + Math.cos(t.angle) * 38, y: t.y - 20 + Math.sin(t.angle) * 38 }; }
function overlaps(x, y, radius, rect) {
  const nx = Math.max(rect.x, Math.min(rect.x + rect.w, x)), ny = Math.max(rect.y, Math.min(rect.y + rect.h, y));
  return (x - nx) ** 2 + (y - ny) ** 2 < radius ** 2;
}

class StructureSystem {
  constructor(host) { this.host = host; this.enemyGoal = { x: 0, y: 0 }; }
  ownedCount() { const r = this.host.run; return r ? r.structures.length + r.turretKits : 0; }
  preview() {
    const r = this.host.run;
    if (!r?.placement) return null;
    const p = r.player, input = r.input;
    let dx = p.lastAimX * 90, dy = p.lastAimY * 90;
    if (input.aimActive) { const length = Math.hypot(input.aimX, input.aimY) || 1, scale = length > 1.01 ? Math.min(140, length) / length : 90 / length; dx = input.aimX * scale; dy = input.aimY * scale; }
    Object.assign(r.placement, { x: p.x + dx, y: p.y + dy });
    const state = this.validate(r.placement.x, r.placement.y);
    r.placement.valid = state.ok; r.placement.reason = state.reason; return r.placement;
  }
  begin() {
    const h = this.host, r = h.run;
    if (!r || h.screen !== "running") return false;
    if (r.placement) return this.confirm();
    if (r.turretKits < 1 || r.structures.length >= TURRET.maxCount) return false;
    r.placement = { x: r.player.x, y: r.player.y, valid: false, reason: "" }; this.preview(); return true;
  }
  cancel() { if (this.host.run) this.host.run.placement = null; }
  validate(x, y, navigation = false) {
    const h = this.host, r = h.run;
    if (!r || r.turretKits < 1 || r.structures.length >= TURRET.maxCount) return { ok: false, reason: "没有可部署套件" };
    if (x < 54 || y < 54 || x > h.worldSize - 54 || y > h.worldSize - 54) return { ok: false, reason: "请远离地图边界" };
    const distance = Math.hypot(x - r.player.x, y - r.player.y);
    if (distance < 44 || distance > 142) return { ok: false, reason: "在身旁空地部署" };
    if (h.obstacles.some(rect => overlaps(x, y, 54, rect))) return { ok: false, reason: "离障碍物太近" };
    if (r.structures.some(t => Math.hypot(t.x - x, t.y - y) < 96)) return { ok: false, reason: "塔台之间留出通路" };
    if (h.enemies.some(e => e.active && Math.hypot(e.x - x, e.y - y) < e.radius + 30)) return { ok: false, reason: "先清理部署位置的敌人" };
    if (Number.isFinite(firstObstacleTime(h.obstacles, r.player.x, r.player.y, x - r.player.x, y - r.player.y))) return { ok: false, reason: "无法隔墙部署" };
    if (navigation) {
      const obstacles = h.obstacles.concat({ x: x - TURRET.radius, y: y - TURRET.radius, w: TURRET.radius * 2, h: TURRET.radius * 2 });
      for (const [size, clearance] of Object.entries(h.navigationClearanceByClass)) {
        const next = createNavigation({ worldSize: h.worldSize, obstacles }, { cellSize: h.navigationCellSize, clearance });
        next.flow.rebuild(r.player.x, r.player.y);
        const ratio = nav => { let free = 0, reached = 0; for (let i = 0; i < nav.grid.cellCount; i++) if (nav.grid.walkable[i]) { free++; if (nav.flow.distances[i] >= 0) reached++; } return reached / Math.max(1, free); };
        if (ratio(next) + 1e-8 < ratio(h.navigations[size])) return { ok: false, reason: "此处会封住通行路线" };
      }
    }
    return { ok: true, reason: "确认部署 · Esc/B取消" };
  }
  confirm() {
    const h = this.host, r = h.run;
    if (!r?.placement || h.screen !== "running") return false;
    const pos = this.preview(), state = this.validate(pos.x, pos.y, true);
    if (!state.ok) { pos.reason = state.reason; pos.valid = false; return false; }
    const fraction = r.turretKitHealth.shift() ?? 1;
    const maxHp = TURRET.maxHp * (1 + r.engineering * .15);
    const t = { id: h.entityId++, x: pos.x, y: pos.y, radius: TURRET.radius, hp: maxHp * fraction, maxHp, active: true,
      angle: 0, cooldown: .2, lastShotAt: -99, lastHitAt: r.elapsed, hitFlash: 0 };
    r.structures.push(t); r.turretKits--; r.structuresBuilt++; r.placement = null;
    h.obstacles.push({ structureId: t.id, kind: "turretBody", x: t.x - t.radius, y: t.y - t.radius, w: t.radius * 2, h: t.radius * 2 });
    this.refreshNavigation(); h.emit("structurePlaced", { x: t.x, y: t.y, id: t.id }); return true;
  }
  refreshNavigation() { const h = this.host; h.rebuildObstacleGrid(); h.setupNavigation(); }
  nearestRecoverable() {
    const h = this.host, p = h.run?.player;
    if (!p) return null;
    return h.run.structures.find(t => {
      const distance = Math.hypot(t.x - p.x, t.y - p.y);
      if (!t.active || distance >= 68) return false;
      const scale = Math.max(0, distance - t.radius * 1.5 - 2) / (distance || 1);
      return !Number.isFinite(firstObstacleTime(h.obstacles, p.x, p.y, (t.x - p.x) * scale, (t.y - p.y) * scale));
    }) || null;
  }
  recover() {
    const h = this.host, r = h.run, t = this.nearestRecoverable();
    if (!t || h.screen !== "running") return false;
    r.turretKitHealth.push(Math.max(.01, t.hp / t.maxHp)); r.turretKits++;
    this.remove(t); h.emit("structureRecovered", { id: t.id }); return true;
  }
  remove(t) {
    const h = this.host, r = h.run; t.active = false;
    r.structures = r.structures.filter(item => item.active);
    h.obstacles = h.obstacles.filter(item => item.structureId !== t.id); this.refreshNavigation();
  }
  damage(t, amount) {
    const h = this.host; if (!t?.active || h.screen !== "running") return false;
    t.hp -= Math.max(0, amount); t.lastHitAt = h.run.elapsed; t.hitFlash = .12;
    if (t.hp <= 0) { this.remove(t); h.emit("structureDestroyed", { x: t.x, y: t.y, id: t.id }); }
    return true;
  }
  targetFor(enemy, player) {
    const h = this.host, r = h.run; enemy.targetStructureId = null;
    if (enemy.boss) return player;
    let best = Math.min(210, Math.hypot(enemy.x - player.x, enemy.y - player.y) * 1.12), target = null;
    for (const t of r.structures) {
      const distance = Math.hypot(enemy.x - t.x, enemy.y - t.y);
      if (distance >= best || !t.active) continue;
      const dx = (enemy.x - t.x) / (distance || 1), dy = (enemy.y - t.y) / (distance || 1);
      const x = t.x + dx * (t.radius + enemy.radius + 3), y = t.y + dy * (t.radius + enemy.radius + 3);
      if (!Number.isFinite(firstObstacleTime(h.obstacles, enemy.x, enemy.y, x - enemy.x, y - enemy.y))) { best = distance; target = t; this.enemyGoal.x = x; this.enemyGoal.y = y; }
    }
    if (target) { enemy.targetStructureId = target.id; return this.enemyGoal; }
    return player;
  }
  update(dt) {
    const h = this.host, r = h.run;
    if (r.placement) this.preview();
    for (const t of r.structures) {
      const nextMax = TURRET.maxHp * (1 + r.engineering * .15);
      if (t.maxHp !== nextMax) { t.hp *= nextMax / t.maxHp; t.maxHp = nextMax; }
      t.hitFlash = Math.max(0, t.hitFlash - dt); t.cooldown -= dt;
      if (r.turretRegen > 0 && r.elapsed - t.lastHitAt > 8) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * r.turretRegen * .01 * dt);
      let target = null, nearest = TURRET.range;
      for (const e of h.enemies) {
        const distance = Math.hypot(e.x - t.x, e.y - (t.y - 20));
        if (!e.active || distance >= nearest) continue;
        const angle = Math.atan2(e.y - t.y + 20, e.x - t.x), mx = t.x + Math.cos(angle) * 38, my = t.y - 20 + Math.sin(angle) * 38;
        if (Number.isFinite(firstObstacleTime(h.obstacles, mx, my, e.x - mx, e.y - my))) continue;
        target = e; nearest = distance; t.angle = angle;
      }
      if (!target || t.cooldown > 0 || h.projectiles.length >= h.limits.projectiles) continue;
      const muzzle = turretMuzzle(t), dx = Math.cos(t.angle), dy = Math.sin(t.angle);
      h.projectiles.push(h.projectilePool.acquire({ id: h.entityId++, x: muzzle.x, y: muzzle.y, vx: dx * TURRET.projectileSpeed, vy: dy * TURRET.projectileSpeed,
        radius: 2.4, ttl: .8, damage: TURRET.damage * (1 + r.engineering * .25), pierce: 0, knockback: 8, owner: "turret", weaponId: "support_turret", color: "#d5bd83" }));
      t.cooldown = TURRET.interval; t.lastShotAt = r.elapsed;
      h.emit("turretShot", { x: muzzle.x, y: muzzle.y, aimX: dx, aimY: dy, structureId: t.id });
    }
  }
}

module.exports = { StructureSystem, turretMuzzle };
