async (page) => {
  const mapMatch = /[?&]qaMap=([^&]+)/.exec(page.url());
  const mapId = mapMatch ? decodeURIComponent(mapMatch[1]) : "echo_district";
  const viewpoints = {
    echo_district: { x: 920, y: 900 },
    freight_nexus: { x: 1680, y: 920 },
    red_basin: { x: 2030, y: 1940 }
  };
  const viewpoint = viewpoints[mapId];
  if (!viewpoint) throw new Error(`Unknown QA map '${mapId}'`);
  await page.evaluate(({ selectedMapId, playerX, playerY }) => {
    const game = window.__WASTELAND_GAME__;
    if (!game || !game.model) throw new Error("Wasteland Echo runtime is not available");
    game.model.startRun({ mapId: selectedMapId, seed: 20260918, duration: 180 });
    game.model.releaseAllEntities();
    game.model.updateSpawner = () => {};
    game.model.run.player.x = playerX;
    game.model.run.player.y = playerY;
  }, { selectedMapId: mapId, playerX: viewpoint.x, playerY: viewpoint.y });
  await page.waitForTimeout(500);
}
