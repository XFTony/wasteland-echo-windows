"use strict";

const { PALETTE } = require("../config");

const OBSTACLE_METHODS = {
  drawObstacles(obstacles) {
    const ctx = this.ctx;
    for (const obstacle of obstacles) {
      const point = this.worldToScreen(obstacle.x, obstacle.y, this.screenPoint);
      if (point.x + obstacle.w < -20 || point.y + obstacle.h < -20 || point.x > this.width + 20 || point.y > this.height + 20) continue;
      ctx.fillStyle = "rgba(20,18,15,0.28)";
      ctx.fillRect(point.x + 8, point.y + 9, obstacle.w, obstacle.h);
      if (obstacle.kind === "shop") {
        ctx.fillStyle = "#473f34";
        ctx.fillRect(point.x, point.y + 10, obstacle.w, obstacle.h - 10);
        ctx.fillStyle = "#2e2b27";
        ctx.fillRect(point.x - 8, point.y, obstacle.w + 16, 13);
        ctx.fillStyle = "#8a4937";
        ctx.fillRect(point.x - 5, point.y + 13, obstacle.w + 10, 12);
        ctx.fillStyle = "#d3b56f";
        for (let stripe = 8; stripe < obstacle.w; stripe += 22) ctx.fillRect(point.x + stripe, point.y + 13, 9, 12);
        ctx.fillStyle = "#20282a";
        ctx.fillRect(point.x + 16, point.y + 40, Math.max(34, obstacle.w * 0.28), 31);
        ctx.fillRect(point.x + obstacle.w - 16 - Math.max(34, obstacle.w * 0.28), point.y + 40, Math.max(34, obstacle.w * 0.28), 31);
        ctx.fillStyle = "#2a2925";
        ctx.fillRect(point.x + obstacle.w / 2 - 15, point.y + 35, 30, obstacle.h - 35);
        ctx.fillStyle = "#b77b43";
        ctx.fillRect(point.x + obstacle.w / 2 - 2, point.y + 38, 4, obstacle.h - 41);
        if (this.qualityLevel > 0) this.text(obstacle.sign || "SHOP", point.x + obstacle.w / 2, point.y + 7, 9, PALETTE.cream, "center", "bold");
      } else if (obstacle.kind === "warehouse") {
        ctx.fillStyle = "#474841";
        ctx.fillRect(point.x, point.y + 12, obstacle.w, obstacle.h - 12);
        ctx.fillStyle = "#252927";
        ctx.fillRect(point.x - 7, point.y, obstacle.w + 14, 14);
        ctx.fillStyle = "#665443";
        ctx.fillRect(point.x + 14, point.y + 30, obstacle.w - 28, obstacle.h - 45);
        ctx.fillStyle = "#292c29";
        for (let slat = 0; slat < 6; slat += 1) ctx.fillRect(point.x + 20, point.y + 38 + slat * 9, obstacle.w - 40, 3);
        ctx.fillStyle = "#a85c3d";
        ctx.fillRect(point.x + 9, point.y + 19, obstacle.w - 18, 5);
        if (this.qualityLevel > 0) this.text(obstacle.sign || "DEPOT", point.x + obstacle.w / 2, point.y + 7, 8, PALETTE.cream, "center", "bold");
      } else if (obstacle.kind === "bus") {
        ctx.fillStyle = "#624337";
        ctx.fillRect(point.x, point.y + 7, obstacle.w, obstacle.h - 13);
        ctx.fillStyle = "#24292a";
        ctx.fillRect(point.x + 14, point.y + 12, obstacle.w - 38, 19);
        for (let window = 0; window < 5; window += 1) {
          ctx.fillStyle = window % 2 ? "#40565a" : "#334548";
          ctx.fillRect(point.x + 21 + window * 28, point.y + 14, 20, 13);
        }
        ctx.fillStyle = "#252624";
        ctx.fillRect(point.x + 22, point.y + obstacle.h - 6, 24, 10);
        ctx.fillRect(point.x + obstacle.w - 48, point.y + obstacle.h - 6, 24, 10);
        ctx.fillStyle = "#c28c49";
        ctx.fillRect(point.x + 7, point.y + 35, obstacle.w - 14, 4);
      } else if (obstacle.kind === "railcar") {
        ctx.fillStyle = "#4e3f34";
        ctx.fillRect(point.x, point.y + 12, obstacle.w, obstacle.h - 20);
        ctx.fillStyle = "#242727";
        ctx.fillRect(point.x - 6, point.y + obstacle.h - 12, obstacle.w + 12, 7);
        ctx.fillStyle = "#7c5039";
        ctx.fillRect(point.x + 7, point.y + 18, obstacle.w - 14, obstacle.h - 38);
        ctx.fillStyle = "#2b2f2d";
        for (let panel = 0; panel < 4; panel += 1) ctx.fillRect(point.x + 12 + panel * (obstacle.w - 24) / 4, point.y + 22, 3, obstacle.h - 46);
        ctx.fillStyle = "#1f2221";
        ctx.fillRect(point.x + 17, point.y + obstacle.h - 10, 19, 8);
        ctx.fillRect(point.x + obstacle.w - 36, point.y + obstacle.h - 10, 19, 8);
      } else if (obstacle.kind === "container") {
        ctx.fillStyle = "#3a4644";
        ctx.fillRect(point.x, point.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#6d7e75";
        for (let rib = 8; rib < obstacle.w; rib += 12) ctx.fillRect(point.x + rib, point.y + 5, 3, obstacle.h - 10);
        ctx.fillStyle = "#8f4c35";
        ctx.fillRect(point.x + 5, point.y + 7, obstacle.w - 10, 4);
        ctx.fillStyle = "#272b29";
        ctx.fillRect(point.x + 7, point.y + obstacle.h - 6, obstacle.w - 14, 4);
      } else if (obstacle.kind === "car" || obstacle.kind === "wreck") {
        ctx.fillStyle = obstacle.kind === "car" ? "#6c3c31" : "#4e4840";
        ctx.fillRect(point.x, point.y + 6, obstacle.w, obstacle.h - 12);
        ctx.fillStyle = "#202120";
        ctx.fillRect(point.x + 14, point.y + obstacle.h - 8, 24, 12);
        ctx.fillRect(point.x + obstacle.w - 38, point.y + obstacle.h - 8, 24, 12);
        ctx.fillStyle = "#292b2b";
        ctx.fillRect(point.x + 22, point.y + 1, obstacle.w - 44, obstacle.h - 2);
        ctx.fillStyle = obstacle.kind === "car" ? "#4e6768" : "#353a39";
        ctx.fillRect(point.x + 28, point.y + 5, Math.max(12, obstacle.w * 0.28), obstacle.h - 16);
        ctx.fillRect(point.x + obstacle.w * 0.58, point.y + 5, Math.max(12, obstacle.w * 0.2), obstacle.h - 16);
        ctx.fillStyle = "rgba(231,216,173,0.2)";
        ctx.fillRect(point.x + obstacle.w * 0.49, point.y + 8, 3, obstacle.h - 21);
        ctx.fillStyle = "#b8864e";
        ctx.fillRect(point.x + 8, point.y + 13, 9, 5);
        ctx.fillStyle = "#3d2b25";
        ctx.fillRect(point.x + obstacle.w - 17, point.y + obstacle.h - 18, 11, 4);
      } else if (obstacle.kind === "station") {
        ctx.fillStyle = "#4e4538";
        ctx.fillRect(point.x, point.y, obstacle.w, obstacle.h);
        ctx.fillStyle = PALETTE.rustDark;
        ctx.fillRect(point.x - 7, point.y, obstacle.w + 14, 10);
        ctx.fillStyle = "#252725";
        ctx.fillRect(point.x + 18, point.y + 23, 32, obstacle.h - 23);
        ctx.fillRect(point.x + 82, point.y + 19, 48, 28);
        ctx.fillStyle = "#8d754c";
        ctx.fillRect(point.x + 77, point.y + 15, 58, 5);
        ctx.fillStyle = "#201f1c";
        for (let slat = 0; slat < 4; slat += 1) ctx.fillRect(point.x + 84, point.y + 24 + slat * 6, 44, 2);
        if (this.qualityLevel > 0) this.text(obstacle.sign || "SERVICE 06", point.x + obstacle.w / 2, point.y + 8, 8, PALETTE.cream, "center", "bold");
      } else if (obstacle.kind === "fence") {
        ctx.fillStyle = "rgba(57,57,52,0.72)";
        ctx.fillRect(point.x, point.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#8b846f";
        ctx.fillRect(point.x, point.y, 5, obstacle.h);
        ctx.fillRect(point.x + obstacle.w - 5, point.y, 5, obstacle.h);
        for (let offset = 8; offset < obstacle.h; offset += 20) ctx.fillRect(point.x, point.y + offset, obstacle.w, 3);
        if (this.qualityLevel > 0) {
          ctx.strokeStyle = "rgba(167,154,128,0.48)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let offset = -obstacle.h; offset < obstacle.w + obstacle.h; offset += 18) {
            ctx.moveTo(point.x + offset, point.y);
            ctx.lineTo(point.x + offset + obstacle.h, point.y + obstacle.h);
            ctx.moveTo(point.x + offset, point.y + obstacle.h);
            ctx.lineTo(point.x + offset + obstacle.h, point.y);
          }
          ctx.stroke();
        }
      } else if (obstacle.kind === "scrap") {
        ctx.fillStyle = "#413d37";
        ctx.fillRect(point.x, point.y + obstacle.h * 0.35, obstacle.w, obstacle.h * 0.65);
        ctx.fillStyle = "#6f583d";
        ctx.fillRect(point.x + 9, point.y + 18, obstacle.w * 0.48, 18);
        ctx.fillStyle = "#6a332c";
        ctx.fillRect(point.x + obstacle.w * 0.52, point.y + 8, obstacle.w * 0.3, obstacle.h * 0.48);
        ctx.fillStyle = "#858076";
        ctx.fillRect(point.x + 16, point.y + obstacle.h * 0.6, obstacle.w - 27, 6);
        ctx.fillRect(point.x + obstacle.w * 0.42, point.y + 3, 5, obstacle.h * 0.72);
      } else if (obstacle.kind === "sign") {
        ctx.fillStyle = "#3f3d37";
        ctx.fillRect(point.x + 11, point.y + 48, 8, obstacle.h - 48);
        ctx.fillRect(point.x + obstacle.w - 19, point.y + 48, 8, obstacle.h - 48);
        ctx.fillStyle = "#66523c";
        ctx.fillRect(point.x, point.y + 5, obstacle.w, 48);
        ctx.strokeStyle = "#a67a49";
        ctx.lineWidth = 3;
        ctx.strokeRect(point.x + 3, point.y + 8, obstacle.w - 6, 42);
        ctx.fillStyle = PALETTE.rust;
        ctx.fillRect(point.x + 10, point.y + 15, obstacle.w - 20, 5);
        this.text("EVAC 03", point.x + obstacle.w / 2, point.y + 35, 10, PALETTE.cream, "center", "bold");
      } else {
        ctx.fillStyle = "#4d463a";
        ctx.fillRect(point.x, point.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#796143";
        ctx.fillRect(point.x + 8, point.y + 8, Math.max(4, obstacle.w - 16), 7);
      }
    }
  }
};

module.exports = { OBSTACLE_METHODS };

