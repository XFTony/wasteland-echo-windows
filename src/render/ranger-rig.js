"use strict";

const { rangerMotionFrame } = require("./ranger-motion");

const CELL = 128;
const PAINTED_LENGTH = 112;

// Stable slots for the ranger atlas. Future outfit and armor art can replace a
// slot while keeping these joints and animation curves.
const PART = Object.freeze({
  torso: 0,
  upperArmLeft: 1,
  upperArmRight: 2,
  forearmLeft: 3,
  forearmRight: 4,
  thighLeft: 5,
  thighRight: 6,
  shinLeft: 7,
  shinRight: 8,
  bootLeft: 9,
  bootRight: 10
});

const EQUIPMENT_SLOTS = Object.freeze({
  helmet: Object.freeze(["torso"]),
  chest: Object.freeze(["torso", "upperArmLeft", "upperArmRight"]),
  legs: Object.freeze(["thighLeft", "thighRight", "shinLeft", "shinRight"]),
  boots: Object.freeze(["bootLeft", "bootRight"])
});

const RIG_ANCHORS = Object.freeze({
  head: Object.freeze({ x: 0, y: -60 }),
  shoulderLeft: Object.freeze({ x: -13, y: -51 }),
  shoulderRight: Object.freeze({ x: 13, y: -51 }),
  hipLeft: Object.freeze({ x: -6, y: -33 }),
  hipRight: Object.freeze({ x: 6, y: -33 }),
  weaponGrip: Object.freeze({ x: 0, y: -31 })
});

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function drawSegment(ctx, atlas, part, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const scale = Math.hypot(dx, dy) / PAINTED_LENGTH;
  const sourceX = (part % 4) * CELL;
  const sourceY = Math.floor(part / 4) * CELL;
  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  ctx.drawImage(atlas, sourceX, sourceY, CELL, CELL,
    -CELL * 0.5 * scale, -8 * scale, CELL * scale, CELL * scale);
  ctx.restore();
}

function solveTwoBone(root, target, upperLength, lowerLength, bend) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reachable = clamp(distance, Math.abs(upperLength - lowerLength) + 0.001, upperLength + lowerLength - 0.001);
  const baseAngle = Math.atan2(dy, dx);
  const cosine = clamp((upperLength * upperLength + reachable * reachable - lowerLength * lowerLength)
    / (2 * upperLength * reachable), -1, 1);
  const angle = baseAngle + bend * Math.acos(cosine);
  return { x: root.x + Math.cos(angle) * upperLength, y: root.y + Math.sin(angle) * upperLength };
}

function footTarget(side, motion) {
  const baseX = side * 7;
  const baseY = -5;
  if (motion.blend < 0.001) return { x: baseX, y: baseY, lift: 0 };
  const phase = (motion.phase + (side > 0 ? 0.5 : 0)) % 1;
  const stance = 0.62;
  const halfStride = clamp(7 + motion.speedRatio * 3, 7, 11);
  let along;
  let lift = 0;
  if (phase < stance) {
    along = halfStride * (1 - 2 * phase / stance);
  } else {
    const progress = (phase - stance) / (1 - stance);
    const ease = progress * progress * (3 - 2 * progress);
    along = halfStride * (-1 + 2 * ease);
    lift = Math.sin(progress * Math.PI) * 6;
  }
  return {
    x: baseX + motion.directionX * along * motion.blend,
    y: baseY + motion.directionY * along * 0.45 * motion.blend - lift * motion.blend,
    lift: lift * motion.blend
  };
}

function rotatedOffset(x, y, angle) {
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}

function weaponSupportOffset(gunWidth) {
  return gunWidth <= 40 ? 4 : Math.min(12, gunWidth * 0.22);
}

function drawRangerRig(renderer, player, run, position, atlas, weapon, gunWidth, grip, flicker) {
  const ctx = renderer.ctx;
  const motion = rangerMotionFrame(renderer, run, player);
  const facing = player.lastAimX < -0.2 ? -1 : 1;
  const localMotion = { ...motion, directionX: motion.directionX * facing };
  const lift = motion.bob;
  const aimAngle = Math.atan2(player.lastAimY, player.lastAimX * facing);
  const gunY = RIG_ANCHORS.weaponGrip.y - lift * 0.7;
  const supportOffset = weaponSupportOffset(gunWidth);
  const support = rotatedOffset(supportOffset, -1, aimAngle);
  const leftHand = { x: support.x, y: gunY + support.y };
  const rightHand = { x: 0, y: gunY };

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.scale(facing, 1);
  ctx.globalAlpha *= flicker ? 0.48 : 1;
  ctx.imageSmoothingEnabled = true;

  for (const side of [-1, 1]) {
    const foot = footTarget(side, localMotion);
    const hipAnchor = side < 0 ? RIG_ANCHORS.hipLeft : RIG_ANCHORS.hipRight;
    const hip = { x: hipAnchor.x, y: hipAnchor.y - lift };
    const ankle = { x: foot.x, y: foot.y };
    const knee = solveTwoBone(hip, ankle, 17, 18, side);
    const thigh = side < 0 ? PART.thighLeft : PART.thighRight;
    const shin = side < 0 ? PART.shinLeft : PART.shinRight;
    const boot = side < 0 ? PART.bootLeft : PART.bootRight;
    drawSegment(ctx, atlas, thigh, hip, knee);
    drawSegment(ctx, atlas, shin, knee, ankle);
    drawSegment(ctx, atlas, boot, ankle, { x: ankle.x + localMotion.directionX * motion.blend * 2, y: ankle.y + 11 });
  }

  const torsoScale = 50 / PAINTED_LENGTH;
  ctx.drawImage(atlas, 0, 0, CELL, CELL,
    -CELL * 0.5 * torsoScale, -70 - lift - 8 * torsoScale,
    CELL * torsoScale, CELL * torsoScale);

  const leftShoulder = { x: RIG_ANCHORS.shoulderLeft.x, y: RIG_ANCHORS.shoulderLeft.y - lift };
  const rightShoulder = { x: RIG_ANCHORS.shoulderRight.x, y: RIG_ANCHORS.shoulderRight.y - lift };
  const leftElbow = solveTwoBone(leftShoulder, leftHand, 18, 19, 1);
  const rightElbow = solveTwoBone(rightShoulder, rightHand, 18, 19, -1);
  drawSegment(ctx, atlas, PART.upperArmLeft, leftShoulder, leftElbow);
  drawSegment(ctx, atlas, PART.upperArmRight, rightShoulder, rightElbow);

  ctx.save();
  ctx.translate(0, gunY);
  ctx.rotate(aimAngle);
  if (player.lastAimX * facing < 0) ctx.scale(1, -1);
  const gunHeight = gunWidth * weapon.naturalHeight / weapon.naturalWidth;
  ctx.drawImage(weapon, -gunWidth * grip, -gunHeight * 0.43, gunWidth, gunHeight);
  ctx.restore();

  drawSegment(ctx, atlas, PART.forearmLeft, leftElbow, leftHand);
  drawSegment(ctx, atlas, PART.forearmRight, rightElbow, rightHand);
  ctx.restore();
  return true;
}

module.exports = { PART, EQUIPMENT_SLOTS, RIG_ANCHORS, solveTwoBone, footTarget, weaponSupportOffset, drawRangerRig };
