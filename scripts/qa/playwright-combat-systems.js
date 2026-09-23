async (page) => {
  const sceneMatch = /[?&]qaScene=([^&]+)/.exec(page.url());
  const scene = sceneMatch ? decodeURIComponent(sceneMatch[1]) : "interaction";
  await page.evaluate((selectedScene) => {
    const game = window.__WASTELAND_GAME__;
    const model = game.model;
    model.startRun({ seed: 20260918, mapId: "echo_district", duration: 180 });
    model.releaseAllEntities();
    model.updateSpawner = () => {};
    if (selectedScene === "boss") {
      model.run.player.x = 1536;
      model.run.player.y = 1536;
      const boss = model.spawnEnemy("iron_colossus", 1740, 1536);
      boss.hp = boss.maxHp * 0.3;
      boss.actionCooldown = 0;
      model.updateEnemies(0);
    } else {
      const barrel = model.interactives.find((item) => item.type === "explosiveBarrel");
      model.run.player.x = barrel.x;
      model.run.player.y = barrel.y + 150;
      for (let index = 0; index < 7; index += 1) {
        const angle = index / 7 * Math.PI * 2;
        model.spawnEnemy(index % 3 === 0 ? "brute" : "drifter", barrel.x + Math.cos(angle) * 82, barrel.y + Math.sin(angle) * 82);
      }
    }
    model.tick = () => {};
  }, scene);
  await page.waitForTimeout(800);
}
