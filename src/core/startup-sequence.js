"use strict";

class StartupSequence {
  constructor(options = {}) {
    this.enabled = options.enabled === true && options.reducedMotion !== true;
    this.startedAt = null;
    this.finished = !this.enabled;
    this.skipped = false;
    this.state = { active: this.enabled, elapsed: 0, progress: 0, assetsReady: false };
  }

  get active() { return !this.finished; }

  advance(now, assetsReady = false) {
    if (this.startedAt === null) this.startedAt = now;
    const elapsed = Math.max(0, (now - this.startedAt) / 1000);
    if (elapsed >= 3.2 || elapsed >= 2.15 && assetsReady) this.finished = true;
    Object.assign(this.state, { active: !this.finished, elapsed,
      progress: Math.min(1, elapsed / 2.15), assetsReady: Boolean(assetsReady) });
    return this.state;
  }

  skip() {
    this.finished = true;
    this.skipped = true;
    this.state.active = false;
  }
}

module.exports = { StartupSequence };
