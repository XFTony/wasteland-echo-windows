import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'output/weapon-feel-2026-10-28');
const require = createRequire(import.meta.url);
const { WEAPONS } = require('../../src/config');
await fs.mkdir(path.join(out, 'audio'), { recursive: true });
const errors = [];
let browser, server;

function wav(samples, rate = 44100) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return bytes;
}

try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(out, 'review/index.html')).href);
  await page.waitForFunction(() => window.weaponReview?.ready);
  await page.evaluate(() => weaponReview.freeze());
  console.log('Preview loaded; checking seven real weapon simulations.');

  const weapons = await page.evaluate(() => {
    const { model: m, renderer: r } = weaponReview.runtime, results = [];
    for (const id of Object.keys(weaponReview.WEAPONS)) {
      const targets = [];
      for (const type of ['drifter', 'brute', 'iron_colossus']) {
        document.querySelector('#target').value = type;
        document.querySelector('#range').value = '70';
        document.querySelector('#automatic').checked = true;
        weaponReview.setWeapon(id);
        const target = weaponReview.target, startX = target.x, startY = target.y;
        let peakOffset = 0;
        for (let i = 0; i < 120; i++) {
          weaponReview.step();
          peakOffset = Math.max(peakOffset, r.compactActors.lastDraw?.feedback.offset || 0);
        }
        targets.push({ type, shots: m.run.shotsFired, hits: m.run.hits, damage: m.run.damageDealt,
          displacement: Math.hypot(target.x - startX, target.y - startY), peakOffset,
          shells: r.shells.filter(s => s.active).length });
      }
      results.push({ id, targets });
    }
    return results;
  });
  for (const weapon of weapons) for (const target of weapon.targets) {
    assert(target.shots > 0 && target.hits > 0 && target.damage > 0, `${weapon.id}: ${target.type} failed to fire/hit`);
    assert(Number.isFinite(target.displacement) && target.displacement < 200, 'unbounded displacement');
    if (['rust_revolver', 'coil_cannon'].includes(weapon.id)) assert.equal(target.shells, 0);
  }

  // Inspect the actual actor renderer in isolation, with a 2x canvas so all source
  // pixel centers are exact even though the live actor scale is 1.5.
  const poses = await page.evaluate(() => {
    const { model: m, renderer: r } = weaponReview.runtime;
    const originalCtx = r.ctx, originalCamera = { ...r.camera };
    const actor = document.createElement('canvas'); actor.width = 512; actor.height = 440;
    const ctx = actor.getContext('2d', { willReadFrequently: true });
    const board = document.createElement('canvas'); board.width = 1600; board.height = 1500;
    const b = board.getContext('2d'); b.fillStyle = '#26342e'; b.fillRect(0, 0, board.width, board.height);
    b.font = '20px Microsoft YaHei'; b.fillStyle = '#e7d7ae'; b.fillText('七枪 · 八方向 · 后坐峰值（实际人物渲染）', 20, 32);
    const checks = [], degrees = [0, 45, 90, 135, 180, -135, -90, -45];
    try {
      Object.keys(weaponReview.WEAPONS).forEach((id, row) => {
        weaponReview.setWeapon(id); const p = m.run.player;
        m.releaseAllEntities(); m.run.elapsed = 10;
        r.ctx = ctx; r.camera.x = p.x - 128; r.camera.y = p.y - 150;
        r.compactActors.prepare(r, id);
        const body = r.artStore.get('actor.compact.ranger.v1');
        const mask = document.createElement('canvas'); mask.width = mask.height = 64;
        const mc = mask.getContext('2d', { willReadFrequently: true }); mc.drawImage(body, 0, 0, 64, 64, 0, 0, 64, 64);
        const pixels = mc.getImageData(0, 0, 64, 64).data;
        degrees.forEach((degrees, col) => {
          const angle = degrees * Math.PI / 180; p.lastAimX = Math.cos(angle); p.lastAimY = Math.sin(angle);
          p.compactFacing = Math.cos(angle) < -.15 ? -1 : 1; p.compactDepth = Math.sin(angle) < -.18 ? 'back' : 'front';
          for (const age of [0, .012, 1.2]) {
            m.run.elapsed = 10 + age;
            r.shotFeedback = { weaponId: id, elapsed: 10, interval: weaponReview.WEAPONS[id].interval, empowered: true };
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 512, 440);
            ctx.setTransform(2, 0, 0, 2, 0, 0); r.compactActors.drawPlayer(r, p, m.run, false);
            const state = r.compactActors.playerState, draw = r.compactActors.lastDraw;
            const sx = Math.round(32 + (draw.muzzleX - p.x) / (1.5 * state.facing));
            const sy = Math.round(56 + (draw.muzzleY - p.y) / 1.5);
            const muzzleAlpha = sx >= 0 && sx < 64 && sy >= 0 && sy < 64 ? pixels[(sy * 64 + sx) * 4 + 3] : 0;
            let faceErrors = 0;
            for (let y = 12; y < 38; y++) for (let x = 14; x < 53; x++) {
              const at = (y * 64 + x) * 4; if (pixels[at + 3] !== 255) continue;
              const wx = Math.floor((128 + (x + .5 - 32) * 1.5 * state.facing) * 2);
              const wy = Math.floor((150 + (y + .5 - 56) * 1.5) * 2);
              const actual = ctx.getImageData(wx, wy, 1, 1).data;
              if (actual[0] !== pixels[at] || actual[1] !== pixels[at + 1] || actual[2] !== pixels[at + 2]) faceErrors++;
            }
            checks.push({ id, degrees, age, depth: state.depth, muzzleAlpha, faceErrors, offset: draw.feedback.offset, phase: draw.phase });
            if (age === .012) {
              b.imageSmoothingEnabled = false;
              b.drawImage(actor, 96, 140, 320, 260, col * 200 + 4, row * 205 + 65, 192, 156);
              b.fillStyle = '#e3c58f'; b.font = '12px Microsoft YaHei';
              b.fillText(weaponReview.WEAPONS[id].name + ' ' + degrees + '°', col * 200 + 8, row * 205 + 57);
            }
          }
        });
      });
    } finally { r.ctx = originalCtx; Object.assign(r.camera, originalCamera); }
    return { checks, board: board.toDataURL('image/png').split(',')[1] };
  });
  await fs.writeFile(path.join(out, 'seven-weapons-directions.png'), Buffer.from(poses.board, 'base64'));
  for (const pose of poses.checks) {
    assert.equal(pose.faceErrors, 0, `${pose.id} ${pose.degrees} age=${pose.age}: face covered`);
    if (pose.depth === 'back') assert.equal(pose.muzzleAlpha, 0, `${pose.id} ${pose.degrees} age=${pose.age}: hidden muzzle`);
    if (pose.age === 1.2) assert.equal(pose.offset, 0, `${pose.id}: incomplete recovery`);
  }
  console.log(`Verified ${poses.checks.length} direction/recoil poses.`);

  const effects = await page.evaluate(() => {
    const { model: m, renderer: r } = weaponReview.runtime;
    document.querySelector('#target').value = 'drifter'; document.querySelector('#range').value = '180';
    weaponReview.setWeapon('breaker_shotgun'); weaponReview.step(); weaponReview.step();
    r.render(m);
    const expected = r.compactActors.lastDraw, translations = [], translate = r.ctx.translate.bind(r.ctx);
    r.ctx.translate = (x, y) => { translations.push([x, y]); return translate(x, y); };
    try { r.drawWorldEffects(m); } finally { r.ctx.translate = translate; }
    const expectedX = Math.round(expected.muzzleX - r.camera.x), expectedY = Math.round(expected.muzzleY - r.camera.y);
    const muzzleFollows = translations.some(([x, y]) => x === expectedX && y === expectedY);
    const phase = r.compactActors.playerState.phase;
    m.run.player.x += 4; m.run.elapsed += 1 / 60; r.render(m);
    const phaseAfterMovement = r.compactActors.playerState.phase;
    m.fireWeapon(m.run.player.lastAimX, m.run.player.lastAimY); r.handleEvents(m.drainEvents(), m); r.render(m);
    const phaseAfterShot = r.compactActors.playerState.phase;
    m.save.settings.flashes = 'off'; m.save.settings.screenShake = 'off'; r.render(m);
    const before = m.run.hits; for (let i = 0; i < 90; i++) weaponReview.step();
    return { muzzleFollows, phase, phaseAfterMovement, phaseAfterShot, hitsWithFeedbackOff: m.run.hits - before };
  });
  assert(effects.muzzleFollows, 'flash must follow the recoiling muzzle');
  assert.notEqual(effects.phase, effects.phaseAfterMovement);
  assert.equal(effects.phaseAfterMovement, effects.phaseAfterShot, 'firing must not reset movement phase');
  assert(effects.hitsWithFeedbackOff > 0);
  for (const id of Object.keys(WEAPONS)) {
    await page.evaluate(id => { weaponReview.setWeapon(id); const { model: m } = weaponReview.runtime; m.save.settings.flashes = 'low'; for (let i = 0; i < 8; i++) weaponReview.step(); }, id);
    await page.screenshot({ path: path.join(out, `${id}.png`) });
  }

  // Render the real WebAudio implementation, rather than a mock or a separate
  // imitation. Preserve the relative weapon volumes (no per-file normalization).
  const audio = [], allSamples = [];
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    const rendered = await page.evaluate(async ({ id, interval }) => {
      const rate = 44100, seconds = Math.max(3.5, 1.6 + 3 * interval), context = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
      const engine = new weaponReview.runtime.audio.constructor(() => context); engine.context = context;
      engine.setSettings({ music: 0, sfx: .75, sfxMuted: false });
      engine.playShot(id, { delay: .15, interval });
      for (let i = 0; i < 4; i++) engine.playShot(id, { delay: .9 + i * Math.max(.07, interval), interval, empowered: i === 3 });
      const buffer = await context.startRendering(), samples = buffer.getChannelData(0);
      let peak = 0, squares = 0, clipped = 0, invalid = 0;
      for (const sample of samples) { if (!Number.isFinite(sample)) invalid++; peak = Math.max(peak, Math.abs(sample)); squares += sample * sample; if (Math.abs(sample) >= .999) clipped++; }
      const bytes = new Uint8Array(samples.buffer); let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary), peak, rms: Math.sqrt(squares / samples.length), clipped, invalid, stats: engine.soundStats };
    }, { id, interval: weapon.interval });
    assert(rendered.peak > .01 && rendered.peak < .98 && rendered.clipped === 0 && rendered.invalid === 0, id + ': invalid/clipped/quiet audio');
    const data = Buffer.from(rendered.base64, 'base64');
    const samples = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    await fs.writeFile(path.join(out, 'audio', `${id}.wav`), wav(samples)); allSamples.push(samples);
    audio.push({ id, name: weapon.name, seconds: samples.length / 44100, peak: rendered.peak, rms: rendered.rms, clipped: rendered.clipped, invalid: rendered.invalid, stats: rendered.stats });
  }
  const combined = new Float32Array(allSamples.reduce((sum, samples) => sum + samples.length, 0));
  let cursor = 0; for (const samples of allSamples) { combined.set(samples, cursor); cursor += samples.length; }
  await fs.writeFile(path.join(out, 'audio/seven-weapons.wav'), wav(combined));
  const stress = await page.evaluate(async () => {
    const context = new OfflineAudioContext(1, 44100 * 6, 44100);
    const engine = new weaponReview.runtime.audio.constructor(() => context); engine.context = context;
    engine.setSettings({ music: .55, sfx: .75 });
    let maximumReservations = 0;
    const scheduled = [];
    for (let i = 0; i < 200; i++) scheduled.push(context.suspend(.1 + i * .025).then(async () => {
      engine.handle([{ type: 'shot', weaponId: 'swarm_smg', attackId: i + 1, interval: .025, elapsed: i * .025 },
        { type: 'hit', weaponId: 'swarm_smg', attackId: i + 1, enemyId: 1, damage: 10, x: 0, y: 0, critical: i % 5 === 0 }]);
      if (i % 4 === 0) engine.playMusicStep({ stageId: 'signal_dawn', duration: 60, elapsed: 55, bossOneSpawned: true });
      maximumReservations = Math.max(maximumReservations, engine.voiceWindows.length);
      await context.resume();
    }));
    const rendered = context.startRendering(); await Promise.all(scheduled);
    const samples = (await rendered).getChannelData(0); let peak = 0, clipped = 0;
    for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); if (Math.abs(sample) >= .999) clipped++; }
    const bytes = new Uint8Array(samples.buffer); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { base64: btoa(binary), peak, clipped, maximumReservations, stats: engine.soundStats, shotsPerSecond: 40, seconds: 6 };
  });
  assert(stress.peak > .01 && stress.peak < .98 && stress.clipped === 0);
  assert.equal(stress.stats.shots, 200); assert.equal(stress.stats.dropped, 0);
  const stressBytes = Buffer.from(stress.base64, 'base64');
  await fs.writeFile(path.join(out, 'audio/rapid-fire-stress.wav'), wav(new Float32Array(stressBytes.buffer.slice(stressBytes.byteOffset, stressBytes.byteOffset + stressBytes.byteLength))));
  delete stress.base64;
  await fs.writeFile(path.join(out, 'audio/index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>七枪音色试听</title><style>body{max-width:820px;margin:32px auto;padding:20px;background:#23332c;color:#eadcb6;font:16px "Microsoft YaHei",sans-serif}audio{width:100%}section{margin:24px 0}small{color:#c3bda6}</style><h1>七枪音色试听</h1><p>每段：一发单射，随后四发连续射击，最后一发强化。使用游戏真实声音程序；音量关系保留。</p><p><small>程序和波形检查已完成；音色是否舒适仍需真人试听。</small></p><audio controls src="seven-weapons.wav"></audio>${audio.map(a => `<section><h2>${a.name}</h2><audio controls preload="none" src="${a.id}.wav"></audio></section>`).join('')}</html>`);
  console.log('Seven original audio previews rendered without clipping.');

  const video = await page.evaluate(async () => {
    const { model: m } = weaponReview.runtime, canvas = document.querySelector('#game');
    m.save.settings.flashes = 'low'; document.querySelector('#range').value = '180';
    const stream = canvas.captureStream(0), track = stream.getVideoTracks()[0], chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2500000 });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject; });
    const ids = Object.keys(weaponReview.WEAPONS); let current = -1, accumulator = 0, last = performance.now(), recorded = last;
    const start = last; recorder.start();
    await new Promise(resolve => {
      function frame(now) {
        const elapsed = (now - start) / 1000, index = Math.floor(elapsed / 2);
        if (index >= ids.length) { resolve(); return; }
        if (index !== current) { current = index; weaponReview.setWeapon(ids[index]); }
        accumulator += Math.min(.05, (now - last) / 1000); last = now;
        m.setInput({ moveX: 0, moveY: Math.sin(elapsed * 3) * .15, firing: false });
        while (accumulator >= 1 / 60) { weaponReview.step(); accumulator -= 1 / 60; }
        if (now - recorded >= 1000 / 30) { track.requestFrame(); recorded = now; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    recorder.stop(); await done; stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: 'video/webm' });
    const base64 = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
    const v = document.createElement('video'); v.muted = true;
    const ready = new Promise((resolve, reject) => { v.onloadeddata = resolve; v.onerror = reject; }); v.src = URL.createObjectURL(blob);
    await ready; await v.play(); await new Promise(resolve => setTimeout(resolve, 100)); v.pause();
    return { base64, decoded: v.currentTime > 0, width: v.videoWidth, height: v.videoHeight, seconds: 14, audio: false };
  });
  assert(video.decoded);
  const videoBytes = Buffer.from(video.base64, 'base64'); await fs.writeFile(path.join(out, 'seven-weapons.webm'), videoBytes);

  // Smoke-test the actual game separately from the isolated range.
  server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], { cwd: root, env: { ...process.env, GAME_PORT: '4223' }, windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:4223/')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  await page.goto('http://127.0.0.1:4223/?seed=17'); await page.waitForFunction(() => window.__WASTELAND_GAME__);
  await page.evaluate(() => { const { app, model: m } = __WASTELAND_GAME__; app.stop(); m.startRun({ seed: 17, tutorial: false }); });
  const resolutions = [];
  for (const [width, height] of [[960, 540], [1280, 720], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const { app, model: m, renderer: r } = __WASTELAND_GAME__; app.resize();
      for (let i = 0; i < 3; i++) { r.render(m); await Promise.all(Object.values(r.artStore.images).map(image => image.decode().catch(() => {}))); }
    });
    await page.screenshot({ path: path.join(out, `main-game-${height}.png`) });
    resolutions.push(await page.evaluate(() => { const r = __WASTELAND_GAME__.renderer; return { width: r.width, height: r.height, worldWidth: r.visibleWorldWidth, worldHeight: r.visibleWorldHeight, compactPlayer: !!r.compactActors.lastDraw }; }));
  }
  for (const resolution of resolutions) assert(resolution.compactPlayer);
  assert.deepEqual(errors, []);
  const proof = { date: '2026-10-28', pageErrors: errors, weapons, poses: poses.checks, effects, audio, audioStress: stress,
    video: { bytes: videoBytes.length, decoded: video.decoded, width: video.width, height: video.height, seconds: video.seconds, audio: false }, resolutions,
    limits: 'Scripted isolated Edge/browser and real WebAudio waveform checks; stationary high-HP range targets. No human sound/taste approval, physical controller acceptance, or real WebView2 long-session acceptance.' };
  await fs.writeFile(path.join(root, 'docs/qa/weapon-feedback-browser-2026-10-28.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ weapons: weapons.length, targetCases: weapons.length * 3, poseChecks: poses.checks.length, effects, audioPeaks: audio.map(a => ({ id: a.id, peak: a.peak })), videoBytes: videoBytes.length, resolutions, pageErrors: errors }));
} finally { if (browser) await browser.close(); if (server) server.kill(); }
