"use strict";

const { clamp } = require("../core/math");

function drawPaintedGround(renderer, texture, worldSize, opacity = null) {
  const { ctx, camera } = renderer;
  const tileSize = 768;
  const width = renderer.visibleWorldWidth || renderer.width;
  const height = renderer.visibleWorldHeight || renderer.height;
  const startColumn = Math.floor(camera.x / tileSize);
  const startRow = Math.floor(camera.y / tileSize);
  const endColumn = Math.ceil(Math.min(worldSize, camera.x + width) / tileSize);
  const endRow = Math.ceil(Math.min(worldSize, camera.y + height) / tileSize);
  ctx.save();
  ctx.globalAlpha = Number.isFinite(opacity) ? opacity : renderer.qualityLevel === 0 ? 0.30 : 0.48;
  ctx.imageSmoothingEnabled = true;
  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      const flipX = column % 2 === 1;
      const flipY = row % 2 === 1;
      const x = column * tileSize - camera.x;
      const y = row * tileSize - camera.y;
      ctx.save();
      ctx.translate(x + (flipX ? tileSize : 0), y + (flipY ? tileSize : 0));
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(texture, 0, 0, tileSize, tileSize);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawVisibleGroundTexture(renderer, worldSize) {
  const { ctx, groundTexture: texture, camera } = renderer;
  if (!texture || !texture.complete || !texture.naturalWidth || !texture.naturalHeight || typeof ctx.drawImage !== "function") return;
  if (renderer.paintedGround) {
    drawPaintedGround(renderer, texture, worldSize);
    return;
  }
  const width = renderer.visibleWorldWidth || renderer.width;
  const height = renderer.visibleWorldHeight || renderer.height;
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

module.exports = { drawVisibleGroundTexture, drawPaintedGround };
