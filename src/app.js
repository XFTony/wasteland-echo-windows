"use strict";

const { SCREENS, assertPort } = require("./core/contracts");
const { FixedStepClock } = require("./core/fixed-step-clock");
const { InputManager } = require("./input/input-manager");
const { UiNavigator } = require("./input/ui-navigator");
const { keyboardCommand, gamepadCommand } = require("./input/command-map");
const { executeUiCommand, dispatchAction, toggleSetting } = require("./runtime/action-router");

const EMPTY_GAMEPADS = Object.freeze([]);

class GameApp {
  constructor({ model, renderer, audio, platform, input }) {
    this.model = assertPort("model", model, ["setInput", "tick", "drainEvents"]);
    this.renderer = assertPort("renderer", renderer, ["resize", "render", "hitTest"]);
    this.audio = assertPort("audio", audio, ["setSettings", "handle", "update", "unlock", "suspend"]);
    this.platform = assertPort("platform", platform, ["viewport", "raf", "now"]);
    this.inputManager = input || new InputManager();
    this.navigator = new UiNavigator();
    this.clock = new FixedStepClock({ step: 1 / 60, maxCatchUpSteps: 4, maxFrameDelta: 0.1 });
    this.running = false;
    this.boundFrame = (time) => this.frame(time);
    this.metrics = { fps: 60, frameMs: 16.67, simulationSteps: 0, droppedCatchUps: 0 };
    this.viewportState = { width: 960, height: 540, aimOriginX: 480, aimOriginY: 270 };
    this.inputOptions = { gamepads: EMPTY_GAMEPADS, settings: this.model.save.settings, keyBindings: this.model.save.keyBindings, screen: this.model.screen, width: 960, height: 540, aimOriginX: 480, aimOriginY: 270, now: 0 };
    this.audio.setSettings(this.model.save.settings);
  }

