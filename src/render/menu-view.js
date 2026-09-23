"use strict";

const { drawShopPage } = require("./ui/shop-page");
const { drawDeploymentPage } = require("./ui/deployment-page");
const { drawInventoryPage } = require("./ui/inventory-page");

function drawMenuPage(renderer, model) {
  if (model.menuPage === "settings") renderer.drawSettings(model);
  else if (model.menuPage === "credits") renderer.drawCredits(model);
  else if (model.menuPage === "shop") drawShopPage(renderer, model);
  else if (model.menuPage === "loadout") drawDeploymentPage(renderer, model);
  else if (model.menuPage === "inventory") drawInventoryPage(renderer, model);
  else renderer.drawMainMenu(model);
}

module.exports = { drawMenuPage };
