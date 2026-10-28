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

module.exports = { segmentCircleTime };
