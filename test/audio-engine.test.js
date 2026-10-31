"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { WEAPONS } = require("../src/config");
const { AudioEngine, SHOT_PROFILES, midiToFrequency } = require("../src/platform/audio-engine");
const { WASTELAND_SCORES, getScoreForStage } = require("../src/platform/music-score");

function createAudioContext() {
  const stats = {
    oscillators: 0,
    oscillatorStarts: 0,
    oscillatorStops: 0,
    noiseSources: 0,
    gainNodes: 0,
    resumes: 0,
    suspends: 0,
    oscillatorTimes: [],
    bufferAllocations: 0,
    noiseOffsets: [],
    compressorNodes: 0,
    gains: []
  };
  const parameter = () => ({
    value: 0,
    setValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; }
  });
  const connectable = () => ({ connect() {} });
  const context = {
    currentTime: 2,
    sampleRate: 8000,
    destination: {},
    resume() { stats.resumes += 1; },
    suspend() { stats.suspends += 1; },
    createOscillator() {
      stats.oscillators += 1;
      return {
        ...connectable(),
        type: "sine",
        frequency: parameter(),
        start(time) { stats.oscillatorStarts += 1; stats.oscillatorTimes.push(time); },
        stop() { stats.oscillatorStops += 1; }
      };
    },
    createGain() {
      stats.gainNodes += 1;
      const gain = { ...connectable(), gain: parameter() };
      stats.gains.push(gain);
      return gain;
    },
    createBuffer(_channels, length) {
      stats.bufferAllocations += 1;
      const samples = new Float32Array(length);
      return { getChannelData: () => samples, duration: length / context.sampleRate };
    },
    createBufferSource() {
      stats.noiseSources += 1;
      return { ...connectable(), buffer: null, start(_time, offset) { stats.noiseOffsets.push(offset); }, stop() {} };
    },
    createDynamicsCompressor() {
      stats.compressorNodes += 1;
      return { ...connectable(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter() };
    },
    createBiquadFilter() {
      return { ...connectable(), type: "bandpass", frequency: parameter(), Q: parameter() };
    }
  };
  return { context, stats };
}

test("MIDI pitch conversion anchors A4 at 440 Hz", () => {
  assert.equal(midiToFrequency(69), 440);
  assert.ok(Math.abs(midiToFrequency(60) - 261.6256) < 0.001);
});

test("each weapon sound layers impact, crack, mechanism and filtered noise", () => {
  const { context, stats } = createAudioContext();
  const engine = new AudioEngine(() => context);
  engine.unlock();
  for (const weaponId of Object.keys(WEAPONS)) {
    assert.ok(SHOT_PROFILES[weaponId], `${weaponId} needs its own audio profile`);
    engine.playShot(weaponId);
    context.currentTime += 1;
  }
  assert.equal(stats.resumes, 1);
  assert.equal(stats.noiseSources, Object.keys(WEAPONS).length);
  assert.ok(stats.oscillatorStarts >= Object.keys(WEAPONS).length * 3);
  assert.equal(stats.oscillatorStarts, stats.oscillatorStops);

  const beforeMuted = stats.oscillatorStarts + stats.noiseSources;
  engine.setSettings({ sfx: 0 });
  engine.playShot("breaker_shotgun");
  assert.equal(stats.oscillatorStarts + stats.noiseSources, beforeMuted);
  engine.setSettings({ sfx: 0.75, sfxMuted: true });
  engine.playShot("breaker_shotgun");
  assert.equal(stats.oscillatorStarts + stats.noiseSources, beforeMuted, "mute preserves the slider value without producing sound");
  engine.suspend();
  assert.equal(stats.suspends, 1);
});

test("adaptive score adds pulse, lead and percussion as danger rises", () => {
  const { context, stats } = createAudioContext();
  const engine = new AudioEngine(() => context);
  engine.unlock();
  engine.handle([{ type: "runStart" }]);
  engine.update(0.01, true, {
    duration: 60,
    elapsed: 1,
    bossOneSpawned: false,
    finalWaveAnnounced: false,
    extraction: { active: false }
  });
  const earlyVoices = stats.oscillatorStarts;

  engine.musicClock = 0;
  engine.musicStep = 0;
  engine.handle([{ type: "finalWave" }]);
  const afterWarning = stats.oscillatorStarts;
  engine.update(0.01, true, {
    duration: 60,
    elapsed: 55,
    bossOneSpawned: true,
    finalWaveAnnounced: true,
    extraction: { active: false }
  });
  const lateVoices = stats.oscillatorStarts - afterWarning;
  assert.ok(earlyVoices >= 3);
  assert.ok(lateVoices > earlyVoices);
});

test("each campaign chapter resolves to an immutable, musically distinct score", () => {
  assert.deepEqual(Object.keys(WASTELAND_SCORES), ["signal_dawn", "dead_rail", "red_storm"]);
  assert.equal(getScoreForStage("missing"), WASTELAND_SCORES.signal_dawn);
  assert.equal(new Set(Object.values(WASTELAND_SCORES).map((score) => score.bpm)).size, 3);
  assert.equal(new Set(Object.values(WASTELAND_SCORES).map((score) => score.mode)).size, 3);
  for (const score of Object.values(WASTELAND_SCORES)) {
    assert.equal(Object.isFrozen(score), true);
    assert.equal(score.bass.length, 64);
    assert.equal(score.pressure.length, 64);
    assert.equal(score.bossMotif.length, 64);
  }
});

