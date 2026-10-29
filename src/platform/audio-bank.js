"use strict";

const { AUDIO_ASSETS } = require("../content/audio-assets");
const DEFINITIONS = Object.freeze(Object.fromEntries(AUDIO_ASSETS.map(item => [item.id, item])));

// Only short effects are decoded; music remains streamed by the browser.
class AudioBank {
  constructor(loadBytes) { this.loadBytes = loadBytes; this.entries = new Map(); this.stats = { loaded: 0, failed: 0, decodedBytes: 0 }; }
  prepare(context, id) {
    const definition = DEFINITIONS[id];
    if (!context || !this.loadBytes || !definition || definition.role === "music" || typeof context.decodeAudioData !== "function") return Promise.resolve(null);
    const previous = this.entries.get(id);
    if (previous) return previous.promise;
    const entry = { buffer: null, promise: null };
    entry.promise = Promise.resolve().then(() => this.loadBytes(definition.src)).then(bytes => new Promise((resolve, reject) => {
      const result = context.decodeAudioData(bytes, resolve, reject);
      if (result && typeof result.then === "function") result.then(resolve, reject);
    })).then(buffer => {
      entry.buffer = buffer; this.stats.loaded++;
      this.stats.decodedBytes += buffer.length * buffer.numberOfChannels * 4; return buffer;
    }).catch(() => { this.stats.failed++; return null; });
    this.entries.set(id, entry); return entry.promise;
  }
  get(id) { return this.entries.get(id)?.buffer || null; }
}

class MusicStream {
  constructor(createAudio) { this.createAudio = createAudio; this.slots = []; this.unlocked = false; this.suspended = false; this.failed = false; this.target = null; }
  unlock() { this.unlocked = true; this.suspended = false; for (const slot of this.slots) slot.attempted = false; }
  suspend() { this.suspended = true; for (const slot of this.slots) slot.element.pause(); }
  update(dt, id, volume) {
    this.target = id;
    if (!this.createAudio || !this.unlocked || this.suspended || this.failed) return;
    let target = this.slots.find(slot => slot.id === id);
    if (id && volume > 0 && !target) {
      if (this.slots.length >= 2) {
        const index = this.slots[0].gain < this.slots[1].gain ? 0 : 1;
        const retired = this.slots.splice(index, 1)[0]; retired.element.pause(); retired.element.removeAttribute?.("src"); retired.element.load?.();
      }
      try {
        const element = this.createAudio(DEFINITIONS[id].src);
        element.loop = true; element.preload = "none"; element.volume = 0;
        target = { id, element, gain: 0, attempted: false }; this.slots.push(target);
        element.onerror = () => { this.failed = true; for (const slot of this.slots) slot.element.pause(); };
      } catch (_error) { this.failed = true; return; }
    }
    const step = Math.max(0, dt) / .7;
    for (const slot of this.slots) {
      const goal = slot.id === id && volume > 0 ? 1 : 0;
      slot.gain += Math.max(-step, Math.min(step, goal - slot.gain));
      slot.element.volume = Math.max(0, Math.min(1, slot.gain * volume * .58));
      if (goal && slot.element.paused && !slot.attempted) {
        slot.attempted = true;
        try { const result = slot.element.play(); if (result?.catch) result.catch(() => {}); } catch (_error) { slot.attempted = true; }
      }
      if (!goal && slot.gain <= 0) { slot.element.pause(); slot.attempted = false; }
    }
  }
  setVolume(volume) { for (const s of this.slots) s.element.volume = Math.max(0, Math.min(1, s.gain * volume * .58)); }
}

module.exports = { AudioBank, MusicStream, AUDIO_DEFINITIONS: DEFINITIONS };
