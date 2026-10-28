"use strict";

function segmentCircleTime(x, y, dx, dy, cx, cy, radius) {
  const ox = x - cx, oy = y - cy, a = dx * dx + dy * dy;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  if (a < 1e-10) return Infinity;
  const b = ox * dx + oy * dy, discriminant = b * b - a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : Infinity;
}

function segmentRectTime(x, y, dx, dy, rect, padding = 0) {
  let low = 0, high = 1;
  for (let axis = 0; axis < 2; axis++) {
    const start = axis === 0 ? x : y, delta = axis === 0 ? dx : dy;
    const minimum = (axis === 0 ? rect.x : rect.y) - padding;
    const maximum = minimum + (axis === 0 ? rect.w : rect.h) + padding * 2;
    if (Math.abs(delta) < 1e-10) { if (start < minimum || start > maximum) return Infinity; }
    else {
      const a = (minimum - start) / delta, b = (maximum - start) / delta;
      low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
      if (low > high) return Infinity;
    }
  }
  return low;
}

function firstObstacleTime(obstacles, x, y, dx, dy, padding = 0, skipInteractiveBodies = false) {
  let first = Infinity;
  for (const obstacle of obstacles) {
    if (skipInteractiveBodies && obstacle.interactiveId && (skipInteractiveBodies !== "aim" || !obstacle.blocksAim)) continue;
    first = Math.min(first, segmentRectTime(x, y, dx, dy, obstacle, padding));
  }
  return first;
}

module.exports = { segmentCircleTime, segmentRectTime, firstObstacleTime };