test("audio engine switches chapter themes and adds a boss motif layer", () => {
  const { context, stats } = createAudioContext();
  const engine = new AudioEngine(() => context);
  engine.unlock();
  const run = {
    stageId: "dead_rail",
    duration: 60,
    elapsed: 55,
    bossOneSpawned: false,
    finalWaveAnnounced: true,
    extraction: { active: false }
  };
  engine.playMusicStep(run);
  assert.equal(engine.currentScoreId, "dead_rail");
  engine.musicStep = 2;
  const withoutBoss = stats.oscillatorStarts;
  engine.playMusicStep(run);
  const ordinaryVoices = stats.oscillatorStarts - withoutBoss;
  engine.musicStep = 2;
  run.bossOneSpawned = true;
  const beforeBoss = stats.oscillatorStarts;
  engine.playMusicStep(run);
  assert.ok(stats.oscillatorStarts - beforeBoss > ordinaryVoices);
});

test("limited WebAudio implementations fail soft", () => {
  const context = { currentTime: 0, destination: {}, resume() {}, suspend() {} };
  const engine = new AudioEngine(() => context);
  assert.doesNotThrow(() => {
    engine.unlock();
    engine.handle([{ type: "shot", weaponId: "scrap_pistol" }, { type: "playerHit" }]);
    engine.update(1 / 60, true, { duration: 60, elapsed: 10, extraction: { active: false } });
    engine.suspend();
  });
});

test("shot events deduplicate an attack but retain rapid and catch-up shots", () => {
  const { context, stats } = createAudioContext();
  const engine = new AudioEngine(() => context);
  engine.unlock();
  const shot = (id, elapsed) => ({ type: "shot", weaponId: "swarm_smg", attackId: id, elapsed, interval: .02 });
  engine.handle([shot(1, 1), shot(1, 1), shot(2, 1.02), shot(3, 1.04)]);
  assert.equal(engine.soundStats.shots, 3, "there is no global time gate dropping valid attacks");
  const starts = [...new Set(stats.oscillatorTimes)].sort();
  assert.ok(starts.some(time => Math.abs(time - 2.02) < 1e-6));
  assert.ok(starts.some(time => Math.abs(time - 2.04) < 1e-6));
  engine.handle([{ type: "runStart" }, shot(1, 0)]);
  assert.equal(engine.soundStats.shots, 4, "new run resets attack numbering");
});

test("SFX use one cached mix bus and noise buffer with varied texture offsets", () => {
  const { context, stats } = createAudioContext();
  const engine = new AudioEngine(() => context);
  engine.unlock();
  engine.playShot("scrap_pistol");
  const bus = engine.sfxBus;
  context.currentTime += .5;
  engine.playShot("scrap_pistol");
  assert.equal(engine.sfxBus, bus);
  assert.equal(stats.compressorNodes, 1);
  assert.equal(stats.bufferAllocations, 1);
  assert.notEqual(stats.noiseOffsets[0], stats.noiseOffsets[1]);
  engine.setSettings({ sfxMuted: true });
  assert.equal(bus.gain.value, 0, "mute also silences previously scheduled mechanical voices");
  const count = stats.oscillatorStarts;
  engine.playShot("coil_cannon");
  assert.equal(stats.oscillatorStarts, count);
  engine.setSettings({ sfxMuted: false });
  assert.equal(bus.gain.value, .82);
});

test("sound overload stays bounded and recovers after scheduled voices finish", () => {
  const { context, stats } = createAudioContext();
  const engine = new AudioEngine(() => context);
  engine.unlock();
  for (let i = 0; i < 200; i++) engine.playShot("coil_cannon");
  assert.ok(engine.voiceWindows.length <= 96, "future reservations have their own bounded queue");
  const concurrent = Math.max(...engine.voiceWindows.map(voice => engine.voiceWindows.filter(other => other.start <= voice.start && other.end > voice.start).length));
  assert.ok(concurrent <= 48, "simultaneous voices respect the mix budget");
  assert.ok(engine.soundStats.dropped > 0);
  const voices = stats.oscillatorStarts + stats.noiseSources;
  context.currentTime += 1;
  assert.equal(engine.playShot("scrap_pistol"), true);
  assert.ok(stats.oscillatorStarts + stats.noiseSources > voices);
  assert.ok(engine.voiceWindows.length <= 5);
});

test("a six-pellet hit produces one impact sound and leaves gameplay events intact", () => {
  const { context, stats } = createAudioContext();
  const engine = new AudioEngine(() => context);
  engine.unlock();
  const events = Array.from({ length: 6 }, () => ({ type: "hit", weaponId: "breaker_shotgun", attackId: 3, enemyId: 8, x: 10, y: 20, damage: 10 }));
  engine.handle(events);
  assert.equal(stats.noiseSources, 1);
  assert.equal(events.length, 6);
  assert.equal(events[0].damage, 10);
  engine.handle([{ ...events[0], attackId: 4 }]);
  assert.equal(stats.noiseSources, 1, "impact cadence has an independent budget");
  context.currentTime += .04;
  engine.handle([{ ...events[0], attackId: 5 }]);
  assert.equal(stats.noiseSources, 2);
});
