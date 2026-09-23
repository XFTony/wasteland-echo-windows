"use strict";

function readyImage(renderer, id) {
  const store = renderer.artStore;
  if (!store || !store.ready(id)) return null;
  return store.get(id);
}

function withImageState(renderer, alpha, callback) {
  const ctx = renderer.ctx;
  const priorSmoothing = ctx.imageSmoothingEnabled;
  ctx.save();
  ctx.globalAlpha *= Number.isFinite(alpha) ? alpha : 1;
  ctx.imageSmoothingEnabled = true;
  callback(ctx);
  ctx.restore();
  ctx.imageSmoothingEnabled = priorSmoothing;
}

function drawAssetContain(renderer, id, x, y, w, h, options = {}) {
  const image = readyImage(renderer, id);
  if (!image || typeof renderer.ctx.drawImage !== "function") return null;
  const padding = Math.max(0, Number(options.padding) || 0);
  const areaW = Math.max(1, w - padding * 2);
  const areaH = Math.max(1, h - padding * 2);
  const scale = Math.min(areaW / image.naturalWidth, areaH / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const alignX = Number.isFinite(options.alignX) ? options.alignX : 0.5;
  const alignY = Number.isFinite(options.alignY) ? options.alignY : 0.5;
  const drawX = x + padding + (areaW - drawW) * alignX;
  const drawY = y + padding + (areaH - drawH) * alignY;
  withImageState(renderer, options.alpha, (ctx) => ctx.drawImage(image, drawX, drawY, drawW, drawH));
  return { x: drawX, y: drawY, w: drawW, h: drawH };
}

function drawAssetCover(renderer, id, x, y, w, h, options = {}) {
  const image = readyImage(renderer, id);
  if (!image || typeof renderer.ctx.drawImage !== "function") return null;
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sourceW = w / scale;
  const sourceH = h / scale;
  const focalX = Number.isFinite(options.focalX) ? options.focalX : 0.5;
  const focalY = Number.isFinite(options.focalY) ? options.focalY : 0.5;
  const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceW, (image.naturalWidth - sourceW) * focalX));
  const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceH, (image.naturalHeight - sourceH) * focalY));
  withImageState(renderer, options.alpha, (ctx) => ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, x, y, w, h));
  return { x, y, w, h };
}

function drawNineSlice(renderer, id, x, y, w, h, options = {}) {
  const image = readyImage(renderer, id);
  if (!image || typeof renderer.ctx.drawImage !== "function") return false;
  const definition = renderer.artStore.definition(id);
  const configured = definition && definition.nineSlice ? definition.nineSlice : {};
  let sourceLeft = Math.min(image.naturalWidth / 2, Number(options.left ?? configured.left) || 0);
  let sourceRight = Math.min(image.naturalWidth / 2, Number(options.right ?? configured.right) || 0);
  let sourceTop = Math.min(image.naturalHeight / 2, Number(options.top ?? configured.top) || 0);
  let sourceBottom = Math.min(image.naturalHeight / 2, Number(options.bottom ?? configured.bottom) || 0);
  // Corners are one physical object. Scale both axes by the same factor and
  // stretch only the center bands so generated rivets and clamps never squash.
  const borderScale = Math.min(
    1,
    (w * 0.8) / Math.max(1, sourceLeft + sourceRight),
    (h * 0.8) / Math.max(1, sourceTop + sourceBottom)
  );
  const targetLeft = sourceLeft * borderScale;
  const targetRight = sourceRight * borderScale;
  const targetTop = sourceTop * borderScale;
  const targetBottom = sourceBottom * borderScale;
  const sourceCenterW = Math.max(1, image.naturalWidth - sourceLeft - sourceRight);
  const sourceCenterH = Math.max(1, image.naturalHeight - sourceTop - sourceBottom);
  const targetCenterW = Math.max(0, w - targetLeft - targetRight);
  const targetCenterH = Math.max(0, h - targetTop - targetBottom);
  const sx = [0, sourceLeft, sourceLeft + sourceCenterW];
  const sy = [0, sourceTop, sourceTop + sourceCenterH];
  const sw = [sourceLeft, sourceCenterW, sourceRight];
  const sh = [sourceTop, sourceCenterH, sourceBottom];
  const dx = [x, x + targetLeft, x + targetLeft + targetCenterW];
  const dy = [y, y + targetTop, y + targetTop + targetCenterH];
  const dw = [targetLeft, targetCenterW, targetRight];
  const dh = [targetTop, targetCenterH, targetBottom];
  withImageState(renderer, options.alpha, (ctx) => {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        if (sw[column] <= 0 || sh[row] <= 0 || dw[column] <= 0 || dh[row] <= 0) continue;
        ctx.drawImage(image, sx[column], sy[row], sw[column], sh[row], dx[column], dy[row], dw[column], dh[row]);
      }
    }
  });
  return true;
}

module.exports = { drawAssetContain, drawAssetCover, drawNineSlice, readyImage };
