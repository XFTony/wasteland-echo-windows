"use strict";

const { PALETTE } = require("../config");
const { clamp } = require("../core/math");
const { INPUT_DEVICES } = require("../core/contracts");
const { UI_COLORS } = require("./ui/theme");
const { drawEchoMark, sectionPlate } = require("./ui/art-primitives");
const { drawFieldPlate, drawTextScrim } = require("./ui/field-surfaces");
const { formatTime } = require("./format");
const { TUTORIAL_STEPS, currentTutorialStep, tutorialProgressRatio } = require("../core/tutorial");

function wrapResultNote(value, maxChars) {
  const characters = Array.from(String(value || ""));
  const lines = [];
  while (characters.length) lines.push(characters.splice(0, maxChars).join(""));
  return lines.length ? lines : [""];
}

const HUD_METHODS = {
  drawHud(model) {
    const run = model.run;
    const player = run.player;
    const mode = this.content.get("modes", run.modeId, this.content.defaults.mode);
    const stage = this.content.get("stages", run.stageId, this.content.defaults.stage);
    const map = this.content.get("maps", run.mapId, this.content.defaults.map);
    const margin = 14;
    sectionPlate(this, margin, margin, 270, 82, { material: "iron", fill: "#211f1a", stroke: "#9a8152", accent: UI_COLORS.gold, raised: true });
    this.text(`LV ${player.level}`, margin + 13, margin + 17, 13, PALETTE.amber, "left", "900");
    const weapon = this.content.get("weapons", player.weaponId, this.content.defaults.weapon);
    const mechanicStatus = model.mechanicSystem && model.mechanicSystem.status(run, weapon);
    const weaponLabel = mechanicStatus ? `${weapon.name} · ${mechanicStatus.label} ${Math.round(mechanicStatus.value * 100)}%` : weapon.name;
    this.fitText(weaponLabel, margin + 72, margin + 17, 13, 186, PALETTE.cream, "left", "900", 9);
    this.ctx.fillStyle = "#312521";
    this.ctx.fillRect(margin + 12, margin + 31, 246, 13);
    this.ctx.fillStyle = player.hp > player.maxHp * 0.35 ? PALETTE.rust : PALETTE.danger;
    this.ctx.fillRect(margin + 12, margin + 31, 246 * clamp(player.hp / player.maxHp, 0, 1), 13);
    this.text(`${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, margin + 135, margin + 38, 10, PALETTE.white, "center", "900");
    this.ctx.fillStyle = "#24332e";
    this.ctx.fillRect(margin + 12, margin + 50, 246, 8);
    this.ctx.fillStyle = PALETTE.mint;
    this.ctx.fillRect(margin + 12, margin + 50, 246 * clamp(player.xp / player.xpNext, 0, 1), 8);
    this.fitText(`${stage.name} · ${map.name}`, margin + 12, margin + 69, 10, 246, "#d9d3ba", "left", "800", 9);

    const remaining = run.elapsed < run.duration ? run.duration - run.elapsed : 0;
    const centerX = this.width / 2;
    const finalWave = run.rule === "survive" && run.finalWaveAnnounced;
    const timerAccent = run.extraction.active ? PALETTE.cyan : finalWave ? PALETTE.amber : PALETTE.sandDark;
    sectionPlate(this, centerX - 86, 12, 172, 58, { material: "iron", fill: "#211f1a", stroke: timerAccent, accent: timerAccent, raised: true });
    const timerText = run.endless ? `∞ ${formatTime(run.elapsed)}` : run.elapsed >= run.duration ? `加时 ${formatTime(run.overtime)}` : formatTime(remaining);
    this.text(timerText, centerX, 33, 23, run.extraction.active ? PALETTE.cyan : finalWave ? PALETTE.amber : PALETTE.white, "center", "900");
    const objective = run.endless ? "无尽尸潮" : run.extraction.active ? "前往撤离区" : finalWave ? "最终攻势" : mode.objective;
    this.text(objective, centerX, 55, 11, PALETTE.muted, "center", "900");

    const boss = model.enemies.find((enemy) => enemy.active && enemy.boss);
    if (boss) {
      const enemyDefinition = this.content.get("enemies", boss.type, this.content.defaults.enemy);
      const bossDefinition = this.content.bossForEnemy(boss.type);
      const phase = boss.bossPhase || 1;
      const phaseDefinition = bossDefinition && bossDefinition.phases[phase - 1];
      const phaseLabel = phaseDefinition ? phaseDefinition.label : `阶段 ${phase}`;
      const bossName = bossDefinition ? bossDefinition.name : enemyDefinition.name;
      const finalPhase = Boolean(bossDefinition && phase >= bossDefinition.phases.length);
      const bossAccent = finalPhase ? PALETTE.danger : bossDefinition && bossDefinition.hudColor || PALETTE.rust;
      const bossW = Math.min(430, this.width * 0.42);
      const bossX = centerX - bossW / 2;
      const bossY = 76;
      sectionPlate(this, bossX, bossY, bossW, 42, { material: "iron", fill: "#211815", stroke: bossAccent, accent: bossAccent, raised: true });
      this.ctx.fillStyle = "#321b18";
      this.ctx.fillRect(bossX + 12, bossY + 24, bossW - 24, 8);
      this.ctx.fillStyle = bossAccent;
      this.ctx.fillRect(bossX + 12, bossY + 24, (bossW - 24) * clamp(boss.hp / boss.maxHp, 0, 1), 8);
      this.text(`${bossName} · ${phaseLabel}`, centerX, bossY + 13, 12, finalPhase ? "#ff9271" : PALETTE.cream, "center", "900");
    }

    const rightW = 170;
    sectionPlate(this, this.width - rightW - margin, margin, rightW, 54, { material: "iron", fill: "#211f1a", stroke: "#9a8152", accent: UI_COLORS.copper, raised: true });
    this.text(`击败 ${run.kills}`, this.width - rightW, margin + 17, 13, PALETTE.cream, "left", "900");
    this.text(`回收物 ${run.scrap}`, this.width - rightW, margin + 38, 12, PALETTE.amber, "left", "900");
    this.button("pause", "Ⅱ", this.width - 48, 17, 32, 32, "secondary");
    if (run.extraction.active) {
      const progress = Math.round((run.extraction.hold / run.extraction.required) * 100);
      this.text(`信标同步 ${progress}%`, centerX, this.height - 23, 13, PALETTE.cyan, "center", "bold");
      this.drawObjectiveArrow(run);
    }
  },

  drawTutorial(model) {
    const tutorial = model.run && model.run.tutorial;
    const step = currentTutorialStep(tutorial);
    if (!step) return;
    const bossActive = model.enemies.some((enemy) => enemy.active && enemy.boss);
    const width = Math.min(380, this.width - 28);
    const height = 116;
    const x = this.width - width - 14;
    const y = bossActive ? 126 : 78;
    sectionPlate(this, x, y, width, height, {
      material: "wood",
      fill: "#28231b",
      stroke: "#a18452",
      accent: UI_COLORS.gold,
      raised: true
    });
    this.trackedText(`荒原手册  ${tutorial.stepIndex + 1}/${TUTORIAL_STEPS.length}`, x + 14, y + 15, 9, PALETTE.amber, 1);
    this.displayText(step.title, x + 14, y + 40, 20, PALETTE.cream, "left");
    const settings=model.save.settings;
    const detail=step.id==='fire'?`${settings.autoAim?"射程内自动锁敌":"使用鼠标或右摇杆瞄准"}；${settings.autoFire?"武器自动射击":"使用射击键开火"}，完成3次攻击。`:step.detail;
    this.fitText(detail, x + 14, y + 66, 11, width - 28, "#d7cfb6", "left", "700", 9);
    const barX = x + 14;
    const barY = y + 88;
    const barW = width - 112;
    this.ctx.fillStyle = "#161512";
    this.ctx.fillRect(barX, barY, barW, 8);
    this.ctx.fillStyle = PALETTE.amber;
    this.ctx.fillRect(barX, barY, barW * tutorialProgressRatio(tutorial), 8);
    this.text(`${Math.min(step.target, tutorial.progress).toFixed(step.target < 3 ? 1 : 0)} / ${step.target}`, barX, y + 105, 9, PALETTE.muted, "left", "700");
    this.button("skipTutorial", "跳过教学", x + width - 88, y + 82, 74, 27, "secondary");
  },

  drawObjectiveArrow(run) {
    const point = this.worldToScreen(run.extraction.x, run.extraction.y, this.screenPoint);
    const safe = 76;
    if (point.x >= safe && point.x <= this.width - safe && point.y >= safe && point.y <= this.height - safe) return;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const angle = Math.atan2(point.y - centerY, point.x - centerX);
    const scale = Math.min((this.width / 2 - safe) / Math.max(0.001, Math.abs(Math.cos(angle))), (this.height / 2 - safe) / Math.max(0.001, Math.abs(Math.sin(angle))));
    const x = centerX + Math.cos(angle) * scale;
    const y = centerY + Math.sin(angle) * scale;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.fillStyle = PALETTE.cyan;
    this.ctx.beginPath();
    this.ctx.moveTo(14, 0);
    this.ctx.lineTo(-8, -8);
    this.ctx.lineTo(-4, 0);
    this.ctx.lineTo(-8, 8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
    const distance = Math.round(Math.hypot(run.extraction.x - run.player.x, run.extraction.y - run.player.y));
    this.text(`${distance}m`, x, y + 17, 9, PALETTE.cyan, "center", "bold");
  },

  drawDesktopControlHint(model) {
    const gamepad = this.activeInputDevice === INPUT_DEVICES.GAMEPAD;
    const settings = model && model.save.settings || {};
    const aim = settings.autoAim ? "自动锁敌" : gamepad ? "RS 瞄准" : "鼠标瞄准";
    const fire = settings.autoFire ? "自动射击" : gamepad ? "RT / RB 射击" : "左键 / 空格射击";
    const label = gamepad ? `手柄  LS 移动  ·  ${aim}  ·  ${fire}  ·  Menu 暂停` : `键鼠  WASD 移动  ·  ${aim}  ·  ${fire}  ·  Esc 暂停`;
    const width = Math.min(gamepad ? 530 : 570, this.width - 28);
    const x = 14;
    const y = this.height - 35;
    this.panel(x, y, width, 23, { fill: "#211e19", stroke: gamepad ? "#617f7b" : "#6e5b3e", radius: 4, lineWidth: 1 });
    this.fitText(label, x + 10, y + 12, 10, width - 20, gamepad ? PALETTE.cyan : PALETTE.muted, "left", "bold", 8);
  },

  drawDiagnostics(model) {
    const stats = model.getStats();
    const metrics = this.metrics || {};
    const width = 188;
    const x = this.width - width - 14;
    const y = 72;
    this.panel(x, y, width, 72, { fill: "#211f1a", stroke: "#667052", radius: 4, lineWidth: 1 });
    this.text(`FPS ${Math.round(metrics.fps || 0)}  ·  ${Number(metrics.frameMs || 0).toFixed(1)} ms`, x + 10, y + 14, 10, PALETTE.mint, "left", "bold");
    this.text(`敌人 ${stats.enemies}  弹体 ${stats.projectiles}  拾取 ${stats.pickups}`, x + 10, y + 33, 9, PALETTE.cream, "left");
    this.text(`网格 ${stats.spatialCells}  补帧 ${metrics.simulationSteps || 0}  丢弃 ${metrics.droppedCatchUps || 0}`, x + 10, y + 51, 9, PALETTE.muted, "left");
    this.text(`画质 ${this.qualityLevel}  输入 ${this.activeInputDevice === INPUT_DEVICES.GAMEPAD ? "手柄" : "键鼠"}`, x + 10, y + 66, 8, PALETTE.muted, "left");
  },

  drawOverlay() {
    this.ctx.fillStyle = "rgba(13,12,11,0.72)";
    this.ctx.fillRect(0, 0, this.width, this.height);
  },

  drawPause() {
    this.drawOverlay();
    const compact = this.height < 520 || this.width < 760;
    const w = Math.min(520, this.width - 30);
    const h = Math.min(390, this.height - 24);
    const x = (this.width - w) / 2;
    const y = (this.height - h) / 2;
    drawTextScrim(this, x, y, w, h, { fill: "rgba(20,19,16,0.97)", accent: UI_COLORS.gold });
    this.ctx.strokeStyle = "#766b59";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    drawEchoMark(this, x + 22, y + 18, UI_COLORS.gold, compact ? 0.7 : 0.9);
    this.displayText("行动暂停", x + 61, y + (compact ? 34 : 43), compact ? 26 : 34, PALETTE.white, "left");
    this.text("战场时间已冻结", x + 24, y + (compact ? 66 : 80), compact ? 11 : 14, PALETTE.muted, "left", "700");
    this.ctx.fillStyle = "rgba(196,178,141,0.3)";
    this.ctx.fillRect(x + 24, y + (compact ? 82 : 102), w - 48, 1);
    const buttonW = Math.min(330, w - 64);
    const buttonH = compact ? 42 : 48;
    const gap = compact ? 9 : 12;
    const firstY = y + (compact ? 98 : 120);
    this.button("resume", "继续战斗", this.width / 2 - buttonW / 2, firstY, buttonW, buttonH, "primary");
    this.button("restart", "重新开始", this.width / 2 - buttonW / 2, firstY + buttonH + gap, buttonW, buttonH, "secondary");
    this.button("quit", "退出本局", this.width / 2 - buttonW / 2, firstY + (buttonH + gap) * 2, buttonW, buttonH, "danger");
    const hint = this.activeInputDevice === INPUT_DEVICES.GAMEPAD ? "手柄 Menu / B 继续 · A 确认" : "P / Esc 继续 · Q 退出 · R 重开";
    this.fitText(hint, this.width / 2, y + h - 20, compact ? 10 : 12, w - 36, PALETTE.muted, "center", "700", 9);
  },

  drawResult(model) {
    this.drawOverlay();
    const run = model.run;
    const won = model.screen === "resultWin";
    const compact = this.height < 600 || this.width < 860;
    const visualScale = compact ? 1 : Math.min(1.32, Math.max(1, this.height / 720));
    const w = Math.min(960 * visualScale, this.width - 34);
    const h = Math.min(600 * visualScale, this.height - 28);
    const x = (this.width - w) / 2;
    const y = (this.height - h) / 2;
    const inset = compact ? 18 : 28 * visualScale;
    const accent = won ? PALETTE.cyan : PALETTE.rust;
    drawTextScrim(this, x, y, w, h, { fill: "rgba(19,18,15,0.98)", accent });
    this.ctx.strokeStyle = "#766b59";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    drawEchoMark(this, x + inset, y + (compact ? 15 : 18 * visualScale), accent, compact ? 0.72 : 0.9 * visualScale);
    const title = won ? run.rule === "extract" ? "撤离成功" : "坚守成功" : run.endless ? "尸潮压境" : "信号中断";
    this.displayText(title, x + inset + (compact ? 40 : 54 * visualScale), y + (compact ? 35 : 44 * visualScale), compact ? 27 : 37 * visualScale, accent, "left");
    this.text(`SEED ${run.seed}`, x + w - inset, y + (compact ? 31 : 34 * visualScale), compact ? 9 : 11 * visualScale, PALETTE.muted, "right", "800", "mono");
    const summary = won ? run.rule === "extract" ? "你把废土的回声带了回来" : "信号穿过了最后一轮沙暴" : "本局战利品已结算；下面记录关键战况";
    this.fitText(summary, x + inset, y + (compact ? 70 : 83 * visualScale), compact ? 11 : 14 * visualScale, w - inset * 2, PALETTE.cream, "left", "700", 10);

    const payout = run.payout || { copper: run.scrap * 12 + run.kills * 2, gold: 0 };
    const accuracy = Math.round((Number(run.accuracy) || 0) * 100);
    const primary = [
      ["存活时间", formatTime(run.endless ? run.elapsed : Math.min(run.elapsed, run.duration)), PALETTE.white],
      ["击败感染者", String(run.kills), PALETTE.white],
      ["获得铜币", `+${payout.copper}`, "#dfaa67"]
    ];
    const top = y + (compact ? 91 : 111 * visualScale);
    const primaryGap = compact ? 7 : 12 * visualScale;
    const primaryW = (w - inset * 2 - primaryGap * 2) / 3;
    const primaryH = compact ? 70 : 88 * visualScale;
    primary.forEach(([label, value, color], index) => {
      const px = x + inset + index * (primaryW + primaryGap);
      drawFieldPlate(this, px, top, primaryW, primaryH, { accent: color, fill: "#2e2b24" });
      this.text(label, px + 13, top + (compact ? 20 : 24 * visualScale), compact ? 10 : 13 * visualScale, PALETTE.muted, "left", "800");
      this.fitText(value, px + 13, top + (compact ? 49 : 58 * visualScale), compact ? 24 : 31 * visualScale, primaryW - 25, color, "left", "900", 16, "display");
    });

    const bodyY = top + primaryH + (compact ? 12 : 18 * visualScale);
    const buttonH = compact ? 39 : 46 * visualScale;
    const buttonY = y + h - buttonH - (compact ? 13 : 19 * visualScale);
    const bodyH = buttonY - bodyY - (compact ? 13 : 18 * visualScale);
    const bodyGap = compact ? 8 : 16 * visualScale;
    const leftW = (w - inset * 2 - bodyGap) * 0.56;
    const rightX = x + inset + leftW + bodyGap;
    const rightW = w - inset * 2 - leftW - bodyGap;
    drawTextScrim(this, x + inset, bodyY, leftW, bodyH, { fill: "#24231e", accent: UI_COLORS.ironLight });
    drawTextScrim(this, rightX, bodyY, rightW, bodyH, { fill: "#24231e", accent });
    this.text("战况记录", x + inset + 14, bodyY + (compact ? 19 : 23 * visualScale), compact ? 13 : 16 * visualScale, PALETTE.cream, "left", "900");
    const secondary = [
      ["精英", run.eliteKills],
      ["造成伤害", Math.round(Number(run.damageDealt) || 0)],
      ["命中率", `${accuracy}%`],
      ["最长无伤", formatTime(Number(run.maxNoHitTime) || 0)],
      ["武器熟练", `Lv.${run.masteryLevel || 1}  +${run.masteryGain || 0}`],
      ["获得金币", `+${payout.gold}`]
    ];
    const rowStart = bodyY + (compact ? 39 : 49 * visualScale);
    const rowH = (bodyH - (compact ? 46 : 56 * visualScale)) / secondary.length;
    secondary.forEach(([label, value], index) => {
      const rowY = rowStart + index * rowH;
      if (index) {
        this.ctx.fillStyle = "rgba(196,178,141,0.18)";
        this.ctx.fillRect(x + inset + 13, rowY - rowH * 0.48, leftW - 27, 1);
      }
      this.text(label, x + inset + 14, rowY, compact ? 10 : 12 * visualScale, PALETTE.muted, "left", "700");
      this.fitText(String(value), x + inset + leftW - 15, rowY, compact ? 12 : 15 * visualScale, leftW * 0.52, label === "获得金币" ? PALETTE.amber : PALETTE.white, "right", "900", 10);
    });

    const progression = [
      ...(Array.isArray(run.masteryRewards) ? run.masteryRewards.map((reward) => `精通 Lv.${reward.level}「${reward.name}」`) : []),
      ...(Array.isArray(run.unlockRewards) ? run.unlockRewards.map((unlock) => `规则「${unlock.name}」`) : [])
    ];
    this.text("本局新增", rightX + 14, bodyY + (compact ? 19 : 23 * visualScale), compact ? 13 : 16 * visualScale, accent, "left", "900");
    const rewardBase = bodyY + (compact ? 43 : 53 * visualScale);
    const rewardStep = compact ? 20 : 24 * visualScale;
    if (progression.length) {
      progression.slice(0, 3).forEach((line, index) => this.fitText(line, rightX + 14, rewardBase + index * rewardStep, compact ? 10 : 13 * visualScale, rightW - 28, PALETTE.cream, "left", "700", 9));
    } else {
      this.fitText("本局无新增解锁", rightX + 14, rewardBase, compact ? 10 : 13 * visualScale, rightW - 28, PALETTE.muted, "left", "700", 9);
    }
    if (!won) {
      const adviceY = bodyY + bodyH * 0.56;
      this.text("复盘建议", rightX + 14, adviceY, compact ? 12 : 15 * visualScale, PALETTE.amber, "left", "900");
      const advice = Array.isArray(run.advice) && run.advice.length ? run.advice : ["调整站位与装备，再次尝试。"];
      let noteY = adviceY + (compact ? 21 : 27 * visualScale);
      for (const suggestion of advice.slice(0, 2)) {
        for (const line of wrapResultNote(suggestion, compact ? 20 : 26)) {
          this.fitText(line, rightX + 14, noteY, compact ? 10 : 12 * visualScale, rightW - 28, PALETTE.cream, "left", "700", 10);
          noteY += compact ? 16 : 19 * visualScale;
        }
        noteY += compact ? 4 : 6 * visualScale;
      }
    } else {
      this.fitText("行动记录已归档，战利品已入账。", rightX + 14, bodyY + bodyH - (compact ? 22 : 27 * visualScale), compact ? 10 : 12 * visualScale, rightW - 28, PALETTE.muted, "left", "700", 9);
    }

    const actionW = Math.min(compact ? 146 : 168 * visualScale, (w - inset * 2 - 12) / 2);
    const actionGap = compact ? 10 : 14 * visualScale;
    this.button("restart", "再来一局", this.width / 2 - actionW - actionGap / 2, buttonY, actionW, buttonH, "primary");
    this.button("menu", "返回主页", this.width / 2 + actionGap / 2, buttonY, actionW, buttonH, "secondary");
  },

  drawWindowNotice() {
    this.ctx.fillStyle = "rgba(16,14,12,0.94)";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.text("请放宽游戏窗口", this.width / 2, this.height / 2 - 20, 28, PALETTE.white, "center", "bold");
    this.text("建议使用 16:9 横向窗口或按 F 切换全屏", this.width / 2, this.height / 2 + 22, 14, PALETTE.muted, "center");
  }
};

module.exports = { HUD_METHODS };
