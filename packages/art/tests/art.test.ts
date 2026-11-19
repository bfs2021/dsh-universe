import test from 'node:test';
import assert from 'node:assert/strict';
import { TAGS, rng, segmentsOf } from '@dsh-universe/model';
import { artKitProblems, type BuildingSpec } from '@dsh-universe/renderer';
import { ALPHA_CUT, CIVIC_TEMPLATES, lut, MASTER, PAL32, ROOMS, SpriteCache, TOWER_TEMPLATES, createArtKit, inPalette, outline, quantize } from '../src/index.ts';
import { fakeSurface } from './fake-canvas.ts';

test('the art kit is a complete kit', () => {
  assert.deepEqual(artKitProblems(createArtKit({ make: fakeSurface })), []);
});

test('50 room templates: 15 library, 13 workshop, 12 machine, 10 meeting; 1–3 tags from the vocabulary', () => {
  assert.equal(ROOMS.length, 50);
  const per = (f: string) => ROOMS.filter((r) => r.floors.includes(f as never)).length;
  assert.deepEqual([per('library'), per('workshop'), per('machine'), per('meeting')], [15, 13, 12, 10]);
  for (const r of ROOMS) {
    assert.ok(r.tags.length >= 1 && r.tags.length <= 3, r.id);
    for (const t of r.tags) assert.ok((TAGS as readonly string[]).includes(t), r.id + ' ' + t);
  }
});

test('74 building templates: 60 towers (15 silhouettes × 4 facades, unique ids, tags from the vocabulary) and 14 civic', () => {
  assert.equal(TOWER_TEMPLATES.length, 60);
  assert.equal(new Set(TOWER_TEMPLATES.map((t) => t.id)).size, 60);
  assert.equal(new Set(TOWER_TEMPLATES.map((t) => t.form)).size, 15);
  for (const t of TOWER_TEMPLATES) for (const tag of t.tags) assert.ok((TAGS as readonly string[]).includes(tag), t.id + ' ' + tag);
  for (const tag of TAGS) assert.ok(TOWER_TEMPLATES.some((t) => t.tags.includes(tag)), 'some tower suits ' + tag);
  assert.equal(CIVIC_TEMPLATES.length, 14);
});

test('palette: about 120 colours, the lookup maps every 15-bit colour to an entry', () => {
  assert.ok(MASTER.length >= 110 && MASTER.length <= 140, String(MASTER.length));
  const LUT = lut();
  assert.equal(LUT.length, 32768);
  assert.equal(lut(), LUT, 'built once');
  for (let i = 0; i < LUT.length; i += 97) assert.ok(LUT[i] < MASTER.length);
});

test('quantize: every opaque pixel is in the palette, nothing is semi-transparent', () => {
  const w = 32, h = 32, d = new Uint8ClampedArray(w * h * 4);
  const r = rng(12345);
  for (let i = 0; i < d.length; i++) d[i] = Math.floor(r() * 256);
  quantize(d);
  const u = new Uint32Array(d.buffer);
  let opaque = 0;
  for (const v of u) {
    const a = v >>> 24;
    assert.ok(a === 0 || a === 255, 'alpha ' + a);
    if (a) { opaque++; assert.ok(inPalette(v), v.toString(16)); }
    else assert.equal(v, 0);
  }
  assert.ok(opaque > 100 && opaque < u.length);
  // the cut-off: just under is dropped, at the cut is kept
  const e = new Uint8ClampedArray([200, 10, 10, ALPHA_CUT - 1, 200, 10, 10, ALPHA_CUT]);
  quantize(e);
  assert.equal(e[3], 0);
  assert.equal(e[7], 255);
  assert.ok(PAL32.includes(new Uint32Array(e.buffer)[1]));
});

test('outline: exactly one pixel wide, all round the shape', () => {
  const w = 12, h = 10, d = new Uint8ClampedArray(w * h * 4);
  const U = new Uint32Array(d.buffer);
  for (let y = 3; y < 7; y++) for (let x = 4; x < 8; x++) U[y * w + x] = PAL32[5];
  U[5 * w + 8] = PAL32[5];   // a bump on the right
  outline(d, w, h, false);
  const shape = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && U[y * w + x] === PAL32[5];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = U[y * w + x];
    if (v === PAL32[5]) continue;
    const touches = shape(x - 1, y) || shape(x + 1, y) || shape(x, y - 1) || shape(x, y + 1);
    if (touches) assert.notEqual(v, 0, `(${x},${y}) next to the shape is outlined`);
    else assert.equal(v, 0, `(${x},${y}) not next to the shape stays clear`);
  }
});

