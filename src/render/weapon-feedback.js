"use strict";

const WEAPON_FEEDBACK = Object.freeze({
  scrap_pistol: Object.freeze({ family: "pistol", kick: 1.6, angle: .65, recovery: .09, camera: .28, trail: 9, width: 3, color: "#e7bd70", core: "#fff0bd", impact: "#d9bf8f", shell: "brass", ejectDelay: 0, flash: "compact" }),
  swarm_smg: Object.freeze({ family: "rapid", kick: .75, angle: .25, recovery: .045, camera: .10, trail: 7, width: 2, color: "#b7c399", core: "#f0e9bd", impact: "#c5c397", shell: "brass", ejectDelay: 0, flash: "short" }),
  breaker_shotgun: Object.freeze({ family: "pellet", kick: 3.2, angle: 1.15, recovery: .14, camera: .75, trail: 4, width: 3, color: "#deb67a", core: "#f8e7b8", impact: "#d9b27b", shell: "shotgun", ejectDelay: .17, flash: "wide" }),
  needle_rifle: Object.freeze({ family: "needle", kick: 2, angle: .72, recovery: .11, camera: .40, trail: 22, width: 2, color: "#9dbcc2", core: "#f0f6dc", impact: "#bfd0c3", shell: "brass", ejectDelay: .08, flash: "needle" }),
  rust_revolver: Object.freeze({ family: "slug", kick: 2.1, angle: 1.0, recovery: .14, camera: .55, trail: 10, width: 4, color: "#d8a366", core: "#fff1c6", impact: "#dfb885", shell: "none", ejectDelay: 0, flash: "heavy" }),
  ember_carbine: Object.freeze({ family: "carbine", kick: 1.2, angle: .38, recovery: .065, camera: .20, trail: 13, width: 2, color: "#e8ac76", core: "#ffe2af", impact: "#d8bb8b", shell: "brass", ejectDelay: 0, flash: "compact" }),
  coil_cannon: Object.freeze({ family: "coil", kick: 3.5, angle: .88, recovery: .18, camera: .95, trail: 26, width: 5, color: "#70cbd1", core: "#dcfff0", impact: "#97d9d2", shell: "none", ejectDelay: 0, flash: "coil" })
});

function feedbackFor(id) { return WEAPON_FEEDBACK[id] || WEAPON_FEEDBACK.scrap_pistol; }

function sampleWeaponFeedback(shot, elapsed, weaponId, facing = 1, angle = 0) {
  if (!shot || shot.weaponId !== weaponId) return { offset: 0, angle: 0, strength: 0 };
  const p = feedbackFor(weaponId), age = Math.max(0, elapsed - shot.elapsed);
  const recovery = Math.min(p.recovery, Math.max(.025, shot.interval * .65));
  const attack = .012;
  const curve = age < attack ? 1 - (1 - age / attack) ** 2 : Math.exp(-(age - attack) / recovery);
  const strength = curve < .015 ? 0 : curve;
  const boost = shot.empowered ? 1.12 : 1;
  return { offset: p.kick * strength * boost,
    angle: -facing * p.angle * Math.PI / 180 * strength * boost * (.2 + .8 * Math.abs(Math.cos(angle))), strength };
}

function drawWeaponProjectile(ctx, projectile, x, y) {
  const p = feedbackFor(projectile.weaponId), empowered = projectile.empowered || projectile.critical;
  const width = p.width + (empowered ? 1 : 0), length = p.trail;
  ctx.save();ctx.translate(x, y);ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
  ctx.fillStyle = "rgba(13,24,21,0.85)";
  if (p.family === "pellet") {
    ctx.fillRect(-3, -3, 6, 6);ctx.fillStyle = p.color;ctx.fillRect(-2, -2, 4, 4);
    ctx.fillStyle = p.core;ctx.fillRect(0, -1, 2, 2);
  } else if (p.family === "coil") {
    ctx.globalAlpha = .25;ctx.fillStyle = p.color;ctx.fillRect(-length, -width / 2, length, width);
    ctx.globalAlpha = 1;ctx.fillStyle = "#254149";ctx.fillRect(-8, -width / 2 - 1, 15, width + 2);
    ctx.fillStyle = p.color;ctx.beginPath();ctx.moveTo(8, 0);ctx.lineTo(2, -width / 2);ctx.lineTo(-8, -width / 2);ctx.lineTo(-10, 0);ctx.lineTo(-8, width / 2);ctx.lineTo(2, width / 2);ctx.closePath();ctx.fill();
    ctx.fillStyle = p.core;ctx.fillRect(-5, -1, 10, 2);
    ctx.fillStyle = p.color;ctx.fillRect(-16, -5, 4, 1);ctx.fillRect(-21, 4, 4, 1);
  } else {
    ctx.globalAlpha = p.family === "needle" ? .5 : .32;
    ctx.fillStyle = p.color;ctx.fillRect(-length, -Math.max(1, width / 2 - 1), length, Math.max(1, width - 1));
    ctx.globalAlpha = 1;ctx.fillStyle = "#1d251d";ctx.fillRect(-5, -width / 2 - 1, 11, width + 2);
    ctx.fillStyle = p.color;ctx.fillRect(-4, -width / 2, 9, width);
    ctx.fillStyle = p.core;ctx.fillRect(1, -Math.max(1, width / 2 - 1), p.family === "needle" ? 9 : 4, Math.max(1, width - 1));
  }
  ctx.restore();
}