  get keyboard() { return this.inputManager.keyboard; }
  get pointer() { return this.inputManager.pointer; }
  get input() { return this.inputManager.gameplay; }
  get fixedStep() { return this.clock.step; }
  get maxCatchUpSteps() { return this.clock.maxCatchUpSteps; }
  get accumulator() { return this.clock.accumulator; }
  set accumulator(value) { this.clock.accumulator = value; }
  get lastTime() { return this.clock.lastTime; }
  set lastTime(value) { this.clock.lastTime = value; }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    this.clock.reset(this.platform.now());
    this.platform.raf(this.boundFrame);
  }

  stop() {
    this.running = false;
    this.resetInput();
  }

  resize() {
    const viewport = this.platform.viewport();
    this.renderer.resize(viewport.width, viewport.height, viewport.dpr || 1);
  }

  contextKey() {
    return `${this.model.screen}:${this.model.menuPage || ""}`;
  }

  inputViewport() {
    const viewport = this.viewportState;
    viewport.width = this.renderer.width;
    viewport.height = this.renderer.height;
    viewport.aimOriginX = this.renderer.width / 2;
    viewport.aimOriginY = this.renderer.height / 2;
    const player = this.model.run && this.model.run.player;
    const camera = this.renderer.camera;
    if (player && camera && Number.isFinite(camera.x) && Number.isFinite(camera.y)) {
      viewport.aimOriginX = player.x - camera.x;
      viewport.aimOriginY = player.y - camera.y;
    }
    return viewport;
  }

  frame(time) {
    if (!this.running) return;
    const gamepads = typeof this.platform.gamepads === "function" ? this.platform.gamepads() : EMPTY_GAMEPADS;
    const viewport = this.inputViewport();
    const inputOptions = this.inputOptions;
    inputOptions.gamepads = gamepads;
    inputOptions.settings = this.model.save.settings;
    inputOptions.keyBindings = this.model.save.keyBindings;
    inputOptions.screen = this.model.screen;
    inputOptions.width = viewport.width;
    inputOptions.height = viewport.height;
    inputOptions.aimOriginX = viewport.aimOriginX;
    inputOptions.aimOriginY = viewport.aimOriginY;
    inputOptions.now = time;
    this.inputManager.update(inputOptions);
    for (const rawCommand of this.inputManager.drainGamepadCommands()) {
      const command = gamepadCommand(rawCommand, this.model);
      if (command) this.executeCommand(command);
    }

    this.model.setInput(this.input);
    const timing = this.clock.advance(time, this.model.screen === SCREENS.RUNNING, (dt) => this.model.tick(dt));
    if (this.model.screen !== SCREENS.RUNNING) this.clock.accumulator = 0;

    const events = this.model.drainEvents();
    if (events.some((event) => event.type === "setting")) this.audio.setSettings(this.model.save.settings);
    this.audio.handle(events);
    this.audio.update(timing.dt, this.model.screen === SCREENS.RUNNING, this.model.run);
    this.inputManager.handleFeedback(events, this.model.save.settings, time);
    if (typeof this.renderer.updatePerformance === "function") this.renderer.updatePerformance(timing.dt);
    if (typeof this.renderer.handleEvents === "function") this.renderer.handleEvents(events, this.model);
    if (typeof this.renderer.updateEffects === "function") this.renderer.updateEffects(timing.dt);

    const frameMs = timing.dt * 1000;
    this.metrics.frameMs += (frameMs - this.metrics.frameMs) * 0.08;
    this.metrics.fps = this.metrics.frameMs > 0 ? 1000 / this.metrics.frameMs : 60;
    this.metrics.simulationSteps = timing.steps;
    this.metrics.droppedCatchUps = this.clock.droppedCatchUps;

    const presentation = this.inputManager.getPresentationState();
    presentation.focusAction = this.navigator.focusedAction;
    presentation.metrics = this.metrics;
    this.renderer.render(this.model, presentation);
    this.navigator.sync(this.renderer.regions, this.contextKey());
    presentation.focusAction = this.navigator.focusedAction;
    this.platform.raf(this.boundFrame);
  }

  updateKeyboard() {
    const viewport = this.inputViewport();
    const inputOptions = this.inputOptions;
    inputOptions.settings = this.model.save.settings;
    inputOptions.keyBindings = this.model.save.keyBindings;
    inputOptions.screen = this.model.screen;
    inputOptions.width = viewport.width;
    inputOptions.height = viewport.height;
    inputOptions.aimOriginX = viewport.aimOriginX;
    inputOptions.aimOriginY = viewport.aimOriginY;
    inputOptions.now = this.platform.now();
    this.inputManager.update(inputOptions);
  }

  keyDown(code, options = {}) {
    if (this.model.pendingBindingAction) {
      this.audio.unlock();
      if (code === "Escape") this.model.cancelKeyBinding();
      else this.model.applyKeyBinding(code);
      this.resetInput();
      return;
    }
    const state = this.inputManager.keyDown(code);
    this.updateKeyboard();
    this.audio.unlock();
    if (!state.alreadyPressed) {
      const command = keyboardCommand(code, {
        screen: this.model.screen,
        menuPage: this.model.menuPage,
        keyBindings: this.model.save.keyBindings,
        shiftKey: Boolean(options.shiftKey)
      });
      if (command) this.executeCommand(command);
    }
  }

  keyUp(code) {
    this.inputManager.keyUp(code);
    this.updateKeyboard();
  }

  resetInput(options = {}) {
    this.inputManager.reset({ resetAim: Boolean(options.resetAim) });
  }

  mouseDown(x, y) {
    this.audio.unlock();
    const action = this.renderer.hitTest(x, y);
    this.inputManager.mouseDown(x, y, this.inputViewport());
    if (action) {
      this.navigator.set(action, this.renderer.regions);
      this.handleAction(action);
      this.inputManager.mouseUp();
      this.updateKeyboard();
      return;
    }
    this.updateKeyboard();
  }

  mouseMove(x, y) {
    this.inputManager.mouseMove(x, y, this.inputViewport());
    this.updateKeyboard();
  }

  mouseUp() {
    this.inputManager.mouseUp();
    this.updateKeyboard();
  }

  executeCommand(command) {
    return executeUiCommand(this, command);
  }

  handleAction(action) {
    return dispatchAction(this, action);
  }

  toggleSetting(key) {
    return toggleSetting(this, key);
  }

  onHide() {
    this.resetInput();
    if (this.model.screen === SCREENS.RUNNING) this.model.togglePause();
    this.audio.suspend();
  }

  onShow() {
    this.clock.reset(this.platform.now());
  }
}

module.exports = { GameApp };
