"use strict";

const { PALETTE } = require("../config");
const { clamp } = require("../core/math");
const { drawSurvivorActor, drawZombieActor } = require("./pixel-actors");

const ACTOR_METHODS = {
  drawExtraction(run) {
    const extraction = run.extraction;
    if (!extraction.active) return;
    const ctx = this.ctx;
    const point = this.worldToScreen(extraction.x, extraction.y, this.screenPoint);
    const pulse = 0.82 + Math.sin(this.frame * 0.09) * 0.12;
    ctx.strokeStyle = `rgba(116,203,209,${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, extraction.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(116,203,209,0.12)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, extraction.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(180,244,245,0.32)";
    ctx.fillRect(point.x - 5, point.y - 100, 10, 100);
    const progress = extraction.hold / extraction.required;
    if (progress > 0) {
      ctx.strokeStyle = PALETTE.white;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, extraction.radius - 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }
    this.text("撤离区", point.x, point.y - extraction.radius - 14, 12, PALETTE.cyan, "center", "bold");
  },

  drawPlayer(player, run) {
    const p = this.worldToScreen(player.x, player.y, this.screenPoint);
    const skin = this.content.get("skins", player.skinId, this.content.defaults.skin);
    const weapon = this.content.get("weapons", player.weaponId, this.content.defaults.weapon);
    const moving = Math.hypot(run.input.moveX, run.input.moveY) > 0.12;
    const flicker = player.invulnerable > 0 && Math.floor(this.frame / 3) % 2 === 0;
    drawSurvivorActor(this.ctx, {
      x: p.x,
      y: p.y,
      unit: 1,
      skin,
      skinId: player.skinId,
      heroId: player.heroId,
      weapon,
      aimX: player.lastAimX,
      aimY: player.lastAimY,
      elapsed: run.elapsed,
      moving,
      recoil: this.weaponKick,
      alpha: flicker ? 0.45 : 1,
      equipment: run.equipmentLoadout
    });
  },

  drawAimReticle(model) {
    if (model.save.settings.autoAim) return;
    const ctx = this.ctx;
    const player = model.run.player;
    const origin = this.worldToScreen(player.x, player.y, this.screenPoint);
    const x = Math.round(origin.x + player.lastAimX * 74);
    const y = Math.round(origin.y + player.lastAimY * 74);
    const radius = 7;
    ctx.strokeStyle = "rgba(231,216,173,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - radius, y - radius + 6);
    ctx.lineTo(x - radius, y - radius);
    ctx.lineTo(x - radius + 6, y - radius);
    ctx.moveTo(x + radius - 6, y - radius);
    ctx.lineTo(x + radius, y - radius);
    ctx.lineTo(x + radius, y - radius + 6);
    ctx.moveTo(x - radius, y + radius - 6);
    ctx.lineTo(x - radius, y + radius);
    ctx.lineTo(x - radius + 6, y + radius);
    ctx.moveTo(x + radius - 6, y + radius);
    ctx.lineTo(x + radius, y + radius);
    ctx.lineTo(x + radius, y + radius - 6);
    ctx.stroke();
  },

  drawEnemy(enemy, elapsed = 0) {
    const ctx = this.ctx;
    const p = this.worldToScreen(enemy.x, enemy.y, this.screenPoint);
    if (p.x < -80 || p.y < -80 || p.x > this.width + 80 || p.y > this.height + 80) return;
    drawZombieActor(ctx, { enemy, x: p.x, y: p.y, elapsed });

    if (enemy.elite) {
      const barW = enemy.boss ? 64 : 42;
      const barY = p.y - (enemy.boss ? 70 : 50);
      ctx.fillStyle = "#241d1c";
      ctx.fillRect(p.x - barW / 2, barY, barW, 5);
      ctx.fillStyle = enemy.boss ? PALETTE.rust : PALETTE.amber;
      ctx.fillRect(p.x - barW / 2, barY, barW * clamp(enemy.hp / enemy.maxHp, 0, 1), 5);
    } else if (enemy.hp < enemy.maxHp) {
      const barW = 22;
      const barY = p.y - (enemy.role === "tank" ? 47 : enemy.role === "swarm" ? 18 : 36);
      ctx.fillStyle = "rgba(28,23,21,0.82)";
      ctx.fillRect(p.x - barW / 2, barY, barW, 3);
      ctx.fillStyle = PALETTE.rust;
      ctx.fillRect(p.x - barW / 2, barY, barW * clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
    }
  },

  drawProjectile(projectile) {
    const ctx = this.ctx;
    const p = this.worldToScreen(projectile.x, projectile.y, this.screenPoint);
    if (p.x < -10 || p.y < -10 || p.x > this.width + 10 || p.y > this.height + 10) return;
    ctx.fillStyle = projectile.color;
    if (projectile.owner === "player") {
      const length = Math.max(4, Math.min(11, Math.hypot(projectile.vx, projectile.vy) / 80));
      const angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.24;
      ctx.fillRect(-length * 1.8, -1, length * 1.7, 2);
      ctx.globalAlpha = 1;
      ctx.fillRect(-length / 2, -2, length, 4);
      ctx.restore();
    } else {
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.fillStyle = "rgba(216,112,85,0.25)";
      ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
    }
  },

  drawPickup(pickup) {
    const ctx = this.ctx;
    const p = this.worldToScreen(pickup.x, pickup.y, this.screenPoint);
    const bob = Math.round(Math.sin(pickup.age * 5 + pickup.id) * 2);
    if (pickup.type === "xp") {
      ctx.fillStyle = PALETTE.mint;
      ctx.fillRect(p.x - 3, p.y - 4 + bob, 6, 8);
      ctx.fillStyle = "#c1f1d3";
      ctx.fillRect(p.x - 1, p.y - 3 + bob, 2, 3);
    } else if (pickup.type === "scrap") {
      ctx.fillStyle = PALETTE.amber;
      ctx.fillRect(p.x - 5, p.y - 4 + bob, 10, 8);
      ctx.fillStyle = "#664128";
      ctx.fillRect(p.x - 1, p.y - 4 + bob, 2, 8);
    } else {
      ctx.fillStyle = "#d9d2b7";
      ctx.fillRect(p.x - 7, p.y - 6 + bob, 14, 12);
      ctx.fillStyle = PALETTE.rust;
      ctx.fillRect(p.x - 2, p.y - 5 + bob, 4, 10);
      ctx.fillRect(p.x - 5, p.y - 2 + bob, 10, 4);
    }
  }
};

module.exports = { ACTOR_METHODS };

