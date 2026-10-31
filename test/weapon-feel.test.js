"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const { GameModel } = require("../src/core/game-model");
const { SaveManager } = require("../src/core/save");
const { makeEnemy, resetEnemy, makeProjectile, resetProjectile } = require("../src/core/entity-factories");
const { addKnockback, advanceKnockback, IMPULSE_SCALE } = require("../src/core/knockback");
const { circleRectPushOut } = require("../src/core/math");
const { WEAPON_FEEDBACK, sampleWeaponFeedback } = require("../src/render/weapon-feedback");
const { mergeFeedbackHits } = require("../src/shared/combat-feedback-events");

function model(weaponId = "scrap_pistol") {
  const m = new GameModel(new SaveManager({ get: () => null, set() {} }), { seed: 17 });
  m.startRun({ seed: 17, weaponId, tutorial: false });m.releaseAllEntities();
  m.obstacles.length = 0;m.interactives.length = 0;m.rebuildObstacleGrid();return m;
}

test("a high-speed projectile hits the first small target on its entire travel segment", () => {
  const m = model(), p = m.run.player;
  const far = m.spawnEnemy("crawler", p.x + 170, p.y), near = m.spawnEnemy("crawler", p.x + 60, p.y);
  m.projectiles.push(m.projectilePool.acquire({ id: 900, x: p.x, y: p.y, vx: 18000, vy: 0, radius: 2, ttl: 1, damage: 1, pierce: 0, knockback: 0, owner: "player" }));
  m.rebuildEnemyGrid();const nearHp = near.hp, farHp = far.hp;m.updateProjectiles(1 / 60);
  assert.equal(near.hp, nearHp - 1);assert.equal(far.hp, farHp);
});

test("piercing contacts follow path order and never damage one target twice", () => {
  const m = model(), p = m.run.player;
  const far = m.spawnEnemy("brute", p.x + 170, p.y), near = m.spawnEnemy("brute", p.x + 60, p.y);
  m.projectiles.push(m.projectilePool.acquire({ id: 901, x: p.x, y: p.y, vx: 18000, vy: 0, radius: 2, ttl: 1, damage: 1, pierce: 2, knockback: 0, owner: "player" }));
  m.rebuildEnemyGrid();m.drainEvents();m.updateProjectiles(1 / 60);
  assert.deepEqual(m.drainEvents().filter(e => e.type === "hit").map(e => e.enemyId), [near.id, far.id]);
  assert.equal(m.projectiles[0].hitIds.size, 2);
});

test("all six close shotgun pellets can hit before the target starts its bounded shove", () => {
  const m = model("breaker_shotgun"), p = m.run.player;
  const enemy = m.spawnEnemy("brute", p.x + 24, p.y + 4);enemy.hp = enemy.maxHp = 100000;
  const x = enemy.x, y = enemy.y;
  m.updatePlayer(0);m.rebuildEnemyGrid();m.updateProjectiles(1 / 60);
  assert.equal(m.run.hits, 6);assert.equal(enemy.x, x);assert.equal(enemy.y, y);
  assert.ok(Math.hypot(enemy.knockbackVX, enemy.knockbackVY) > 0);
  const cap = 92 * 1.25 * (1 - enemy.knockbackResistance) * 1.15 * IMPULSE_SCALE;
  assert.ok(Math.hypot(enemy.knockbackVX, enemy.knockbackVY) <= cap + .001);
});

test("knockback is smooth, respects armor and stays consistent across update rates", () => {
  const distance = (rate, resistance = 0) => {
    const e = makeEnemy();resetEnemy(e, { id: 1, x: 0, y: 0, radius: 8, knockbackResistance: resistance });
    addKnockback(e, { vx: 100, vy: 0, knockback: 92, attackId: 1 });
    assert.equal(e.x, 0);
    for (let i = 0; i < rate / 2; i++) advanceKnockback(e, 1 / rate, () => {});
    return e.x;
  };
  assert.ok(Math.abs(distance(30) - distance(120)) < .05);
  assert.ok(distance(60, .96) < distance(60) * .06);
});

test("a knockback impulse cannot push a small enemy through a thin solid obstacle", () => {
  const e = makeEnemy();resetEnemy(e, { id: 1, x: 130, y: 50, radius: 6, knockbackResistance: 0 });
  const wall = { x: 143, y: 0, w: 4, h: 100 };
  addKnockback(e, { vx: 100, vy: 0, knockback: 124, attackId: 1 });
  for (let i = 0; i < 30; i++) advanceKnockback(e, 1 / 60, target => circleRectPushOut(target, wall));
  assert.ok(e.x <= wall.x - e.radius + .001);
});

test("pooled entities reset feedback ownership, impulse history and critical state", () => {
  const e = makeEnemy();resetEnemy(e, { id: 1, x: 0, y: 0, knockbackResistance: 0 });
  addKnockback(e, { vx: 1, vy: 0, knockback: 20, attackId: 3 });
  resetEnemy(e, { id: 2, x: 0, y: 0 });assert.equal(e.knockbackVX, 0);assert.ok(e.knockbackAttackIds.every(id => id === 0));
  const p = makeProjectile();resetProjectile(p, { x: 0, y: 0, weaponId: "coil_cannon", attackId: 3, empowered: true });
  resetProjectile(p, { x: 1, y: 1, owner: "enemy" });assert.equal(p.weaponId, null);assert.equal(p.attackId, 0);assert.equal(p.empowered, false);
});

test("automatic lock retains near ties, then switches for clear advantage or invalid targets", () => {
  const m = model(), p = m.run.player;m.save.settings.autoFire = false;
  const a = m.spawnEnemy("drifter", p.x + 100, p.y), b = m.spawnEnemy("drifter", p.x - 101, p.y);
  m.updatePlayer(0);assert.equal(p.aimTargetId, a.id);
  b.x = p.x - 99;m.rebuildEnemyGrid();m.updatePlayer(0);assert.equal(p.aimTargetId, a.id);
  b.x = p.x - 70;m.rebuildEnemyGrid();m.updatePlayer(0);assert.equal(p.aimTargetId, b.id);
  b.active = false;m.rebuildEnemyGrid();m.updatePlayer(0);assert.equal(p.aimTargetId, a.id);
});

test("seven recovery profiles are bounded and return to rest without changing the firing ray", () => {
  for (const [id, p] of Object.entries(WEAPON_FEEDBACK)) {
    const shot = { weaponId: id, elapsed: 10, interval: .2, empowered: true };
    assert.equal(sampleWeaponFeedback(shot, 10, id).offset, 0);
    for (let i = 0; i < 60; i++) assert.ok(sampleWeaponFeedback(shot, 10 + i / 120, id).offset <= p.kick * 1.12 + .001);
    assert.equal(sampleWeaponFeedback(shot, 12, id).offset, 0);
  }
});

test("pellet feedback merges only presentation damage in the same attack and target", () => {
  const events = [1, 2, 3].map(damage => ({ type: "hit", attackId: 1, enemyId: 5, damage, x: 10, y: 20 }));
  const result = mergeFeedbackHits(events);
  assert.equal(result.length, 1);assert.equal(result[0].damage, 6);assert.equal(result[0].hitCount, 3);
  assert.equal(events[0].damage, 1);
});
