async (page) => {
  const sceneMatch = /[?&]qaScene=([^&]+)/.exec(page.url());
  const scene = sceneMatch ? decodeURIComponent(sceneMatch[1]) : "tutorial";
  await page.evaluate((selectedScene) => {
    const runtime = window.__WASTELAND_GAME__;
    const model = runtime.model;
    if (selectedScene === "inventory") {
      model.releaseAllEntities();
      model.run = null;
      model.screen = "menu";
      model.setMenuPage("inventory");
      model.save.ownedEquipment = model.content.ids("equipment").slice();
      model.save.equippedEquipment = {
        helmet: "signal_charm",
        chest: "iron_plate",
        legs: "servo_greaves",
        boots: "stormstep_boots"
      };
      model.setInventoryPage(0);
      return;
    }

    model.startRun({ seed: 20260919, duration: 180, stageId: "signal_dawn", tutorial: selectedScene === "tutorial" });
    model.releaseAllEntities();
    model.updateSpawner = () => {};
    if (selectedScene === "tutorial") {
      model.run.elapsed = 24;
      model.run.tutorial.active = true;
      model.run.tutorial.completed = false;
      model.run.tutorial.stepIndex = 2;
      model.run.tutorial.progress = 1;
      const player = model.run.player;
      for (let index = 0; index < 9; index += 1) {
        const angle = index / 9 * Math.PI * 2;
        model.spawnEnemy(index % 3 === 0 ? "runner" : "drifter", player.x + Math.cos(angle) * (150 + index * 8), player.y + Math.sin(angle) * (150 + index * 8));
      }
    } else if (selectedScene === "result") {
      Object.assign(model.run, {
        elapsed: 180,
        kills: 83,
        eliteKills: 7,
        scrap: 46,
        shotsFired: 420,
        projectilesFired: 460,
        hits: 287,
        criticalHits: 31,
        damageDealt: 12543,
        maxNoHitTime: 68.4
      });
      model.finishRun("win");
    } else if (selectedScene === "evolution") {
      Object.assign(model.run.upgrades, { speed: 3, phaseLining: 2, velocity: 3, critical: 2 });
      model.run.upgradeOptions = [
        model.content.upgrades.kineticLoop,
        model.content.upgrades.arcNetwork,
        model.content.upgrades.penetratorDoctrine,
        model.content.upgrades.phaseAegis
      ];
      model.screen = "levelup";
    }
    model.tick = () => {};
  }, scene);
  await page.waitForTimeout(800);
}
