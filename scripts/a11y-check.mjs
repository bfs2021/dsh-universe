// Accessibility audit: axe-core (pinned dev dependency) over every panel view of the mock sample day, zh and en, light
// and dark, wide and narrow: the city, each data view, the legend, a building card, the list, a room, and the room's
// person card. Prints each violation; exits 1 on any serious or critical one (colour contrast is serious in axe).
//   node scripts/a11y-check.mjs [--all] [--only <view>]   (--all: also list moderate and minor)
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './city-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const AXE = readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
const all = process.argv.includes('--all');
/** `--only <prefix>`: just the views whose name starts with it (e.g. `--only tour`). */
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';

/** Click the busiest building the city shows (its hit box centre). */
async function clickBuilding(p, hoverOnly = false) {
  const pt = await p.evaluate(() => { const c = globalThis.__dshuCity; const hs = c.last.hits.filter((x) => x.id.startsWith('b:')); for (const h of hs) { const s = c.screenOf((h.r[0] + h.r[2]) / 2, (h.r[1] + h.r[3]) / 2); const r = c.canvas.getBoundingClientRect(); if (s[0] > 20 && s[1] > 80 && s[0] < r.width - 60 && s[1] < r.height - 160 && c.hitAt(s[0], s[1])?.id === h.id) return [s[0] + r.left, s[1] + r.top]; } return null; });
  if (!pt) throw new Error('no building on screen');
  if (hoverOnly) await p.mouse.move(pt[0], pt[1]); else await p.mouse.click(pt[0], pt[1]);
}

/** Each view: query string and the clicks that reach it, run in the page. */
const VIEWS = [
  { name: 'city', qs: 'panel=1&fixed=1' },
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ name: 'layer' + i, qs: 'panel=1&fixed=1', go: async (p) => p.getByRole('group', { name: /^(只看|Show)$/ }).getByRole('button').nth(i).click() })),
  { name: 'legend', qs: 'panel=1&fixed=1', go: async (p) => p.getByRole('button', { name: /^(图例|Legend)$/ }).click() },
  { name: 'card', qs: 'panel=1&fixed=1', go: (p) => clickBuilding(p, true) },
  { name: 'list', qs: 'panel=1&fixed=1', go: async (p) => p.getByRole('button', { name: /^(清单|List)$/ }).first().click() },
  { name: 'room', qs: 'room=ledger' },
  // Inside a building (a click enters), with the first person's card open when someone is on the floor.
  { name: 'inside', qs: 'panel=1&fixed=1', go: async (p) => {
    await clickBuilding(p); await p.waitForTimeout(2500);
    const who = p.locator('section[aria-label] button[aria-pressed]').first();
    if (await who.count()) await who.click({ timeout: 3000 }).catch(() => {}); } },
  // The first-run tour, each of its four steps (shown on a device that has not seen it).
  ...[0, 1, 2, 3].map((k) => ({ name: 'tour' + (k + 1), qs: 'panel=1&fixed=1', tour: true, go: async (p) => {
    await p.locator('[data-dshu-tour]').waitFor({ timeout: 5000 });
    for (let j = 0; j < k; j++) { await p.locator('[data-dshu-tour] button').last().click(); await p.waitForTimeout(400); }
    const at = await p.locator('[data-dshu-tour]').getAttribute('data-dshu-tour');
    if (at !== ['today', 'layers', 'square', 'building'][k]) throw new Error('tour is on ' + at); } })),
];

async function main() {
  const b = await browser();
  // Without a Chromium nothing was checked: that fails, unless the caller says skipping is fine (`--allow-skip`, CI).
  if (!b) {
    const ok = process.argv.includes('--allow-skip');
    console.log(`a11y-check: no headless Chromium available; skipped${ok ? ' (--allow-skip)' : ' (pass --allow-skip to accept)'}`);
    return ok ? 0 : 1;
  }
  const r = spawnSync(process.execPath, [join(root, 'scripts/dev.mjs'), '--build-only'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('dev build failed');
  const dev = join(root, '.dev');
  const srv = createServer((q, res) => { const f = (q.url ?? '/').split('?')[0].slice(1) || 'index.html', p = join(dev, f); if (!existsSync(p)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); res.end(readFileSync(p)); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}/index.html?`;
  const found = new Map();
  try {
    for (const lang of ['zh', 'en']) for (const theme of ['light', 'dark']) for (const [w, h] of [[1440, 900], [390, 780]]) for (const v of VIEWS.filter((x) => x.name.startsWith(only))) {
      const page = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce', colorScheme: theme });
      // Every other view as a member who has seen the tour.
      if (!v.tour) await page.addInitScript(() => { try { localStorage.setItem('khglobal-dsh-universe.view', JSON.stringify({ toured: true })); } catch {} });
      const tag = `${v.name} ${lang} ${theme} ${w}`;
      try {
        await page.goto(base + v.qs + (lang === 'en' ? '&lang=en' : '') + (theme === 'dark' ? '&theme=dark' : ''));
        if (v.qs.startsWith('panel')) await page.waitForFunction(() => !!globalThis.__dshuCity?.scene);
        await page.waitForTimeout(800);
        if (v.go) { await v.go(page); await page.waitForTimeout(1000); }
        await page.addScriptTag({ content: AXE });
        const res = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ['violations'] })).violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.slice(0, 6).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary ?? '').split('\n').slice(1, 2).join('').trim().slice(0, 140) + ' :: ' + n.html.slice(0, 120)) })));
        for (const x of res) {
          if (!all && x.impact !== 'serious' && x.impact !== 'critical') continue;
          const k = x.id + ' (' + x.impact + ')';
          if (!found.has(k)) found.set(k, { help: x.help, where: new Set(), nodes: new Set() });
          const f = found.get(k); f.where.add(tag); for (const n of x.nodes) f.nodes.add(n);
        }
      } catch (e) { console.log('a11y-check:', tag, 'could not run:', String(e).split('\n')[0]); found.set('run-error ' + tag, { help: String(e).split('\n')[0], where: new Set([tag]), nodes: new Set() }); }
      await page.close();
    }
  } finally { srv.close(); await b.close(); }
  for (const [k, f] of found) {
    console.log(`\n${k}: ${f.help}\n  in ${f.where.size} views: ${[...f.where].slice(0, 6).join(' | ')}`);
    for (const n of [...f.nodes].slice(0, 12)) console.log('   - ' + n);
  }
  const bad = [...found.keys()].filter((k) => /serious|critical|run-error/.test(k)).length;
  console.log(`\na11y-check: ${bad ? bad + ' serious or critical rules' : 'no serious or critical violations'} over ${VIEWS.filter((x) => x.name.startsWith(only)).length * 8} views (${[...new Set([...found.values()].flatMap((f) => [...f.where]))].length} with issues)`);
  return bad ? 1 : 0;
}
process.exitCode = await main();
