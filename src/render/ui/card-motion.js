"use strict";

function pointInCard(shape, x, y) {
  const dx = x - shape.cx, dy = y - shape.cy;
  const cosine = Math.cos(shape.angle), sine = Math.sin(shape.angle);
  const localX = (dx * cosine + dy * sine) / shape.scale;
  const localY = (-dx * sine + dy * cosine) / shape.scale;
  return Math.abs(localX) <= shape.w / 2 && Math.abs(localY) <= shape.h / 2;
}

function cardBounds(shape) {
  const cosine = Math.abs(Math.cos(shape.angle)), sine = Math.abs(Math.sin(shape.angle));
  const w = (shape.w * cosine + shape.h * sine) * shape.scale;
  const h = (shape.w * sine + shape.h * cosine) * shape.scale;
  return { x: shape.cx - w / 2, y: shape.cy - h / 2, w, h };
}

module.exports = { pointInCard, cardBounds };
