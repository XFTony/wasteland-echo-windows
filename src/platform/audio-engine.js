"use strict";

const { WASTELAND_SCORE, getScoreForStage } = require("./music-score");
const { DEFAULT_RUN_DURATION } = require("../config");

const TONES = Object.freeze({
  ui: { frequency: 420, end: 560, duration: 0.055, gain: 0.035, wave: "square" },
  hit: { frequency: 96, end: 58, duration: 0.042, gain: 0.022, wave: "square" },
  criticalHit: { frequency: 610, end: 270, duration: 0.075, gain: 0.035, wave: "triangle" },
  playerHit: { frequency: 92, end: 38, duration: 0.2, gain: 0.075, wave: "sawtooth" },
  pickup: { frequency: 540, end: 760, duration: 0.07, gain: 0.026, wave: "sine" },
  levelup: { frequency: 360, end: 920, duration: 0.34, gain: 0.05, wave: "square" },
  boss: { frequency: 62, end: 38, duration: 0.72, gain: 0.08, wave: "sawtooth" },
  win: { frequency: 330, end: 880, duration: 0.74, gain: 0.06, wave: "triangle" },
  lose: { frequency: 180, end: 48, duration: 0.74, gain: 0.06, wave: "sawtooth" }
});

const SHOT_PROFILES = Object.freeze({
  scrap_pistol: Object.freeze({
    body: [158, 52, 0.105, 0.09, "sawtooth"],
    crack: [1180, 330, 0.032, 0.035, "square"],
    noise: [0.07, 0.08, 1750],
    mechanism: [760, 390, 0.045, 0.024, "triangle", 0.065]
  }),
  swarm_smg: Object.freeze({
    body: [205, 74, 0.064, 0.055, "square"],
    crack: [1450, 430, 0.022, 0.025, "square"],
    noise: [0.042, 0.045, 2300],
    mechanism: [940, 510, 0.032, 0.02, "triangle", 0.04]
  }),
  breaker_shotgun: Object.freeze({
    body: [92, 34, 0.19, 0.145, "sawtooth"],
    crack: [820, 180, 0.055, 0.055, "square"],
    noise: [0.16, 0.14, 1050],
    mechanism: [520, 190, 0.085, 0.032, "triangle", 0.13],
    echo: [64, 38, 0.16, 0.065, "triangle", 0.035]
  }),
  needle_rifle: Object.freeze({
    body: [255, 58, 0.125, 0.105, "sawtooth"],
    crack: [1860, 280, 0.046, 0.05, "square"],
    noise: [0.085, 0.09, 2900],
    mechanism: [1120, 420, 0.07, 0.03, "triangle", 0.09],
    echo: [310, 82, 0.13, 0.035, "triangle", 0.024]
  }),
  rust_revolver: Object.freeze({
    body: [132, 42, 0.15, 0.12, "sawtooth"],
    crack: [1320, 240, 0.045, 0.048, "square"],
    noise: [0.1, 0.105, 1500],
    mechanism: [640, 280, 0.08, 0.03, "triangle", 0.095],
    echo: [88, 48, 0.11, 0.03, "triangle", 0.025]
  }),
  ember_carbine: Object.freeze({
    body: [188, 54, 0.09, 0.075, "sawtooth"],
    crack: [1580, 350, 0.034, 0.038, "square"],
    noise: [0.065, 0.07, 2350],
    mechanism: [890, 360, 0.052, 0.026, "triangle", 0.062]
  }),
  coil_cannon: Object.freeze({
    body: [74, 29, 0.24, 0.15, "sawtooth"],
    crack: [2140, 170, 0.075, 0.06, "square"],
    noise: [0.19, 0.14, 3200],
    mechanism: [1240, 210, 0.14, 0.036, "triangle", 0.15],
    echo: [420, 48, 0.22, 0.055, "sine", 0.04]
  })
});

function midiToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function setParam(param, value, time) {
  if (!param) return;
  if (typeof param.setValueAtTime === "function") param.setValueAtTime(value, time);
  else param.value = value;
}

function rampParam(param, value, time, exponential = false) {
  if (!param) return;
  const method = exponential ? "exponentialRampToValueAtTime" : "linearRampToValueAtTime";
  if (typeof param[method] === "function") param[method](value, time);
  else param.value = value;
}

