async (page) => {
  await page.evaluate(() => {
    const game = window.__WASTELAND_GAME__;
    const model = game.model;
    model.startRun({ seed: 20260918, duration: 180 });
    Object.assign(model.run.upgrades, {
      damage: 3, pierce: 2,
      projectile: 2, fireRate: 3,
      magnet: 3, recovery: 2,
      armor: 3, phaseLining: 2
    });
    model.run.upgradeOptions = model.createUpgradeOptions();
    model.screen = "levelup";
  });
  await page.waitForTimeout(800);
}
