"use strict";

const { PALETTE } = require("../config");
const { clamp } = require("../core/math");
const { INPUT_DEVICES } = require("../core/contracts");
const { DEFAULT_CONTENT } = require("../core/content-registry");
const { ART_IDS } = require("./art/asset-catalog");
const { createDefaultArtStore } = require("./art/art-store");
const { DEFAULT_WORLD } = require("../world/world-registry");
const { UI_COLORS, MATERIALS } = require("./ui/theme");
const {
  cutCornerPath,
  focusBrackets
} = require("./ui/art-primitives");
const { drawUpgradeDraft } = require("./ui/upgrade-cards");
const { drawFieldPlate } = require("./ui/field-surfaces");
const { initializeFx, FX_METHODS } = require("./fx-system");
const { HUD_METHODS } = require("./hud-view");
const { TERRAIN_METHODS } = require("./terrain-view");
const { OBSTACLE_METHODS } = require("./obstacle-view");
const { ACTOR_METHODS } = require("./actor-view");
const { MENU_METHODS } = require("./menu-pages");
const { drawMenuPage } = require("./menu-view");
const { hash2 } = require("./render-hash");
const { formatTime } = require("./format");

const FONT_STACKS = Object.freeze({
  ui: '"Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  display: '"Fusion Pixel 12", Impact, "Microsoft YaHei UI", sans-serif',
  card: '"Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  mono: '"Cascadia Mono", Consolas, "Fusion Pixel 12", monospace'
});
const OFFSCREEN_POINTER = Object.freeze({ x: -1000, y: -1000, down: false });
class CanvasRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.content = options.content || DEFAULT_CONTENT;
    if (!this.content || typeof this.content.get !== "function") {
      throw new TypeError("CanvasRenderer requires a content registry with get()");
    }
    const contentWorld = this.content.world;
    if (options.world && contentWorld && options.world !== contentWorld) {
      throw new Error("CanvasRenderer content and world registries must be the same composition");
    }
    this.world = options.world || contentWorld || DEFAULT_WORLD;
    if (!this.world || typeof this.world.get !== "function") {
      throw new TypeError("CanvasRenderer requires a world registry with get()");
    }
    this.profile = options.profile || "desktop";
    this.width = 960;
    this.height = 540;
    this.dpr = 1;
    this.regions = [];
    this.regionPool = Array.from({ length: 128 }, () => ({ action: "", x: 0, y: 0, w: 0, h: 0 }));
    this.regionCount = 0;
    this.camera = { x: 0, y: 0 };
    this.mapLayout = this.resolveMapLayout(this.content.defaults.map);
    this.screenPoint = { x: 0, y: 0 };
    this.frame = 0;
    initializeFx(this);
    this.qualityLevel = 2;
    this.frameTimeAverage = 1 / 60;
    this.slowFrameTime = 0;
    this.stableFrameTime = 0;
    this.menuGradient = null;
    this.menuReadabilityGradient = null;
    this.menuFooterGradient = null;
    this.atmosphereGradient = null;
    this.focusAction = null;
    this.activeInputDevice = INPUT_DEVICES.KEYBOARD_MOUSE;
    this.gamepadConnected = false;
    this.gamepadId = "";
    this.metrics = null;
    this.lastScreen = null;
    this.screenEnteredFrame = 0;
    this.artStore = options.artStore || createDefaultArtStore();
    this.groundTexture = this.artStore.get(ART_IDS.GROUND);
    this.coverArt = this.artStore.get(ART_IDS.TITLE_KEY_ART);
    this.portraitLook = { x: 0, y: 0 };
    this.activeMenuBackdrop = null;
    this.uiScale = 1;
  }

  resolveMapLayout(mapId) {
    const map = this.content.get("maps", mapId, this.content.defaults.map);
    const layout = map && this.world.get(map.layoutId);
    if (!layout) throw new Error(`Map '${mapId}' does not resolve to a registered world layout`);
    return layout;
  }

  updatePerformance(dt) {
    if (!(dt > 0) || dt > 0.25) return;
    const sample = Math.min(dt, 0.1);
    this.frameTimeAverage += (sample - this.frameTimeAverage) * 0.08;
    if (this.frameTimeAverage > 1 / 42) {
      this.slowFrameTime += sample;
      this.stableFrameTime = 0;
      if (this.slowFrameTime >= 1.5 && this.qualityLevel > 0) {
        this.qualityLevel -= 1;
        this.slowFrameTime = 0;
      }
    } else if (this.frameTimeAverage < 1 / 57) {
      this.stableFrameTime += sample;
      this.slowFrameTime = 0;
      if (this.stableFrameTime >= 5 && this.qualityLevel < 2) {
        this.qualityLevel += 1;
        this.stableFrameTime = 0;
      }
    } else {
      this.slowFrameTime = Math.max(0, this.slowFrameTime - sample * 0.5);
      this.stableFrameTime = 0;
    }
  }

  rebuildGradients() {
    const menuGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    menuGradient.addColorStop(0, "#211e19");
    menuGradient.addColorStop(0.55, "#4a3828");
    menuGradient.addColorStop(1, "#171411");
    this.menuGradient = menuGradient;

    const menuReadabilityGradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
    menuReadabilityGradient.addColorStop(0, "rgba(16,14,11,0.98)");
    menuReadabilityGradient.addColorStop(0.28, "rgba(18,15,12,0.94)");
    menuReadabilityGradient.addColorStop(0.5, "rgba(19,16,13,0.68)");
    menuReadabilityGradient.addColorStop(0.73, "rgba(17,14,11,0.2)");
    menuReadabilityGradient.addColorStop(1, "rgba(14,12,10,0.3)");
    this.menuReadabilityGradient = menuReadabilityGradient;

    const menuFooterGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    menuFooterGradient.addColorStop(0, "rgba(12,10,8,0)");
    menuFooterGradient.addColorStop(0.72, "rgba(12,10,8,0.08)");
    menuFooterGradient.addColorStop(1, "rgba(12,10,8,0.94)");
    this.menuFooterGradient = menuFooterGradient;

    const atmosphereGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    atmosphereGradient.addColorStop(0, "rgba(21,17,14,0.23)");
    atmosphereGradient.addColorStop(0.16, "rgba(21,17,14,0)");
    atmosphereGradient.addColorStop(0.78, "rgba(21,17,14,0)");
    atmosphereGradient.addColorStop(1, "rgba(21,17,14,0.28)");
    this.atmosphereGradient = atmosphereGradient;
  }

  resize(width, height, dpr = 1) {
    this.width = Math.max(320, width);
    this.height = Math.max(180, height);
    this.dpr = clamp(dpr, 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    if (this.canvas.style) {
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
    }
    this.rebuildGradients();
  }

  hitTest(x, y) {
    for (let index = this.regions.length - 1; index >= 0; index -= 1) {
      const region = this.regions[index];
      if (x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h) {
        return region.action;
      }
    }
    return null;
  }

  addRegion(action, x, y, w, h) {
    let region = this.regionPool[this.regionCount];
    if (!region) {
      region = { action: "", x: 0, y: 0, w: 0, h: 0 };
      this.regionPool.push(region);
    }
    region.action = action;
    region.x = x;
    region.y = y;
    region.w = w;
    region.h = h;
    this.regionCount += 1;
    this.regions.push(region);
  }

  render(model, inputState = {}) {
    const ctx = this.ctx;
    this.frame += 1;
    this.pointerState = inputState.pointer || OFFSCREEN_POINTER;
    this.focusAction = inputState.focusAction || null;
    this.activeInputDevice = inputState.activeDevice || INPUT_DEVICES.KEYBOARD_MOUSE;
    this.gamepadConnected = Boolean(inputState.gamepadConnected);
    this.gamepadId = inputState.gamepadId || "";
    this.metrics = inputState.metrics || null;
    this.uiScale = model.save && model.save.settings ? Number(model.save.settings.uiScale) || 1 : 1;
    this.flashSetting = model.save && model.save.settings ? model.save.settings.flashes : "low";
    if (model.screen !== this.lastScreen) {
      this.lastScreen = model.screen;
      this.screenEnteredFrame = this.frame;
    }
    this.regions.length = 0;
    this.regionCount = 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, this.height);

    if (model.run) {
      this.mapLayout = this.resolveMapLayout(model.run.mapId);
      this.drawWorld(model);
      this.drawHud(model);
      if (model.screen === "running") {
        this.drawTutorial(model);
        if (model.save.settings.showControlHints) this.drawDesktopControlHint();
      }
      if (model.save.settings.showFps) this.drawDiagnostics(model);
      this.drawScreenEffects();
    } else {
      this.drawMenuBackdrop(model.menuPage || "main");
    }

    if (model.screen === "menu") {
      drawMenuPage(this, model);
    } else if (model.screen === "levelup") {
      drawUpgradeDraft(this, model);
    } else if (model.screen === "paused") {
      this.drawPause();
    } else if (model.screen === "resultWin" || model.screen === "resultLose") {
      this.drawResult(model);
    }

    this.drawSaveStatus(model);
    if (this.width < 800 || this.height < 450 || this.width / this.height < 1.15) this.drawWindowNotice();
  }

  drawSaveStatus(model) {
    const status = model.saveManager && model.saveManager.status;
    if (!status || status === "ok" || (model.screen !== "menu" && status !== "write-failed")) return;
    const message = status === "write-failed"
      ? "存档写入失败：本次进度可能无法保存，请先备份存档目录"
      : status === "recovered"
        ? "已从备份恢复存档，请先备份存档目录"
        : "存档损坏，原文已保留；当前使用新存档，请先备份存档目录";
    const width = Math.min(680, this.width - 36);
    const x = (this.width - width) / 2;
    const y = model.screen === "menu" ? 8 : this.height - 63;
    this.panel(x, y, width, 42, { fill: "#251b18", stroke: "#d98e65", radius: 3, lineWidth: 2 });
    this.fitText(message, this.width / 2, y + 21, 14, width - 24, "#fff0d0", "center", "bold", 11);
  }

  roundedPath(x, y, w, h, radius = 8) {
    const ctx = this.ctx;
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  strokeLine(x1, y1, x2, y2, color, width = 1) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(Math.round(x1), Math.round(y1));
    ctx.lineTo(Math.round(x2), Math.round(y2));
    ctx.stroke();
  }

  panel(x, y, w, h, options = {}) {
    const ctx = this.ctx;
    const material = MATERIALS[options.material] || MATERIALS.iron;
    const radius = Number.isFinite(Number(options.radius)) ? Number(options.radius) : 6;
    const shadowOffset = options.shadow === false ? 0 : Math.min(5, Math.max(2, Math.round(Math.min(w, h) * 0.025)));
    if (shadowOffset) {
      this.roundedPath(x + shadowOffset, y + shadowOffset, w, h, radius);
      ctx.fillStyle = options.shadowColor || UI_COLORS.shadow;
      ctx.fill();
    }
    this.roundedPath(x, y, w, h, radius);
    ctx.fillStyle = options.fill || material.fill;
    ctx.fill();
    ctx.strokeStyle = options.stroke || material.edge;
    ctx.lineWidth = options.lineWidth || 2;
    ctx.stroke();
    if (w > 34 && h > 24) {
      ctx.strokeStyle = options.innerStroke || material.highlight;
      ctx.lineWidth = 1;
      this.roundedPath(x + 3, y + 3, w - 6, h - 6, Math.max(1, radius - 2));
      ctx.stroke();
    }
    if (options.rivets !== false && w > 82 && h > 44) {
      ctx.fillStyle = options.rivetColor || material.edge;
      const rivet = Math.min(3, Math.max(2, Math.round(Math.min(w, h) * 0.035)));
      ctx.fillRect(x + 7, y + 7, rivet, rivet);
      ctx.fillRect(x + w - 7 - rivet, y + 7, rivet, rivet);
      ctx.fillRect(x + 7, y + h - 7 - rivet, rivet, rivet);
      ctx.fillRect(x + w - 7 - rivet, y + h - 7 - rivet, rivet, rivet);
    }
  }

  text(value, x, y, size = 16, color = PALETTE.white, align = "left", weight = "normal", role = "ui") {
    const ctx = this.ctx;
    const minimum = role === "display" ? 16 : role === "mono" ? 10 : 11;
    const readableSize = Math.max(minimum, (Number(size) || minimum) * this.uiScale);
    ctx.font = `${weight} ${readableSize}px ${FONT_STACKS[role] || FONT_STACKS.ui}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), x, y);
  }

  displayText(value, x, y, size, color = PALETTE.cream, align = "left") {
    const ctx = this.ctx;
    const readableSize = Math.max(18, (Number(size) || 18) * this.uiScale);
    ctx.font = `900 ${readableSize}px ${FONT_STACKS.display}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(17,15,13,0.72)";
    ctx.fillText(String(value), x + Math.max(2, readableSize * 0.065), y + Math.max(2, readableSize * 0.065));
    ctx.fillStyle = color;
    ctx.fillText(String(value), x, y);
  }

  trackedText(value, x, y, size = 11, color = PALETTE.muted, tracking = 2) {
    const ctx = this.ctx;
    const characters = String(value);
    const readableSize = Math.max(9, (Number(size) || 9) * this.uiScale);
    ctx.font = `700 ${readableSize}px ${FONT_STACKS.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    let cursor = x;
    for (const character of characters) {
      ctx.fillText(character, cursor, y);
      cursor += ctx.measureText ? ctx.measureText(character).width + tracking : readableSize * 0.64 + tracking;
    }
  }

  fitText(value, x, y, size, maxWidth, color = PALETTE.white, align = "center", weight = "normal", minSize = 11, role = "ui") {
    const text = String(value);
    const characters = text.length;
    const estimatedWidth = characters * size * this.uiScale * (role === "mono" ? 0.66 : 0.92);
    const fittedSize = estimatedWidth > maxWidth ? Math.max(minSize, size * maxWidth / estimatedWidth) : size;
    this.text(text, x, y, fittedSize, color, align, weight, role);
  }

  button(action, label, x, y, w, h, style = "primary") {
    const ctx = this.ctx;
    const pointer = this.pointerState || OFFSCREEN_POINTER;
    const hovered = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
    const pressed = hovered && pointer.down;
    const focused = this.focusAction === action;
    const baseFill = style === "primary" ? "#9f4935" : style === "danger" ? "#74312f" : "#3b3932";
    const hoverFill = style === "primary" ? "#b85b3f" : style === "danger" ? "#91413b" : "#504b40";
    const fill = hovered || focused ? hoverFill : baseFill;
    const stroke = style === "primary" ? UI_COLORS.gold : style === "danger" ? "#b96858" : UI_COLORS.ironLight;
    const offset = pressed ? 2 : 0;
    drawFieldPlate(this, x, y + offset, w, h - offset, {
      fill,
      stroke,
      accent: stroke,
      active: hovered || focused,
      raised: hovered || focused,
      lineWidth: focused ? 3 : 2
    });
    const innerX = Math.max(8, w * 0.08);
    const innerY = Math.max(6, h * 0.22);
    ctx.fillStyle = style === "primary" ? (hovered || focused ? "rgba(169,71,47,0.84)" : "rgba(116,49,36,0.8)")
      : style === "danger" ? "rgba(112,43,40,0.78)"
        : "rgba(28,28,23,0.38)";
    ctx.fillRect(x + innerX, y + offset + innerY, w - innerX * 2, Math.max(3, h - innerY * 2 - offset));
    if (focused) focusBrackets(this, x - 3, y - 3, w + 6, h + 6, UI_COLORS.gold, 2, Math.min(15, h * 0.35));
    ctx.fillStyle = hovered ? "#b3a17b" : "#817766";
    ctx.fillRect(x + 4, y + 4 + offset, w - 8, 2);
    ctx.fillStyle = style === "primary" ? "#6f3328" : "#272620";
    ctx.fillRect(x + 4, y + h - 5, w - 8, 2);
    this.text(label, x + w / 2, y + h / 2 + 1 + offset, Math.max(13, Math.min(19, h * 0.38)), PALETTE.white, "center", "900", "ui");
    this.addRegion(action, x, y, w, h);
  }

  drawWorld(model) {
    const ctx = this.ctx;
    const run = model.run;
    const player = run.player;
    let shakeX = 0;
    let shakeY = 0;
    if (player.invulnerable > 0 && model.save.settings.screenShake !== "off") {
      const strength = model.save.settings.screenShake === "high" ? 5 : 2.5;
      shakeX = Math.sin(this.frame * 2.1) * strength;
      shakeY = Math.cos(this.frame * 1.7) * strength;
    }
    const recoilScale = model.save.settings.screenShake === "off" ? 0 : model.save.settings.screenShake === "high" ? 1 : 0.58;
    const maxCameraX = Math.max(0, model.worldSize - this.width);
    const maxCameraY = Math.max(0, model.worldSize - this.height);
    this.camera.x = clamp(
      player.x - this.width / 2 + this.recoilAimX * this.cameraKick * recoilScale - shakeX,
      0,
      maxCameraX
    );
    this.camera.y = clamp(
      player.y - this.height / 2 + this.recoilAimY * this.cameraKick * recoilScale - shakeY,
      0,
      maxCameraY
    );
    ctx.fillStyle = "#6d593b";
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawTerrain(model.worldSize);
    this.drawInteractives(model.interactives || []);
    this.drawExtraction(run);
    this.drawObstacles(model.obstacles);

    for (const pickup of model.pickups) this.drawPickup(pickup);
    for (const projectile of model.projectiles) this.drawProjectile(projectile);
    for (const shot of model.enemyShots) this.drawProjectile(shot);
    for (const enemy of model.enemies) this.drawEnemy(enemy, run.elapsed);
    this.drawPlayer(player, run);
    this.drawAimReticle(model);
    this.drawWorldEffects();
    this.drawAtmosphere(run.elapsed);
  }

  drawWorldEffects() {
    const ctx = this.ctx;
    const particleStep = this.qualityLevel === 0 ? 2 : 1;
    for (let index = 0; index < this.particles.length; index += particleStep) {
      const particle = this.particles[index];
      if (!particle.active) continue;
      const point = this.worldToScreen(particle.x, particle.y, this.screenPoint);
      if (point.x < -8 || point.y < -8 || point.x > this.width + 8 || point.y > this.height + 8) continue;
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(point.x, point.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    for (let index = 0; index < this.shells.length; index += 1) {
      const shell = this.shells[index];
      if (!shell.active) continue;
      const point = this.worldToScreen(shell.x, shell.y, this.screenPoint);
      if (point.x < -8 || point.y < -8 || point.x > this.width + 8 || point.y > this.height + 8) continue;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(shell.rotation);
      ctx.globalAlpha = clamp(shell.life / shell.maxLife * 1.4, 0, 1);
      ctx.fillStyle = "#4a3520";
      ctx.fillRect(-shell.length / 2 - 1, -2, shell.length + 2, 4);
      ctx.fillStyle = shell.color;
      ctx.fillRect(-shell.length / 2, -1, shell.length, 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (let index = 0; index < this.muzzleFlashes.length; index += 1) {
      const flash = this.muzzleFlashes[index];
      if (!flash.active) continue;
      const point = this.worldToScreen(flash.x, flash.y, this.screenPoint);
      const lifeScale = clamp(flash.life / flash.maxLife, 0, 1);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(flash.angle);
      ctx.globalAlpha = lifeScale;
      ctx.fillStyle = "#fff2b0";
      ctx.fillRect(-2, -3, flash.length * 0.56, 6);
      ctx.fillStyle = flash.color;
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(flash.length, -5 * lifeScale);
      ctx.lineTo(flash.length * 0.64, 0);
      ctx.lineTo(flash.length, 5 * lifeScale);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (let index = 0; index < this.floatTexts.length; index += 1) {
      const label = this.floatTexts[index];
      if (!label.active) continue;
      const point = this.worldToScreen(label.x, label.y, this.screenPoint);
      ctx.globalAlpha = clamp(label.life / label.maxLife, 0, 1);
      if (label.critical) this.text(label.value, point.x + 1, point.y + 2, label.size, "#3b1716", "center", "bold");
      this.text(label.value, point.x, point.y, label.size, label.color, "center", "bold");
    }
    ctx.globalAlpha = 1;
  }

  drawAtmosphere(elapsed) {
    const ctx = this.ctx;
    const wind = elapsed * 18;
    const dustCount = this.qualityLevel === 0 ? 8 : this.qualityLevel === 1 ? 14 : 22;
    for (let index = 0; index < dustCount; index += 1) {
      const seed = hash2(index * 73, 911);
      const x = ((seed % (this.width + 160)) + wind * (0.35 + (index % 5) * 0.12)) % (this.width + 160) - 80;
      const y = 70 + ((seed >>> 9) % Math.max(90, this.height - 130));
      const length = 5 + ((seed >>> 18) % 18);
      ctx.fillStyle = index % 4 === 0 ? "rgba(231,216,173,0.12)" : "rgba(66,52,37,0.1)";
      ctx.fillRect(Math.round(x), Math.round(y), length, index % 3 === 0 ? 2 : 1);
    }
    ctx.fillStyle = this.atmosphereGradient || "rgba(21,17,14,0.12)";
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawScreenEffects() {
    const ctx = this.ctx;
    if (this.damageVignette > 0) {
      const alpha = this.damageVignette * 0.26;
      ctx.fillStyle = `rgba(145,43,38,${alpha})`;
      ctx.fillRect(0, 0, this.width, 12);
      ctx.fillRect(0, this.height - 12, this.width, 12);
      ctx.fillRect(0, 12, 12, this.height - 24);
      ctx.fillRect(this.width - 12, 12, 12, this.height - 24);
    }
    if (this.banner.life > 0) {
      const progress = this.banner.life / this.banner.maxLife;
      const alpha = clamp(Math.min((1 - progress) * 5, progress * 3), 0, 1);
      ctx.globalAlpha = alpha;
      const width = Math.min(480, this.width - 40);
      const y = 78;
      this.panel(this.width / 2 - width / 2, y, width, 58, {
        fill: "rgba(26,23,20,0.92)", stroke: this.banner.color, radius: 4, lineWidth: 2
      });
      this.text(this.banner.text, this.width / 2, y + 20, 17, this.banner.color, "center", "bold");
      this.text(this.banner.detail, this.width / 2, y + 42, 11, PALETTE.cream, "center");
      ctx.globalAlpha = 1;
    }
    if (this.upgradeFlash > 0) {
      const progress = clamp(this.upgradeFlash / 0.62, 0, 1);
      const alpha = clamp(Math.min((1 - progress) * 7, progress * 2.2), 0, 1);
      const width = Math.min(310, this.width - 48);
      const y = this.height * 0.73;
      ctx.globalAlpha = alpha;
      this.panel(this.width / 2 - width / 2, y, width, 38, {
        fill: "rgba(25,22,18,0.9)", stroke: this.upgradeFlashColor, radius: 3, lineWidth: 2
      });
      this.text("改造已装配", this.width / 2 - width * 0.36, y + 19, 10, this.upgradeFlashColor, "left", "800", "mono");
      this.fitText(this.upgradeFlashName, this.width / 2 + width * 0.06, y + 19, 14, width * 0.42, PALETTE.cream, "left", "800", 9);
      ctx.globalAlpha = 1;
    }
  }

  worldToScreen(x, y, output = null) {
    const point = output || { x: 0, y: 0 };
    point.x = Math.round(x - this.camera.x);
    point.y = Math.round(y - this.camera.y);
    return point;
  }

  drawUpgradeIcon(id, x, y, size = 58, color = PALETTE.mint) {
    const ctx = this.ctx;
    const radius = size / 2;
    const unit = size / 48;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = `${color}22`;
    ctx.fillRect(-radius, -radius, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, 3 * unit);
    ctx.strokeRect(-radius + 5 * unit, -radius + 5 * unit, size - 10 * unit, size - 10 * unit);
    ctx.fillStyle = color;
    if (id === "kineticLoop") {
      ctx.beginPath();
      ctx.arc(0, 0, 15 * unit, -Math.PI * 0.2, Math.PI * 1.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-17 * unit, -9 * unit);
      ctx.lineTo(-7 * unit, -13 * unit);
      ctx.lineTo(-9 * unit, -3 * unit);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-3 * unit, -11 * unit, 6 * unit, 22 * unit);
    } else if (id === "arcNetwork") {
      ctx.beginPath();
      ctx.moveTo(-5 * unit, -19 * unit);
      ctx.lineTo(9 * unit, -19 * unit);
      ctx.lineTo(1 * unit, -4 * unit);
      ctx.lineTo(14 * unit, -4 * unit);
      ctx.lineTo(-9 * unit, 20 * unit);
      ctx.lineTo(-2 * unit, 4 * unit);
      ctx.lineTo(-15 * unit, 4 * unit);
      ctx.closePath();
      ctx.fill();
    } else if (id === "executionCapacitor") {
      ctx.fillRect(-12 * unit, -16 * unit, 24 * unit, 32 * unit);
      ctx.fillStyle = "#29261f";
      ctx.fillRect(-6 * unit, -10 * unit, 12 * unit, 20 * unit);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-2 * unit, -8 * unit);
      ctx.lineTo(7 * unit, -8 * unit);
      ctx.lineTo(1 * unit, 1 * unit);
      ctx.lineTo(7 * unit, 1 * unit);
      ctx.lineTo(-6 * unit, 11 * unit);
      ctx.lineTo(-1 * unit, 3 * unit);
      ctx.lineTo(-7 * unit, 3 * unit);
      ctx.closePath();
      ctx.fill();
    } else if (id === "reactivePlating") {
      ctx.beginPath();
      ctx.moveTo(0, -18 * unit);
      ctx.lineTo(16 * unit, -10 * unit);
      ctx.lineTo(11 * unit, 13 * unit);
      ctx.lineTo(0, 19 * unit);
      ctx.lineTo(-11 * unit, 13 * unit);
      ctx.lineTo(-16 * unit, -10 * unit);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PALETTE.white;
      for (let ray = 0; ray < 4; ray += 1) {
        ctx.save();
        ctx.rotate(ray * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -20 * unit);
        ctx.lineTo(0, -14 * unit);
        ctx.stroke();
        ctx.restore();
      }
    } else if (id === "salvageOverdrive") {
      ctx.fillRect(-16 * unit, -8 * unit, 32 * unit, 23 * unit);
      ctx.fillStyle = "#29261f";
      ctx.fillRect(-11 * unit, -3 * unit, 22 * unit, 4 * unit);
      ctx.fillRect(-3 * unit, -8 * unit, 6 * unit, 23 * unit);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(0, -8 * unit, 12 * unit, Math.PI * 1.05, Math.PI * 1.9);
      ctx.stroke();
    } else if (id === "pointBlankRelay") {
      ctx.lineWidth = 3 * unit;
      for (const ring of [7, 14, 20]) {
        ctx.beginPath();
        ctx.arc(0, 0, ring * unit, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillRect(-4 * unit, -4 * unit, 8 * unit, 8 * unit);
    } else if (id === "focusProtocol") {
      ctx.beginPath();
      ctx.moveTo(-20 * unit, 0);
      ctx.quadraticCurveTo(0, -17 * unit, 20 * unit, 0);
      ctx.quadraticCurveTo(0, 17 * unit, -20 * unit, 0);
      ctx.fill();
      ctx.fillStyle = "#29261f";
      ctx.beginPath();
      ctx.arc(0, 0, 7 * unit, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(-2 * unit, -2 * unit, 4 * unit, 4 * unit);
    } else if (id === "cascadeRounds") {
      ctx.lineWidth = 4 * unit;
      ctx.beginPath();
      ctx.moveTo(-17 * unit, 13 * unit);
      ctx.lineTo(-3 * unit, 1 * unit);
      ctx.lineTo(-3 * unit, -13 * unit);
      ctx.moveTo(-3 * unit, 1 * unit);
      ctx.lineTo(16 * unit, -10 * unit);
      ctx.moveTo(-3 * unit, 1 * unit);
      ctx.lineTo(16 * unit, 14 * unit);
      ctx.stroke();
      for (const point of [[-17, 13], [-3, -13], [16, -10], [16, 14]]) {
        ctx.beginPath();
        ctx.arc(point[0] * unit, point[1] * unit, 4 * unit, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === "vitality") {
      ctx.fillRect(-5 * unit, -16 * unit, 10 * unit, 32 * unit);
      ctx.fillRect(-16 * unit, -5 * unit, 32 * unit, 10 * unit);
    } else if (id === "speed") {
      ctx.beginPath();
      ctx.moveTo(-18 * unit, -10 * unit);
      ctx.lineTo(8 * unit, -10 * unit);
      ctx.lineTo(8 * unit, -16 * unit);
      ctx.lineTo(19 * unit, -5 * unit);
      ctx.lineTo(8 * unit, 6 * unit);
      ctx.lineTo(8 * unit, 0);
      ctx.lineTo(-18 * unit, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-13 * unit, 7 * unit, 26 * unit, 6 * unit);
    } else if (id === "armor") {
      ctx.beginPath();
      ctx.moveTo(0, -18 * unit);
      ctx.lineTo(17 * unit, -10 * unit);
      ctx.lineTo(12 * unit, 13 * unit);
      ctx.lineTo(0, 20 * unit);
      ctx.lineTo(-12 * unit, 13 * unit);
      ctx.lineTo(-17 * unit, -10 * unit);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#29261f";
      ctx.fillRect(-3 * unit, -10 * unit, 6 * unit, 20 * unit);
    } else if (id === "magnet") {
      ctx.lineWidth = 8 * unit;
      ctx.beginPath();
      ctx.arc(0, -1 * unit, 14 * unit, 0, Math.PI);
      ctx.stroke();
      ctx.fillRect(-18 * unit, -13 * unit, 8 * unit, 12 * unit);
      ctx.fillRect(10 * unit, -13 * unit, 8 * unit, 12 * unit);
    } else if (id === "fireRate") {
      ctx.fillRect(-18 * unit, -13 * unit, 25 * unit, 5 * unit);
      ctx.fillRect(-13 * unit, -3 * unit, 31 * unit, 6 * unit);
      ctx.fillRect(-18 * unit, 8 * unit, 25 * unit, 5 * unit);
      ctx.beginPath();
      ctx.moveTo(11 * unit, -17 * unit);
      ctx.lineTo(20 * unit, -10 * unit);
      ctx.lineTo(11 * unit, -4 * unit);
      ctx.closePath();
      ctx.fill();
    } else if (id === "projectile") {
      for (let row = -1; row <= 1; row += 1) {
        ctx.fillRect(-17 * unit, (row * 11 - 3) * unit, 27 * unit, 6 * unit);
        ctx.beginPath();
        ctx.arc(11 * unit, row * 11 * unit, 5 * unit, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
      }
    } else if (id === "pierce") {
      ctx.fillRect(-15 * unit, -18 * unit, 5 * unit, 36 * unit);
      ctx.fillRect(-2 * unit, -18 * unit, 5 * unit, 36 * unit);
      ctx.fillRect(11 * unit, -18 * unit, 5 * unit, 36 * unit);
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(-21 * unit, -3 * unit, 35 * unit, 6 * unit);
      ctx.beginPath();
      ctx.moveTo(20 * unit, 0);
      ctx.lineTo(10 * unit, -8 * unit);
      ctx.lineTo(10 * unit, 8 * unit);
      ctx.closePath();
      ctx.fill();
    } else if (id === "velocity") {
      ctx.fillRect(-19 * unit, -3 * unit, 28 * unit, 6 * unit);
      ctx.beginPath();
      ctx.moveTo(20 * unit, 0);
      ctx.lineTo(6 * unit, -12 * unit);
      ctx.lineTo(6 * unit, 12 * unit);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-17 * unit, -13 * unit, 17 * unit, 4 * unit);
      ctx.fillRect(-12 * unit, 9 * unit, 12 * unit, 4 * unit);
    } else if (id === "caliber") {
      ctx.beginPath();
      ctx.arc(-3 * unit, 0, 13 * unit, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(5 * unit, -7 * unit, 13 * unit, 14 * unit);
      ctx.fillStyle = "#29261f";
      ctx.beginPath();
      ctx.arc(-3 * unit, 0, 5 * unit, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === "critical") {
      ctx.lineWidth = 3 * unit;
      ctx.beginPath();
      ctx.arc(0, 0, 14 * unit, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(-3 * unit, -20 * unit, 6 * unit, 13 * unit);
      ctx.fillRect(-3 * unit, 7 * unit, 6 * unit, 13 * unit);
      ctx.fillRect(-20 * unit, -3 * unit, 13 * unit, 6 * unit);
      ctx.fillRect(7 * unit, -3 * unit, 13 * unit, 6 * unit);
      ctx.beginPath();
      ctx.arc(0, 0, 4 * unit, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === "recovery") {
      ctx.lineWidth = 3 * unit;
      ctx.beginPath();
      ctx.arc(0, 0, 18 * unit, -Math.PI * 0.2, Math.PI * 1.25);
      ctx.stroke();
      ctx.fillRect(-4 * unit, -13 * unit, 8 * unit, 26 * unit);
      ctx.fillRect(-13 * unit, -4 * unit, 26 * unit, 8 * unit);
    } else if (id === "scavenger") {
      ctx.fillRect(-16 * unit, -10 * unit, 32 * unit, 25 * unit);
      ctx.fillStyle = "#29261f";
      ctx.fillRect(-11 * unit, -5 * unit, 22 * unit, 4 * unit);
      ctx.fillRect(-3 * unit, -10 * unit, 6 * unit, 25 * unit);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4 * unit;
      ctx.beginPath();
      ctx.arc(0, -10 * unit, 8 * unit, Math.PI, Math.PI * 2);
      ctx.stroke();
    } else if (id === "phaseLining") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * unit;
      ctx.strokeRect(-17 * unit, -17 * unit, 34 * unit, 34 * unit);
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-10 * unit, -10 * unit, 20 * unit, 20 * unit);
      ctx.restore();
      ctx.fillRect(-3 * unit, -3 * unit, 6 * unit, 6 * unit);
    } else {
      ctx.fillRect(-18 * unit, -3 * unit, 36 * unit, 6 * unit);
      ctx.fillRect(10 * unit, -8 * unit, 10 * unit, 16 * unit);
    }
    ctx.restore();
  }

}

Object.assign(CanvasRenderer.prototype, FX_METHODS);
Object.assign(CanvasRenderer.prototype, HUD_METHODS);
Object.assign(CanvasRenderer.prototype, TERRAIN_METHODS);
Object.assign(CanvasRenderer.prototype, OBSTACLE_METHODS);
Object.assign(CanvasRenderer.prototype, ACTOR_METHODS);
Object.assign(CanvasRenderer.prototype, MENU_METHODS);

module.exports = { CanvasRenderer, formatTime };
