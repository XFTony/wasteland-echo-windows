"use strict";

class FixedStepClock {
  constructor(options = {}) {
    this.step = options.step || 1 / 60;
    this.maxCatchUpSteps = options.maxCatchUpSteps || 4;
    this.maxFrameDelta = options.maxFrameDelta || 0.1;
    this.lastTime = 0;
    this.accumulator = 0;
    this.droppedCatchUps = 0;
    this.result = { dt: 0, steps: 0, dropped: false };
  }

  reset(time = 0) {
    this.lastTime = Number.isFinite(time) ? time : 0;
    this.accumulator = 0;
  }

  advance(time, shouldSimulate, simulate) {
    const safeTime = Number.isFinite(time) ? time : this.lastTime;
    const dt = Math.min(this.maxFrameDelta, Math.max(0, (safeTime - this.lastTime) / 1000));
    this.lastTime = safeTime;

    if (!shouldSimulate) {
      this.accumulator = 0;
      this.result.dt = dt;
      this.result.steps = 0;
      this.result.dropped = false;
      return this.result;
    }

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxCatchUpSteps) {
      simulate(this.step);
      this.accumulator -= this.step;
      steps += 1;
    }

    let dropped = false;
    if (steps === this.maxCatchUpSteps && this.accumulator >= this.step) {
      this.accumulator = 0;
      this.droppedCatchUps += 1;
      dropped = true;
    }
    this.result.dt = dt;
    this.result.steps = steps;
    this.result.dropped = dropped;
    return this.result;
  }
}

module.exports = { FixedStepClock };
