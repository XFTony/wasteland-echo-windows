"use strict";

const { Random } = require("./random");
const { Pool } = require("./pool");
const { SpatialGrid } = require("./spatial-grid");
const {
  DEFAULT_LIMITS,
  normalizeLimits,
  makeProjectile,
  resetProjectile,
  makeEnemy,
  resetEnemy,
  makePickup,
  resetPickup
} = require("./entity-factories");
const { clamp, distanceSq, circleRectPushOut } = require("./math");
const { copyGameplayInput } = require("./contracts");
const { DEFAULT_CONTENT } = require("./content-registry");
const { DEFAULT_UPGRADE_EFFECTS } = require("./upgrade-effects");
const { createRunState } = require("./run-state");
const { SPAWN_STAGE_DEFINITIONS, buildSpawnStages } = require("./spawn-director");
const { applyRunProgress } = require("./progression");
const { normalizeSettings } = require("./save");
const {
  highestUnlockedStageOrder,
  syncCampaignUnlocks
} = require("./campaign");
const { getShopItemState, purchaseShopItem } = require("./economy");
const { equipItem, unequipItem, applyHeroAndEquipment } = require("./equipment");
const {
  resolveLoadoutSelections,
  persistLoadoutSelections: writeLoadoutSelections,
  cycleLoadoutSelection,
  selectLoadoutSelection
} = require("./loadout-selection");
const { DEFAULT_RUN_DURATION } = require("../config");
const { DEFAULT_WORLD } = require("../world/world-registry");
const { createNavigation } = require("../world/navigation-grid");
const { MenuSession } = require("./menu-session");
const { createTutorialState, currentTutorialStep, advanceTutorial } = require("./tutorial");
const { buildRunAdvice } = require("./run-advice");
const { SpawnSystem } = require("./spawn-system");
const { CombatSim } = require("./combat-sim");
const { MechanicSystem } = require("./mechanic-system");
const { BossSystem } = require("./boss-system");
const { UnlockSystem } = require("./unlock-system");
const { MasterySystem } = require("./mastery-system");

const NORMALIZE_EPSILON = 0.00000001;
const NAVIGATION_REFRESH_SECONDS = 0.35;
function getWeaponLockRange(weapon, rangeMultiplier = 1) {
  const configured = Number(weapon && weapon.lockRange);
  const safeMultiplier = Number.isFinite(Number(rangeMultiplier)) && rangeMultiplier > 0 ? rangeMultiplier : 1;
  if (Number.isFinite(configured) && configured > 0) return configured * safeMultiplier;
  const projectileSpeed = Number(weapon && weapon.projectileSpeed) || 420;
  const ttl = Number(weapon && weapon.ttl) || 0.75;
  return Math.max(160, projectileSpeed * ttl * 0.82) * safeMultiplier;
}