function drawWeaponFlash(ctx, flash, x, y, angle) {
  const profile = feedbackFor(flash.weaponId), life = Math.max(0, flash.life / flash.maxLife);
  const length = Math.min(flash.length, profile.flash === "short" ? 8 : profile.flash === "coil" ? 17 : 22);
  ctx.save();ctx.translate(x, y);ctx.rotate(angle);ctx.globalAlpha = life;
  ctx.fillStyle = profile.color;
  if (profile.flash === "coil") {
    ctx.strokeStyle = profile.color;ctx.lineWidth = 2;ctx.beginPath();ctx.arc(3, 0, 4 + (1 - life) * 4, -.8, .8);ctx.stroke();
    ctx.fillRect(0, -2, length, 4);ctx.fillStyle = profile.core;ctx.fillRect(0, -1, length * .7, 2);
  } else if (profile.flash === "wide" || profile.flash === "heavy") {
    ctx.beginPath();ctx.moveTo(-1, 0);ctx.lineTo(length * .8, -6 * life);ctx.lineTo(length * .58, -1);
    ctx.lineTo(length, 0);ctx.lineTo(length * .58, 2);ctx.lineTo(length * .8, 6 * life);ctx.closePath();ctx.fill();
    ctx.fillStyle = profile.core;ctx.fillRect(-1, -2, length * .5, 4);
  } else {
    const half = profile.flash === "needle" ? 1.5 : 2;
    ctx.fillRect(0, -half, length, half * 2);
    ctx.fillStyle = profile.core;ctx.fillRect(0, -1, length * .6, 2);
    if (profile.flash !== "short") { ctx.fillStyle = profile.color;ctx.fillRect(3, -4, 3, 1);ctx.fillRect(6, 3, 3, 1); }
  }
  ctx.restore();
}

function drawWeaponImpact(ctx, impact, x, y) {
  const life = Math.max(0, impact.life / impact.maxLife), radius = impact.radius * (1.4 - life * .4);
  ctx.save();ctx.translate(x, y);ctx.rotate(impact.angle);ctx.globalAlpha = life;
  ctx.fillStyle = impact.color;ctx.strokeStyle = impact.color;ctx.lineWidth = 1.5;
  if (impact.family === "coil") {
    ctx.beginPath();ctx.arc(0, 0, radius, -.8, .8);ctx.stroke();
    ctx.fillRect(-3, -1, 6, 2);ctx.fillRect(-1, -5, 2, 10);
  } else if (impact.family === "needle") {
    ctx.fillRect(-radius, -1, radius * 2, 2);ctx.fillRect(1, -4, 1, 8);
  } else if (impact.family === "slug" || impact.family === "pellet") {
    ctx.fillRect(-3, -3, 6, 6);ctx.fillRect(-radius, -1, 3, 2);ctx.fillRect(1, -radius, 2, 3);ctx.fillRect(3, radius - 3, 2, 3);
  } else {
    ctx.fillRect(-radius, -1, radius * 1.7, 2);ctx.fillRect(-1, -radius * .6, 2, radius * 1.2);
  }
  ctx.restore();
}

module.exports = { WEAPON_FEEDBACK, feedbackFor, sampleWeaponFeedback, drawWeaponProjectile, drawWeaponFlash, drawWeaponImpact };
