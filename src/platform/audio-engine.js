"use strict";

const { WASTELAND_SCORE, getScoreForStage } = require("./music-score");
const { DEFAULT_RUN_DURATION } = require("../config");
const { AudioBank, MusicStream } = require("./audio-bank");

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

const { SHOT_PROFILES } = require("./weapon-sounds");
const { mergeFeedbackHits } = require("../shared/combat-feedback-events");

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
  constructor(contextFactory, ports = {}) {
    this.contextFactory = contextFactory;
    this.context = null;
    this.bank = new AudioBank(ports.loadBytes);
    this.music = new MusicStream(ports.createMusic);
    this.currentWeapon = "scrap_pistol";
    this.settings = { music: 0.55, sfx: 0.75 };
    this.musicClock = 0;
    this.musicStep = 0;
    this.musicBoost = 0;
    this.currentScoreId = null;
    this.lastShotAt = -Infinity;
    this.noiseBuffer = null;
    this.noiseContext = null;
    this.sfxBus = null;
    this.sfxBusContext = null;
    this.voiceWindows = [];
    this.shotCounters = Object.create(null);
    this.lastShotIds = Object.create(null);
    this.lastImpactAt = -Infinity;
    this.soundStats = { shots: 0, voices: 0, dropped: 0, recorded: 0, fallback: 0 };
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.music.setVolume(this.settings.musicMuted ? 0 : this.settings.music);
    if (this.sfxBus && this.context) setParam(this.sfxBus.gain,
      this.settings.sfxMuted || !(this.settings.sfx > 0) ? 0 : .82, this.context.currentTime || 0);
  }

  unlock() {
    this.music.unlock();
    try {
      if (!this.context) {
        this.context = this.contextFactory && this.contextFactory();
        this.noiseBuffer = null;
        this.noiseContext = null;
      }
      if (this.context && typeof this.context.resume === "function") {
        const resumed = this.context.resume();
        if (resumed && typeof resumed.catch === "function") resumed.catch(() => {});
      }
      this.prepareWeapon(this.currentWeapon);
    } catch (_error) {
      this.context = null;
    }
  }

  suspend() {
    this.music.suspend();
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
    if (!this.reserveVoice(duration, delay, bus)) return false;
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
      gain.connect(bus === "sfx" ? this.sfxDestination() : context.destination);
      oscillator.onended = () => {
        if (typeof oscillator.disconnect === "function") oscillator.disconnect();
        if (typeof gain.disconnect === "function") gain.disconnect();
      };
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
      const length = Math.ceil(sampleRate * 0.36);
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
    if (!this.reserveVoice(duration, delay, bus)) return false;
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
      gain.connect(bus === "sfx" ? this.sfxDestination() : context.destination);
      source.onended = () => {
        if (typeof source.disconnect === "function") source.disconnect();
        if (typeof gain.disconnect === "function") gain.disconnect();
        if (tail !== source && typeof tail.disconnect === "function") tail.disconnect();
      };
      const room = Math.max(0, (buffer.duration || 0) - duration - .005);
      const offset = room * ((this.soundStats.voices * 0.381966) % 1);
      source.start(start, offset);
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

  reserveVoice(duration, delay, bus) {
    if (bus !== "sfx") return true;
    const now = this.context.currentTime || 0, start = now + delay, end = start + duration + .025;
    this.voiceWindows = this.voiceWindows.filter(voice => voice.end > now);
    const overlap = this.voiceWindows.filter(voice => voice.start < end && voice.end > start).length;
    if (overlap >= 48 || this.voiceWindows.length >= 96) { this.soundStats.dropped++; return false; }
    this.voiceWindows.push({ start, end });this.soundStats.voices++;
    return true;
  }

  sfxDestination() {
    const context = this.context;
    if (this.sfxBus && this.sfxBusContext === context) return this.sfxBus;
    const gain = context.createGain();
    setParam(gain.gain, this.settings.sfxMuted ? 0 : .82, context.currentTime || 0);
    if (typeof context.createDynamicsCompressor === "function") {
      const compressor = context.createDynamicsCompressor();
      for (const [key, value] of Object.entries({ threshold: -10, knee: 16, ratio: 5, attack: .003, release: .12 })) setParam(compressor[key], value, context.currentTime || 0);
      gain.connect(compressor);compressor.connect(context.destination);
    } else gain.connect(context.destination);
    this.sfxBus = gain;this.sfxBusContext = context;
    return gain;
  }

  playShot(weaponId, options = {}) {
    if (!this.context || this.settings.sfxMuted || !(this.settings.sfx > 0)) return false;
    const profile = SHOT_PROFILES[weaponId] || SHOT_PROFILES.scrap_pistol;
    const count = (this.shotCounters[weaponId] || 0) + 1;
    this.shotCounters[weaponId] = count;this.soundStats.shots++;
    const pitch = 1 + ((count * 7 % 11) - 5) * .003;
    const gain = options.empowered ? 1.08 : 1;
    const delay = Math.max(0, Number(options.delay) || 0);
    this.prepareWeapon(weaponId);
    if (this.playSample(weaponId, pitch, gain, delay)) {
      this.soundStats.recorded++;
      const mechanical = ["breaker_shotgun", "rust_revolver", "coil_cannon"].includes(weaponId) ? "mechanical_heavy" : "mechanical_light";
      this.playSample(mechanical, pitch, .28, delay + Math.min(.085, (options.interval || .3) * .4));
      return true;
    }
    this.soundStats.fallback++;
    const voice = (part, mechanical = false) => {
      const ownDelay = mechanical ? Math.min(part[5] || 0, Number(options.interval) > 0 ? options.interval * .5 : Infinity) : part[5] || 0;
      return this.playVoice(part[0] * pitch, part[1] * pitch, part[2], part[3] * gain, part[4], delay + ownDelay, "sfx");
    };
    const played = voice(profile.body);
    voice(profile.crack);
    this.playNoise(profile.noise[0], profile.noise[1] * gain, profile.noise[2] * pitch, delay, "sfx");
    voice(profile.mechanism, true);
    if (profile.echo) voice(profile.echo);
    return played;
  }

  prepareWeapon(id) {
    this.currentWeapon = id;
    this.bank.prepare(this.context, id);
    this.bank.prepare(this.context, "mechanical_light"); this.bank.prepare(this.context, "mechanical_heavy");
  }

  playSample(id, pitch = 1, scale = 1, delay = 0) {
    const buffer = this.bank.get(id), c = this.context;
    if (!buffer || !c || !c.createBufferSource || this.settings.sfxMuted || !(this.settings.sfx > 0)) return false;
    if (!this.reserveVoice(buffer.duration / pitch, delay, "sfx")) return true;
    try {
      const source = c.createBufferSource(), gain = c.createGain(), start = (c.currentTime || 0) + delay;
      source.buffer = buffer; setParam(source.playbackRate, pitch, start);
      setParam(gain.gain, this.settings.sfx * scale * .68, start);
      source.connect(gain); gain.connect(this.sfxDestination());
      source.onended = () => { source.disconnect?.(); gain.disconnect?.(); };
      source.start(start); source.stop(start + buffer.duration / pitch + .01); return true;
    } catch (_error) { return false; }
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

  update(dt, isRunning, run = null, screen = isRunning ? "running" : run ? "paused" : "menu") {
    const volume = this.settings.musicMuted ? 0 : this.settings.music;
    const id = screen === "menu" || screen === "resultWin" || screen === "resultLose" ? "theme_menu"
      : screen === "paused" ? null : run && (run.activeBosses > 0 || run.threatLevel >= 8) ? "theme_pressure" : "theme_combat";
    this.music.update(dt, id, volume * (["levelup", "fieldShop"].includes(screen) ? .38 : 1));
    if (this.music.createAudio && !this.music.failed) return;
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
    const firstShot = events.find(event => event.type === "shot" && Number.isFinite(event.elapsed));
    for (const event of mergeFeedbackHits(events)) {
      if (event.type === "runStart") {
        this.prepareWeapon(event.weaponId);
        this.musicClock = 0;
        this.musicStep = 0;
        this.musicBoost = 0;
        this.currentScoreId = null;
        this.lastShotAt = -Infinity;
        this.lastShotIds = Object.create(null);
        this.lastImpactAt = -Infinity;
      }
      if (event.type === "weaponChanged") this.prepareWeapon(event.weaponId);
      if (event.type === "turretShot") this.playShot("scrap_pistol", { interval: .85 });
      if (event.type === "shot") {
        if (event.attackId > 0 && this.lastShotIds[event.weaponId] === event.attackId) continue;
        this.lastShotIds[event.weaponId] = event.attackId;
        this.playShot(event.weaponId, { interval: event.interval, empowered: event.empowered,
          delay: firstShot && Number.isFinite(event.elapsed) ? Math.min(.08, Math.max(0, event.elapsed - firstShot.elapsed)) : 0 });
      }
      if (event.type === "hit") {
        const now = this.context ? this.context.currentTime || 0 : 0;
        if (now - this.lastImpactAt >= (event.critical ? .016 : .028)) {
          this.lastImpactAt = now;
          const energy = event.weaponId === "coil_cannon";
          this.playNoise(energy ? .04 : .022, event.elite ? .025 : .015, energy ? 2900 : 1050);
          if (event.critical) this.tone("criticalHit", .65);
        }
      }
      if (event.type === "pickup") this.tone("pickup", event.pickupType === "scrap" ? 1.3 : 0.72);
      if (event.type === "levelup") this.tone("levelup");
      if (event.type === "upgrade" || event.type === "ui") this.tone("ui");
      if (event.type === "fieldMarketOpen" || event.type === "fieldPurchase") this.tone("ui");
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
        this.tone(event.result === "retire" ? "ui" : event.result === "win" ? "win" : "lose");
        this.musicBoost = 0;
      }
    }
  }

}

module.exports = { AudioEngine, SHOT_PROFILES, midiToFrequency };