test('sprite cache: a hit does not redraw; a changed key redraws only that sprite; the budget evicts the oldest', () => {
  const c = new SpriteCache(fakeSurface, 64 * 64 * 4 * 3);
  let paints = 0;
  const paint = () => { paints++; };
  c.get('a', 'k1', 64, 64, 0, 0, paint);
  c.get('b', 'k1', 64, 64, 0, 0, paint);
  c.get('a', 'k1', 64, 64, 0, 0, paint);
  assert.equal(paints, 2);
  assert.equal(c.stats().hits, 1);
  c.get('a', 'k2', 64, 64, 0, 0, paint);
  assert.equal(paints, 3, 'only a was redrawn');
  c.get('b', 'k1', 64, 64, 0, 0, paint);
  assert.equal(paints, 3, 'b still cached');
  c.get('c', 'k', 64, 64, 0, 0, paint); c.get('d', 'k', 64, 64, 0, 0, paint);
  assert.ok(c.stats().bytes <= 64 * 64 * 4 * 3);
  assert.equal(c.stats().evictions, 1);
});

function spec(o: Partial<BuildingSpec> = {}): BuildingSpec {
  return {
    id: 'b:s1', seed: 2166136261, template: 17, at: [8, 8], segments: segmentsOf({ library: 20, workshop: 9, machine: 4 }, false), footprint: 0.7,
    stage: 'construction', state: 'running', heads: [{ floor: 'library', seed: 3 }], resting: [], annexes: ['running'], scheduled: false, preset: true,
    hover: false, frames: { crane: 3, blink: 0, epoch: 1 }, ...o,
  };
}
const paintLog = (s: BuildingSpec) => { const logs: string[][] = []; const k = createArtKit({ make: (w, h) => { const f = fakeSurface(w, h); logs.push(f.log); return f; } }); k.building(s); return logs.map((l) => l.join('\n')).join('\n--\n'); };

test('building determinism: the same session draws the same building; every template draws', () => {
  assert.equal(paintLog(spec()), paintLog(spec()));
  assert.notEqual(paintLog(spec()), paintLog(spec({ template: 18 })));
  for (let t = 0; t < 60; t++) for (const state of ['running', 'waiting', 'done', 'failed', 'idle'] as const) {
    assert.ok(paintLog(spec({ template: t, state, stage: state === 'running' || state === 'waiting' ? 'construction' : 'topped' })).length > 100);
  }
});

test('growth stages: a crown only once topped out; height follows the segments', () => {
  const k = createArtKit({ make: fakeSurface });
  const low = k.building(spec({ id: 'x1', segments: segmentsOf({ library: 4 }, false) }));
  const high = k.building(spec({ id: 'x2', segments: segmentsOf({ library: 80, workshop: 80, machine: 80 }, false) }));
  assert.ok(high.top > low.top);
  const run = paintLog(spec({ template: 8 /* tower-2-0: needle spire */, state: 'idle', stage: 'construction' }));
  const top = paintLog(spec({ template: 8, state: 'idle', stage: 'topped' }));
  assert.ok(top.length > run.length, 'the crown adds drawing');
});

test('night: an idle or finished tower has no lit windows; a running one does', () => {
  const lit = (state: BuildingSpec['state']) => {
    const logs: string[][] = [];
    const k = createArtKit({ make: (w, h) => { const f = fakeSurface(w, h); logs.push(f.log); return f; } });
    k.setLight({ dark: true });
    k.building(spec({ state, template: 3 * 4 + 3, stage: 'topped', heads: [] }));
    k.setLight({ dark: false });
    return logs.flat().filter((l) => /fillStyle=#ffd37e/i.test(l)).length;
  };
  assert.equal(lit('idle'), 0);
  assert.equal(lit('done'), 0);
  assert.ok(lit('running') > 0);
});