class AudioEngine {
  constructor(contextFactory) {
    this.contextFactory = contextFactory;
    this.context = null;
    this.settings = { music: 0.55, sfx: 0.75 };
    this.musicClock = 0;
    this.musicStep = 0;
    this.musicBoost = 0;
    this.currentScoreId = null;
    this.lastShotAt = -Infinity;
    this.noiseBuffer = null;
    this.noiseContext = null;
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  unlock() {
    try {
      if (!this.context) {
        this.context = this.contextFactory && this.contextFactory();
        this.noiseBuffer = null;
        this.noiseContext = null;
      }
      if (this.context && typeof this.context.resume === "function") this.context.resume();
    } catch (_error) {
      this.context = null;
    }
  }

  suspend() {
    try {
      if (this.context && typeof this.context.suspend === "function") this.context.suspend();
    } catch (_error) {
      // Audio is optional; gameplay must remain usable.
    }
  }

  playVoice(frequency, end, duration, gainAmount, wave = "triangle", delay = 0, bus = "sfx") {
    const context = this.context;
    const busVolume = Number(this.settings[bus]);
    if (!context || this.settings[`${bus}Muted`] === true || !(busVolume > 0) || typeof context.createOscillator !== "function" || typeof context.createGain !== "function") return false;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime || 0;
      const start = now + delay;
      const finish = start + duration;
      oscillator.type = wave;
      setParam(oscillator.frequency, Math.max(1, frequency), start);
      rampParam(oscillator.frequency, Math.max(1, end), finish, true);
      setParam(gain.gain, 0.0001, start);
      rampParam(gain.gain, Math.max(0.0001, gainAmount * busVolume), start + Math.min(0.008, duration * 0.2));
      rampParam(gain.gain, 0.0001, finish, true);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(finish + 0.02);
      return true;
    } catch (_error) {
      return false;
    }
  }

  ensureNoiseBuffer() {
    const context = this.context;
    if (!context || typeof context.createBuffer !== "function") return null;
    if (this.noiseBuffer && this.noiseContext === context) return this.noiseBuffer;
    try {
      const sampleRate = context.sampleRate || 44100;
      const length = Math.ceil(sampleRate * 0.22);
      const buffer = context.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let state = 0x6d2b79f5;
      for (let index = 0; index < data.length; index += 1) {
        state = (Math.imul(state ^ (state >>> 15), 1 | state) + index) | 0;
        data[index] = (((state ^ (state >>> 14)) >>> 0) / 2147483648 - 1) * (1 - index / data.length * 0.38);
      }
      this.noiseBuffer = buffer;
      this.noiseContext = context;
      return buffer;
    } catch (_error) {
      return null;
    }
  }

