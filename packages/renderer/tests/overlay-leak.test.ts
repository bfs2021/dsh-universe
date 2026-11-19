// No colour leaks out of a data view. On CI there is no browser, so this checks at the level of
// draw calls: in every layer, the only original (coloured) sprites the data view draws are the layer's own subjects;
// and every grey sprite that the text layer may draw again over a sign (its cut-out) has been swapped for its grey
// version first. The pixel-level check runs locally with Chromium (`scripts/city-check.mjs --golden`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, cityTemplate, coloredSet, createStore, emptyPlacement, place, type LayerId, type UEvent } from '@dsh-universe/model';
import { Traffic, buildScene, createDataViews, createStubKit, paintCity, type OverlayFrame, type SceneInput } from '../src/index.ts';
import { artXY } from '../src/geometry.ts';

const DAY = new Date(2026, 10, 18).getTime();
const at = (h: number, m = 0) => DAY + (h * 60 + m) * 60_000;
const names = { town: 'T', station: 'S', fire: 'F', school: 'K', library: 'L' };

/** A 2D context that records drawImage sources and keeps its transform (enough for the overlay's own maths). */
function recorder(w = 1, h = 1) {
  const draws: unknown[] = [];
  let m = { e: 0, f: 0 };
  const canvas = { width: w, height: h, kind: 'sprite' as string };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, k: string) {
      if (k === 'canvas') return canvas;
      if (k === 'drawImage') return (img: unknown) => { draws.push(img); };
      if (k === 'setTransform') return (_a: number, _b: number, _c: number, _d: number, e: number, f: number) => { m = { e, f }; };
      if (k === 'getTransform') return () => ({ ...m });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 7 });
      if (k === 'getImageData') return (_x: number, _y: number, ww: number, hh: number) => ({ data: new Uint8ClampedArray(Math.max(1, ww * hh) * 4).fill(255) });
      return () => {};
    },
    set() { return true; },
  });
  return { canvas, ctx, draws };
}

function day(): UEvent[] {
  const ev: UEvent[] = [{ type: 'workspace', data: { id: 'w1', title: 'Finance', displayPath: 'fin' } }, { type: 'connector', data: { id: 'erp', title: 'ERP', state: 'connected' } }];
  for (let i = 0; i < 14; i++) {
    const id = 's' + i;
    ev.push({ type: 'agent', data: { id, sessionId: id, workspaceId: 'w1', label: 'x', kind: i % 5 === 0 ? 'scheduled' : 'main', ...(i % 5 === 0 ? { scheduleId: 'd' } : {}), state: 'running', startedAt: at(8, i * 9) } });
    ev.push({ type: 'turn', data: { t: at(8, i * 9), agentId: id, phase: 'start' } });
    for (let k = 0; k < 8 + i * 3; k++) ev.push({ type: 'activity', data: { id: id + ':' + k, t: at(9, 50) + k * 9000, agentId: id, category: (['read', 'edit', 'exec', 'connector'] as const)[k % 4], connectorId: k % 4 === 3 ? 'erp' : undefined, tool: 't', ok: (k + i) % 7 !== 0 } });
    ev.push({ type: 'usage', data: { t: at(9, 55), agentId: id, model: 'm1', input: 1000 * (i + 1), output: 100 } });
    if (i % 3 === 1) ev.push({ type: 'turn', data: { t: at(9, 58), agentId: id, phase: 'end', reason: 'completed' } });
    if (i === 2) ev.push({ type: 'approval', data: { id: 'a', agentId: id, kind: 'approval', askedAt: at(9, 40) } });
  }
  ev.push({ type: 'schedule', data: { id: 'd', title: 'Daily', status: 'active', nextAt: at(15), runs: [{ at: at(8), agentId: 's0', ok: true }] } });
  return ev;
}

test('no colour leaks: per layer, only the subjects are drawn in colour, and sign cut-outs are grey', () => {
  const ev = day();
  const placement = place(cityTemplate(), emptyPlacement(), ev.flatMap((e) => (e.type === 'agent' ? [{ sessionId: e.data.sessionId, workspaceId: e.data.workspaceId, startedAt: e.data.startedAt }] : []))).state;
  // Grey sprites are made on an OffscreenCanvas: a fake one, marked, so a grey copy is told from an original.
  const G = globalThis as { OffscreenCanvas?: unknown };
  const had = G.OffscreenCanvas;
  G.OffscreenCanvas = class { width: number; height: number; kind = 'grey'; constructor(w: number, h: number) { this.width = w; this.height = h; } getContext() { return recorder().ctx; } };
  try {
    for (const layer of LAYERS.filter((l) => l !== 'all') as LayerId[]) {
      const store = createStore(); store.applyAll(ev);
      const inp: SceneInput = { store, placement, T: at(10), templateTags: [[]], names, time: 0, night: false, city: 'dsh' };
      const kit = createStubKit((w, h) => { const r = recorder(w, h); return { canvas: r.canvas as never, ctx: r.ctx as never }; });
      const scene = buildScene(inp);
      const buf = recorder(900, 700);
      const last = paintCity(buf.ctx as never, kit, scene, new Traffic(), { time: 0, zoom: 1, bw: 900, bh: 700, camX: 0, camY: 232 });
      const originals = new Set(last.blits.map((b) => b.image));
      const colour = coloredSet(layer, store, inp.T, 'dsh');
      const keep = (id?: string) => !!id && (id === 'car' ? layer === 'calls' : id === 'train' ? layer === 'scheduled' : !!colour?.has(id));
      const keptImages = new Set(last.blits.filter((b) => keep(b.id)).map((b) => b.image));
      buf.draws.length = 0;
      const views = createDataViews({ t: (k) => k, tokens: String, duration: String, clock: String });
      const f: OverlayFrame = { ctx: buf.ctx as never, kit, scene, input: inp, last, layer, time: 0, reducedMotion: true, dpr: 1, zoom: 1 };
      views.art!(f);
      // 1. What the data view drew in colour.
      const leaked = buf.draws.filter((img) => originals.has(img as never) && !keptImages.has(img as never));
      assert.equal(leaked.length, 0, `${layer}: ${leaked.length} grey sprite(s) drawn in colour`);
      // 2. What the text layer will draw again over a sign: never an original sprite that is not a subject.
      const m = (buf.ctx as unknown as { getTransform(): { e: number; f: number } }).getTransform(), ox = m.e, oy = m.f;   // the world offset
      const signs = scene.signs.map((s) => { const q = artXY(s.x, s.y, s.z); return [q[0] + ox - 170, q[1] + oy - 40, q[0] + ox + 170, q[1] + oy + 14]; });
      const near = (t: readonly number[]) => signs.some((r) => t[0] < r[2] && t[2] > r[0] && t[1] < r[3] && t[3] > r[1]);
      const cutOuts = last.blits.filter((b) => b.image && near(b.t) && !keep(b.id) && originals.has(b.image));
      assert.equal(cutOuts.length, 0, `${layer}: ${cutOuts.length} sprite(s) the text layer would draw again in colour`);
      assert.ok(last.blits.some((b) => near(b.t)), `${layer}: the check saw signs`);
    }
  } finally { G.OffscreenCanvas = had; }
});
