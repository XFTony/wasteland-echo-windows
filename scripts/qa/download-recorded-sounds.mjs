// Acquire the author's freely downloadable pack through its public download UI.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'output/continuous-survival-2026-10-28/sources');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.goto('https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack/purchase', { waitUntil: 'domcontentloaded' });
  await page.getByText('No thanks, just take me to the downloads', { exact: false }).click();
  await page.getByRole('link', { name: 'Download', exact: true }).first().waitFor();
  const pending = page.waitForEvent('download', { timeout: 90000 });
  await page.getByRole('link', { name: 'Download', exact: true }).first().click();
  const download = await pending;
  await download.saveAs(path.join(out, 'snakef8-authentic-guns.zip'));
  console.log(JSON.stringify({ source: 'SnakeF8 second authentic gun sounds', saved: 'output/continuous-survival-2026-10-28/sources/snakef8-authentic-guns.zip', bytes: (await fs.stat(path.join(out, 'snakef8-authentic-guns.zip'))).size }));
} finally { await browser.close(); }
