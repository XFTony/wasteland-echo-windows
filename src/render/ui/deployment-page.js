"use strict";

const {
  SELECTOR_META,
  drawDeploymentBunkerPage,
  drawSelector
} = require("./deployment-bunker");

function drawDeploymentPage(renderer, model) {
  drawDeploymentBunkerPage(renderer, model);
}

module.exports = {
  SELECTOR_META,
  drawSelector,
  drawDeploymentPage
};
