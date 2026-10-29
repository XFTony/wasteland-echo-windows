"use strict";

const { PALETTE } = require("../config");
const { equippedDefinitionMap } = require("../core/equipment");
const { drawSurvivorActor, drawZombieActor } = require("./pixel-actors");
const { ART_IDS } = require("./art/asset-catalog");
const { UI_COLORS } = require("./ui/theme");
const { cutCornerPath, drawEchoMark, focusBrackets, sectionTitle } = require("./ui/art-primitives");
const { drawAssetCover } = require("./ui/image-primitives");
const { drawFieldButton, drawFieldPlate, drawTextScrim } = require("./ui/field-surfaces");
const { hash2 } = require("./render-hash");
const { BINDABLE_ACTIONS, keyLabel } = require("../input/key-bindings");
const { GAME_VERSION, DESKTOP_SAVE_PATH } = require("../version");
const { drawRadioMainMenu, drawRadioMenuChoice } = require("./ui/radio-main-menu");
const { toggleSwitch } = require("./ui/radio-materials");

const MENU_BACKDROPS = Object.freeze({
  main: ART_IDS.RADIO_CAMP,
  loadout: ART_IDS.RADIO_DESK,
  inventory: ART_IDS.RADIO_DESK,
  shop: ART_IDS.RADIO_DESK,
  settings: ART_IDS.RADIO_DESK,
  credits: ART_IDS.RADIO_DESK
});

