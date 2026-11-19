// Dev tool: paints rooms with the real art kit in headless Chromium and saves PNGs (no agents).
// node scripts/shots/run-art.mjs <outdir> <room[:act][:dark]>... | all   (PLAYWRIGHT_CORE=<playwright-core dir>, CHROMIUM=<executable>, optional)
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const r = await build({ entryPoints: [join(here, 'art-page.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022' });
const html = '<!doctype html><body style="margin:0;background:#fff"><canvas id="c"></canvas><script>' + r.outputFiles[0].text + '</script>';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1300, height: 760 } });
page.on('console', (m) => console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.setContent(html);
let rooms = process.argv.slice(3);
if (rooms[0] === 'all') rooms = await page.evaluate(() => window.ROOM_IDS);
for (const spec of rooms) {
  const [room, ...fl] = spec.split(':');
  const o = { room, act: fl.includes('act'), night: fl.includes('dark'), frame: fl.includes('act') ? 37 : 0, n: 40, jobs: fl.includes('act') ? 2 : 0,
    recent: fl.includes('act') ? [{ age: 1, err: false }, { age: 7, err: true }, { age: 15, err: false }, { age: 33, err: false }] : [] };
  const ms = await page.evaluate((o) => window.paintRoom(o), o);
  await (await page.$('#c')).screenshot({ path: join(out, spec.replace(/:/g, '-') + '.png') });
  console.log(spec, ms.toFixed(1) + 'ms');
}
await browser.close();
