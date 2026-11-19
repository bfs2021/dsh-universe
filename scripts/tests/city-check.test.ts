// Golden screenshots of the city at a fixed time (centre and whole city, light and dark, an empty workspace). Runs
// only where a headless Chromium is available (CHROME_PATH or Playwright's own); CI without one skips it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../city-check.mjs', import.meta.url));
let have = false;
try {
  const { chromium } = await import('playwright-core');
  have = !!process.env.CHROME_PATH || existsSync(chromium.executablePath());
} catch { have = false; }

test('city: golden screenshots match (headless Chromium)', { skip: !have && 'no headless Chromium here', timeout: 180_000 }, () => {
  const r = spawnSync(process.execPath, [script, '--golden'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /golden: centre-light ok/);
  assert.match(r.stdout, /golden: whole-dark ok/);
});