class GameModel {
  constructor(saveManager, options = {}) {
    this.saveManager = saveManager;
    this.save = saveManager.load();
    this.content = options.content || DEFAULT_CONTENT;
    if (!this.content || typeof this.content.get !== "function" || typeof this.content.ids !== "function") {
      throw new TypeError("GameModel requires a content registry with get() and ids()");
    }
    const contentWorld = this.content.world;
    if (options.world && contentWorld && options.world !== contentWorld) {
      throw new Error("GameModel content and world registries must be the same composition");
    }
    this.world = options.world || contentWorld || DEFAULT_WORLD;
    if (!this.world || typeof this.world.get !== "function" || typeof this.world.has !== "function") {
      throw new TypeError("GameModel requires a world registry with has() and get()");
    }
    this.upgradeEffects = Object.freeze({ ...DEFAULT_UPGRADE_EFFECTS, ...(options.upgradeEffects || {}) });
    this.limits = normalizeLimits(options.limits);
    this.durationOverride = Number(options.duration) > 0 ? Number(options.duration) : null;
    this.duration = this.durationOverride || DEFAULT_RUN_DURATION;
    this.seed = options.seed || Date.now();
    this.worldSizeOverride = Number(options.worldSize) > 0 ? Number(options.worldSize) : null;
    this.random = new Random(this.seed);
    this.events = [];
    this.drainedEvents = [];
    this.entityId = 1;
    this.projectilePool = new Pool(makeProjectile, resetProjectile, this.limits.projectileWarmup);
    this.enemyPool = new Pool(makeEnemy, resetEnemy, this.limits.enemyWarmup);
    this.pickupPool = new Pool(makePickup, resetPickup, Math.min(this.limits.pickups, this.limits.pickupWarmup));
    const mapWorldSizes = this.content.ids("maps")
      .map((id) => Number(this.content.maps[id].worldSize))
      .filter((size) => Number.isFinite(size) && size > 0);
    const maximumWorldSize = Math.max(1, ...mapWorldSizes);
    this.enemyGrid = new SpatialGrid(this.limits.gridCellSize, Math.ceil(maximumWorldSize / this.limits.gridCellSize) + 2);
    this.obstacleGrid = new SpatialGrid(this.limits.gridCellSize, Math.ceil(maximumWorldSize / this.limits.gridCellSize) + 2);
    this.maximumEnemyRadius = Math.max(1, ...this.content.ids("enemies").map((id) => Number(this.content.get("enemies", id).radius) || 1));
    this.navigationCellSize = Math.max(32, Math.round(Number(options.navigationCellSize) || 64));
    this.navigationClearance = Math.max(this.maximumEnemyRadius + 4, Number(options.navigationClearance) || 0);
    const enemyRadii = this.content.ids("enemies").map((id) => Number(this.content.get("enemies", id).radius) || 1);
    const smallRadius = Math.max(1, ...enemyRadii.filter((radius) => radius <= 10));
    const mediumRadius = Math.max(smallRadius, ...enemyRadii.filter((radius) => radius <= 20));
    this.navigationClearanceByClass = Object.freeze({
      small: smallRadius + 4,
      medium: mediumRadius + 4,
      large: this.navigationClearance
    });
    this.navigationCache = new Map();
    this.navigation = null;
    this.navigations = null;
    this.navigationRefreshCooldown = 0;
    this.navigationPlayerCell = -1;
    this.enemyGridCount = -1;
    this.enemyGridFirstId = null;
    this.enemyGridLastId = null;
    this.collisionCandidates = [];
    this.separationCandidates = [];
    this.obstacleCandidates = [];
    this.obstacleQuerySeen = new Set();
    this.playerObstacleCandidates = [];
    this.playerObstacleQuerySeen = new Set();
    this.lastPlayerObstacleChecks = 0;
    this.targetCandidates = [];
    this.upgradeCandidateBuffer = [];
    this.screamers = [];
    this.enemySteering = { distance: 0, towardX: 1, towardY: 0, directionX: 1, directionY: 0 };
    this.projectiles = [];
    this.enemyShots = [];
    this.enemies = [];
    this.pickups = [];
    this.pickupMergeCursor = 0;
    this.screen = "menu";
    this.menuPage = "main";
    this.menuSession = new MenuSession(this.save, this.saveManager);
    this.run = null;
    this.masterySystem = options.masterySystem || new MasterySystem(this.content);
    this.unlockSystem = options.unlockSystem || new UnlockSystem(this.content);
    syncCampaignUnlocks(this.save, this.content);
    this.masterySystem.reconcile(this.save);
    this.unlockSystem.evaluate(this.save, null);
    Object.assign(this, resolveLoadoutSelections(this.save, this.content));
    this.mapLayout = this.resolveMapLayout(this.selectedMap);
    this.worldSize = this.worldSizeOverride || this.mapLayout.worldSize;
    writeLoadoutSelections(this.save, this.loadoutSelections());
    this.saveManager.persist();
    this.obstacles = this.createObstacles();
    this.rebuildObstacleGrid();
    this.interactives = this.createInteractives();
    this.environmentHit = { vx: 0, vy: 0, knockback: 28, critical: false };
    this.mechanicSystem = new MechanicSystem(this, this.content);
    this.bossSystem = new BossSystem(this, this.content);
    this.combatSim = new CombatSim(this, this.content);
    this.spawnSystem = new SpawnSystem(this, this.content);
  }

  resolveMapLayout(mapId) {
    const map = this.content.get("maps", mapId, this.content.defaults.map);
    const layout = map && this.world.get(map.layoutId);
    if (!layout) throw new Error(`Map '${mapId}' does not resolve to a registered world layout`);
    return layout;
  }

  loadoutSelections() {
    return {
      selectedWeapon: this.selectedWeapon,
      selectedSkin: this.selectedSkin,
      selectedMode: this.selectedMode,
      selectedHero: this.selectedHero,
      selectedStage: this.selectedStage,
      selectedMap: this.selectedMap,
      shopCategory: this.shopCategory
    };
  }

  cycleLoadout(key, direction = 1) {
    const next = cycleLoadoutSelection(this.save, this.content, this.loadoutSelections(), key, direction);
    Object.assign(this, next);
    if (key === "shopCategory") this.shopMessage = null;
    writeLoadoutSelections(this.save, next);
    this.saveManager.persist();
    this.emit("ui");
  }

