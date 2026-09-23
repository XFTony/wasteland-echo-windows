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

const MENU_BACKDROPS = Object.freeze({
  main: ART_IDS.BACKDROP_MAIN,
  loadout: ART_IDS.BACKDROP_DEPLOYMENT,
  inventory: ART_IDS.BACKDROP_INVENTORY,
  shop: ART_IDS.BACKDROP_SHOP,
  settings: ART_IDS.BACKDROP_SETTINGS,
  credits: ART_IDS.BACKDROP_CREDITS
});

const MENU_METHODS = {
  drawMenuBackdrop(menuPage = "main") {
    const ctx = this.ctx;
    const backgroundId = MENU_BACKDROPS[menuPage] || MENU_BACKDROPS.main;
    const backgroundReady = this.artStore && this.artStore.ready(backgroundId);
    if (backgroundReady && drawAssetCover(this, backgroundId, 0, 0, this.width, this.height, { focalX: 0.5, focalY: 0.5 })) {
      if (backgroundId !== this.activeMenuBackdrop) {
        if (typeof this.artStore.releaseGroup === "function") this.artStore.releaseGroup("menu-backdrop", backgroundId);
        this.activeMenuBackdrop = backgroundId;
      }
      ctx.fillStyle = menuPage === "main" ? "rgba(10,9,7,0.08)" : "rgba(10,9,7,0.16)";
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }
    if (this.activeMenuBackdrop && drawAssetCover(this, this.activeMenuBackdrop, 0, 0, this.width, this.height, { focalX: 0.5, focalY: 0.5 })) {
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
    const compact = this.height < 430 || this.width < 720;
    const safeX = compact ? 18 : Math.max(58, this.width * 0.06);
    const safeY = compact ? 18 : Math.max(42, this.height * 0.07);
    const menuW = compact ? Math.min(286, this.width * 0.51) : Math.min(430, this.width * 0.38);
    const hasKeyArt = this.drawTitleKeyArt();
    this.ctx.fillStyle = this.menuReadabilityGradient || "rgba(8,15,20,0.9)";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = this.menuFooterGradient || "rgba(8,12,15,0.3)";
    this.ctx.fillRect(0, 0, this.width, this.height);

    drawEchoMark(this, safeX, safeY, UI_COLORS.orange, compact ? 0.72 : 1.05);
    this.trackedText("WASTELAND SURVIVAL / FIELD 07", safeX + (compact ? 34 : 44), safeY + (compact ? 7 : 10), compact ? 9 : 11, UI_COLORS.gold, compact ? 0.7 : 1.25);
    this.displayText("荒原回响", safeX, safeY + (compact ? 43 : 68), compact ? 39 : 68, UI_COLORS.white);
    this.trackedText("WASTELAND ECHO", safeX + 3, safeY + (compact ? 70 : 110), compact ? 10 : 14, UI_COLORS.cyan, compact ? 1.1 : 2.25);
    this.text("枪火穿过尸潮，失真的信号仍在回响。", safeX + 1, safeY + (compact ? 87 : 137), compact ? 11 : 15, UI_COLORS.paper, "left", "700");

    const startY = safeY + (compact ? 101 : 166);
    const buttonH = compact ? 38 : 62;
    const gap = compact ? 6 : 10;
    this.menuChoice("start", "开始游戏", "进入作战部署", safeX, startY, menuW, buttonH, true, "01");
    this.menuChoice("shop", "拾荒者商栈", "武器 · 服饰 · 装备", safeX, startY + buttonH + gap, menuW, buttonH, false, "02");
    this.menuChoice("settings", "设置", "音频 · 画面 · 控制", safeX, startY + (buttonH + gap) * 2, menuW, buttonH, false, "03");
    this.menuChoice("credits", "档案与制作", "记录 · 许可 · 版本", safeX, startY + (buttonH + gap) * 3, menuW, buttonH, false, "04");

    const footerY = this.height - (compact ? 22 : 42);
    this.text(`铜币 ${model.save.currencies.copper}   金币 ${model.save.currencies.gold}`, safeX, footerY - (compact ? 14 : 20), compact ? 9 : 13, UI_COLORS.gold, "left", "900", "mono");
    this.text(`击败 ${model.save.totalKills}  ·  胜利 ${model.save.wins}  ·  已通关 ${model.save.completedStages.length}  ·  成就 ${Object.keys(model.save.achievements || {}).length}/8`, safeX, footerY, compact ? 8 : 11, UI_COLORS.muted, "left", "800", "mono");

    if (!hasKeyArt) this.drawMenuActorShowcase(model, compact);
    const controlHint = this.gamepadConnected
      ? "A 选择  ·  十字键导航  ·  Menu 暂停"
      : "Enter 选择  ·  方向键导航  ·  F 全屏";
    this.fitText(controlHint, this.width - (compact ? 14 : 34), this.height - (compact ? 13 : 23), compact ? 9 : 11, this.width * 0.46, this.gamepadConnected ? UI_COLORS.cyan : UI_COLORS.muted, "right", "800", 8);
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

  menuChoice(action, label, detail, x, y, w, h, primary = false, index = "") {
    const ctx = this.ctx;
    const pointer = this.pointerState || OFFSCREEN_POINTER;
    const hovered = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
    const focused = this.focusAction === action;
    const active = hovered || focused;
    const pressed = hovered && pointer.down;
    const offset = pressed ? 2 : 0;
    const accent = primary ? UI_COLORS.orange : active ? UI_COLORS.gold : UI_COLORS.iron;
    drawFieldPlate(this, x, y + offset, w, h - offset, { accent, active, raised: active, lineWidth: focused ? 3 : 2 });
    if (primary) {
      const innerX = Math.max(18, w * 0.08);
      const innerY = Math.max(9, h * 0.2);
      ctx.fillStyle = active ? "rgba(169,71,47,0.84)" : "rgba(116,49,36,0.8)";
      ctx.fillRect(x + innerX, y + offset + innerY, w - innerX * 2, Math.max(4, h - innerY * 2 - offset));
    }
    ctx.fillStyle = accent;
    ctx.fillRect(x + 4, y + 7 + offset, active ? 7 : 4, h - 14 - offset);
    this.text(label, x + (h < 48 ? 19 : 25), y + h * 0.35 + offset, h < 48 ? 15 : 20, UI_COLORS.white, "left", "900", "display");
    this.text(detail, x + (h < 48 ? 19 : 25), y + h * 0.72 + offset, h < 48 ? 11 : 13, active ? UI_COLORS.paper : UI_COLORS.muted, "left", "700");
    ctx.fillStyle = active ? "#5a4430" : "#23221d";
    cutCornerPath(ctx, x + w - (h < 48 ? 38 : 46), y + 8 + offset, h < 48 ? 30 : 36, h - 16 - offset, 5);
    ctx.fill();
    this.text(index, x + w - (h < 48 ? 23 : 28), y + h / 2 + offset, h < 48 ? 11 : 13, active ? UI_COLORS.gold : UI_COLORS.ironLight, "center", "900", "mono");
    if (focused) focusBrackets(this, x - 3, y - 3, w + 6, h + 6, UI_COLORS.gold, 2, 14);
    this.addRegion(action, x, y, w, h);
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
      ["autoAim", "自动瞄准（新档默认开）", settings.autoAim ? "开" : "关", "toggle"],
      ["autoFire", "自动开火", settings.autoFire ? "开" : "关", "toggle"],
      ["screenShake", "屏幕抖动", { off: "关", low: "低", high: "高" }[settings.screenShake], "toggle"],
      ["flashes", "闪光强度", { off: "关", low: "低", high: "高" }[settings.flashes], "toggle"],
      ["gamepadEnabled", "手柄输入", settings.gamepadEnabled ? "开" : "关", "toggle"],
      ["gamepadVibration", "手柄震动", settings.gamepadVibration ? "开" : "关", "toggle"],
      ["gamepadDeadzone", "摇杆死区", deadzoneLabel, "toggle"],
      ["showControlHints", "控制提示", settings.showControlHints ? "开" : "关", "toggle"],
      ["showFps", "性能信息", settings.showFps ? "开" : "关", "toggle"]
    ];
    const columns = 2;
    const rowsPerColumn = Math.ceil(rows.length / columns);
    const footerArea = compact ? 86 : 112;
    const contentTop = y + headerH;
    const contentWidth = panelW - (compact ? 24 : 40);
    const columnW = contentWidth / columns;
    const rowH = Math.min(compact ? 52 : 72, (panelH - headerH - footerArea) / rowsPerColumn);
    rows.forEach(([key, label, value, kind, muted], index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const columnX = x + (compact ? 12 : 20) + column * columnW;
      const rowY = contentTop + row * rowH;
      drawFieldPlate(this, columnX + 3, rowY + 3, columnW - 8, rowH - 6, {
        accent: value === "关" ? UI_COLORS.iron : UI_COLORS.cyan,
        active: this.focusAction === `toggle:${key}`
      });
      this.fitText(label, columnX + (compact ? 12 : 18), rowY + rowH / 2, compact ? 13 : 16, columnW - (compact ? 102 : 148), PALETTE.cream, "left", "800", 11);
      const buttonH = compact ? Math.max(34, rowH - 14) : Math.min(46, rowH - 16);
      if (kind === "range") {
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
        this.button(`toggle:${key}`, value, columnX + columnW - buttonW - (compact ? 10 : 18), rowY + (rowH - buttonH) / 2, buttonW, buttonH, value === "关" ? "secondary" : "primary");
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
      const keyboardGuide = settings.autoAim
        ? "键鼠  WASD 移动  ·  范围内自动锁敌 / Space 射击  ·  Esc 暂停"
        : "键鼠  WASD 移动  ·  鼠标瞄准 / 左键射击  ·  Esc 暂停";
      this.fitText(keyboardGuide, guideX + 14, lineY, compact ? 10 : 13, contentWidth * 0.56, UI_COLORS.paper, "left", "700", 10);
      this.fitText("手柄  左摇杆移动  ·  RT / RB 射击  ·  A 确认  ·  B 返回", guideX + contentWidth - 14, lineY, compact ? 10 : 13, contentWidth * 0.4, UI_COLORS.paper, "right", "700", 10);
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
      `生存档案：成就 ${Object.keys(model.save.achievements || {}).length}/8 · 胜利 ${model.save.wins} · 击败 ${model.save.totalKills}`,
      rulesLine,
      nextRuleLine,
      "游戏设计、战斗内核与像素角色：本项目原创",
      "标题主视觉、地表纹理与破框感染者：为本项目生成并登记素材台账",
      "标题字体：Fusion Pixel Font · SIL OFL 1.1；正文使用系统易读字体",
      "音乐与音效：原创编曲 + WebAudio 程序化合成，无外部采样",
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
