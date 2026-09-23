"use strict";

const { clamp } = require("../core/math");

function drawVisibleGroundTexture(renderer, worldSize) {
  const { ctx, groundTexture: texture, camera, width, height } = renderer;
  if (!texture || !texture.complete || !texture.naturalWidth || !texture.naturalHeight || typeof ctx.drawImage !== "function") return;
  const sourceX = clamp(camera.x / worldSize * texture.naturalWidth, 0, texture.naturalWidth);
  const sourceY = clamp(camera.y / worldSize * texture.naturalHeight, 0, texture.naturalHeight);
  const visibleWidth = Math.max(0, Math.min(width, worldSize - camera.x));
  const visibleHeight = Math.max(0, Math.min(height, worldSize - camera.y));
  if (!(visibleWidth > 0 && visibleHeight > 0)) return;
  const sourceWidth = visibleWidth / worldSize * texture.naturalWidth;
  const sourceHeight = visibleHeight / worldSize * texture.naturalHeight;
  ctx.save();
  ctx.globalAlpha = renderer.qualityLevel === 2 ? 0.16 : 0.08;
  ctx.drawImage(texture, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, visibleWidth, visibleHeight);
  ctx.restore();
}

module.exports = { drawVisibleGroundTexture };