  selectLoadout(key, id) {
    const next = selectLoadoutSelection(this.save, this.content, this.loadoutSelections(), key, id);
    if (!next) return false;
    Object.assign(this, next);
    writeLoadoutSelections(this.save, next);
    this.saveManager.persist();
    this.emit("ui", { selection: key, id });
    return true;
  }

  createObstacles() {
    return this.mapLayout.obstacles
      .filter((obstacle) => obstacle.x < this.worldSize && obstacle.y < this.worldSize)
      .map((obstacle) => ({ ...obstacle }));
  }

  createInteractives() {
    return (this.mapLayout.interactives || [])
      .filter((item) => item.x >= 0 && item.y >= 0 && item.x <= this.worldSize && item.y <= this.worldSize)
      .map((item) => ({ ...item, active: true, pulse: 0 }));
  }

  setupNavigation() {
    const layout = {
      id: this.mapLayout.id,
      worldSize: this.worldSize,
      obstacles: this.obstacles
    };
    const navigations = {};
    for (const [sizeClass, clearance] of Object.entries(this.navigationClearanceByClass)) {
      const cacheKey = `${this.mapLayout.id}:${this.worldSize}:${this.navigationCellSize}:${clearance}`;
      let navigation = this.navigationCache.get(cacheKey);
      if (!navigation) {
        navigation = createNavigation(layout, {
          cellSize: this.navigationCellSize,
          clearance
        });
        this.navigationCache.set(cacheKey, navigation);
      }
      navigations[sizeClass] = navigation;
    }
    this.navigations = navigations;
    this.navigation = navigations.small;
    this.navigationRefreshCooldown = 0;
    this.navigationPlayerCell = -1;
    this.updateNavigation(0, true);
  }

  updateNavigation(dt, force = false) {
    if (!this.navigation || !this.navigations || !this.run) return false;
    this.navigationRefreshCooldown = Math.max(0, this.navigationRefreshCooldown - dt);
    const player = this.run.player;
    const playerCell = this.navigation.grid.worldIndex(player.x, player.y);
    if (!force && (playerCell === this.navigationPlayerCell || this.navigationRefreshCooldown > 0)) return false;
    let rebuilt = false;
    for (const navigation of Object.values(this.navigations)) {
      rebuilt = navigation.flow.rebuild(player.x, player.y) || rebuilt;
    }
    if (rebuilt) {
      this.navigationPlayerCell = playerCell;
      this.navigationRefreshCooldown = NAVIGATION_REFRESH_SECONDS;
    }
    return rebuilt;
  }

  navigationForEnemy(enemy) {
    if (!this.navigations) return this.navigation;
    if (enemy.radius <= 10) return this.navigations.small;
    if (enemy.radius <= 20) return this.navigations.medium;
    return this.navigations.large;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const drained = this.events;
    this.events = this.drainedEvents;
    this.drainedEvents = drained;
    this.events.length = 0;
    return drained;
  }

  setMenuPage(page) {
    this.menuPage = page;
    if (page !== "settings") this.menuSession.leaveSettings();
    this.emit("ui");
  }

  get settingsSection() { return this.menuSession.settingsSection; }
  get pendingBindingAction() { return this.menuSession.pendingBindingAction; }
  get bindingMessage() { return this.menuSession.bindingMessage; }
  get inventoryPage() { return this.menuSession.inventoryPage; }
  get shopMessage() { return this.menuSession.shopMessage; }
  set shopMessage(value) { this.menuSession.shopMessage = value; }
  get spawnStages() { return this.spawnSystem.stages; }

  setSettingsSection(section) {
    this.menuSession.setSettingsSection(section);
    this.emit("ui");
  }

  beginKeyBinding(actionId) {
    if (!this.menuSession.beginKeyBinding(actionId)) return false;
    this.emit("ui");
    return true;
  }

  cancelKeyBinding() {
    this.menuSession.cancelKeyBinding();
    this.emit("ui");
  }

  applyKeyBinding(code) {
    const result = this.menuSession.applyKeyBinding(code);
    this.emit("ui");
    return result;
  }

  resetKeyBindings() {
    this.menuSession.resetKeyBindings();
    this.emit("ui");
  }

  setInventoryPage(page) {
    this.menuSession.setInventoryPage(page);
    this.emit("ui");
  }

  cycleWeapon(direction = 1) {
    this.cycleLoadout("selectedWeapon", direction);
  }

  selectWeapon(id) {
    return this.selectLoadout("selectedWeapon", id);
  }

  cycleSkin(direction = 1) {
    this.cycleLoadout("selectedSkin", direction);
  }

  selectSkin(id) {
    return this.selectLoadout("selectedSkin", id);
  }

  cycleMode(direction = 1) {
    this.cycleLoadout("selectedMode", direction);
  }

