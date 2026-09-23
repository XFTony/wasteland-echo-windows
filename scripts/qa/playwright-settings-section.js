async (page) => {
  const sectionMatch = /[?&]qaSection=([^&]+)/.exec(page.url());
  const section = sectionMatch ? decodeURIComponent(sectionMatch[1]) : "general";
  await page.evaluate((selectedSection) => {
    const game = window.__WASTELAND_GAME__;
    if (!game || !game.model) throw new Error("Wasteland Echo runtime is not available");
    game.model.setMenuPage("settings");
    game.model.setSettingsSection(selectedSection);
  }, section);
  await page.waitForTimeout(500);
}
