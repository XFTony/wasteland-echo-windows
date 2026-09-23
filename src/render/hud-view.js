"use strict";

const { PALETTE } = require("../config");
const { clamp } = require("../core/math");
const { INPUT_DEVICES } = require("../core/contracts");
const { UI_COLORS } = require("./ui/theme");
const { drawEchoMark, screenFrame, sectionPlate, statBlock } = require("./ui/art-primitives");
const { formatTime } = require("./format");
const { TUTORIAL_STEPS, currentTutorialStep, tutorialProgressRatio } = require("../core/tutorial");

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
    this.fitText(step.detail, x + 14, y + 66, 11, width - 28, "#d7cfb6", "left", "700", 9);
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

  drawDesktopControlHint() {
    const gamepad = this.activeInputDevice === INPUT_DEVICES.GAMEPAD;
    const label = gamepad ? "手柄  LS 移动  ·  RS 瞄准  ·  RT / RB 射击  ·  Menu 暂停" : "键鼠  WASD 移动  ·  鼠标瞄准  ·  左键 / 空格射击  ·  Esc 暂停";
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
    const w = Math.min(440, this.width - 30);
    const h = Math.min(350, this.height - 24);
    const x = this.width / 2 - w / 2;
    const y = this.height / 2 - h / 2;
    screenFrame(this, x, y, w, h, { material: "iron", fill: "#1b1915", stroke: UI_COLORS.ironLight, accent: UI_COLORS.gold });
    drawEchoMark(this, x + 22, y + 17, UI_COLORS.gold, compact ? 0.72 : 0.9);
    this.displayText("行动暂停", this.width / 2, y + (compact ? 38 : 45), compact ? 26 : 34, PALETTE.white, "center");
    this.text("战场时间已冻结 · 输入状态已清空", this.width / 2, y + (compact ? 68 : 83), compact ? 11 : 13, PALETTE.muted, "center", "700");
    const buttonW = Math.min(290, w - 54);
    const buttonH = compact ? 42 : 48;
    const gap = compact ? 9 : 12;
    const firstY = y + (compact ? 86 : 108);
    this.button("resume", "继续战斗", this.width / 2 - buttonW / 2, firstY, buttonW, buttonH, "primary");
    this.button("restart", "重新开始", this.width / 2 - buttonW / 2, firstY + buttonH + gap, buttonW, buttonH, "secondary");
    this.button("quit", "退出本局", this.width / 2 - buttonW / 2, firstY + (buttonH + gap) * 2, buttonW, buttonH, "danger");
    const hint = this.activeInputDevice === INPUT_DEVICES.GAMEPAD ? "手柄：Menu / B 继续，A 确认" : "键盘：P / Esc 继续，Q 退出，R 重开";
    this.text(hint, this.width / 2, y + h - 16, compact ? 10 : 12, PALETTE.muted, "center", "700");
  },

  drawResult(model) {
    this.drawOverlay();
    const run = model.run;
    const won = model.screen === "resultWin";
    const compact = this.height < 600 || this.width < 860;
    const w = Math.min(820, this.width - 34);
    const h = Math.min(compact ? 512 : 580, this.height - 28);
    const x = this.width / 2 - w / 2;
    const y = this.height / 2 - h / 2;
    const accent = won ? PALETTE.cyan : PALETTE.rust;
    screenFrame(this, x, y, w, h, { material: "wood", fill: "#1b1813", stroke: "#8b6844", accent });
    drawEchoMark(this, x + 24, y + 18, accent, compact ? 0.72 : 0.9);
    const winTitle = run.rule === "extract" ? "撤离成功" : "坚守成功";
    this.displayText(won ? winTitle : run.endless ? "尸潮压境" : "信号中断", this.width / 2, y + (compact ? 42 : 52), compact ? 28 : 38, accent, "center");
    this.text(`SEED ${run.seed}`, x + w - 22, y + 22, compact ? 9 : 11, PALETTE.muted, "right", "800", "mono");
    this.text(won ? run.rule === "extract" ? "你把废土的回声带了回来" : "信号穿过了最后一轮沙暴" : "战利品已结算，下一次会走得更远", this.width / 2, y + (compact ? 75 : 92), compact ? 11 : 14, PALETTE.muted, "center", "700");
    const payout = run.payout || { copper: run.scrap * 12 + run.kills * 2, gold: 0 };
    const accuracy = Math.round((Number(run.accuracy) || 0) * 100);
    const stats = [
      ["存活", formatTime(run.endless ? run.elapsed : Math.min(run.elapsed, run.duration))],
      ["击败", run.kills],
      ["精英", run.eliteKills],
      ["造成伤害", Math.round(Number(run.damageDealt) || 0)],
      ["弹体命中率", `${accuracy}%`],
      ["最长无伤", formatTime(Number(run.maxNoHitTime) || 0)],
      ["武器熟练", `Lv.${run.masteryLevel || 1}  +${run.masteryGain || 0}`],
      ["获得铜币", `+${payout.copper}`],
      ["获得金币", `+${payout.gold}`]
    ];
    const statY = y + (compact ? 98 : 126);
    const statGap = compact ? 5 : 9;
    const statW = (w - (compact ? 34 : 52) - statGap * 2) / 3;
    const statH = compact ? 62 : 78;
    stats.forEach(([label, value], index) => {
      const sx = x + (compact ? 17 : 26) + (index % 3) * (statW + statGap);
      const sy = statY + Math.floor(index / 3) * (statH + statGap);
      const valueColor = label === "获得金币" ? "#ffe15c" : label === "获得铜币" ? "#ff9b52" : PALETTE.white;
      statBlock(this, label, String(value), sx, sy, statW, statH, { accent: valueColor, valueColor, fill: "#343126" });
    });
    const progression = [
      ...(Array.isArray(run.masteryRewards) ? run.masteryRewards.map((reward) => `精通 Lv.${reward.level}「${reward.name}」`) : []),
      ...(Array.isArray(run.unlockRewards) ? run.unlockRewards.map((unlock) => `规则「${unlock.name}」`) : [])
    ];
    if (progression.length) {
      const progressionY = statY + 3 * (statH + statGap) + (compact ? 2 : 1);
      const progressionX = x + (compact ? 17 : 26);
      const progressionW = w - (compact ? 34 : 52);
      const progressionH = compact ? 37 : 48;
      sectionPlate(this, progressionX, progressionY, progressionW, progressionH, { material: "iron", fill: "#292820", stroke: PALETTE.cyan, accent: PALETTE.cyan, raised: true });
      this.text("本局新增", progressionX + (compact ? 10 : 14), progressionY + progressionH / 2, compact ? 11 : 13, PALETTE.cyan, "left", "900");
      this.fitText(progression.slice(0, 3).join(" · "), progressionX + (compact ? 72 : 90), progressionY + progressionH / 2, compact ? 10 : 13, progressionW - (compact ? 82 : 104), PALETTE.cream, "left", "900", 9);
    }
    const buttonY = y + h - (compact ? 49 : 62);
    if (!won && Array.isArray(run.advice) && run.advice.length) {
      const adviceY = buttonY - (compact ? 55 : 70);
      this.text("复盘建议", x + (compact ? 18 : 28), adviceY, compact ? 11 : 13, PALETTE.amber, "left", "900");
      this.fitText(run.advice[0], x + (compact ? 86 : 108), adviceY, compact ? 10 : 12, w - (compact ? 108 : 140), PALETTE.cream, "left", "700", 9);
      if (run.advice[1]) this.fitText(run.advice[1], x + (compact ? 18 : 28), adviceY + (compact ? 18 : 23), compact ? 9 : 11, w - (compact ? 36 : 56), PALETTE.muted, "left", "700", 8);
    }
    this.button("restart", "再来一局", this.width / 2 - (compact ? 154 : 178), buttonY, compact ? 146 : 168, compact ? 40 : 46, "primary");
    this.button("menu", "返回主页", this.width / 2 + (compact ? 8 : 10), buttonY, compact ? 146 : 168, compact ? 40 : 46, "secondary");
  },

  drawWindowNotice() {
    this.ctx.fillStyle = "rgba(16,14,12,0.94)";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.text("请放宽游戏窗口", this.width / 2, this.height / 2 - 20, 28, PALETTE.white, "center", "bold");
    this.text("建议使用 16:9 横向窗口或按 F 切换全屏", this.width / 2, this.height / 2 + 22, 14, PALETTE.muted, "center");
  }
};

module.exports = { HUD_METHODS };