  cycleHero(direction = 1) {
    this.cycleLoadout("selectedHero", direction);
  }

  selectHero(id) {
    return this.selectLoadout("selectedHero", id);
  }

  cycleStage(direction = 1) {
    this.cycleLoadout("selectedStage", direction);
  }

  cycleMap(direction = 1) {
    this.cycleLoadout("selectedMap", direction);
  }

  cycleShopCategory(direction = 1) {
    this.cycleLoadout("shopCategory", direction);
  }

  getShopState(itemId) {
    return getShopItemState(
      this.save,
      this.content.get("shopItems", itemId),
      highestUnlockedStageOrder(this.save, this.content)
    );
  }

  getUnlockRuleProgress(ruleId, run = null) {
    return this.unlockSystem.progressForRule(this.save, run, ruleId);
  }

  buyShopItem(itemId) {
    const item = this.content.get("shopItems", itemId);
    const result = purchaseShopItem(this.save, item, highestUnlockedStageOrder(this.save, this.content));
    const messages = {
      purchased: `已购入：${item ? item.name : "物品"}`,
      owned: "该物品已经拥有",
      ruleLocked: "先完成对应档案规则取得蓝图",
      locked: "先完成前置关卡才能购买",
      insufficient: "货币不足",
      missing: "物品数据不存在"
    };
    this.shopMessage = { text: messages[result.status] || "购买失败", tone: result.ok ? "success" : "danger" };
    if (result.ok && item && item.grantType === "equipment") equipItem(this.save, item.grantId, this.content);
    if (result.ok) this.saveManager.persist();
    this.emit("shop", { itemId, ...result });
    return result;
  }

  equip(itemId) {
    const result = equipItem(this.save, itemId, this.content);
    this.shopMessage = {
      text: result.ok ? `已装备：${this.content.get("equipment", itemId).name}` : "尚未拥有该装备",
      tone: result.ok ? "success" : "danger"
    };
    if (result.ok) this.saveManager.persist();
    this.emit("ui");
    return result;
  }

  unequip(slot) {
    const result = unequipItem(this.save, slot);
    this.shopMessage = {
      text: result.itemId ? "装备已收入背包" : "该部位当前为空",
      tone: result.ok ? "success" : "danger"
    };
    if (result.ok) this.saveManager.persist();
    this.emit("ui");
    return result;
  }

  updateSetting(key, value) {
    if (!(key in this.save.settings)) return;
    this.save.settings[key] = normalizeSettings({ ...this.save.settings, [key]: value })[key];
    this.saveManager.persist();
    this.emit("setting", { key, value: this.save.settings[key] });
  }

  startRun(options = {}) {
    this.releaseAllEntities();
    this.seed = options.seed || Date.now();
    this.random = new Random(this.seed);
    const weaponId = this.content.has("weapons", options.weaponId) ? options.weaponId : this.selectedWeapon;
    const skinId = this.content.has("skins", options.skinId) ? options.skinId : this.selectedSkin;
    const modeId = this.content.has("modes", options.modeId) ? options.modeId : this.selectedMode;
    const heroId = this.content.has("heroes", options.heroId) ? options.heroId : this.selectedHero;
    const stageId = this.content.has("stages", options.stageId) ? options.stageId : this.selectedStage;
    const stage = this.content.get("stages", stageId, this.content.defaults.stage);
    const mapId = this.content.has("maps", options.mapId) ? options.mapId : this.selectedMap;
    const map = this.content.get("maps", mapId, this.content.defaults.map);
    const mode = this.content.get("modes", modeId, this.content.defaults.mode);
    const hero = this.content.get("heroes", heroId, this.content.defaults.hero);
    this.mapLayout = this.resolveMapLayout(mapId);
    this.worldSize = this.worldSizeOverride || Number(map.worldSize) || this.mapLayout.worldSize;
    this.obstacles = this.createObstacles();
    this.rebuildObstacleGrid();
    this.interactives = this.createInteractives();
    this.duration = Number(options.duration) > 0 ? Number(options.duration) : this.durationOverride || Number(stage.duration) || DEFAULT_RUN_DURATION;
    this.run = createRunState({
      duration: this.duration,
      worldSize: this.worldSize,
      weaponId,
      skinId,
      modeId,
      heroId,
      mapId,
      stageId,
      difficulty: (Number(stage.difficulty) || 1) * (Number(map.threat) || 1),
      seed: this.seed,
      mode
    });
    const tutorialEnabled = options.tutorial === true
      || (options.tutorial !== false && !this.save.tutorialCompleted && !this.save.tutorialSkipped);
    this.run.tutorial = createTutorialState(tutorialEnabled);
    const equipped = applyHeroAndEquipment(this.run.player, hero, this.save, this.content);
    this.masterySystem.applyPerks(this.run.player, this.save, weaponId);
    this.run.equipmentIds = equipped.map((item) => item.id);
    this.run.equipmentLoadout = Object.fromEntries(equipped.map((item) => [item.slot, item]));
    this.setupNavigation();
    this.screen = "running";
    this.menuPage = "main";
    this.emit("runStart", {
      seed: this.seed,
      weaponId,
      skinId,
      modeId,
      heroId,
      mapId,
      stageId,
      radioTitle: stage.radioTitle,
      radioDetail: stage.radioDetail
    });
    this.spawnEnemy("drifter", this.run.player.x + 220, this.run.player.y);
    if (this.run.rule === "extract") this.spawnEnemy("drifter", this.run.player.x - 210, this.run.player.y + 80);
    this.rebuildEnemyGrid();
  }

