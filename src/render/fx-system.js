"use strict";

const { PALETTE } = require("../config");
const { UPGRADE_FAMILY_STYLES } = require("./ui/theme");

function hash2(x, y) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  value = (value ^ (value >>> 13)) * 1274126177;
  return (value ^ (value >>> 16)) >>> 0;
}

function initializeFx(renderer) {
  renderer.particles = Array.from({ length: 180 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 2, color: PALETTE.amber, gravity: 0 }));
  renderer.shells = Array.from({ length: 32 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, rotation: 0, angularVelocity: 0, color: PALETTE.amber, length: 4 }));
  renderer.muzzleFlashes = Array.from({ length: 12 }, () => ({ active: false, x: 0, y: 0, angle: 0, life: 0, maxLife: 0, length: 12, color: PALETTE.amber }));
  renderer.floatTexts = Array.from({ length: 24 }, () => ({ active: false, x: 0, y: 0, life: 0, maxLife: 0, value: "", color: PALETTE.white, size: 11, critical: false }));
  renderer.nextParticle = 0;
  renderer.nextShell = 0;
  renderer.nextMuzzleFlash = 0;
  renderer.nextFloatText = 0;
  renderer.banner = { text: "", detail: "", life: 0, maxLife: 0, color: PALETTE.amber };
  renderer.damageVignette = 0;
  renderer.weaponKick = 0;
  renderer.cameraKick = 0;
  renderer.recoilAimX = 1;
  renderer.recoilAimY = 0;
  renderer.upgradeFlash = 0;
  renderer.upgradeFlashColor = PALETTE.amber;
  renderer.upgradeFlashName = "";
}

