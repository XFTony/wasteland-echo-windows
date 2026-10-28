"use strict";

const { PALETTE } = require("../config");
const { drawVisibleGroundTexture, drawPaintedGround } = require("./world-view");
const { hash2 } = require("./render-hash");

function ctxLabel(ctx, x, y, width) {
  ctx.fillStyle = "rgba(31,31,24,.88)"; ctx.fillRect(x - width / 2, y, width, 20);
}

const TERRAIN_METHODS = {
  drawTerrain(worldSize) {
    const ctx = this.ctx;
    const theme = this.mapLayout.theme;
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGroundTexture(worldSize);
    this.drawGroundGrain(worldSize);
    this.drawDistrictSurfaces();
    this.drawRoadNetwork();
    this.drawSurfacePatina(worldSize);
    this.drawRoadDetails();
    this.drawRailNetwork();
    this.drawMapLabels();
    this.drawScenery();
  },

  drawGroundTexture(worldSize) {
    drawVisibleGroundTexture(this, worldSize);
  },

  drawGroundGrain(worldSize) {
    const ctx = this.ctx;
    const tile = 96;
    const startX = Math.floor(this.camera.x / tile) * tile;
    const startY = Math.floor(this.camera.y / tile) * tile;
    const endX = Math.min(worldSize, this.camera.x + this.width + tile);
    const endY = Math.min(worldSize, this.camera.y + this.height + tile);
    for (let worldY = startY; worldY < endY; worldY += tile) {
      for (let worldX = startX; worldX < endX; worldX += tile) {
        const seed = hash2(worldX / tile, worldY / tile);
        const screenX = Math.round(worldX - this.camera.x);
        const screenY = Math.round(worldY - this.camera.y);
        ctx.fillStyle = seed % 3 === 0 ? "rgba(39,33,25,0.2)" : "rgba(226,190,126,0.12)";
        ctx.fillRect(screenX + (seed % 78) + 5, screenY + ((seed >>> 8) % 72) + 6, 3, 2);
        if (this.qualityLevel === 2 && seed % 5 === 0) {
          ctx.fillStyle = "rgba(55,45,32,0.22)";
          ctx.fillRect(screenX + ((seed >>> 13) % 72) + 8, screenY + ((seed >>> 20) % 66) + 12, 8, 2);
        }
      }
    }
  },

  drawInteractives(interactives) {
    const ctx = this.ctx;
    for (const item of interactives) {
      const point = this.worldToScreen(item.x, item.y, this.screenPoint);
      if (point.x < -item.radius - 20 || point.y < -item.radius - 20 || point.x > this.width + item.radius + 20 || point.y > this.height + item.radius + 20) continue;
      if (item.type === "tradePost" && item.active) {
        ctx.fillStyle = "#b19c67";
        for (let i = 0; i < 12; i++) { const angle = i / 12 * Math.PI * 2; ctx.fillRect(point.x + Math.cos(angle) * 26 - 2, point.y + Math.sin(angle) * 16 - 1, 4, 2); }
        ctx.fillStyle = "#6d5b3d"; ctx.fillRect(point.x - 10, point.y - 6, 20, 12);
        ctx.fillStyle = "#d9bd75"; ctx.fillRect(point.x - 6, point.y - 3, 12, 6);
      } else if (item.type === "electricField") {
        const pulse = 0.28 + Math.sin((item.pulse || 0) * Math.PI * 2) * 0.08;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#55a79e";
        ctx.beginPath();
        ctx.arc(point.x, point.y, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = "#8fd1c6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, item.radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (item.type === "explosiveBarrel") {
        ctx.fillStyle = item.active ? "#8f3f2d" : "#302d27";
        ctx.fillRect(point.x - 10, point.y - 14, 20, 28);
        ctx.fillStyle = item.active ? "#d8a245" : "#554d40";
        ctx.fillRect(point.x - 10, point.y - 8, 20, 3);
        ctx.fillRect(point.x - 10, point.y + 7, 20, 3);
        if (item.active) {
          ctx.fillStyle = "#ead9ad";
          ctx.fillRect(point.x - 2, point.y - 4, 4, 8);
        }
      } else if (item.type === "supplyCache" && item.active) {
        ctx.fillStyle = "#403d31";
        ctx.fillRect(point.x - 18, point.y - 12, 36, 24);
        ctx.strokeStyle = "#c8a55c";
        ctx.lineWidth = 2;
        ctx.strokeRect(point.x - 18, point.y - 12, 36, 24);
        ctx.fillStyle = "#bd5b43";
        ctx.fillRect(point.x - 3, point.y - 8, 6, 16);
        ctx.fillRect(point.x - 8, point.y - 3, 16, 6);
      }
    }
  },

  drawDistrictSurfaces() {
    const ctx = this.ctx;
    const theme = this.mapLayout.theme;
    for (const zone of this.mapLayout.zones) {
      const point = this.worldToScreen(zone.x, zone.y, this.screenPoint);
      if (point.x + zone.w < -30 || point.y + zone.h < -30 || point.x > this.width + 30 || point.y > this.height + 30) continue;
      if (zone.surface === "pavement") {
        ctx.fillStyle = theme.ground;
        ctx.fillRect(point.x, point.y, zone.w, zone.h);
        ctx.fillStyle = "rgba(49,43,34,0.36)";
        for (let x = 18; x < zone.w; x += 58) ctx.fillRect(point.x + x, point.y, 2, zone.h);
        for (let y = 28; y < zone.h; y += 64) ctx.fillRect(point.x, point.y + y, zone.w, 2);
      } else if (zone.surface === "concrete") {
        ctx.fillStyle = theme.concrete;
        ctx.fillRect(point.x, point.y, zone.w, zone.h);
        ctx.strokeStyle = "rgba(35,36,33,0.34)";
        ctx.lineWidth = 2;
        for (let x = 26; x < zone.w; x += 96) {
          ctx.beginPath();
          ctx.moveTo(point.x + x, point.y + 8);
          ctx.lineTo(point.x + x - 18, point.y + zone.h - 8);
          ctx.stroke();
        }
      } else if (zone.surface === "ballast") {
        ctx.fillStyle = theme.ballast;
        ctx.fillRect(point.x, point.y, zone.w, zone.h);
        if (this.qualityLevel > 0) {
          ctx.fillStyle = "rgba(49,44,37,0.36)";
          for (let x = 16; x < zone.w; x += 42) {
            const seed = hash2(zone.x + x, zone.y);
            ctx.fillRect(point.x + x, point.y + 16 + (seed % Math.max(1, zone.h - 32)), 3, 3);
          }
        }
      } else if (zone.surface === "scrap") {
        ctx.fillStyle = theme.ground;
        ctx.fillRect(point.x, point.y, zone.w, zone.h);
        ctx.strokeStyle = "rgba(150,93,57,0.48)";
        ctx.lineWidth = 3;
        ctx.strokeRect(point.x + 8, point.y + 8, zone.w - 16, zone.h - 16);
      }
    }
  },

  drawRoadNetwork() {
    const ctx = this.ctx;
    const viewW = this.visibleWorldWidth || this.width, viewH = this.visibleWorldHeight || this.height;
    for (const road of this.mapLayout.roads) {
      const point = this.worldToScreen(road.x, road.y, this.screenPoint);
      if (point.x + road.w < -40 || point.y + road.h < -40 || point.x > viewW + 40 || point.y > viewH + 40) continue;
      ctx.fillStyle = this.mapLayout.theme.asphalt;
      ctx.fillRect(point.x, point.y, road.w, road.h);
      ctx.fillStyle = "#777064";
      if (road.orientation === "horizontal") {
        ctx.fillRect(point.x, point.y + 10, road.w, 5);
        ctx.fillRect(point.x, point.y + road.h - 15, road.w, 5);
        const laneY = point.y + road.h / 2;
        const start = road.x + Math.floor((Math.max(this.camera.x, road.x) - road.x) / 92) * 92;
        ctx.fillStyle = "#c3a663";
        for (let worldX = start; worldX < Math.min(road.x + road.w, this.camera.x + viewW); worldX += 92) {
          const left = Math.max(road.x, worldX), right = Math.min(worldX + 48, road.x + road.w);
          if (right > left) ctx.fillRect(Math.round(left - this.camera.x), Math.round(laneY - 2), right - left, 4);
        }
      } else {
        ctx.fillRect(point.x + 10, point.y, 5, road.h);
        ctx.fillRect(point.x + road.w - 15, point.y, 5, road.h);
        const laneX = point.x + road.w / 2;
        const start = road.y + Math.floor((Math.max(this.camera.y, road.y) - road.y) / 92) * 92;
        ctx.fillStyle = "#c3a663";
        for (let worldY = start; worldY < Math.min(road.y + road.h, this.camera.y + viewH); worldY += 92) {
          const top = Math.max(road.y, worldY), bottom = Math.min(worldY + 48, road.y + road.h);
          if (bottom > top) ctx.fillRect(Math.round(laneX - 2), Math.round(top - this.camera.y), 4, bottom - top);
        }
      }
    }
  },

  drawInteractionLabels(model) {
    const p = model.run.player;
    for (const item of model.interactives) {
      if (!item.active || item.type === "tradePost" || Math.hypot(p.x - item.x, p.y - item.y) > 300) continue;
      const point = this.worldToScreen(item.x, item.y, this.screenPoint);
      const label = item.type === "supplyCache" ? "靠近拾取补给" : item.type === "explosiveBarrel" ? "爆桶 · 可射击引爆" : "电磁区 · 减速感染者";
      const width = label.length * 9 + 14, y = point.y - (item.type === "electricField" ? item.radius + 22 : 48);
      ctxLabel(this.ctx, point.x, y, width);
      this.text(label, point.x, y + 10, 10, item.type === "explosiveBarrel" ? "#e3b47e" : "#e1d5ad", "center", "bold");
    }
  },

  drawSurfacePatina(worldSize) {
    if (!this.paintedGround || !this.groundTexture) return;
    const ctx = this.ctx;
    const width = this.visibleWorldWidth || this.width;
    const height = this.visibleWorldHeight || this.height;
    ctx.save();
    ctx.beginPath();
    for (const zone of this.mapLayout.zones) {
      const point = this.worldToScreen(zone.x, zone.y, this.screenPoint);
      if (point.x + zone.w < 0 || point.y + zone.h < 0 || point.x > width || point.y > height) continue;
      ctx.rect(point.x, point.y, zone.w, zone.h);
    }
    for (const road of this.mapLayout.roads) {
      const point = this.worldToScreen(road.x, road.y, this.screenPoint);
      if (point.x + road.w < 0 || point.y + road.h < 0 || point.x > width || point.y > height) continue;
      ctx.rect(point.x, point.y, road.w, road.h);
    }
    ctx.clip();
    drawPaintedGround(this, this.groundTexture, worldSize, this.qualityLevel === 0 ? 0.25 : 0.38);
    ctx.restore();
  },

  drawRoadDetails() {
    const ctx = this.ctx;
    for (const detail of this.mapLayout.roadDetails) {
      if (detail.type === "crack" && this.qualityLevel === 0) continue;
      const point = this.worldToScreen(detail.x, detail.y, this.screenPoint);
      if (point.x + detail.w < -20 || point.y + detail.h < -20 || point.x > this.width + 20 || point.y > this.height + 20) continue;
      if (detail.type === "crosswalk") {
        const stripeCount = Math.max(2, Number(detail.stripes) || 6);
        ctx.fillStyle = "rgba(224,211,169,0.45)";
        if (detail.orientation === "horizontal") {
          const step = detail.h / stripeCount;
          const stripeHeight = Math.max(3, Math.floor(step * 0.52));
          for (let stripe = 0; stripe < stripeCount; stripe += 1) {
            ctx.fillRect(point.x, Math.round(point.y + stripe * step), detail.w, stripeHeight);
          }
        } else {
          const step = detail.w / stripeCount;
          const stripeWidth = Math.max(3, Math.floor(step * 0.52));
          for (let stripe = 0; stripe < stripeCount; stripe += 1) {
            ctx.fillRect(Math.round(point.x + stripe * step), point.y, stripeWidth, detail.h);
          }
        }
      } else if (detail.type === "crack") {
        const seed = Number(detail.seed) || hash2(detail.x, detail.y);
        const horizontal = detail.w >= detail.h;
        ctx.fillStyle = "rgba(22,22,20,0.35)";
        if (horizontal) {
          const y = point.y + Math.floor(detail.h * 0.55);
          ctx.fillRect(point.x, y, detail.w, 3);
          const branchX = point.x + 5 + (seed % Math.max(6, detail.w - 12));
          ctx.fillRect(branchX, y - Math.floor(detail.h * 0.45), 3, Math.max(7, Math.floor(detail.h * 0.7)));
        } else {
          const x = point.x + Math.floor(detail.w * 0.5);
          ctx.fillRect(x, point.y, 3, detail.h);
          const branchY = point.y + 5 + (seed % Math.max(6, detail.h - 12));
          ctx.fillRect(x - Math.floor(detail.w * 0.4), branchY, Math.max(7, Math.floor(detail.w * 0.7)), 3);
        }
      }
    }
  },

  drawRailNetwork() {
    const ctx = this.ctx;
    const viewW = this.visibleWorldWidth || this.width, viewH = this.visibleWorldHeight || this.height;
    for (const track of this.mapLayout.tracks) {
      const point = this.worldToScreen(track.x, track.y, this.screenPoint);
      if (point.x + track.w < -40 || point.y + track.h < -40 || point.x > viewW + 40 || point.y > viewH + 40) continue;
      if (track.orientation === "horizontal") {
        ctx.fillStyle = "rgba(60,55,45,0.44)";
        ctx.fillRect(point.x, point.y, track.w, track.h);
        for (let line = 0; line < track.lines; line += 1) {
          const y = Math.round(point.y + 24 + line * track.spacing);
          ctx.fillStyle = "#242624";
          ctx.fillRect(point.x, y - 4, track.w, 2);
          ctx.fillRect(point.x, y + 5, track.w, 2);
          ctx.fillStyle = "#8c7654";
          const start = track.x + Math.floor((Math.max(this.camera.x, track.x) - track.x) / 24) * 24;
          for (let worldX = start; worldX < Math.min(track.x + track.w, this.camera.x + viewW); worldX += 24) {
            ctx.fillRect(Math.round(worldX - this.camera.x), y - 7, Math.min(5, track.x + track.w - worldX), 16);
          }
        }
      } else {
        ctx.fillStyle = "rgba(61,55,45,0.38)";
        ctx.fillRect(point.x, point.y, track.w, track.h);
        for (let line = 0; line < track.lines; line += 1) {
          const x = Math.round(point.x + 38 + line * track.spacing);
          ctx.fillStyle = "#242624";
          ctx.fillRect(x - 4, point.y, 2, track.h);
          ctx.fillRect(x + 5, point.y, 2, track.h);
          ctx.fillStyle = "#8c7654";
          const start = track.y + Math.floor((Math.max(this.camera.y, track.y) - track.y) / 24) * 24;
          for (let worldY = start; worldY < Math.min(track.y + track.h, this.camera.y + viewH); worldY += 24) {
            ctx.fillRect(x - 7, Math.round(worldY - this.camera.y), 16, Math.min(5, track.y + track.h - worldY));
          }
        }
      }
    }
  },

  drawMapLabels() {
    for (const zone of this.mapLayout.zones) {
      const x = zone.x + zone.w / 2 - this.camera.x;
      const y = zone.y + 26 - this.camera.y;
      if (x > -150 && x < this.width + 150 && y > -20 && y < this.height + 30) {
        this.text(zone.label, x, y, 11, "#f3ddaa", "center", "bold");
      }
    }
  },

  drawScenery() {
    const ctx = this.ctx;
    const scenery = this.mapLayout.scenery;
    for (let index = 0; index < scenery.length; index += 1) {
      const item = scenery[index];
      if (this.qualityLevel === 0 && item.detail) continue;
      const p = this.worldToScreen(item.x, item.y, this.screenPoint);
      if (p.x < -60 || p.y < -80 || p.x > this.width + 60 || p.y > this.height + 80) continue;
      ctx.fillStyle = "rgba(24,20,17,0.28)";
      ctx.fillRect(p.x - 14, p.y + 12, 32, 6);
      if (item.type === "deadTree") {
        ctx.fillStyle = "#4a3828";
        ctx.fillRect(p.x - 3, p.y - 37, 7, 52);
        ctx.fillRect(p.x - 18, p.y - 27, 18, 5);
        ctx.fillRect(p.x + 2, p.y - 17, 17, 4);
        ctx.fillRect(p.x - 16, p.y - 31, 4, 12);
      } else if (item.type === "barrels") {
        ctx.fillStyle = "#6a3f32";
        ctx.fillRect(p.x - 15, p.y - 13, 13, 27);
        ctx.fillStyle = "#46524e";
        ctx.fillRect(p.x + 1, p.y - 10, 14, 24);
        ctx.fillStyle = "#bd8a4e";
        ctx.fillRect(p.x - 15, p.y - 7, 13, 2);
        ctx.fillRect(p.x + 1, p.y + 5, 14, 2);
      } else if (item.type === "pump") {
        ctx.fillStyle = "#333532";
        ctx.fillRect(p.x - 9, p.y - 24, 18, 39);
        ctx.fillStyle = "#9d4937";
        ctx.fillRect(p.x - 11, p.y - 24, 22, 7);
        ctx.fillStyle = "#c8b277";
        ctx.fillRect(p.x - 5, p.y - 13, 10, 8);
        ctx.strokeStyle = "#242522";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x + 9, p.y - 15);
        ctx.lineTo(p.x + 17, p.y - 7);
        ctx.lineTo(p.x + 15, p.y + 8);
        ctx.stroke();
      } else if (item.type === "tires") {
        ctx.strokeStyle = "#272725";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(p.x - 8, p.y + 2, 10, 0, Math.PI * 2);
        ctx.arc(p.x + 10, p.y - 3, 11, 0, Math.PI * 2);
        ctx.stroke();
      } else if (item.type === "antenna") {
        ctx.strokeStyle = "#5d5b54";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + 15);
        ctx.lineTo(p.x, p.y - 48);
        ctx.moveTo(p.x, p.y - 35);
        ctx.lineTo(p.x - 15, p.y + 12);
        ctx.moveTo(p.x, p.y - 35);
        ctx.lineTo(p.x + 15, p.y + 12);
        ctx.stroke();
        ctx.fillStyle = this.frame % 80 < 40 ? PALETTE.rust : "#4b332e";
        ctx.fillRect(p.x - 3, p.y - 53, 6, 6);
      } else if (item.type === "streetlight") {
        ctx.fillStyle = "#393b36";
        ctx.fillRect(p.x - 3, p.y - 58, 6, 72);
        ctx.fillStyle = "#282a27";
        ctx.fillRect(p.x - 13, p.y - 58, 26, 6);
        ctx.fillStyle = this.frame % 90 < 54 ? "#d8bd79" : "#7b6845";
        ctx.fillRect(p.x - 7, p.y - 53, 14, 8);
        if (this.qualityLevel === 2) {
          ctx.fillStyle = "rgba(229,194,112,0.12)";
          ctx.fillRect(p.x - 22, p.y - 45, 44, 58);
        }
      } else if (item.type === "bench") {
        ctx.fillStyle = "#4d4030";
        ctx.fillRect(p.x - 18, p.y - 6, 36, 7);
        ctx.fillRect(p.x - 18, p.y + 3, 36, 4);
        ctx.fillStyle = "#292a27";
        ctx.fillRect(p.x - 13, p.y + 7, 4, 8);
        ctx.fillRect(p.x + 9, p.y + 7, 4, 8);
      } else if (item.type === "dumpster") {
        ctx.fillStyle = "#344542";
        ctx.fillRect(p.x - 18, p.y - 18, 36, 31);
        ctx.fillStyle = "#1f2826";
        ctx.fillRect(p.x - 20, p.y - 22, 40, 7);
        ctx.fillStyle = "#8b7f5c";
        ctx.fillRect(p.x - 12, p.y - 7, 23, 4);
        ctx.fillStyle = "#22231f";
        ctx.fillRect(p.x - 15, p.y + 12, 7, 4);
        ctx.fillRect(p.x + 9, p.y + 12, 7, 4);
      } else if (item.type === "mailbox") {
        ctx.fillStyle = "#3a4a4b";
        ctx.fillRect(p.x - 8, p.y - 21, 16, 17);
        ctx.fillStyle = "#222825";
        ctx.fillRect(p.x - 3, p.y - 4, 6, 19);
        ctx.fillStyle = PALETTE.cream;
        ctx.fillRect(p.x - 4, p.y - 15, 8, 2);
      } else if (item.type === "rubble") {
        ctx.fillStyle = "#4a4439";
        ctx.fillRect(p.x - 22, p.y + 3, 44, 9);
        ctx.fillStyle = "#827051";
        ctx.fillRect(p.x - 13, p.y - 5, 11, 9);
        ctx.fillRect(p.x + 3, p.y - 8, 16, 12);
        ctx.fillStyle = "#342e27";
        ctx.fillRect(p.x - 19, p.y - 1, 6, 5);
        ctx.fillRect(p.x + 16, p.y + 3, 7, 5);
      } else if (item.type === "barricade") {
        ctx.fillStyle = "#4a4236";
        ctx.fillRect(p.x - 22, p.y + 6, 44, 5);
        ctx.fillStyle = "#a56d3c";
        ctx.fillRect(p.x - 20, p.y - 12, 40, 15);
        ctx.fillStyle = "#302c28";
        for (let stripe = -16; stripe <= 12; stripe += 10) ctx.fillRect(p.x + stripe, p.y - 11, 5, 13);
        ctx.fillStyle = "#2c2d2a";
        ctx.fillRect(p.x - 15, p.y + 10, 4, 8);
        ctx.fillRect(p.x + 11, p.y + 10, 4, 8);
      } else if (item.type === "hydrant") {
        ctx.fillStyle = "#9d4535";
        ctx.fillRect(p.x - 5, p.y - 15, 10, 27);
        ctx.fillRect(p.x - 10, p.y - 9, 20, 7);
        ctx.fillStyle = "#d1a14e";
        ctx.fillRect(p.x - 4, p.y - 19, 8, 5);
        ctx.fillRect(p.x - 8, p.y + 10, 16, 4);
      } else if (item.type === "railSignal") {
        ctx.fillStyle = "#333530";
        ctx.fillRect(p.x - 3, p.y - 47, 6, 62);
        ctx.fillStyle = "#1d211f";
        ctx.fillRect(p.x - 10, p.y - 46, 20, 24);
        ctx.fillStyle = this.frame % 70 < 35 ? PALETTE.rust : "#5f302c";
        ctx.fillRect(p.x - 4, p.y - 41, 8, 8);
        ctx.fillStyle = "#e2bd67";
        ctx.fillRect(p.x - 4, p.y - 30, 8, 5);
      } else if (item.type === "pallet") {
        ctx.fillStyle = "#5c4733";
        for (let plank = 0; plank < 4; plank += 1) ctx.fillRect(p.x - 18, p.y - 10 + plank * 6, 36, 4);
        ctx.fillStyle = "#392d23";
        ctx.fillRect(p.x - 13, p.y + 13, 4, 5);
        ctx.fillRect(p.x + 9, p.y + 13, 4, 5);
      } else if (item.type === "crane") {
        ctx.fillStyle = "#3d3d37";
        ctx.fillRect(p.x - 4, p.y - 86, 8, 102);
        ctx.fillStyle = "#785743";
        ctx.fillRect(p.x, p.y - 84, 68, 7);
        ctx.fillStyle = "#292b28";
        ctx.fillRect(p.x + 56, p.y - 77, 3, 47);
        ctx.fillRect(p.x + 50, p.y - 31, 15, 5);
        ctx.fillStyle = "#ae7040";
        ctx.fillRect(p.x + 4, p.y - 82, 22, 4);
      } else if (item.type === "warningSign") {
        ctx.fillStyle = "#49453c";
        ctx.fillRect(p.x - 2, p.y - 24, 4, 39);
        ctx.fillStyle = "#bc7641";
        ctx.fillRect(p.x - 18, p.y - 28, 36, 18);
        ctx.fillStyle = "#2b2925";
        for (let stripe = -14; stripe <= 10; stripe += 8) ctx.fillRect(p.x + stripe, p.y - 26, 4, 14);
        ctx.fillStyle = PALETTE.cream;
        ctx.fillRect(p.x - 2, p.y - 23, 4, 7);
      } else if (item.type === "crate") {
        ctx.fillStyle = "#594632";
        ctx.fillRect(p.x - 16, p.y - 14, 32, 29);
        ctx.strokeStyle = "#8f7048";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x - 14, p.y - 12, 28, 25);
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y - 10);
        ctx.lineTo(p.x + 12, p.y + 11);
        ctx.moveTo(p.x + 12, p.y - 10);
        ctx.lineTo(p.x - 12, p.y + 11);
        ctx.stroke();
      } else if (item.type === "bones") {
        ctx.fillStyle = "#c6b98e";
        ctx.fillRect(p.x - 15, p.y + 3, 30, 3);
        ctx.fillRect(p.x - 4, p.y - 7, 8, 14);
        ctx.fillRect(p.x - 12, p.y - 3, 4, 4);
        ctx.fillRect(p.x + 9, p.y + 5, 4, 4);
      } else if (item.type === "cone") {
        ctx.fillStyle = "#d0783f";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 18);
        ctx.lineTo(p.x - 10, p.y + 10);
        ctx.lineTo(p.x + 10, p.y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.cream;
        ctx.fillRect(p.x - 6, p.y - 1, 12, 4);
        ctx.fillStyle = "#3a332b";
        ctx.fillRect(p.x - 14, p.y + 10, 28, 4);
      } else if (item.type === "scrub") {
        ctx.strokeStyle = "#6f673e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + 12);
        ctx.lineTo(p.x - 12, p.y - 8);
        ctx.moveTo(p.x, p.y + 12);
        ctx.lineTo(p.x + 11, p.y - 11);
        ctx.moveTo(p.x - 2, p.y + 4);
        ctx.lineTo(p.x - 18, p.y + 1);
        ctx.moveTo(p.x + 2, p.y + 4);
        ctx.lineTo(p.x + 18, p.y - 1);
        ctx.stroke();
      } else if (item.type === "cable") {
        ctx.strokeStyle = "#2b2927";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 2, 18, 0.15, Math.PI * 1.65);
        ctx.arc(p.x + 21, p.y + 4, 13, Math.PI * 0.75, Math.PI * 2.1);
        ctx.stroke();
      }
    }
  }
};

module.exports = { TERRAIN_METHODS };

