"use strict";

// Runtime score data. One step is an eighth note and every theme is an
// eight-bar loop. Tracks are generated once at module load and remain frozen;
// the audio engine performs no score allocations during a frame.
const SCORE_LENGTH = 64;

function sparseTrack(notes, every, offset = 0) {
  const track = new Array(SCORE_LENGTH).fill(null);
  let noteIndex = 0;
  for (let step = offset; step < SCORE_LENGTH; step += every) {
    track[step] = notes[noteIndex % notes.length];
    noteIndex += 1;
  }
  return Object.freeze(track);
}

function createScore(definition) {
  const roots = definition.roots;
  return Object.freeze({
    id: definition.id,
    title: definition.title,
    mode: definition.mode,
    bpm: definition.bpm,
    stepsPerBeat: 2,
    length: SCORE_LENGTH,
    bass: sparseTrack(roots, 8),
    padRoot: sparseTrack(roots.map((note) => note + 12), 8),
    padFifth: sparseTrack(roots.map((note) => note + 19), 8),
    pulse: sparseTrack(definition.pulse, 2),
    lead: sparseTrack(definition.lead, 4),
    pressure: sparseTrack(definition.pressure, 2, 1),
    bossMotif: sparseTrack(definition.bossMotif, 4, 2),
    timbre: Object.freeze({ ...definition.timbre })
  });
}

const WASTELAND_SCORES = Object.freeze({
  signal_dawn: createScore({
    id: "signal_dawn",
    title: "破晓脉冲",
    mode: "D Aeolian",
    bpm: 104,
    roots: [38, 45, 34, 41, 36, 43, 38, 45],
    pulse: [62, 69, 62, 65, 62, 69, 60, 65, 58, 65, 58, 62, 53, 60, 53, 57],
    lead: [65, 69, 67, 64, 65, 62, 60, 62, 62, 65, 67, 69, 72, 69, 67, 65],
    pressure: [50, 57, 53, 57, 48, 55, 50, 57],
    bossMotif: [50, 53, 49, 50, 57, 53, 49, 50],
    timbre: { bass: "sawtooth", pad: "triangle", pulse: "square", lead: "triangle" }
  }),
  dead_rail: createScore({
    id: "dead_rail",
    title: "锈轨挽歌",
    mode: "E Phrygian",
    bpm: 112,
    roots: [40, 41, 36, 35, 40, 41, 43, 35],
    pulse: [64, 71, 65, 69, 67, 74, 65, 71, 64, 72, 67, 71, 65, 69, 64, 67],
    lead: [76, 74, 72, 71, 69, 67, 65, 64, 67, 69, 71, 72, 71, 67, 65, 64],
    pressure: [52, 59, 53, 60, 48, 55, 47, 54],
    bossMotif: [52, 53, 59, 58, 52, 53, 47, 52],
    timbre: { bass: "square", pad: "sine", pulse: "square", lead: "sawtooth" }
  }),
  red_storm: createScore({
    id: "red_storm",
    title: "赤风终焉",
    mode: "D Harmonic Minor",
    bpm: 120,
    roots: [38, 33, 34, 37, 38, 41, 33, 37],
    pulse: [62, 69, 65, 73, 62, 70, 65, 69, 74, 69, 77, 73, 70, 69, 65, 73],
    lead: [74, 77, 81, 80, 77, 73, 74, 69, 70, 74, 77, 81, 80, 77, 73, 74],
    pressure: [50, 57, 46, 53, 49, 56, 50, 45],
    bossMotif: [50, 49, 57, 53, 50, 46, 49, 50],
    timbre: { bass: "sawtooth", pad: "triangle", pulse: "sawtooth", lead: "square" }
  })
});

function getScoreForStage(stageId) {
  return WASTELAND_SCORES[stageId] || WASTELAND_SCORES.signal_dawn;
}

const WASTELAND_SCORE = WASTELAND_SCORES.signal_dawn;

module.exports = { SCORE_LENGTH, WASTELAND_SCORE, WASTELAND_SCORES, getScoreForStage };
