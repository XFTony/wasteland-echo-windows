/* Offline compact-character motion study. No game-model or save dependencies. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CompactRangerMotion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TAU = Math.PI * 2;
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function createState(options = {}) {
    const pixelScale = Math.max(.25, finite(options.pixelScale, 2));
    const world = options.world || {};
    const body = Object.assign({ width: 64, height: 64, root: [32, 56], columns: 9,
      idleFrame: 0, walkFrames: [1, 2, 3, 4, 5, 6, 7, 8] }, options.body);
    const weapon = Object.assign({ width: 36, height: 20, pivot: [9, 6], muzzle: [33, 6],
      chestY: -16, aimOffsetX: 3, upShoulder: 12, upLift: 8, recoil: 2.5 }, options.weapon);
    const state = {
      x: finite(options.x, 160), y: finite(options.y, 200),
      speed: Math.max(0, finite(options.speed, 150)),
      radius: Math.max(1, finite(options.radius, 10)), pixelScale,
      world: { width: Math.max(32, finite(world.width, 960)), height: Math.max(32, finite(world.height, 540)),
        boxes: (world.boxes || []).map(box => ({ x: box.x, y: box.y, w: box.w, h: box.h })) },
      config: { body, weapon, strideLength: Math.max(1, finite(options.strideLength, 34 * pixelScale)),
        shotInterval: Math.max(.05, finite(options.shotInterval, .28)),
        bulletSpeed: Math.max(1, finite(options.bulletSpeed, 420)),
        bulletLife: Math.max(.1, finite(options.bulletLife, 1.6)) },
      phase: 0, distance: 0, elapsed: 0, angle: 0, facing: 1, depth: "front",
      walking: false, paused: false, recoil: 0, flash: 0, fireCooldown: 0,
      lastDx: 0, lastDy: 0, shotsFired: 0, hits: 0,
      bullets: [], impacts: [], events: [], lastShot: null,
      targets: (options.targets || []).map((target, index) => ({
        id: target.id == null ? index : target.id, x: target.x, y: target.y,
        radius: Math.max(1, finite(target.radius, finite(target.r, 12))),
        hp: Math.max(1, finite(target.hp, 5)), maxHp: Math.max(1, finite(target.hp, 5)), hitFlash: 0
      }))
    };
    state.x = clamp(state.x, state.radius, state.world.width - state.radius);
    state.y = clamp(state.y, state.radius, state.world.height - state.radius);
    setAimAngle(state, finite(options.angle, 0));
    return state;
  }

  function setAimAngle(state, radians) {
    if (!Number.isFinite(radians)) return state;
    state.angle = Math.atan2(Math.sin(radians), Math.cos(radians));
    const x = Math.cos(state.angle), y = Math.sin(state.angle);
    if (x > .15) state.facing = 1;
    else if (x < -.15) state.facing = -1;
    if (y < -.18) state.depth = "back";
    else if (y > .18) state.depth = "front";
    return state;
  }

  function weaponPoint(weapon, x, y) {
    const localX = (x - weapon.pivot[0]) * weapon.scale;
    const localY = (y - weapon.pivot[1]) * weapon.scale * weapon.mirrorY;
    const cosine = Math.cos(weapon.angle), sine = Math.sin(weapon.angle);
    return { x: weapon.anchorX + cosine * localX - sine * localY,
      y: weapon.anchorY + sine * localX + cosine * localY };
  }

  function aimAt(state, targetX, targetY) {
    const config = state.config.weapon, scale = state.pixelScale;
    // The aiming ray starts at the moving grip, rather than the actor's feet.
    // Shoulder offsets therefore cannot make shots run parallel to the cursor.
    let angle = Math.atan2(targetY - state.y - config.chestY * scale, targetX - state.x);
    for (let index = 0; index < 12; index++) {
      const up = Math.max(0, -Math.sin(angle));
      const x = state.x + (config.aimOffsetX * Math.cos(angle) + config.upShoulder * up ** 3) * scale;
      const y = state.y + (config.chestY - config.upLift * up) * scale;
      if (Math.hypot(targetX - x, targetY - y) < 2 * scale) break;
      angle = Math.atan2(targetY - y, targetX - x);
    }
    return setAimAngle(state, angle);
  }

  function pose(state) {
    const config = state.config, scale = state.pixelScale;
    const x = Math.cos(state.angle), y = Math.sin(state.angle), up = Math.max(0, -y);
    const frameIndex = Math.floor((state.phase % 1) * config.body.walkFrames.length);
    // Continuous angle-based shoulder offset: no +/- shoulder jump when facing flips.
    // Raising the upward grip a little exposes the muzzle above the large hood.
    const offsetX = config.weapon.aimOffsetX * x + config.weapon.upShoulder * up * up * up;
    const offsetY = config.weapon.chestY - config.weapon.upLift * up;
    const recoil = state.recoil * config.weapon.recoil * scale;
    const weapon = {
      anchorX: state.x + offsetX * scale - x * recoil,
      anchorY: state.y + offsetY * scale - y * recoil,
      angle: state.angle, mirrorY: state.facing, scale,
      width: config.weapon.width, height: config.weapon.height,
      pivot: config.weapon.pivot.slice(), muzzle: config.weapon.muzzle.slice()
    };
    const muzzle = weaponPoint(weapon, weapon.muzzle[0], weapon.muzzle[1]);
    weapon.muzzleX = muzzle.x; weapon.muzzleY = muzzle.y;
    return { x: state.x, y: state.y, phase: state.phase, facing: state.facing, depth: state.depth,
      bodyFrame: state.walking ? config.body.walkFrames[frameIndex] : config.body.idleFrame,
      weapon, walking: state.walking, paused: state.paused };
  }

  function move(state, dx, dy) {
    const radius = state.radius, world = state.world;
    const previousX = state.x, previousY = state.y;
    let x = clamp(previousX + dx, radius, world.width - radius);
    for (const box of world.boxes) {
      if (!(previousY > box.y - radius && previousY < box.y + box.h + radius)) continue;
      if (dx > 0 && previousX <= box.x - radius && x > box.x - radius) x = box.x - radius;
      if (dx < 0 && previousX >= box.x + box.w + radius && x < box.x + box.w + radius) x = box.x + box.w + radius;
    }
    let y = clamp(previousY + dy, radius, world.height - radius);
    for (const box of world.boxes) {
      if (!(x > box.x - radius && x < box.x + box.w + radius)) continue;
      if (dy > 0 && previousY <= box.y - radius && y > box.y - radius) y = box.y - radius;
      if (dy < 0 && previousY >= box.y + box.h + radius && y < box.y + box.h + radius) y = box.y + box.h + radius;
    }
    state.x = x; state.y = y;
    state.lastDx = x - previousX; state.lastDy = y - previousY;
    const distance = Math.hypot(state.lastDx, state.lastDy);
    state.walking = distance > 1e-7;
    if (state.walking) {
      state.distance += distance;
      state.phase = (state.phase + distance / state.config.strideLength) % 1;
    }
  }

  function segmentBox(x, y, dx, dy, box) {
    let low = 0, high = 1;
    for (const [origin, delta, minimum, maximum] of [[x, dx, box.x, box.x + box.w], [y, dy, box.y, box.y + box.h]]) {
      if (Math.abs(delta) < 1e-10) {
        if (origin < minimum || origin > maximum) return null;
      } else {
        const first = (minimum - origin) / delta, second = (maximum - origin) / delta;
        low = Math.max(low, Math.min(first, second)); high = Math.min(high, Math.max(first, second));
        if (low > high) return null;
      }
    }
    return low;
  }

  function segmentCircle(x, y, dx, dy, target) {
    const ox = x - target.x, oy = y - target.y;
    const a = dx * dx + dy * dy, c = ox * ox + oy * oy - target.radius * target.radius;
    if (c <= 0) return 0;
    if (a < 1e-10) return null;
    const b = 2 * (ox * dx + oy * dy), discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }

  function updateBullets(state, dt) {
    const remaining = [];
    for (const bullet of state.bullets) {
      bullet.prevX = bullet.x; bullet.prevY = bullet.y;
      const dx = bullet.vx * dt, dy = bullet.vy * dt;
      let first = Infinity, targetHit = null;
      for (const box of state.world.boxes) {
        const t = segmentBox(bullet.x, bullet.y, dx, dy, box);
        if (t !== null && t < first) { first = t; targetHit = null; }
      }
      for (const target of state.targets) {
        if (target.hp <= 0) continue;
        const t = segmentCircle(bullet.x, bullet.y, dx, dy, target);
        if (t !== null && t < first) { first = t; targetHit = target; }
      }
      if (first !== Infinity) {
        const x = bullet.x + dx * first, y = bullet.y + dy * first;
        state.impacts.push({ x, y, life: .18, target: Boolean(targetHit) });
        if (targetHit) {
          targetHit.hp = Math.max(0, targetHit.hp - 1); targetHit.hitFlash = .14; state.hits++;
          state.events.push({ type: "hit", targetId: targetHit.id, x, y });
        }
        continue;
      }
      bullet.x += dx; bullet.y += dy; bullet.life -= dt;
      if (bullet.life > 0 && bullet.x >= 0 && bullet.y >= 0 && bullet.x <= state.world.width && bullet.y <= state.world.height) remaining.push(bullet);
    }
    state.bullets = remaining.slice(-64);
    state.impacts = state.impacts.slice(-48);
  }

  function step(state, input = {}, dt = 1 / 60) {
    state.events = [];
    if (typeof input.paused === "boolean") state.paused = input.paused;
    if (state.paused) return state;
    dt = clamp(finite(dt, 0), 0, .05);
    if (dt <= 0) return state;
    state.elapsed += dt;
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    state.recoil *= Math.exp(-20 * dt);
    state.flash = Math.max(0, state.flash - dt);
    for (const target of state.targets) target.hitFlash = Math.max(0, target.hitFlash - dt);
    for (const impact of state.impacts) impact.life -= dt;
    state.impacts = state.impacts.filter(impact => impact.life > 0);
    let dx, dy;
    if (Number.isFinite(input.dx) && Number.isFinite(input.dy)) { dx = input.dx; dy = input.dy; }
    else {
      const mx = finite(input.moveX, 0), my = finite(input.moveY, 0), length = Math.max(1, Math.hypot(mx, my));
      dx = mx / length * state.speed * dt; dy = my / length * state.speed * dt;
    }
    move(state, dx, dy);
    if (Number.isFinite(input.targetX) && Number.isFinite(input.targetY)) {
      const aimX = input.targetX - state.x, aimY = input.targetY - state.y;
      if (Math.hypot(aimX, aimY) > 1) aimAt(state, input.targetX, input.targetY);
    } else if (Number.isFinite(input.angle)) setAimAngle(state, input.angle);
    updateBullets(state, dt);
    if (input.firing && state.fireCooldown <= 0) {
      state.recoil = 1; state.flash = .065; state.fireCooldown = state.config.shotInterval;
      const current = pose(state), weapon = current.weapon;
      const shot = { type: "shot", x: weapon.muzzleX, y: weapon.muzzleY,
        angle: weapon.angle, aimX: Math.cos(weapon.angle), aimY: Math.sin(weapon.angle) };
      state.bullets.push({ x: shot.x, y: shot.y, prevX: shot.x, prevY: shot.y,
        vx: shot.aimX * state.config.bulletSpeed, vy: shot.aimY * state.config.bulletSpeed,
        life: state.config.bulletLife });
      state.lastShot = shot; state.events.push(shot); state.shotsFired++;
    }
    return state;
  }

  function ready(image) {
    return Boolean(image && image.complete !== false && (image.naturalWidth || image.width) > 0 && (image.naturalHeight || image.height) > 0);
  }

  function draw(ctx, state, assets = {}, options = {}) {
    const current = pose(state), scale = state.pixelScale;
    const bodyReady = ready(assets.body), weaponReady = ready(assets.weapon);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (options.drawTargets !== false) for (const target of state.targets) {
      ctx.globalAlpha = target.hp > 0 ? 1 : .28;
      ctx.fillStyle = target.hitFlash > 0 ? "#f3ca76" : "#536b68";
      ctx.beginPath(); ctx.arc(target.x, target.y, target.radius, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#c4d3bd"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#18282c"; ctx.fillRect(target.x - 2, target.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    if (options.drawShadow !== false) {
      ctx.fillStyle = "rgba(8,12,12,.35)"; ctx.beginPath();
      ctx.ellipse(state.x, state.y + scale, 14 * scale, 3 * scale, 0, 0, TAU); ctx.fill();
    }
    const drawWeapon = () => {
      if (!weaponReady) return;
      const weapon = current.weapon;
      ctx.save(); ctx.translate(weapon.anchorX, weapon.anchorY); ctx.rotate(weapon.angle);
      ctx.scale(scale, scale * weapon.mirrorY);
      ctx.drawImage(assets.weapon, 0, 0, assets.weapon.naturalWidth || assets.weapon.width,
        assets.weapon.naturalHeight || assets.weapon.height, -weapon.pivot[0], -weapon.pivot[1], weapon.width, weapon.height);
      ctx.restore();
    };
    if (current.depth === "back") drawWeapon();
    if (bodyReady) {
      const body = state.config.body, frame = current.bodyFrame;
      ctx.save(); ctx.translate(state.x, state.y); ctx.scale(scale * current.facing, scale);
      ctx.drawImage(assets.body, frame % body.columns * body.width, Math.floor(frame / body.columns) * body.height,
        body.width, body.height, -body.root[0], -body.root[1], body.width, body.height); ctx.restore();
    }
    if (current.depth === "front") drawWeapon();
    if (options.drawProjectiles !== false) {
      ctx.strokeStyle = "#ffcf72"; ctx.lineWidth = Math.max(2, scale);
      for (const bullet of state.bullets) {
        ctx.beginPath(); ctx.moveTo(bullet.prevX, bullet.prevY); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
      }
    }
    if (options.drawImpacts !== false) for (const impact of state.impacts) {
      ctx.globalAlpha = impact.life / .18; ctx.fillStyle = impact.target ? "#ffdc8a" : "#b3b79b";
      ctx.fillRect(impact.x - 3, impact.y - 1, 6, 2); ctx.fillRect(impact.x - 1, impact.y - 3, 2, 6);
    }
    ctx.globalAlpha = 1;
    if (weaponReady && options.drawFlash !== false && state.flash > 0) {
      const weapon = current.weapon;
      ctx.save(); ctx.translate(weapon.muzzleX, weapon.muzzleY); ctx.rotate(weapon.angle);
      ctx.fillStyle = "#e6913b"; ctx.fillRect(0, -3 * scale, 7 * scale, 6 * scale);
      ctx.fillStyle = "#ffe7a0"; ctx.fillRect(0, -scale, 5 * scale, 2 * scale); ctx.restore();
    }
    ctx.restore();
    return Object.assign(current, { bodyReady, weaponReady, drawn: bodyReady && weaponReady });
  }

  return { createState, step, pose, draw, setAimAngle, aimAt, weaponPoint };
});