const MENU_METHODS = {
  drawMenuBackdrop(menuPage = "main") {
    const ctx = this.ctx;
    const backgroundId = MENU_BACKDROPS[menuPage] || MENU_BACKDROPS.main;
    const backgroundReady = this.artStore && this.artStore.ready(backgroundId);
    if (backgroundReady && drawAssetCover(this, backgroundId, 0, 0, this.width, this.height, { focalX: 0.5, focalY: 0.5, pixelated: true })) {
      if (backgroundId !== this.activeMenuBackdrop) {
        if (typeof this.artStore.releaseGroup === "function") this.artStore.releaseGroup("menu-backdrop", backgroundId);
        this.activeMenuBackdrop = backgroundId;
      }
      ctx.fillStyle = menuPage === "main" ? "rgba(10,14,10,0.04)" : "rgba(14,17,12,0.24)";
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }
    if (this.activeMenuBackdrop && drawAssetCover(this, this.activeMenuBackdrop, 0, 0, this.width, this.height, { focalX: 0.5, focalY: 0.5, pixelated: true })) {
      ctx.fillStyle = "rgba(10,9,7,0.28)";
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }
    ctx.fillStyle = this.menuGradient || "#4d3829";
    ctx.fillRect(0, 0, this.width, this.height);
    const horizon = this.height * 0.57;
    const sunX = this.width * 0.74;
    const sunY = this.height * 0.18;
    const sunSize = Math.max(30, Math.min(58, this.height * 0.1));
    ctx.fillStyle = "rgba(177,105,59,0.1)";
    ctx.fillRect(sunX - sunSize * 0.78, sunY - sunSize * 0.78, sunSize * 1.56, sunSize * 1.56);
    ctx.fillStyle = "#9b6341";
    ctx.fillRect(sunX - sunSize / 2, sunY - sunSize / 2, sunSize, sunSize);
    ctx.fillStyle = "rgba(32,27,23,0.18)";
    for (let stripe = -sunSize / 2 + 5; stripe < sunSize / 2; stripe += 7) {
      ctx.fillRect(sunX - sunSize / 2, sunY + stripe, sunSize, 2);
    }

    // Three silhouette depths give the menu a stage-like wasteland composition.
    ctx.fillStyle = "#493b30";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let px = 0; px <= this.width; px += 72) {
      ctx.lineTo(px, horizon - ((hash2(px, 13) % 60) + 10));
    }
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();

    ctx.fillStyle = "#2d2924";
    ctx.beginPath();
    ctx.moveTo(0, horizon + this.height * 0.08);
    for (let px = 0; px <= this.width; px += 54) {
      ctx.lineTo(px, horizon + 8 - (hash2(px, 29) % 38));
    }
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();

    // Broken pylons and a collapsed radio mast establish the world before a run starts.
    ctx.fillStyle = "#211e1b";
    const ground = this.height * 0.79;
    ctx.fillRect(0, ground, this.width, this.height - ground);
    for (let px = 12; px < this.width; px += 96) {
      const pylonH = 18 + (hash2(px, 41) % 34);
      ctx.fillStyle = px % 192 === 12 ? "#563229" : "#3e362d";
      ctx.fillRect(px, ground - pylonH, 7, pylonH);
      ctx.fillRect(px - 8, ground - pylonH + 7, 23, 5);
    }
    const mastX = this.width * 0.84;
    this.strokeLine(mastX, ground, mastX - 31, horizon - 74, "#24211e", 5);
    this.strokeLine(mastX - 31, horizon - 74, mastX + 4, horizon - 26, "#24211e", 3);
    this.strokeLine(mastX - 42, horizon - 55, mastX - 13, horizon - 55, "#24211e", 3);

    // A road and sparse dust particles subtly animate without changing layout.
    ctx.fillStyle = "rgba(14,13,12,0.26)";
    ctx.beginPath();
    ctx.moveTo(this.width * 0.47, this.height);
    ctx.lineTo(this.width * 0.59, horizon + 2);
    ctx.lineTo(this.width * 0.65, horizon + 2);
    ctx.lineTo(this.width * 0.83, this.height);
    ctx.closePath();
    ctx.fill();
    for (let index = 0; index < 22; index += 1) {
      const drift = (this.frame * (0.18 + (index % 4) * 0.04) + hash2(index, 71)) % (this.width + 80);
      const dustX = drift - 40;
      const dustY = this.height * 0.22 + (hash2(index, 91) % Math.max(1, Math.floor(this.height * 0.5)));
      ctx.fillStyle = index % 3 === 0 ? "rgba(231,216,173,0.18)" : "rgba(231,216,173,0.1)";
      ctx.fillRect(dustX, dustY, index % 4 + 1, 1);
    }

    ctx.fillStyle = "rgba(18,16,14,0.22)";
    for (let py = 0; py < this.height; py += 4) ctx.fillRect(0, py, this.width, 1);
  },

  drawMainMenu(model) {
    drawRadioMainMenu(this, model);
  },

  drawTitleKeyArt() {
    const image = this.coverArt;
    if (!image || !image.complete || !image.naturalWidth || typeof this.ctx.drawImage !== "function") return false;
    const compact = this.height < 430 || this.width < 720;
    const areaW = this.width * (compact ? 0.68 : 0.66);
    const areaH = this.height * (compact ? 0.94 : 0.96);
    const scale = Math.min(areaW / image.naturalWidth, areaH / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const drawX = this.width - drawW - this.width * (compact ? 0.005 : 0.012);
    const drawY = (this.height - drawH) * 0.5;
    this.ctx.save();
    this.ctx.globalAlpha = 0.98;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(image, drawX, drawY, drawW, drawH);
    this.ctx.restore();
    return true;
  },

  menuChoice(action, label, detail, x, y, w, h, primary = false) {
    drawRadioMenuChoice(this, action, label, detail, x, y, w, h, primary);
  },

  drawMenuActorShowcase(model, compact) {
    const ctx = this.ctx;
    const skin = this.content.get("skins", model.selectedSkin, this.content.defaults.skin);
    const weapon = this.content.get("weapons", model.selectedWeapon, this.content.defaults.weapon);
    const actorX = this.width * (compact ? 0.78 : 0.75);
    const actorY = this.height * (compact ? 0.66 : 0.68);
    const unit = Math.max(compact ? 1.35 : 1.85, Math.min(compact ? 1.8 : 2.7, this.height / 215));
    ctx.save();
    ctx.globalAlpha = 0.34;
    drawZombieActor(ctx, {
      enemy: { id: 901, role: "runner", radius: 8, heading: Math.PI, hitFlash: 0, elite: false, boss: false },
      x: actorX + 100 * unit,
      y: actorY + 12 * unit,
      elapsed: this.frame / 60
    });
    drawZombieActor(ctx, {
      enemy: { id: 902, role: "chaser", radius: 10, heading: Math.PI, hitFlash: 0, elite: false, boss: false },
      x: actorX - 92 * unit,
      y: actorY + 20 * unit,
      elapsed: this.frame / 60
    });
    ctx.restore();
    ctx.fillStyle = "rgba(240,184,90,0.08)";
    ctx.fillRect(actorX - 80 * unit, actorY + 24 * unit, 172 * unit, 2);
    drawSurvivorActor(ctx, {
      x: actorX,
      y: actorY,
      unit,
      skin,
      skinId: model.selectedSkin,
      heroId: model.selectedHero,
      weapon,
      aimX: 0.93,
      aimY: -0.36,
      elapsed: this.frame / 60,
      moving: false,
      recoil: Math.max(0, Math.sin(this.frame * 0.035) * 0.45),
      portrait: true,
      equipment: equippedDefinitionMap(model.save, this.content)
    });
    const labelX = actorX - 70 * unit;
    const labelY = actorY - 74 * unit;
    this.text("幸存者 / 01", labelX, labelY, compact ? 8 : 10, PALETTE.amber, "left", "700", "mono");
    this.fitText(skin.name, labelX, labelY + (compact ? 14 : 18), compact ? 12 : 16, 150 * unit, PALETTE.cream, "left", "800", 9);
    if (!compact) this.text("荒原广播第 27 次恢复", labelX, labelY + 38, 10, PALETTE.muted, "left", "600");
  },

  drawSettings(model) {
    const compact = this.height < 600 || this.width < 900;
    const panelW = Math.min(1240, this.width - (compact ? 16 : 58));
    const panelH = Math.min(760, this.height - (compact ? 16 : 42));
    const x = (this.width - panelW) / 2;
    const y = (this.height - panelH) / 2;
    const headerH = compact ? 50 : 76;
    drawTextScrim(this, x, y, Math.min(panelW * 0.62, compact ? 500 : 720), headerH, { fill: "rgba(13,14,12,0.92)", accent: UI_COLORS.cyan });
    drawEchoMark(this, x + (compact ? 18 : 28), y + (compact ? 12 : 18), UI_COLORS.cyan, compact ? 0.7 : 0.95);
    this.displayText("桌面设置", x + (compact ? 58 : 82), y + headerH / 2 + 2, compact ? 25 : 38, UI_COLORS.white);
    this.text("音频、辅助瞄准、手柄与显示", x + (compact ? 210 : 286), y + headerH / 2 + 4, compact ? 11 : 14, UI_COLORS.paper, "left", "700");
    const tabW = compact ? 88 : 118;
    const tabH = compact ? 30 : 38;
    const tabY = y + (headerH - tabH) / 2;
    drawFieldButton(this, "settingsSection:general", "常规与音频", x + panelW - tabW * 2 - (compact ? 10 : 18), tabY, tabW, tabH, { accent: model.settingsSection === "general" ? UI_COLORS.cyan : UI_COLORS.iron });
    drawFieldButton(this, "settingsSection:controls", "按键绑定", x + panelW - tabW - (compact ? 6 : 12), tabY, tabW, tabH, { accent: model.settingsSection === "controls" ? UI_COLORS.cyan : UI_COLORS.iron });
    if (model.settingsSection === "controls") {
      this.drawControlBindings(model, { compact, panelW, panelH, x, y, headerH });
      return;
    }
    const settings = model.save.settings;
    const deadzoneLabel = settings.gamepadDeadzone < 0.15 ? "低" : settings.gamepadDeadzone < 0.23 ? "标准" : "高";
    const rows = [
      ["music", "背景音乐", `${Math.round(settings.music * 100)}%`, "range", settings.musicMuted],
      ["sfx", "战斗音效", `${Math.round(settings.sfx * 100)}%`, "range", settings.sfxMuted],
      ["uiScale", "界面缩放", `${Math.round(settings.uiScale * 100)}%`, "range", false],
      ["autoAim", "自动瞄准", settings.autoAim ? "开" : "关", "toggle"],
      ["autoFire", "自动开火", settings.autoFire ? "开" : "关", "toggle"],
      ["screenShake", "屏幕抖动", { off: "关", low: "低", high: "高" }[settings.screenShake], "toggle"],
      ["flashes", "闪光强度", { off: "关", low: "低", high: "高" }[settings.flashes], "toggle"],
      ["gamepadEnabled", "手柄输入", settings.gamepadEnabled ? "开" : "关", "toggle"],
      ["gamepadVibration", "手柄震动", settings.gamepadVibration ? "开" : "关", "toggle"],
      ["gamepadDeadzone", "摇杆死区", deadzoneLabel, "toggle"],
      ["showControlHints", "控制提示", settings.showControlHints ? "开" : "关", "toggle"],
      ["showFps", "性能信息", settings.showFps ? "开" : "关", "toggle"],
      ["introAnimation", "启动动画", settings.introAnimation ? "开" : "关", "toggle"],
      ["replayStartup", "启动画面", "重播", "action"]
    ];
    const columns = 2;
    const rowsPerColumn = Math.ceil(rows.length / columns);
    const footerArea = compact ? 86 : 112;
    const contentTop = y + headerH + 20;
    const contentWidth = panelW - (compact ? 24 : 40);
    const columnW = contentWidth / columns;
    const rowH = Math.min(compact ? 52 : 72, (panelH - headerH - footerArea - 20) / rowsPerColumn);
    for (let column = 0; column < 2; column++) {
      drawTextScrim(this, x + (compact ? 12 : 20) + column * columnW, contentTop - 5, columnW - 10, rowH * rowsPerColumn + 5,
        { fill: "rgba(31,35,26,0.95)" });
    }
    rows.forEach(([key, label, value, kind, muted], index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const columnX = x + (compact ? 12 : 20) + column * columnW;
      const rowY = contentTop + row * rowH;
      this.ctx.fillStyle = "rgba(183,170,132,0.16)";
      this.ctx.fillRect(columnX + 12, rowY + rowH - 4, columnW - 34, 1);
      this.fitText(label, columnX + (compact ? 12 : 18), rowY + rowH / 2, compact ? 13 : 16, columnW - (compact ? 102 : 148), PALETTE.cream, "left", "800", 11);
      const buttonH = compact ? Math.max(34, rowH - 14) : Math.min(46, rowH - 16);
      if (kind === "action") {
        this.button("replayStartup", value, columnX + columnW - (compact ? 82 : 118), rowY + (rowH - buttonH) / 2,
          compact ? 72 : 100, buttonH, "secondary");
      } else if (kind === "range") {
        const controlRight = columnX + columnW - (compact ? 10 : 18);
        const smallW = compact ? 32 : 38;
        const valueW = compact ? 68 : 92;
        this.button(`adjust:${key}:-1`, "−", controlRight - smallW * 2 - valueW - 8, rowY + (rowH - buttonH) / 2, smallW, buttonH, "secondary");
        if (key === "music" || key === "sfx") {
          this.button(`toggle:${key}Muted`, muted ? "静音" : value, controlRight - smallW - valueW - 4, rowY + (rowH - buttonH) / 2, valueW, buttonH, muted ? "danger" : "primary");
        } else {
          drawFieldPlate(this, controlRight - smallW - valueW - 4, rowY + (rowH - buttonH) / 2, valueW, buttonH, { accent: UI_COLORS.cyan });
          this.text(value, controlRight - smallW - valueW / 2 - 4, rowY + rowH / 2, compact ? 11 : 13, PALETTE.cream, "center", "800");
        }
        this.button(`adjust:${key}:1`, "+", controlRight - smallW, rowY + (rowH - buttonH) / 2, smallW, buttonH, "secondary");
      } else {
        const buttonW = compact ? 72 : 100;
        const buttonX = columnX + columnW - buttonW - (compact ? 10 : 18), buttonY = rowY + (rowH - buttonH) / 2;
        if (value === "开" || value === "关") toggleSwitch(this, `toggle:${key}`, value, buttonX, buttonY, buttonW, buttonH);
        else this.button(`toggle:${key}`, value, buttonX, buttonY, buttonW, buttonH, "secondary");
      }
    });
    const footerY = y + panelH - (compact ? 43 : 54);
    const gamepadStatus = this.gamepadConnected ? `手柄：${this.gamepadId || "Gamepad"}` : "未检测到手柄";
    const status = `${gamepadStatus} · v${GAME_VERSION} · 存档：${DESKTOP_SAVE_PATH}`;
    const guideY = contentTop + rowH * rowsPerColumn + (compact ? 7 : 12);
    const guideH = footerY - guideY - (compact ? 8 : 14);
    if (guideH >= 56) {
      const guideX = x + (compact ? 10 : 18);
      drawFieldPlate(this, guideX, guideY, contentWidth, guideH, { accent: this.gamepadConnected ? UI_COLORS.cyan : UI_COLORS.gold });
      sectionTitle(this, "输入速记", "INPUT 07", guideX + 18, guideY + (compact ? 20 : 30), contentWidth - 36, {
        accent: this.gamepadConnected ? UI_COLORS.cyan : UI_COLORS.gold,
        size: compact ? 12 : 15,
        role: "ui"
      });
      const lineY = guideY + (compact ? 42 : 61);
      const keyboardGuide = `键鼠  WASD 移动  ·  ${settings.autoAim ? "自动锁敌" : "鼠标瞄准"} / ${settings.autoFire ? "自动射击" : "左键射击"}  ·  Esc 暂停`;
      this.fitText(keyboardGuide, guideX + 14, lineY, compact ? 10 : 13, contentWidth * 0.56, UI_COLORS.paper, "left", "700", 10);
      this.fitText(`手柄  左摇杆移动  ·  ${settings.autoFire ? "自动射击" : "RT / RB 射击"}  ·  A 确认  ·  B 返回`, guideX + contentWidth - 14, lineY, compact ? 10 : 13, contentWidth * 0.4, UI_COLORS.paper, "right", "700", 10);
    }
    drawFieldButton(this, "fullscreen", "切换全屏  F", this.width / 2 - (compact ? 157 : 180), footerY, compact ? 148 : 168, compact ? 34 : 42, { accent: UI_COLORS.cyan });
    drawFieldButton(this, "back", "返回营地", this.width / 2 + (compact ? 9 : 12), footerY, compact ? 148 : 168, compact ? 34 : 42, { accent: UI_COLORS.gold });
    this.fitText(status, this.width / 2, footerY - (compact ? 9 : 16), compact ? 9 : 11, panelW - 40, this.gamepadConnected ? PALETTE.cyan : PALETTE.muted, "center", "700", 8);
  },

  drawControlBindings(model, layout) {
    const { compact, panelW, panelH, x, y, headerH } = layout;
    const bindings = model.save.keyBindings;
    const columns = compact ? 3 : 2;
    const rowsPerColumn = Math.ceil(BINDABLE_ACTIONS.length / columns);
    const footerArea = compact ? 54 : 82;
    const contentTop = y + headerH + (compact ? 3 : 8);
    const contentWidth = panelW - (compact ? 18 : 36);
    const columnW = contentWidth / columns;
    const rowH = Math.min(compact ? 42 : 62, (panelH - headerH - footerArea) / rowsPerColumn);
    for (let index = 0; index < BINDABLE_ACTIONS.length; index += 1) {
      const action = BINDABLE_ACTIONS[index];
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const columnX = x + (compact ? 9 : 18) + column * columnW;
      const rowY = contentTop + row * rowH;
      const pending = model.pendingBindingAction === action.id;
      drawFieldPlate(this, columnX + 2, rowY + 2, columnW - 6, rowH - 4, { accent: pending ? UI_COLORS.gold : UI_COLORS.cyan, active: pending || this.focusAction === `bind:${action.id}` });
      this.fitText(action.label, columnX + (compact ? 8 : 14), rowY + rowH / 2, compact ? 10 : 13, columnW - (compact ? 66 : 116), PALETTE.cream, "left", "800", 8);
      const buttonW = compact ? 52 : 88;
      const buttonH = Math.max(28, Math.min(compact ? 34 : 42, rowH - 10));
      this.button(`bind:${action.id}`, pending ? "请按键" : keyLabel(bindings[action.id]), columnX + columnW - buttonW - (compact ? 8 : 14), rowY + (rowH - buttonH) / 2, buttonW, buttonH, pending ? "danger" : "primary");
    }
    const footerY = y + panelH - (compact ? 39 : 52);
    const message = model.bindingMessage || "点击一项后按下新按键；冲突按键会自动交换，方向键保留给菜单导航";
    this.fitText(message, x + panelW / 2, footerY - (compact ? 9 : 16), compact ? 9 : 12, panelW - (compact ? 20 : 44), model.pendingBindingAction ? PALETTE.amber : PALETTE.muted, "center", "700", 8);
    drawFieldButton(this, "resetBindings", "恢复默认", this.width / 2 - (compact ? 157 : 180), footerY, compact ? 148 : 168, compact ? 34 : 42, { accent: UI_COLORS.rust });
    drawFieldButton(this, "back", "返回营地", this.width / 2 + (compact ? 9 : 12), footerY, compact ? 148 : 168, compact ? 34 : 42, { accent: UI_COLORS.gold });
  },

  drawCredits(model) {
    const compact = this.height < 580 || this.width < 850;
    const panelW = Math.min(1180, this.width - (compact ? 16 : 64));
    const panelH = Math.min(720, this.height - (compact ? 16 : 48));
    const x = (this.width - panelW) / 2;
    const y = (this.height - panelH) / 2;
    const headerH = compact ? 52 : 80;
    drawTextScrim(this, x, y, Math.min(panelW * 0.6, compact ? 430 : 650), headerH, { fill: "rgba(14,13,10,0.91)", accent: UI_COLORS.gold });
    drawEchoMark(this, x + (compact ? 18 : 28), y + (compact ? 12 : 18), UI_COLORS.gold, compact ? 0.7 : 0.95);
    this.displayText("制作与许可", x + (compact ? 58 : 82), y + headerH / 2 + 2, compact ? 25 : 38, UI_COLORS.white);
    const unlockRuleIds = this.content.ids("unlockRules");
    const completedRuleIds = new Set(model.save.completedUnlockRules || []);
    const pendingRules = unlockRuleIds
      .filter((id) => !completedRuleIds.has(id))
      .map((id) => ({ rule: this.content.unlockRules[id], progress: model.getUnlockRuleProgress(id) }))
      .sort((left, right) => right.progress.ratio - left.progress.ratio);
    const nextRule = pendingRules[0] || null;
    const rulesLine = `规则档案：${completedRuleIds.size}/${unlockRuleIds.length} · 蓝图 ${(model.save.unlockedBlueprints || []).length}/10 · 协议 ${(model.save.unlockedModifiers || []).length}/4 · 铭牌 ${(model.save.masteryBadges || []).length}/7`;
    const nextRuleLine = nextRule
      ? `下一目标：${nextRule.rule.name} — ${nextRule.rule.description}（${Math.round(nextRule.progress.ratio * 100)}%）`
      : "下一目标：全部规则已完成";
    const lines = [
      "当前版本：v1.5 技术重构预览",
      `生存档案：成就 ${Object.keys(model.save.achievements || {}).length}/8 · 结算 ${model.save.settledRuns} · 击败 ${model.save.totalKills}`,
      rulesLine,
      nextRuleLine,
      "游戏设计、战斗内核与像素角色：本项目原创",
      "像素人物、营地与桌面场景：项目生成素材，经原生像素整理",
      "字标采用 Fusion Pixel；中文正文采用系统字体，许可见素材台账",
      "音频：原创主题编曲；实录枪声 SnakeF8；氛围 SubspaceAudio（CC0）",
      "输入：可重绑定键盘鼠标 + 标准 Gamepad API 手柄",
      "完整来源、许可与修改记录：查看 CREDITS.md 和素材台账"
    ];
    const bodyX = x + (compact ? 12 : 22);
    const bodyY = y + headerH;
    const bodyW = Math.min(panelW - (compact ? 24 : 44), compact ? panelW * 0.94 : 860);
    const bodyH = panelH - headerH - (compact ? 52 : 70);
    drawTextScrim(this, bodyX, bodyY, bodyW, bodyH, { fill: "rgba(16,14,11,0.9)", accent: UI_COLORS.gold });
    sectionTitle(this, "荒原档案 / WASTELAND RECORD", "FILE 01", bodyX + 16, bodyY + (compact ? 20 : 27), bodyW - 32, { accent: UI_COLORS.gold, size: compact ? 13 : 16, role: "ui" });
    lines.forEach((line, index) => {
      this.fitText(line, bodyX + (compact ? 16 : 24), bodyY + (compact ? 50 : 66) + index * (compact ? 27 : 38), index === 0 ? compact ? 13 : 17 : compact ? 11 : 14, bodyW - (compact ? 32 : 48), index === 0 ? PALETTE.amber : PALETTE.cream, "left", index === 0 ? "900" : "700", 10);
    });
    if (nextRule) {
      const progressY = bodyY + (compact ? 50 : 66) + 3 * (compact ? 27 : 38) - (compact ? 10 : 15);
      const progressX = bodyX + (compact ? 16 : 24);
      const progressW = bodyW - (compact ? 32 : 48);
      this.ctx.fillStyle = "#37342c";
      this.ctx.fillRect(progressX, progressY, progressW, compact ? 3 : 5);
      this.ctx.fillStyle = UI_COLORS.gold;
      this.ctx.fillRect(progressX, progressY, progressW * nextRule.progress.ratio, compact ? 3 : 5);
    }
    drawFieldButton(this, "back", "返回营地", this.width / 2 - 80, y + panelH - (compact ? 43 : 55), 160, compact ? 34 : 42, { accent: UI_COLORS.gold });
  }
};

module.exports = { MENU_METHODS };
