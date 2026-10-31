"use strict";

const { createGameRuntime } = require("../../src/runtime/create-game-runtime");
const { createBrowserPlatform } = require("../../src/platform/browser-platform");
const { CanvasRenderer } = require("../../src/render/canvas-renderer");
const { ArtStore } = require("../../src/render/art/art-store");
const { WEAPONS } = require("../../src/config");
const { feedbackFor } = require("../../src/render/weapon-feedback");

const canvas = document.querySelector('#game'), viewport = canvas.parentElement;
const image = src => new Promise((resolve, reject) => { const im = new Image();im.onload = () => resolve(im);im.onerror = reject;im.src = src; });

async function boot() {
  const images = Object.fromEntries(await Promise.all(Object.entries(window.WEAPON_REVIEW_ASSETS).map(async ([id, src]) => [id, await image(src)])));
  const store = new ArtStore({ images });
  const renderer = new CanvasRenderer(canvas, { artStore: store });
  const platform = createBrowserPlatform(window, document, canvas);
  platform.viewport = () => ({ width: viewport.clientWidth, height: viewport.clientHeight, dpr: window.devicePixelRatio || 1 });
  const runtime = createGameRuntime({ canvas, renderer, platform,
    storage: { get: () => null, set() {} }, startup: false,
    audioContextFactory: () => new (window.AudioContext || window.webkitAudioContext)() });
  const { model, app, audio } = runtime;
  model.save.settings.music = 0;model.save.settings.sfxMuted = true;model.save.settings.showControlHints = false;
  audio.setSettings(model.save.settings);
  renderer.drawTerrain = function() {
    const ctx = this.ctx, w = this.visibleWorldWidth, h = this.visibleWorldHeight;
    ctx.fillStyle = '#27352e';ctx.fillRect(0, 0, w, h);ctx.fillStyle = '#344138';
    for (let x = -this.camera.x % 64; x < w; x += 64) ctx.fillRect(x, 0, 1, h);
    for (let y = -this.camera.y % 64; y < h; y += 64) ctx.fillRect(0, y, w, 1);
  };
  renderer.drawAtmosphere = () => {};
  renderer.showBanner = () => {};
  model.updateSpawner = () => {};
  model.bossSystem.update = () => {}; // The review target has no attack schedule.
  let target = null;
  function reset(weaponId = document.querySelector('#weapon').value) {
    model.startRun({ weaponId, seed: 17, duration: 3600, modeId: 'endless', tutorial: false });
    model.releaseAllEntities();model.obstacles.length = 0;model.interactives.length = 0;model.rebuildObstacleGrid();
    model.run.player.xpNext = 1000000;
    model.save.settings.autoFire = document.querySelector('#automatic').checked;
    model.save.settings.screenShake = document.querySelector('#shake').checked ? 'low' : 'off';
    const p = model.run.player, distance = Number(document.querySelector('#range').value);
    target = model.spawnEnemy(document.querySelector('#target').value, p.x + distance, p.y);
    target.hp = target.maxHp = 100000;target.speed = 0;target.actionCooldown = 100000;
    renderer.handleEvents(model.drainEvents(), model);renderer.banner.life = 0;
    const w = WEAPONS[weaponId], fx = feedbackFor(weaponId);
    document.querySelector('#description').textContent = w.name + ' · ' + w.description;
    document.querySelector('#facts').textContent = '伤害 ' + w.damage + ' · 每秒 ' + (1 / w.interval).toFixed(2) + ' 次 · 弹丸 ' + w.projectileCount + ' · 穿透 ' + w.pierce + ' · 击退 ' + w.knockback;
    document.querySelector('#mechanical').textContent = fx.shell === 'none' ? '该枪逐发不抛壳' : fx.ejectDelay ? '机械回程后抛壳' : '枪机抛出弹壳';
    return model.run;
  }
  for (const [id, w] of Object.entries(WEAPONS)) { const option = document.createElement('option');option.value = id;option.textContent = w.name;document.querySelector('#weapon').append(option); }
  document.querySelector('#weapon').onchange = () => reset();
  document.querySelector('#target').onchange = () => reset();
  document.querySelector('#range').onchange = () => reset();
  document.querySelector('#reset').onclick = () => reset();
  document.querySelector('#automatic').onchange = event => { model.save.settings.autoFire = event.target.checked; };
  document.querySelector('#shake').onchange = event => { model.save.settings.screenShake = event.target.checked ? 'low' : 'off'; };
  document.querySelector('#sound').onclick = event => {
    audio.unlock();model.save.settings.sfxMuted = !model.save.settings.sfxMuted;audio.setSettings(model.save.settings);
    event.target.textContent = model.save.settings.sfxMuted ? '开启声音' : '关闭声音';
  };
  window.addEventListener('resize', () => app.resize());
  window.addEventListener('keydown', event => {
    if (/INPUT|BUTTON|SELECT/.test(event.target.tagName)) return;
    app.keyDown(event.code, event);if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', event => app.keyUp(event.code));
  window.addEventListener('blur', () => app.resetInput());
  canvas.addEventListener('pointerdown', event => {canvas.focus();app.mouseDown(event.offsetX,event.offsetY);});
  canvas.addEventListener('pointermove', event => app.mouseMove(event.offsetX,event.offsetY));
  canvas.addEventListener('pointerup', () => app.mouseUp());
  const tick = model.tick.bind(model);
  model.tick = dt => {
    tick(dt);
    document.querySelector('#result').textContent = '开火 ' + model.run.shotsFired + ' · 命中弹丸 ' + model.run.hits + ' · 总伤害 ' + model.run.damageDealt.toFixed(1);
  };
  reset();
  window.weaponReview = { ready: true, runtime, reset,
    setWeapon(id) { document.querySelector('#weapon').value = id;reset(id); },
    get target() { return target; },
    freeze() { app.stop(); },
    step(dt = 1 / 60) { model.tick(dt);renderer.handleEvents(model.drainEvents(), model);renderer.updateEffects(dt, model);renderer.render(model); },
    WEAPONS };
  app.start();
  document.querySelector('#status').textContent = '就绪 · 独立试射，不写入正式存档';
}
boot().catch(error => { document.querySelector('#status').textContent = error.message;throw error; });
