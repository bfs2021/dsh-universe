// node scripts/shots/run-room.mjs <outdir> <json list of show() options with "name">   (PLAYWRIGHT_CORE, CHROMIUM)
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const r = await build({ entryPoints: [join(here, 'room-page.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022' });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.setContent('<!doctype html><body style="margin:0;background:#fff"><canvas id="c" style="display:block"></canvas><script>' + r.outputFiles[0].text + '</script>');
const list = JSON.parse(process.argv[3]);
for (const o of list) {
  const info = await page.evaluate((o) => window.show(o), o);
  if (o.frames) await page.evaluate((n) => { for (let i = 0; i < n; i++) window.frame(16); }, o.frames);
  if (o.perf) console.log(o.name, JSON.stringify(await page.evaluate(([n, s]) => window.perf(n, s), o.perf)));
  await page.screenshot({ path: join(out, o.name + '.png') });
  console.log(o.name, JSON.stringify(info).slice(0, 400));
}
await browser.close();
