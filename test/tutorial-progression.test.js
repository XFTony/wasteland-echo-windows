"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SaveManager, createDefaultSave } = require("../src/core/save");
const { GameModel } = require("../src/core/game-model");
const { currentTutorialStep } = require("../src/core/tutorial");
const {
  masteryLevelForExperience,
  recordRunHistory
} = require("../src/core/progression");

function createModel() {
  let stored = null;
  const manager = new SaveManager({
    get: () => stored,
    set: (_key, value) => { stored = value; }
  });
  return new GameModel(manager, { seed: 1701, duration: 60 });
}

test("first-run field manual advances through real gameplay actions and persists completion", () => {
  const model = createModel();
  model.startRun({ seed: 1701, tutorial: true });
  model.updateSpawner = () => {};
  const startEvent = model.drainEvents().find((event) => event.type === "runStart");
  assert.match(startEvent.radioTitle, /破晓频段/);
  assert.match(startEvent.radioDetail, /广播塔/);
  assert.equal(currentTutorialStep(model.run.tutorial).id, "deployment");

  for (let index = 0; index < 40; index += 1) model.tick(0.05);
  assert.equal(currentTutorialStep(model.run.tutorial).id, "move");

  model.setInput({ moveX: 1, moveY: 0, aimX: 1, aimY: 0, aimActive: true, firing: false });
  for (let index = 0; index < 26; index += 1) model.tick(0.05);
  assert.equal(currentTutorialStep(model.run.tutorial).id, "fire");

  model.fireWeapon(1, 0);
  model.fireWeapon(1, 0);
  model.fireWeapon(1, 0);
  assert.equal(currentTutorialStep(model.run.tutorial).id, "pickup");

  const pickup = model.spawnPickup("scrap", model.run.player.x, model.run.player.y, 1);
  model.collectPickup(pickup);
  assert.equal(currentTutorialStep(model.run.tutorial).id, "upgrade");

  model.screen = "levelup";
  model.run.upgradeOptions = [model.content.upgrades.damage];
  assert.equal(model.chooseUpgrade("damage"), true);
  assert.equal(currentTutorialStep(model.run.tutorial).id, "pause");

  model.togglePause();
  assert.equal(model.run.tutorial.completed, true);
  assert.equal(model.save.tutorialCompleted, true);
  assert.equal(model.save.tutorialSkipped, false);

  model.goToMenu();
  model.startRun({ seed: 1702 });
  assert.equal(model.run.tutorial.active, false, "completed players are not forced through the manual again");
});

test("field manual can be skipped once without affecting combat", () => {
  const model = createModel();
  model.startRun({ seed: 1801 });
  assert.equal(model.skipTutorial(), true);
  assert.equal(model.run.tutorial.active, false);
  assert.equal(model.save.tutorialSkipped, true);
  assert.equal(model.screen, "running");
  assert.equal(model.skipTutorial(), false);
});

test("combat statistics, weapon mastery and the newest run summary settle together", () => {
  const model = createModel();
  model.startRun({ seed: 1901, tutorial: false });
  model.releaseAllEntities();
  const enemy = model.spawnEnemy("drifter", model.run.player.x + 50, model.run.player.y);
  enemy.hp = 10;
  model.fireWeapon(1, 0);
  const projectile = model.projectiles[0];
  projectile.critical = true;
  model.damageEnemy(enemy, 100, projectile);
  model.run.elapsed = 12;
  model.run.maxNoHitTime = 12;
  model.finishRun("win");

  assert.equal(model.run.shotsFired, 1);
  assert.equal(model.run.projectilesFired, 1);
  assert.equal(model.run.hits, 1);
  assert.equal(model.run.criticalHits, 1);
  assert.equal(model.run.damageDealt, 10, "overkill does not inflate damage dealt");
  assert.equal(model.run.accuracy, 1);
  assert.ok(model.run.masteryGain > 0);
  assert.equal(model.save.bestNoHitTime, 12);
  assert.equal(model.save.weaponMastery.scrap_pistol.kills, 1);
  assert.equal(model.save.weaponMastery.scrap_pistol.runs, 1);
  assert.equal(model.save.runHistory.length, 1);
  assert.equal(model.save.runHistory[0].seed, 1901);
  assert.equal(model.save.runHistory[0].damageDealt, 10);
});

test("mastery levels are monotonic and run history remains bounded to 20 newest records", () => {
  assert.equal(masteryLevelForExperience(0), 1);
  assert.equal(masteryLevelForExperience(50), 2);
  assert.equal(masteryLevelForExperience(999999), 10);
  const save = createDefaultSave();
  for (let seed = 0; seed < 25; seed += 1) {
    recordRunHistory(save, {
      seed,
      modeId: "survival",
      stageId: "signal_dawn",
      elapsed: seed,
      kills: seed,
      damageDealt: seed * 10,
      projectilesFired: 10,
      hits: 5,
      maxNoHitTime: seed,
      masteryGain: 2,
      masteryLevel: 1,
      player: { weaponId: "scrap_pistol" }
    }, "win");
  }
  assert.equal(save.runHistory.length, 20);
  assert.equal(save.runHistory[0].seed, 24);
  assert.equal(save.runHistory[19].seed, 5);
});
