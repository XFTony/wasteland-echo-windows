"use strict";
const { PART_ASSETS } = require("../content/compact-actors");

// Native pixel mechanical parts share the current brass, olive and dark-ink palette.
function drawTurret(ctx, x, y, angle, active, recoil = 0, gun = null) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = "rgba(12,17,14,.38)"; ctx.fillRect(-22, -3, 44, 10);
  ctx.fillStyle = "#242b24"; ctx.fillRect(-20, -8, 9, 14); ctx.fillRect(11, -8, 9, 14); ctx.fillRect(-7, -17, 14, 20);
  ctx.fillStyle = "#757657"; ctx.fillRect(-18, -8, 5, 9); ctx.fillRect(13, -8, 5, 9); ctx.fillRect(-4, -16, 8, 13);
  ctx.fillStyle = "#b6aa7a"; ctx.fillRect(-18, -8, 3, 2); ctx.fillRect(13, -8, 3, 2); ctx.fillRect(-3, -15, 2, 9);
  ctx.fillStyle = "#3b4636"; ctx.fillRect(-12, -15, 24, 8); ctx.fillStyle = "#a18e60"; ctx.fillRect(-11, -14, 22, 2);
  ctx.fillStyle = "#1c251e"; ctx.fillRect(-14, -26, 12, 15); ctx.fillStyle = "#937c4a"; ctx.fillRect(-12, -24, 8, 11);
  ctx.fillStyle = "#cfb57c"; ctx.fillRect(-12, -24, 3, 9); ctx.fillStyle = "#273229"; ctx.fillRect(-12, -20, 8, 2);
  ctx.translate(0, -20); ctx.rotate(angle); ctx.translate(-recoil, 0);
  if (Math.cos(angle) < 0) ctx.scale(1, -1);
  if (gun) {
    const scale = 38 / 26; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(gun, -13 * scale, -6 * scale, 40 * scale, 22 * scale);
    ctx.restore(); return;
  }
  ctx.fillStyle = "#1c241e"; ctx.fillRect(-14, -8, 37, 16); ctx.fillRect(20, -4, 18, 8);
  ctx.fillStyle = active ? "#7e8c67" : "#68765b"; ctx.fillRect(-12, -6, 33, 12);
  ctx.fillStyle = "#c0a66d"; ctx.fillRect(-8, -6, 4, 12); ctx.fillRect(20, -3, 15, 6);
  ctx.fillStyle = "#d3c99d"; ctx.fillRect(0, -5, 14, 2); ctx.fillStyle = "#39463a"; ctx.fillRect(27, -3, 2, 6);
  ctx.restore();
}

function drawStructures(r, model) {
  const run = model.run, ctx = r.ctx;
  const asset = PART_ASSETS["weapon.swarm_smg"], gun = (run.structures.length || run.placement) && r.artStore.ready(asset) ? r.artStore.get(asset) : null;
  for (const t of run.structures) {
    const x = t.x - r.camera.x, y = t.y - r.camera.y;
    if (x < -70 || y < -70 || x > r.visibleWorldWidth + 70 || y > r.visibleWorldHeight + 70) continue;
    const recoil = Math.max(0, 1 - (run.elapsed - t.lastShotAt) / .1) * 2;
    drawTurret(ctx, x, y, t.angle, t.hitFlash > 0, recoil, gun);
    ctx.fillStyle = "#1e2922"; ctx.fillRect(x - 20, y - 43, 40, 5);
    ctx.fillStyle = t.hp < t.maxHp * .3 ? "#c07b5b" : "#8fbd92"; ctx.fillRect(x - 19, y - 42, 38 * Math.max(0, t.hp / t.maxHp), 3);
  }
  const preview = run.placement;
  if (!preview) return;
  const x = preview.x - r.camera.x, y = preview.y - r.camera.y;
  ctx.save(); ctx.globalAlpha = .55; drawTurret(ctx, x, y, Math.atan2(run.player.lastAimY, run.player.lastAimX), false, 0, gun); ctx.globalAlpha = .9;
  ctx.strokeStyle = preview.valid ? "#99d4ac" : "#e28c6c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

module.exports = { drawTurret, drawStructures };