  playNoise(duration, gainAmount, filterFrequency, delay = 0, bus = "sfx") {
    const context = this.context;
    const busVolume = Number(this.settings[bus]);
    if (this.settings[`${bus}Muted`] === true) return false;
    if (!context || !(busVolume > 0) || typeof context.createBufferSource !== "function" || typeof context.createGain !== "function") {
      return this.playVoice(filterFrequency, Math.max(120, filterFrequency * 0.25), duration, gainAmount * 0.35, "sawtooth", delay, bus);
    }
    const buffer = this.ensureNoiseBuffer();
    if (!buffer) return this.playVoice(filterFrequency, Math.max(120, filterFrequency * 0.25), duration, gainAmount * 0.35, "sawtooth", delay, bus);
    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime || 0;
      const start = now + delay;
      const finish = start + duration;
      source.buffer = buffer;
      let tail = source;
      if (typeof context.createBiquadFilter === "function") {
        const filter = context.createBiquadFilter();
        filter.type = "bandpass";
        setParam(filter.frequency, filterFrequency, start);
        setParam(filter.Q, 0.72, start);
        source.connect(filter);
        tail = filter;
      }
      setParam(gain.gain, Math.max(0.0001, gainAmount * busVolume), start);
      rampParam(gain.gain, 0.0001, finish, true);
      tail.connect(gain);
      gain.connect(context.destination);
      source.start(start);
      source.stop(finish + 0.01);
      return true;
    } catch (_error) {
      return false;
    }
  }

  tone(name, volumeScale = 1) {
    const definition = TONES[name];
    if (!definition) return;
    this.playVoice(
      definition.frequency,
      definition.end,
      definition.duration,
      definition.gain * volumeScale,
      definition.wave,
      0,
      "sfx"
    );
  }

  playShot(weaponId) {
    const profile = SHOT_PROFILES[weaponId] || SHOT_PROFILES.scrap_pistol;
    this.playVoice(...profile.body, 0, "sfx");
    this.playVoice(...profile.crack, 0, "sfx");
    this.playNoise(profile.noise[0], profile.noise[1], profile.noise[2], 0, "sfx");
    this.playVoice(...profile.mechanism, "sfx");
    if (profile.echo) this.playVoice(...profile.echo, "sfx");
  }

  playMusicStep(run) {
    const score = getScoreForStage(run && run.stageId);
    if (this.currentScoreId !== score.id) {
      this.currentScoreId = score.id;
      this.musicStep = 0;
    }
    const step = this.musicStep % score.length;
    const duration = Number(run && run.duration) || DEFAULT_RUN_DURATION;
    const progress = Math.min(1, Math.max(0, Number(run && run.elapsed) / duration));
    const crisis = Boolean(run && (run.finalWaveAnnounced || run.extraction && run.extraction.active));
    const boss = Boolean(run && (run.bossOneSpawned || run.endlessBossWave > 0));
    const intensity = Math.min(1, progress + (crisis ? 0.34 : 0) + (boss ? 0.16 : 0) + this.musicBoost * 0.2);
    const stepDuration = 60 / score.bpm / score.stepsPerBeat;

    if (score.bass[step] !== null) {
      const note = midiToFrequency(score.bass[step]);
      this.playVoice(note, note * 0.86, stepDuration * 3.5, 0.032, score.timbre.bass, 0, "music");
    }
    if (score.padRoot[step] !== null) {
      const root = midiToFrequency(score.padRoot[step]);
      const fifth = midiToFrequency(score.padFifth[step]);
      this.playVoice(root, root * 0.997, stepDuration * 7.4, 0.014, score.timbre.pad, 0, "music");
      this.playVoice(fifth, fifth * 1.003, stepDuration * 7.4, 0.009, "sine", 0, "music");
    }
    if (intensity >= 0.16 && score.pulse[step] !== null) {
      const note = midiToFrequency(score.pulse[step]);
      this.playVoice(note, note * 0.985, stepDuration * 0.58, 0.009 + intensity * 0.006, score.timbre.pulse, 0, "music");
    }
    if (intensity >= 0.5 && score.lead[step] !== null) {
      const note = midiToFrequency(score.lead[step]);
      this.playVoice(note, note * 0.995, stepDuration * 1.65, 0.011 + intensity * 0.006, crisis ? "square" : score.timbre.lead, 0, "music");
    }
    if (intensity >= 0.42 && score.pressure[step] !== null) {
      const note = midiToFrequency(score.pressure[step]);
      this.playVoice(note, note * 0.94, stepDuration * 0.42, 0.007 + intensity * 0.007, "square", 0, "music");
    }
    if (boss && score.bossMotif[step] !== null) {
      const note = midiToFrequency(score.bossMotif[step]);
      this.playVoice(note, note * 0.965, stepDuration * 1.35, 0.012 + intensity * 0.006, "sawtooth", 0, "music");
    }
    if (intensity >= 0.28 && step % (intensity > 0.72 ? 2 : 4) === 0) {
      this.playVoice(58, 35, 0.09, 0.014 + intensity * 0.008, "sine", 0, "music");
    }
    if (intensity >= 0.72 && step % 4 === 2) {
      this.playNoise(0.035, 0.008, 3600, 0, "music");
    }
    this.musicStep = (this.musicStep + 1) % score.length;
  }

  update(dt, isRunning, run = null) {
    if (!isRunning || !run) return;
    const score = getScoreForStage(run.stageId);
    const stepDuration = 60 / score.bpm / score.stepsPerBeat;
    this.musicBoost = Math.max(0, this.musicBoost - dt * 0.08);
    this.musicClock -= dt;
    let catchUp = 0;
    while (this.musicClock <= 0 && catchUp < 2) {
      this.playMusicStep(run);
      this.musicClock += stepDuration;
      catchUp += 1;
    }
    if (this.musicClock < -stepDuration) this.musicClock = 0;
  }

  handle(events) {
    for (const event of events) {
      if (event.type === "runStart") {
        this.musicClock = 0;
        this.musicStep = 0;
        this.musicBoost = 0;
        this.currentScoreId = null;
        this.lastShotAt = -Infinity;
      }
      if (event.type === "shot") {
        const now = Date.now();
        if (now - this.lastShotAt < 28) continue;
        this.lastShotAt = now;
        this.playShot(event.weaponId);
      }
      if (event.type === "hit") {
        this.tone(event.critical ? "criticalHit" : "hit", event.elite ? 1.45 : 0.72);
      }
      if (event.type === "pickup") this.tone("pickup", event.pickupType === "scrap" ? 1.3 : 0.72);
      if (event.type === "levelup") this.tone("levelup");
      if (event.type === "upgrade" || event.type === "ui") this.tone("ui");
      if (event.type === "finalWave") {
        this.musicBoost = 1;
        this.tone("boss", 0.72);
      }
      if (event.type === "boss" || event.type === "extraction") {
        this.musicBoost = 1;
        this.tone("boss");
      }
      if (event.type === "playerHit") {
        this.tone("playerHit");
      }
      if (event.type === "result") {
        this.tone(event.result === "win" ? "win" : "lose");
        this.musicBoost = 0;
      }
    }
  }

}

module.exports = { AudioEngine, SHOT_PROFILES, midiToFrequency };