const FX_METHODS = {
  handleEvents(events, model) {
    for (const event of events) {
      if (event.type === "shot" && model.run) {
        const player = model.run.player;
        const weapon = this.content.get("weapons", event.weaponId, this.content.defaults.weapon);
        const aimX = Number.isFinite(event.aimX) ? event.aimX : player.lastAimX;
        const aimY = Number.isFinite(event.aimY) ? event.aimY : player.lastAimY;
        const x = event.x + aimX * weapon.muzzleLength;
        const y = event.y + aimY * weapon.muzzleLength;
        this.spawnBurst(x, y, weapon.color, weapon.muzzleParticles, 88, aimX, aimY);
        this.spawnShell(event.x, event.y, weapon, aimX, aimY);
        this.spawnMuzzleFlash(x, y, weapon, aimX, aimY);
        this.weaponKick = Math.min(14, Math.max(this.weaponKick, weapon.recoil));
        this.cameraKick = Math.min(7, this.cameraKick + weapon.recoil * 0.32);
        this.recoilAimX = aimX;
        this.recoilAimY = aimY;
      } else if (event.type === "hit") {
        this.spawnBurst(event.x, event.y, event.elite ? PALETTE.amber : "#c6b27d", event.elite ? 8 : 4, 86);
        this.spawnFloatText(event.x, event.y - 12, event.critical ? `✦${Math.round(event.damage)}` : Math.round(event.damage), event.critical ? PALETTE.danger : event.elite ? PALETTE.amber : PALETTE.cream, Boolean(event.critical));
      } else if (event.type === "kill") {
        this.spawnBurst(event.x, event.y, event.boss ? PALETTE.rust : "#76684d", event.elite ? 14 : 7, event.elite ? 120 : 74);
      } else if (event.type === "playerHit") {
        this.damageVignette = 1;
      } else if (event.type === "environment") {
        const explosive = event.action === "explode";
        this.spawnBurst(event.x, event.y, explosive ? "#e97842" : PALETTE.mint, explosive ? 28 : 12, explosive ? 180 : 86);
        if (explosive) this.cameraKick = Math.min(7, this.cameraKick + 4.5);
      } else if (event.type === "enemyAction") {
        const colors = { dash: "#cf8452", charge: "#b55c42", scream: "#9d76b1", pulse: "#d9674e" };
        const counts = { dash: 5, charge: 10, scream: 12, pulse: 14 };
        this.spawnBurst(event.x, event.y, colors[event.action] || PALETTE.rust, counts[event.action] || 7, event.action === "charge" ? 118 : 86);
      } else if (event.type === "boss") {
        this.showBanner(event.intro || event.name || "高危目标逼近", event.detail || "观察预警，保持移动", event.hudColor || PALETTE.rust, 2.8);
      } else if (event.type === "bossPhase") {
        this.showBanner(
          (event.name || "高危目标") + " · " + (event.phaseLabel || "阶段变化"),
          event.warning || "攻击模式已经改变",
          event.phase >= 3 ? PALETTE.danger : event.hudColor || PALETTE.rust,
          2.6
        );
      } else if (event.type === "extraction") {
        this.showBanner("撤离信标已上线", "进入蓝色信号圈完成同步", PALETTE.cyan, 3.2);
      } else if (event.type === "finalWave") {
        this.showBanner("最终攻势", "守住阵地，信号即将抵达", PALETTE.amber, 3.2);
      } else if (event.type === "spawnPhase") {
        this.showBanner(event.label || "尸潮升级", event.detail || "感染者正在聚集", PALETTE.rust, 2.5);
      } else if (event.type === "mechanicReady") {
        this.showBanner(event.label || "机制已充能", "下一次射击将触发强化", PALETTE.cyan, 1.35);
      } else if (event.type === "mechanicProc") {
        this.spawnBurst(event.x, event.y, PALETTE.cyan, Math.max(5, Number(event.hits) * 2 || 5), 96);
        if (this.upgradeFlash <= 0.12) {
          this.upgradeFlash = 0.34;
          this.upgradeFlashColor = PALETTE.cyan;
          this.upgradeFlashName = event.label || "机制触发";
        }
      } else if (event.type === "upgradeSalvage") {
        this.showBanner("战地拆解", `回收 ${Number(event.value) || 0} 废料`, PALETTE.amber, 1.35);
      } else if (event.type === "runStart") {
        this.weaponKick = 0;
        this.cameraKick = 0;
        this.damageVignette = 0;
        this.banner.life = 0;
        for (const particle of this.particles) particle.active = false;
        for (const shell of this.shells) shell.active = false;
        for (const flash of this.muzzleFlashes) flash.active = false;
        for (const label of this.floatTexts) label.active = false;
        this.showBanner(event.radioTitle || "远征电台已接通", event.radioDetail || "保持移动，等待目标信号", PALETTE.amber, 3.6);
      } else if (event.type === "upgrade") {
        const upgrade = this.content.get("upgrades", event.id, null);
        const family = upgrade && UPGRADE_FAMILY_STYLES[upgrade.family];
        this.upgradeFlash = 0.62;
        this.upgradeFlashColor = family ? family.color : PALETTE.amber;
        this.upgradeFlashName = upgrade ? upgrade.name : "改造完成";
        if (model.run) this.spawnBurst(model.run.player.x, model.run.player.y - 12, this.upgradeFlashColor, 18, 132);
      }
    }
  },

  spawnBurst(x, y, color, count, speed, directionX = 0, directionY = 0) {
    const flashScale = this.flashSetting === "off" ? 0.35 : this.flashSetting === "high" ? 1.2 : 0.8;
    const qualityScale = (this.qualityLevel === 0 ? 0.55 : this.qualityLevel === 1 ? 0.8 : 1) * flashScale;
    const visibleCount = Math.max(1, Math.ceil(count * qualityScale));
    for (let index = 0; index < visibleCount; index += 1) {
      const slot = this.particles[this.nextParticle];
      this.nextParticle = (this.nextParticle + 1) % this.particles.length;
      const hash = hash2(Math.floor(x * 3) + index * 17 + this.frame, Math.floor(y * 5) + index * 31);
      const angle = ((hash % 6283) / 1000) + Math.atan2(directionY, directionX) * 0.25;
      const velocity = speed * (0.35 + ((hash >>> 8) % 100) / 100);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.vx = Math.cos(angle) * velocity + directionX * speed * 0.45;
      slot.vy = Math.sin(angle) * velocity + directionY * speed * 0.45;
      slot.maxLife = 0.2 + ((hash >>> 16) % 18) / 100;
      slot.size = 1 + ((hash >>> 24) % 3);
      slot.color = color;
      slot.gravity = 18;
      slot.life = slot.maxLife;
    }
  },

  spawnShell(x, y, weapon, aimX, aimY) {
    const slot = this.shells[this.nextShell];
    this.nextShell = (this.nextShell + 1) % this.shells.length;
    const sideX = -aimY;
    const sideY = aimX;
    const seed = hash2(this.frame + Math.round(x * 7), Math.round(y * 11));
    const sideSpeed = 62 + (seed % 44);
    slot.active = true;
    slot.x = x + aimX * 8 + sideX * 5;
    slot.y = y + aimY * 8 + sideY * 5;
    slot.vx = sideX * sideSpeed - aimX * (14 + ((seed >>> 7) % 18));
    slot.vy = sideY * sideSpeed - aimY * (14 + ((seed >>> 7) % 18)) - 22;
    slot.maxLife = weapon.shellLife;
    slot.rotation = (seed % 628) / 100;
    slot.angularVelocity = 9 + ((seed >>> 13) % 10);
    slot.color = weapon.shellColor || PALETTE.amber;
    slot.length = weapon.shellLength;
    slot.life = slot.maxLife;
  },

  spawnMuzzleFlash(x, y, weapon, aimX, aimY) {
    const slot = this.muzzleFlashes[this.nextMuzzleFlash];
    this.nextMuzzleFlash = (this.nextMuzzleFlash + 1) % this.muzzleFlashes.length;
    slot.active = this.flashSetting !== "off";
    slot.x = x;
    slot.y = y;
    slot.angle = Math.atan2(aimY, aimX);
    slot.maxLife = weapon.muzzleFlashLife;
    slot.length = weapon.muzzleFlashLength;
    slot.color = weapon.color;
    slot.life = slot.maxLife;
  },

  spawnFloatText(x, y, value, color, critical = false) {
    const slot = this.floatTexts[this.nextFloatText];
    this.nextFloatText = (this.nextFloatText + 1) % this.floatTexts.length;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.value = String(value);
    slot.color = color;
    slot.size = critical ? 16 : 11;
    slot.critical = critical;
    slot.maxLife = critical ? 0.82 : 0.62;
    slot.life = slot.maxLife;
  },

  showBanner(text, detail, color, duration) {
    this.banner.text = text;
    this.banner.detail = detail;
    this.banner.color = color;
    this.banner.maxLife = duration;
    this.banner.life = duration;
  },

  updateEffects(dt) {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) { particle.active = false; continue; }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - dt * 5.5);
      particle.vy = particle.vy * Math.max(0, 1 - dt * 5.5) + particle.gravity * dt;
    }
    for (const shell of this.shells) {
      if (!shell.active) continue;
      shell.life -= dt;
      if (shell.life <= 0) { shell.active = false; continue; }
      shell.x += shell.vx * dt;
      shell.y += shell.vy * dt;
      shell.vx *= Math.max(0, 1 - dt * 4.2);
      shell.vy = shell.vy * Math.max(0, 1 - dt * 4.2) + 72 * dt;
      shell.rotation += shell.angularVelocity * dt;
    }
    for (const flash of this.muzzleFlashes) {
      if (!flash.active) continue;
      flash.life -= dt;
      if (flash.life <= 0) flash.active = false;
    }
    for (const label of this.floatTexts) {
      if (!label.active) continue;
      label.life -= dt;
      label.y -= dt * 24;
      if (label.life <= 0) label.active = false;
    }
    this.banner.life = Math.max(0, this.banner.life - dt);
    this.damageVignette = Math.max(0, this.damageVignette - dt * 2.7);
    this.upgradeFlash = Math.max(0, this.upgradeFlash - dt);
    this.weaponKick *= Math.exp(-15 * dt);
    this.cameraKick *= Math.exp(-20 * dt);
    if (this.weaponKick < 0.04) this.weaponKick = 0;
    if (this.cameraKick < 0.03) this.cameraKick = 0;
  }
};

module.exports = { initializeFx, FX_METHODS };
