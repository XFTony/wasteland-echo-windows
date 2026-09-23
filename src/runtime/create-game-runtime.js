"use strict";

const { SaveManager } = require("../core/save");
const { GameModel } = require("../core/game-model");
const { DEFAULT_CONTENT } = require("../core/content-registry");
const { CanvasRenderer } = require("../render/canvas-renderer");
const { AudioEngine } = require("../platform/audio-engine");
const { InputManager } = require("../input/input-manager");
const { GameApp } = require("../app");
const { DEFAULT_WORLD } = require("../world/world-registry");

function assertRuntimeMember(name, member, content, world) {
  if (!member) return;
  if (member.content && member.content !== content) {
    throw new Error(name + " must use the runtime content registry");
  }
  if (member.world && member.world !== world) {
    throw new Error(name + " must use the runtime world registry");
  }
}

function createGameRuntime(options = {}) {
  const content = options.content
    || (options.model && options.model.content)
    || (options.renderer && options.renderer.content)
    || DEFAULT_CONTENT;
  const contentWorld = content && content.world;
  if (options.world && contentWorld && options.world !== contentWorld) {
    throw new Error("Runtime content and world registries must be the same composition");
  }
  const world = options.world
    || contentWorld
    || (options.model && options.model.world)
    || (options.renderer && options.renderer.world)
    || DEFAULT_WORLD;
  const saveManager = options.saveManager || new SaveManager(options.storage);
  const model = options.model || new GameModel(saveManager, {
    ...(options.modelOptions || {}),
    content,
    world
  });
  const renderer = options.renderer || new CanvasRenderer(options.canvas, {
    content,
    world,
    profile: (options.platform && options.platform.profile) || "desktop"
  });
  assertRuntimeMember("Model", model, content, world);
  assertRuntimeMember("Renderer", renderer, content, world);
  const audio = options.audio || new AudioEngine(options.audioContextFactory);
  const input = options.input || new InputManager();
  const app = new GameApp({ model, renderer, audio, input, platform: options.platform });
  return { app, model, renderer, audio, input, saveManager, content, world };
}

module.exports = { assertRuntimeMember, createGameRuntime };
