import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..'), out = path.join(root, 'output/echo-market-2026-10-28');
await fs.mkdir(out, { recursive: true });
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], { cwd: root, env: { ...process.env, GAME_PORT: '4234' }, windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:4234/')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4234/?seed=23'); await page.waitForFunction(() => window.__WASTELAND_GAME__);
  await page.evaluate(() => {
    const { model: m, app, renderer: r } = __WASTELAND_GAME__;
    app.stop(); app.startup.skip(); m.save.settings.sfxMuted = true;
    window.echoQA = { now: 100, reducedMotion: false,
      render(dt = 1 / 60) {
        this.now += dt; r.handleEvents(m.drainEvents(), m); r.updateEffects(dt, m);
        r.render(m, { ...app.inputManager.getPresentationState(), uiTime: this.now, focusAction: app.navigator.focusedAction, reducedMotion: this.reducedMotion });
        app.navigator.sync(r.regions, app.contextKey());
      },
      reset() {
        app.resetInput(); m.startRun({ seed: 23, mapId: 'echo_district', tutorial: false }); m.updateSpawner = () => {};
        m.run.player.xpNext = 100000; this.render();
      },
      counter() { const s = m.interactives.find(i => i.type === 'tradePost'); m.run.player.x = s.x; m.run.player.y = s.y + 20; this.render(); },
      draft() { m.screen = 'running'; m.run.player.xp = m.run.player.xpNext; m.checkLevelUp(); m.run.upgradeOptions = ['damage', 'speed', 'armor', 'magnet'].map(id => m.content.get('upgrades', id)); this.render(); }
    };
    echoQA.reset();
  });
  const settle = async () => page.evaluate(async () => {
    await document.fonts.ready;
    const r = __WASTELAND_GAME__.renderer;
    for (let i = 0; i < 6; i++) { echoQA.render(.1); await Promise.all(Object.values(r.artStore.images).map(image => image.decode().catch(() => {}))); }
  });
  const layouts = [];
  for (const [width, height] of [[960, 540], [1280, 720], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); __WASTELAND_GAME__.app.resize(); echoQA.reset(); });
    await settle(); await page.screenshot({ path: path.join(out, `square-${height}.png`) });
    await page.evaluate(() => { echoQA.counter(); __WASTELAND_GAME__.model.run.scrap = 35; __WASTELAND_GAME__.app.handleAction('fieldOpen'); echoQA.render(); });
    await settle(); await page.screenshot({ path: path.join(out, `field-shop-${height}.png`) });
    const shopRegions = await page.evaluate(() => __WASTELAND_GAME__.renderer.regions.map(region => ({ action: region.action, x: region.x, y: region.y, w: region.w, h: region.h })));
    for (const region of shopRegions) assert(region.x >= 0 && region.y >= 0 && region.x + region.w <= width && region.y + region.h <= height, `${height}: ${region.action} outside viewport`);
    await page.evaluate(() => { __WASTELAND_GAME__.model.fieldMarket.close(); echoQA.draft(); });
    await settle(); await page.screenshot({ path: path.join(out, `upgrade-cards-${height}.png`) });
    const cards = await page.evaluate(() => {
      const r = __WASTELAND_GAME__.renderer;
      return r.regions.filter(region => region.action.startsWith('upgrade:')).map(region => ({ action: region.action, ...region.cardShape,
        centerHit: r.hitTest(region.cardShape.cx, region.cardShape.cy), cornerHit: r.hitTest(region.x, region.y) }));
    });
    assert.equal(cards.length, 4);
    for (const card of cards) { assert.equal(card.centerHit, card.action); assert.notEqual(card.cornerHit, card.action); }
    layouts.push({ width, height, shopRegions, cards });
  }
  console.log('Captured map, shop and cards at four resolutions.');
  if (process.argv.includes('--capture-only')) { assert.deepEqual(errors, []); console.log(JSON.stringify({ pageErrors: errors, layouts: layouts.length })); }
  else {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); __WASTELAND_GAME__.app.resize(); echoQA.reset(); });
    // Real coin collection and keyboard transactions in an isolated profile.
    const collected = await page.evaluate(() => {
      const { model: m } = __WASTELAND_GAME__, p = m.run.player;
      m.spawnPickup('scrap', p.x + 4, p.y, 12); m.tick(1 / 60); echoQA.render(); return m.run.scrap;
    });
    assert(collected >= 12);
    await page.evaluate(() => { echoQA.counter(); });
    await page.keyboard.press('KeyE'); await page.evaluate(() => echoQA.render());
    assert.equal(await page.evaluate(() => __WASTELAND_GAME__.model.screen), 'fieldShop');
    const frozen = await page.evaluate(() => {
      const { model: m, app } = __WASTELAND_GAME__, before = m.run.elapsed;
      app.keyDown('KeyE', { repeat: true });
      for (let i = 0; i < 100; i++) { m.tick(1 / 60); echoQA.render(); }
      return { before, after: m.run.elapsed, screen: m.screen };
    });
    assert.equal(frozen.before, frozen.after); assert.equal(frozen.screen, 'fieldShop');
    const buy = await page.evaluate(() => {
      const r = __WASTELAND_GAME__.renderer, region = r.regions.find(region => region.action === 'fieldBuy:weaponCalibration');
      return { x: region.x + region.w / 2, y: region.y + region.h / 2, before: __WASTELAND_GAME__.model.run.scrap };
    });
    await page.mouse.click(buy.x, buy.y); await page.evaluate(() => echoQA.render());
    const bought = await page.evaluate(() => { const m = __WASTELAND_GAME__.model; return { balance: m.run.scrap, purchases: m.run.fieldMarket.purchases.weaponCalibration, damage: m.run.player.damageMultiplier }; });
    assert.equal(bought.balance, buy.before - 10); assert.equal(bought.purchases, 1);
    await page.keyboard.press('Escape'); await page.evaluate(() => echoQA.render());
    assert.equal(await page.evaluate(() => __WASTELAND_GAME__.model.screen), 'running');
    await page.evaluate(() => { __WASTELAND_GAME__.app.executeCommand({ type: 'interact' }); echoQA.render(); __WASTELAND_GAME__.app.executeCommand({ type: 'back' }); echoQA.render(); });
    assert.equal(await page.evaluate(() => __WASTELAND_GAME__.model.screen), 'running');

    await page.evaluate(() => { echoQA.draft(); }); await settle();
    const hover = await page.evaluate(() => __WASTELAND_GAME__.renderer.draftCards[2].screenShape);
    await page.mouse.move(hover.cx, hover.cy);
    const hoverProof = await page.evaluate(() => {
      for (let i = 0; i < 12; i++) echoQA.render();
      const r = __WASTELAND_GAME__.renderer;
      return { active: r.draftCards.filter(card => card.hovered).map(card => card.i), shape: r.draftCards[2].screenShape };
    });
    assert.deepEqual(hoverProof.active, [2]);
    await page.screenshot({ path: path.join(out, 'upgrade-hover.png') });
    await page.mouse.click(hoverProof.shape.cx, hoverProof.shape.cy); await page.evaluate(() => echoQA.render());
    assert.equal(await page.evaluate(() => __WASTELAND_GAME__.model.run.upgrades.armor), 1);
    assert(await page.evaluate(() => !!__WASTELAND_GAME__.renderer.cardReceipt));
    await page.screenshot({ path: path.join(out, 'upgrade-equipped-stamp.png') });
    const reduced = await page.evaluate(() => {
      echoQA.reducedMotion = true; echoQA.draft();
      const result = __WASTELAND_GAME__.renderer.draftCards.map(card => ({ angle: card.shape.angle, progress: card.progress }));
      echoQA.reducedMotion = false; return result;
    });
    for (const card of reduced) { assert.equal(card.angle, 0); assert.equal(card.progress, 1); }
    // Stress icon/prop states; remove a solid interactive through real gameplay.
    const props = await page.evaluate(() => {
      const { model: m, renderer: r } = __WASTELAND_GAME__; echoQA.reset();
      const cache = m.interactives.find(item => item.type === 'supplyCache');
      m.run.player.x = cache.x; m.run.player.y = cache.y + cache.radius + m.run.player.radius + 3;
      m.tick(1 / 60); echoQA.render();
      return { consumed: !cache.active, blockerRemoved: !m.obstacles.some(obstacle => obstacle.interactiveId === cache.id), artLoaded: r.artStore.ready('world.prop.echo.market.v1') };
    });
    assert(props.consumed && props.blockerRemoved);
    await page.screenshot({ path: path.join(out, 'supply-interaction.png') });
    const fallback = await page.evaluate(() => {
      echoQA.reset(); echoQA.counter(); const { renderer: r, model: m } = __WASTELAND_GAME__, ready = r.artStore.ready.bind(r.artStore);
      r.artStore.ready = id => id === 'world.prop.echo.market.v1' ? false : ready(id);
      echoQA.render(); const opened = m.fieldMarket.open(); echoQA.render(); r.artStore.ready = ready; return { opened, screen: m.screen };
    });
    assert(fallback.opened && fallback.screen === 'fieldShop');
    await page.evaluate(async () => {
      const store = __WASTELAND_GAME__.renderer.artStore;
      for (const id of store.ids('world-props')) store.request(id);
      await Promise.all(Object.values(store.images).map(image => image.decode().catch(() => {})));
    });
    const overview = await page.evaluate(() => {
      echoQA.reset();
      const { model: m, renderer: r } = __WASTELAND_GAME__, canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const saved = { ctx: r.ctx, width: r.width, height: r.height, dpr: r.dpr, visibleWorldWidth: r.visibleWorldWidth, visibleWorldHeight: r.visibleWorldHeight, camera: { ...r.camera } };
      const atmosphere = r.drawAtmosphere;
      try {
        r.ctx = canvas.getContext('2d'); r.width = r.height = r.visibleWorldWidth = r.visibleWorldHeight = 3072;
        r.dpr = 1; r.camera.zoom = 1 / 3; r.drawAtmosphere = () => {}; r.drawWorld(m);
        const ctx = r.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.font = '14px Microsoft YaHei';
        for (const zone of m.mapLayout.zones) {
          const x = (zone.x + zone.w / 2) / 3, y = zone.y / 3 + 11;
          ctx.fillStyle = '#272b23'; ctx.fillRect(x - 76, y - 14, 152, 24); ctx.fillStyle = '#e6c995'; ctx.textAlign = 'center'; ctx.fillText(zone.label, x, y + 3);
        }
        ctx.fillStyle = '#252a21'; ctx.fillRect(10, 982, 1004, 32); ctx.fillStyle = '#edd6a3'; ctx.textAlign = 'left';
        ctx.fillText('回声街区布局总览 · 交易站位于广播广场 · 图中视野仅供设计查看', 24, 1004);
      } finally { const camera = saved.camera; delete saved.camera; Object.assign(r, saved); Object.assign(r.camera, camera); r.drawAtmosphere = atmosphere; }
      echoQA.render(); return canvas.toDataURL('image/png').split(',')[1];
    });
    await fs.writeFile(path.join(out, 'map-overview.png'), Buffer.from(overview, 'base64'));
    const video = await page.evaluate(async () => {
      const { model: m, app, renderer: r } = __WASTELAND_GAME__, canvas = document.querySelector('#game');
      echoQA.reset(); r.banner.life = 0;
      const p = m.run.player; m.spawnPickup('scrap', p.x, p.y - 25, 18); m.spawnPickup('scrap', p.x, p.y - 70, 18);
      const stream = canvas.captureStream(0), track = stream.getVideoTracks()[0], chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2500000 });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject; });
      let opened = false, bought = false, closed = false, drafted = false, equipped = false, accumulator = 0;
      let start = performance.now(), last = start, recorded = start; recorder.start();
      await new Promise(resolve => {
        function frame(now) {
          const elapsed = (now - start) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
          if (elapsed >= 12) { resolve(); return; }
          if (elapsed < 1.4) m.setInput({ moveX: .17, moveY: -.75, firing: false });
          else m.setInput({ moveX: elapsed > 8 ? .45 : 0, moveY: 0, firing: false });
          if (elapsed > 2 && !opened) { opened = true; echoQA.counter(); m.fieldMarket.open(); }
          if (elapsed > 3.2 && !bought) { bought = true; m.fieldMarket.purchase('weaponCalibration'); }
          if (elapsed > 4.4 && !closed) { closed = true; m.fieldMarket.close(); }
          if (elapsed > 5.4 && !drafted) { drafted = true; echoQA.draft(); }
          if (elapsed > 6.3 && !equipped && r.draftCards?.length) { const shape = r.draftCards[2].screenShape; app.mouseMove(shape.cx, shape.cy); }
          if (elapsed > 7.5 && !equipped) { equipped = true; const shape = r.draftCards[2].screenShape; app.mouseDown(shape.cx, shape.cy); app.mouseUp(); m.spawnEnemy('brute', m.run.player.x + 240, m.run.player.y + 30); }
          accumulator += dt;
          while (accumulator >= 1 / 60) { m.tick(1 / 60); accumulator -= 1 / 60; }
          echoQA.render(dt); r.banner.life = 0;
          if (now - recorded >= 1000 / 30) { track.requestFrame(); recorded = now; }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: 'video/webm' });
      const base64 = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
      const v = document.createElement('video'); v.muted = true;
      const ready = new Promise((resolve, reject) => { v.onloadeddata = resolve; v.onerror = reject; }); v.src = URL.createObjectURL(blob);
      await ready; await v.play(); await new Promise(resolve => setTimeout(resolve, 100)); v.pause();
      return { base64, decoded: v.currentTime > 0, width: v.videoWidth, height: v.videoHeight, seconds: 12, opened, bought, equipped, purchases: m.run.fieldMarket.purchases.weaponCalibration || 0 };
    });
    assert(video.decoded && video.opened && video.bought && video.equipped && video.purchases === 1);
    const videoBytes = Buffer.from(video.base64, 'base64'); delete video.base64;
    await fs.writeFile(path.join(out, 'map-shop-upgrade.webm'), videoBytes);
    video.bytes = videoBytes.length; video.audio = false;
    const scaling = [];
    for (const factor of [1.25, 1.5]) {
      const scaled = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: factor }), sp = await scaled.newPage();
      sp.on('pageerror', error => errors.push(error.message));
      await sp.goto('http://127.0.0.1:4234/?seed=23'); await sp.waitForFunction(() => window.__WASTELAND_GAME__);
      await sp.evaluate(() => {
        const { app, model: m, renderer: r } = __WASTELAND_GAME__; app.stop(); app.startup.skip();
        m.startRun({ mapId: 'echo_district', seed: 23, tutorial: false });
        const station = m.interactives.find(item => item.type === 'tradePost'); m.run.player.x = station.x; m.run.player.y = station.y + 20;
        m.run.scrap = 35; m.fieldMarket.open(); r.render(m);
      });
      await sp.screenshot({ path: path.join(out, `shop-dpr-${factor * 100}.png`) });
      const target = await sp.evaluate(() => { const region = __WASTELAND_GAME__.renderer.regions.find(region => region.action === 'fieldBuy:weaponCalibration'); return { x: region.x + region.w / 2, y: region.y + region.h / 2 }; });
      await sp.mouse.click(target.x, target.y);
      const result = await sp.evaluate(() => ({ dpr: window.devicePixelRatio, balance: __WASTELAND_GAME__.model.run.scrap }));
      assert.equal(result.balance, 25); scaling.push(result); await scaled.close();
    }
    assert.deepEqual(errors, []);
    const proof = { date: '2026-10-28', pageErrors: errors, layouts, coinsCollected: collected, frozen, purchase: bought, hover: hoverProof, reducedMotion: reduced, props, missingArtFallback: fallback, video, browserScaling: scaling,
      limits: 'Isolated Edge with scripted coin setup and stationary interaction scenes. Synthetic command routing is not physical controller acceptance; screenshots do not establish balance or low-spec Windows performance.' };
    await fs.writeFile(path.join(root, 'docs/qa/echo-market-browser-2026-10-28.json'), JSON.stringify(proof, null, 2) + '\n');
    await fs.writeFile(path.join(out, 'review.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>回声街区与战地改造</title><style>body{max-width:1200px;margin:30px auto;padding:18px;background:#252b22;color:#ead8af;font:16px "Microsoft YaHei",sans-serif}img,video{max-width:100%;display:block;margin:18px 0}a{color:#dec08b}h2{margin-top:34px}</style><h1>回声街区 · 交易站与改装卡样板</h1><p>完整游戏请选择回声旧城（本次街区样板）。WASD走位，自动瞄准射击；靠近柜台按E／手柄A交易，Esc／B离开。购买时战斗与计时暂停。</p><p><a href="windows/WastelandEcho-v1.5.0-alpha.1-win-x64.exe">Windows便携游戏</a> · <a href="../../docs/echo-map-market-cards-plan-2026-10-28.md">设计与验收计划</a></p><video controls preload="metadata" src="map-shop-upgrade.webm"></video><p>演示为预置金币和指定升级卡的12秒无声流程，用于查看交互；不代表正常掉率或对局难度。</p><h2>广播广场</h2><img src="square-720.png"><h2>战地交易</h2><img src="field-shop-720.png"><h2>改装图纸</h2><img src="upgrade-cards-720.png"><h2>地图布局总览</h2><img src="map-overview.png"></html>`);
    console.log(JSON.stringify({ resolutions: layouts.length, coinsCollected: collected, frozen, purchase: bought, singleHover: hoverProof.active, props, video, browserScaling: scaling, missingArtFallback: fallback, pageErrors: errors }));
  }
} finally { if (browser) await browser.close(); server.kill(); }
