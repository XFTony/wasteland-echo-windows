"use strict";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceSq = (ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

function normalize(x, y, fallbackX = 0, fallbackY = 0) {
  const length = Math.hypot(x, y);
  if (length < 0.0001) return { x: fallbackX, y: fallbackY, length: 0 };
  return { x: x / length, y: y / length, length };
}

function circleRectPushOut(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  let dx = circle.x - nearestX;
  let dy = circle.y - nearestY;
  let distance = Math.hypot(dx, dy);
  if (distance >= circle.radius) return false;

  if (distance < 0.0001) {
    const left = Math.abs(circle.x - rect.x);
    const right = Math.abs(rect.x + rect.w - circle.x);
    const top = Math.abs(circle.y - rect.y);
    const bottom = Math.abs(rect.y + rect.h - circle.y);
    const edge = Math.min(left, right, top, bottom);
    if (edge === left) {
      circle.x = rect.x - circle.radius;
    } else if (edge === right) {
      circle.x = rect.x + rect.w + circle.radius;
    } else if (edge === top) {
      circle.y = rect.y - circle.radius;
    } else {
      circle.y = rect.y + rect.h + circle.radius;
    }
    return true;
  }

  const overlap = circle.radius - distance;
  const inverseDistance = 1 / distance;
  circle.x += dx * inverseDistance * overlap;
  circle.y += dy * inverseDistance * overlap;
  return true;
}

module.exports = { clamp, distanceSq, normalize, circleRectPushOut };