  releaseAllEntities() {
    for (const item of this.projectiles) this.projectilePool.release(item);
    for (const item of this.enemyShots) this.projectilePool.release(item);
    for (const item of this.enemies) this.enemyPool.release(item);
    for (const item of this.pickups) this.pickupPool.release(item);
    this.projectiles.length = 0;
    this.enemyShots.length = 0;
    this.enemies.length = 0;
    this.pickups.length = 0;
    this.pickupMergeCursor = 0;
  }

  setInput(input) {
    if (!this.run) return;
    copyGameplayInput(this.run.input, input);
  }

  progressTutorial(stepId, amount = 1) {
    const tutorial = this.run && this.run.tutorial;
    const step = currentTutorialStep(tutorial);
    if (!step || step.id !== stepId) return false;
    const advanced = advanceTutorial(tutorial, amount);
    if (!advanced) return false;
    const next = currentTutorialStep(tutorial);
    if (tutorial.completed) {
      this.save.tutorialCompleted = true;
      this.save.tutorialSkipped = false;
      this.saveManager.persist();
      this.emit("tutorialComplete");
    } else {
      this.emit("tutorialStep", { stepId: next && next.id });
    }
    return true;
  }

  skipTutorial() {
    const tutorial = this.run && this.run.tutorial;
    if (!tutorial || !tutorial.active) return false;
    tutorial.active = false;
    tutorial.completed = false;
    this.save.tutorialSkipped = true;
    this.saveManager.persist();
    this.emit("tutorialSkipped");
    return true;
  }

  togglePause() {
    if (this.screen === "running") {
      this.progressTutorial("pause", 1);
      this.screen = "paused";
      this.emit("pause");
    } else if (this.screen === "paused") {
      this.screen = "running";
      this.emit("resume");
    }
  }

  goToMenu() {
    this.releaseAllEntities();
    this.run = null;
    this.screen = "menu";
    this.menuPage = "main";
    this.emit("ui");
  }

  tick(dt) {
    if (this.screen !== "running" || !this.run) return;
    const step = clamp(dt, 0, 0.05);
    const run = this.run;
    const player = run.player;

    run.elapsed += step;
    player.noHitTime += step;
    run.maxNoHitTime = Math.max(run.maxNoHitTime, player.noHitTime);
    player.invulnerable = Math.max(0, player.invulnerable - step);
    player.weaponCooldown -= step;
    this.mechanicSystem.tick(run, step);
    this.progressTutorial("deployment", step);
    if (player.regenPerSecond > 0 && player.noHitTime >= 4 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + player.regenPerSecond * step);
    }

    this.updatePlayer(step);
    if (run.input.moveX * run.input.moveX + run.input.moveY * run.input.moveY > 0.04) {
      this.progressTutorial("move", step);
    }
    this.updateNavigation(step);
    if (run.rule === "extract") this.updateExtraction(step);
    this.updateSpawner(step);
    this.updateEnemies(step);
    this.updateProjectiles(step);
    this.updateInteractives(step);
    this.updatePickups(step);
    this.compactEntities();

