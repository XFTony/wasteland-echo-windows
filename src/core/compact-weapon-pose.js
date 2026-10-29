"use strict";

const Motion = require("../shared/compact-ranger-motion");
const Grip = require("../shared/modular-grip-compositor");
const { HERO, MATERIALS } = require("../content/active-compact-actors");

const DEFINITIONS = Grip.definitionsForCharacter(MATERIALS);
const RIGS = Object.fromEntries(DEFINITIONS.map(w => [w.id, w.rig]));

function usesCompactPlayer(player) {
  return Boolean(player && player.heroId === HERO.heroId && player.skinId === HERO.skinId && RIGS[player.weaponId]);
}

function compactPoseState(player, aimX = player.lastAimX, aimY = player.lastAimY) {
  if (!usesCompactPlayer(player)) return null;
  const state = {
    x: player.x, y: player.y, pixelScale: HERO.pixelScale,
    config: { body: HERO.body, weapon: RIGS[player.weaponId] },
    phase: 0, walking: false, paused: false, recoil: 0,
    facing: player.compactFacing || 1, depth: player.compactDepth || "front"
  };
  Motion.setAimAngle(state, Math.atan2(aimY, aimX));
  return state;
}

function compactAimAt(player, target) {
  const state = compactPoseState(player);
  if (!state) return null;
  Motion.aimAt(state, target.x, target.y);
  player.compactFacing = state.facing;
  player.compactDepth = state.depth;
  return { x: Math.cos(state.angle), y: Math.sin(state.angle) };
}

function compactShotPose(player, aimX, aimY) {
  const state = compactPoseState(player, aimX, aimY);
  if (!state) return null;
  return Motion.pose(state).weapon;
}

module.exports = { DEFINITIONS, usesCompactPlayer, compactPoseState, compactAimAt, compactShotPose };
