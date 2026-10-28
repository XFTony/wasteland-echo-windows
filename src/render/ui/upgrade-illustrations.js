"use strict";

// Editable code-native pixel objects, shared by draft cards and field purchases.
function drawUpgradeIllustration(ctx, id, x, y, size, family = "utility") {
  const scale = size / 64;
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(scale, scale);
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const dark = "#252a23", edge = "#493a2a", copper = "#b68b50", light = "#e5c17b", steel = "#788079", cloth = "#707451";
  rect(8, 53, 49, 5, "rgba(36,31,23,.22)");
  if (/vitality|regen|recovery|fieldMedkit/i.test(id)) {
    rect(10, 20, 44, 34, dark); rect(13, 22, 38, 29, "#d2c298");
    rect(23, 12, 20, 9, edge); rect(27, 15, 12, 6, "#b5a281");
    rect(28, 27, 8, 19, "#9c4836"); rect(22, 33, 20, 7, "#9c4836");
    rect(15, 24, 4, 24, copper); rect(45, 24, 4, 24, copper); rect(19, 24, 20, 2, "#f0dfb7");
  } else if (family === "mobility" || /speed|runner|kinetic/i.test(id)) {
    for (const [bx, by] of [[12, 14], [33, 24]]) {
      rect(bx, by, 17, 28, dark); rect(bx + 2, by + 2, 13, 24, cloth);
      rect(bx - 3, by + 25, 24, 13, edge); rect(bx - 2, by + 27, 23, 7, "#9c7444");
      rect(bx - 3, by + 36, 24, 3, dark);
      for (let j = 0; j < 3; j++) { rect(bx + 4, by + 7 + j * 6, 8, 2, light); }
      rect(bx, by + 24, 17, 4, copper);
    }
  } else if (/armor|aegis|ballistic/i.test(id)) {
    rect(14, 12, 36, 42, dark); rect(19, 9, 8, 13, edge); rect(37, 9, 8, 13, edge);
    rect(17, 18, 30, 32, steel); rect(29, 18, 5, 32, dark);
    for (let j = 0; j < 3; j++) { rect(20, 23 + j * 8, 23, 5, "#9b9b7c"); rect(22, 23 + j * 8, 3, 2, light); }
    rect(14, 44, 36, 6, copper); rect(29, 44, 6, 6, edge);
  } else if (/magnet|arc|coil|capacitor|network|chamber/i.test(id)) {
    rect(10, 15, 44, 38, dark); rect(14, 19, 36, 29, "#555e4b");
    for (let j = 0; j < 5; j++) { rect(19 + j * 5, 20, 3, 28, copper); rect(19 + j * 5, 22, 2, 20, light); }
    rect(8, 26, 8, 14, steel); rect(49, 26, 8, 14, steel);
    rect(25, 8, 14, 9, edge); rect(28, 10, 7, 7, "#8cad9a");
  } else if (/critical|damage|pierce|round|penetrat|relay|focus|fireRate|projectile|swarm|momentum/i.test(id) || family === "firepower") {
    rect(8, 39, 48, 15, dark); rect(11, 42, 42, 9, edge);
    for (let j = 0; j < 3; j++) {
      const bx = 14 + j * 13, by = 13 + (j % 2) * 5;
      rect(bx, by + 6, 9, 29, copper); rect(bx + 2, by + 8, 3, 24, light);
      rect(bx + 2, by + 2, 5, 7, "#8f5539"); rect(bx + 3, by, 3, 4, steel);
      rect(bx - 1, by + 32, 11, 4, "#e0b66e");
    }
    rect(10, 44, 44, 3, cloth); rect(12, 44, 3, 3, light); rect(48, 44, 3, 3, light);
  } else {
    rect(12, 23, 42, 31, dark); rect(15, 25, 36, 25, cloth);
    rect(15, 28, 36, 5, copper); rect(19, 16, 26, 8, edge); rect(23, 18, 18, 5, steel);
    rect(27, 30, 12, 15, light); rect(30, 33, 6, 9, edge);
    for (let j = 0; j < 3; j++) rect(17 + j * 12, 46, 5, 2, copper);
  }
  ctx.restore();
}

function drawCoin(ctx, x, y, radius = 7) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#3e3020"; ctx.beginPath(); ctx.arc(1, 2, radius + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#bd8c3c"; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#efd28b"; ctx.fillRect(-radius * .65, -radius * .6, radius, 2);
  ctx.fillStyle = "#795828"; ctx.fillRect(-1, -radius * .45, 2, radius * .9); ctx.fillRect(-radius * .4, -1, radius * .8, 2);
  ctx.restore();
}

module.exports = { drawUpgradeIllustration, drawCoin };