    if (!run.endless && run.elapsed >= this.duration) {
      if (run.rule === "survive") {
        this.finishRun("win");
      } else if (run.extraction.hold >= run.extraction.required) {
        this.finishRun("win");
      } else {
        run.overtime += step;
        if (run.overtime >= 15) this.finishRun("lose");
      }
    }
  }

  updatePlayer(dt) {
    const { player, input } = this.run;
    let moveX = input.moveX;
    let moveY = input.moveY;
    const moveLengthSq = moveX * moveX + moveY * moveY;
    if (moveLengthSq > 1) {
      const inverseLength = 1 / Math.sqrt(moveLengthSq);
      moveX *= inverseLength;
      moveY *= inverseLength;
    }
    player.x += moveX * player.speed * dt;
    player.y += moveY * player.speed * dt;
    player.x = clamp(player.x, player.radius + 24, this.worldSize - player.radius - 24);
    player.y = clamp(player.y, player.radius + 24, this.worldSize - player.radius - 24);
    const nearbyObstacles = this.obstacleGrid.queryCircleUnique(
      player.x,
      player.y,
      player.radius,
      this.playerObstacleCandidates,
      this.playerObstacleQuerySeen
    );
    this.lastPlayerObstacleChecks = nearbyObstacles.length;
    for (let index = 0; index < nearbyObstacles.length; index += 1) circleRectPushOut(player, nearbyObstacles[index]);

    let aimX = input.aimX;
    let aimY = input.aimY;
    let aimLengthSq = aimX * aimX + aimY * aimY;
    let hasAim = aimLengthSq > NORMALIZE_EPSILON;
    let target = null;
    if (this.save.settings.autoAim) {
      const weapon = this.content.get("weapons", player.weaponId, this.content.defaults.weapon);
      // Automatic combat intentionally begins only after a hostile enters the
      // selected weapon's useful lock range. Mouse/right-stick input remains
      // dormant in this mode so shots cannot drift toward a distant target.
      target = this.findNearestEnemy(
        player.x,
        player.y,
        getWeaponLockRange(weapon, player.projectileRangeMultiplier * player.lockRangeMultiplier)
      );
      if (target) {
        const targetX = target.x - player.x;
        const targetY = target.y - player.y;
        aimLengthSq = targetX * targetX + targetY * targetY;
        if (aimLengthSq > NORMALIZE_EPSILON) {
          const inverseLength = 1 / Math.sqrt(aimLengthSq);
          aimX = targetX * inverseLength;
          aimY = targetY * inverseLength;
          hasAim = true;
        }
      } else {
        aimX = player.lastAimX;
        aimY = player.lastAimY;
        hasAim = false;
      }
    } else if (hasAim) {
      const inverseLength = 1 / Math.sqrt(aimLengthSq);
      aimX *= inverseLength;
      aimY *= inverseLength;
    } else {
      aimX = player.lastAimX;
      aimY = player.lastAimY;
    }
    player.aimTargetId = target ? target.id : null;
    if (hasAim) {
      player.lastAimX = aimX;
      player.lastAimY = aimY;
    }
    const wantsToFire = this.save.settings.autoFire || input.firing;
    const canFire = this.save.settings.autoAim ? Boolean(target) : hasAim;
    if (wantsToFire && player.weaponCooldown <= 0 && canFire) {
      this.fireWeapon(player.lastAimX, player.lastAimY);
    }
  }

  fireWeapon(aimX, aimY) {
    return this.combatSim.fireWeapon(aimX, aimY);
  }

  updateSpawner(dt) {
    return this.spawnSystem.update(dt);
  }

  chooseEnemyType(progress) {
    return this.spawnSystem.chooseEnemyType(progress);
  }

  spawnAtEdge(type) {
    return this.spawnSystem.spawnAtEdge(type);
  }

  spawnEnemy(type, x, y) {
    return this.combatSim.spawnEnemy(type, x, y);
  }

  updateEnemies(dt) {
    return this.combatSim.updateEnemies(dt);
  }

  resolveEnemyWorldCollision(enemy) {
    return this.combatSim.resolveEnemyWorldCollision(enemy);
  }

  rebuildObstacleGrid() {
    this.obstacleGrid.clear();
    for (const obstacle of this.obstacles) {
      this.obstacleGrid.insertBounds(obstacle, obstacle.x, obstacle.y, obstacle.x + obstacle.w, obstacle.y + obstacle.h);
    }
  }

  resolveEnemySeparation() {
    return this.combatSim.resolveEnemySeparation();
  }

  hasScreecherBuff(enemy) {
    return this.combatSim.hasScreecherBuff(enemy);
  }

  rebuildEnemyGrid() {
    return this.combatSim.rebuildEnemyGrid();
  }

  radialAttack(enemy, count, speed, damage) {
    return this.combatSim.radialAttack(enemy, count, speed, damage);
  }

  spawnEnemyShot(enemy, dx, dy, speed, damage, ttl, color) {
    return this.combatSim.spawnEnemyShot(enemy, dx, dy, speed, damage, ttl, color);
  }

  updateProjectiles(dt) {
    return this.combatSim.updateProjectiles(dt);
  }

  hitExplosiveInteractive(projectile) {
    return this.combatSim.hitExplosiveInteractive(projectile);
  }

  triggerInteractive(interactive) {
    return this.combatSim.triggerInteractive(interactive);
  }

  updateInteractives(dt) {
    return this.combatSim.updateInteractives(dt);
  }

  damageEnemy(enemy, amount, projectile) {
    return this.combatSim.damageEnemy(enemy, amount, projectile);
  }

  damagePlayer(amount, sourceX, sourceY, source = null) {
    return this.combatSim.damagePlayer(amount, sourceX, sourceY, source);
  }

  killEnemy(enemy) {
    return this.combatSim.killEnemy(enemy);
  }

  spawnPickup(type, x, y, value) {
    return this.combatSim.spawnPickup(type, x, y, value);
  }

  updatePickups(dt) {
    return this.combatSim.updatePickups(dt);
  }

  collectPickup(pickup) {
    return this.combatSim.collectPickup(pickup);
  }

  checkLevelUp() {
    const player = this.run.player;
    if (player.xp < player.xpNext || this.screen !== "running") return;
    player.xp -= player.xpNext;
    player.level += 1;
    player.xpNext = 10 + player.level * 8;
    this.run.upgradeOptions = this.createUpgradeOptions();
    this.screen = "levelup";
    this.emit("levelup", { level: player.level });
  }

  createUpgradeOptions() {
    const pool = this.upgradeCandidateBuffer;
    pool.length = 0;
    const evolutions = [];
    for (const upgradeId of this.content.ids("upgrades")) {
      const upgrade = this.content.upgrades[upgradeId];
      const level = this.run.upgrades[upgrade.id] || 0;
      if (level >= upgrade.max || typeof this.upgradeEffects[upgrade.id] !== "function" || !this.upgradeRequirementsMet(upgrade)) continue;
      if (upgrade.evolution) evolutions.push(upgrade);
      else pool.push(upgrade);
    }
    const choices = [];
    while (choices.length < 4 && evolutions.length) {
      const index = this.random.int(0, evolutions.length - 1);
      choices.push(evolutions[index]);
      evolutions[index] = evolutions[evolutions.length - 1];
      evolutions.length -= 1;
    }
    while (choices.length < 4 && pool.length) {
      const selected = this.random.weighted(pool, (upgrade) => this.upgradeSelectionWeight(upgrade));
      const index = pool.indexOf(selected);
      choices.push(selected);
      pool[index] = pool[pool.length - 1];
      pool.length -= 1;
    }
    return choices;
  }

  upgradeSelectionWeight(upgrade) {
    const current = Number(this.run && this.run.upgrades && this.run.upgrades[upgrade.id]) || 0;
    const mechanicRank = Number(this.run && this.run.mechanicUpgrades && this.run.mechanicUpgrades[upgrade.id]) || 0;
    return 1 + (current > 0 ? 0.7 : 0) + (mechanicRank > 0 ? 0.25 : 0);
  }

  upgradeSalvageValue() {
    const level = Math.max(1, Number(this.run && this.run.player && this.run.player.level) || 1);
    return Math.min(18, 4 + Math.floor(level / 2) * 2);
  }

  upgradeRequirementsMet(upgrade) {
    if (!upgrade.requires) return true;
    const requirements = upgrade.requires.upgrades || {};
    for (const [requiredId, requiredLevel] of Object.entries(requirements)) {
      if ((this.run.upgrades[requiredId] || 0) < requiredLevel) return false;
    }
    if (upgrade.requires.masteryUnlock === true) {
      const unlocked = Array.isArray(this.save.unlockedEvolutions) ? this.save.unlockedEvolutions : [];
      if (!unlocked.includes(upgrade.id)) return false;
    }
    const weaponClasses = upgrade.requires.weaponClasses;
    if (Array.isArray(weaponClasses) && weaponClasses.length) {
      const weapon = this.content.get("weapons", this.run.player.weaponId, this.content.defaults.weapon);
      if (!weaponClasses.includes(weapon.weaponClass)) return false;
    }
    const weaponIds = upgrade.requires.weaponIds;
    if (Array.isArray(weaponIds) && weaponIds.length && !weaponIds.includes(this.run.player.weaponId)) return false;
    const rangeBands = upgrade.requires.rangeBands;
    if (Array.isArray(rangeBands) && rangeBands.length) {
      const weapon = this.content.get("weapons", this.run.player.weaponId, this.content.defaults.weapon);
      if (!rangeBands.includes(weapon.rangeBand)) return false;
    }
    return true;
  }

  chooseUpgrade(id) {
    if (this.screen !== "levelup" || !this.run) return false;
    const upgrade = this.run.upgradeOptions.find((option) => option.id === id);
    if (!upgrade) return false;
    const current = this.run.upgrades[id] || 0;
    if (current >= upgrade.max) return false;
    const player = this.run.player;
    const applyEffect = this.upgradeEffects[id];
    if (typeof applyEffect !== "function") return false;
    applyEffect(player, this.run, this);
    this.run.upgrades[id] = current + 1;
    this.run.upgradeOrder.push({ id, level: current + 1, elapsed: this.run.elapsed });
    this.run.upgradeOptions = [];
    this.screen = "running";
    this.progressTutorial("upgrade", 1);
    this.emit("upgrade", { id });
    return true;
  }

  salvageUpgradeOptions() {
    if (this.screen !== "levelup" || !this.run || !this.run.upgradeOptions.length) return false;
    const value = this.upgradeSalvageValue();
    this.run.scrap += value;
    this.run.upgradeOrder.push({ id: "salvage", level: 1, elapsed: this.run.elapsed, value });
    this.run.upgradeOptions = [];
    this.screen = "running";
    this.progressTutorial("upgrade", 1);
    this.emit("upgradeSalvage", { value });
    return true;
  }

  updateExtraction(dt) {
    const extraction = this.run.extraction;
    if (!extraction.active) return;
    const player = this.run.player;
    const inside = distanceSq(player.x, player.y, extraction.x, extraction.y) <= extraction.radius * extraction.radius;
    if (inside) extraction.hold = Math.min(extraction.required, extraction.hold + dt);
    else extraction.hold = Math.max(0, extraction.hold - dt * 0.65);
  }

  finishRun(result) {
    if (!this.run || this.run.result) return;
    const run = this.run;
    run.result = result;
    run.advice = buildRunAdvice(run, result, this.content);
    this.screen = result === "win" ? "resultWin" : "resultLose";
    const mode = this.content.get("modes", run.modeId, this.content.defaults.mode);
    const stage = this.content.get("stages", run.stageId, this.content.defaults.stage);
    const progress = applyRunProgress(this.save, run, this.duration, mode, result, this.content, stage, {
      masterySystem: this.masterySystem,
      unlockSystem: this.unlockSystem
    });
    const { earned, unlocked } = progress;
    run.payout = progress.payout;
    this.saveManager.persist();
    this.emit("result", { result, earned, unlocked, payout: progress.payout });
  }

  findNearestEnemy(x, y, maxDistance = Infinity) {
    let nearest = null;
    let best = maxDistance * maxDistance;
    const firstId = this.enemies.length ? this.enemies[0].id : null;
    const lastId = this.enemies.length ? this.enemies[this.enemies.length - 1].id : null;
    if (this.enemyGridCount !== this.enemies.length || this.enemyGridFirstId !== firstId || this.enemyGridLastId !== lastId) {
      this.rebuildEnemyGrid();
    }
    const candidates = Number.isFinite(maxDistance)
      ? this.enemyGrid.queryCircle(x, y, maxDistance, this.targetCandidates)
      : this.enemies;
    for (const enemy of candidates) {
      if (!enemy.active) continue;
      const distance = distanceSq(x, y, enemy.x, enemy.y);
      if (distance < best) {
        best = distance;
        nearest = enemy;
      }
    }
    return nearest;
  }

  compactEntities() {
    this.compactActive(this.projectiles);
    this.compactActive(this.enemyShots);
    this.compactActive(this.enemies);
    this.compactActive(this.pickups);
  }

  compactActive(items) {
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < items.length; readIndex += 1) {
      const item = items[readIndex];
      if (item.active) {
        items[writeIndex] = item;
        writeIndex += 1;
      }
    }
    items.length = writeIndex;
  }

  getStats() {
    return {
      screen: this.screen,
      seed: this.seed,
      mapId: this.run ? this.run.mapId : this.selectedMap,
      worldSize: this.worldSize,
      enemies: this.enemies.length,
      projectiles: this.projectiles.length + this.enemyShots.length,
      pickups: this.pickups.length,
      pools: {
        enemies: this.enemyPool.stats(),
        projectiles: this.projectilePool.stats(),
        pickups: this.pickupPool.stats()
      },
      spatialCells: this.enemyGrid.activeCellCount,
      playerObstacleChecks: this.lastPlayerObstacleChecks,
      navigationCells: this.navigation ? this.navigation.grid.cellCount : 0,
      navigationRebuilds: this.navigation ? this.navigation.flow.rebuildCount : 0,
      navigationProfiles: this.navigations ? Object.keys(this.navigations).length : 0,
      limits: this.limits
    };
  }
}

module.exports = { GameModel, DEFAULT_LIMITS, normalizeLimits, SPAWN_STAGE_DEFINITIONS, buildSpawnStages };
