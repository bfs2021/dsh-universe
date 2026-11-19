// Token use, drawn as electricity: every session tower that used tokens hangs on a wire from the
// power plant of the model it used most. A tower that drew tokens in the last five minutes has a live wire (orange)
// with yellow lights running along it, more and faster the more it drew; one that drew nothing lately is off the
// grid (no wire, except a grey one for today's three biggest users). A meter beside each tower is today's tokens,
// and the three biggest users have a bolt overhead. Over each plant a load bar: green, orange, red past 80 % of the
// day's peak five minutes.
import { RECENT_MS, buildingOf, type Store } from '@dsh-universe/model';
import type { PixelPen } from './artkit.ts';
import { artXY } from './geometry.ts';
import { INK, clamp, lerp, markTop, type LayerData } from './overlay-common.ts';
import type { ScenePlace } from './scene.ts';
import type { OverlayFrame } from './view.ts';
import type { Tag } from './overlay.ts';

interface Grid { key: string; modelOf: Map<string, string>; peak: Map<string, number> }
const grids = new WeakMap<Store, Grid>();

/** Per building, the model it used most by T; per model, the busiest five minutes of the day up to T. */
export function gridAt(store: Store, T: number): Grid {
  const key = store.version() + '|' + T;
  const old = grids.get(store);
  if (old?.key === key) return old;
  const use = new Map<string, Map<string, number>>();
  const byModel = new Map<string, { t: number; v: number }[]>();
  for (const s of store.agents()) {
    const b = buildingOf(store, s);
    for (const u of s.usage) {
      if (u.t > T || !u.model) continue;
      const v = u.input + u.output;
      const m = use.get(b) ?? new Map<string, number>();
      m.set(u.model, (m.get(u.model) ?? 0) + v);
      use.set(b, m);
      (byModel.get(u.model) ?? byModel.set(u.model, []).get(u.model)!).push({ t: u.t, v });
    }
  }
  const modelOf = new Map<string, string>();
  for (const [b, m] of use) modelOf.set(b, [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0]);
  const peak = new Map<string, number>();
  for (const [m, list] of byModel) {
    list.sort((a, b) => a.t - b.t);
    let lo = 0, sum = 0, best = 0;
    for (const x of list) { sum += x.v; while (list[lo].t <= x.t - RECENT_MS) sum -= list[lo++].v; best = Math.max(best, sum); }
    peak.set(m, best);
  }
  const g = { key, modelOf, peak };
  grids.set(store, g);
  return g;
}

/** The top of a plant's stack, art pixels (the art kit's plant: one stack, or two at 88 % when the variant is odd). */
export function stackTop(p: ScenePlace): [number, number] {
  const twin = ((p.civic?.variant ?? 0) & 1) === 1, h = p.civic?.level ?? 46;
  return artXY(p.at[0] + (twin ? 0.75 : 1.1), p.at[1], (twin ? h * 0.88 : h));
}

/** A whole-pixel line two pixels thick. */
function wire(px: PixelPen, a: readonly number[], b: readonly number[], c: string): void {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let i = 0; i <= n; i++) px(Math.round(lerp(a[0], b[0], i / n)), Math.round(lerp(a[1], b[1], i / n)), 2, 2, c);
}

function bolt(px: PixelPen, x: number, y: number): void {
  px(x - 1, y - 1, 10, 14, INK);
  ['0011', '0110', '1111', '0011', '0110', '0100'].forEach((row, r) => { for (let c = 0; c < 4; c++) if (row[c] === '1') px(x + c * 2, y + r * 2, 2, 2, '#FFC928'); });
}

/** Returns whether anything moves (a live wire). */
export function paintPower(f: OverlayFrame, d: LayerData, px: PixelPen): boolean {
  const store = f.input.store, T = f.input.T, grid = gridAt(store, T);
  const towers = f.scene.places.filter((p) => p.tier === 'building' && (d.metrics.places.get(p.id)?.tokens ?? 0) > 0)
    .sort((a, b) => d.metrics.places.get(b.id)!.tokens - d.metrics.places.get(a.id)!.tokens || a.id.localeCompare(b.id));
  const max = towers.length ? d.metrics.places.get(towers[0].id)!.tokens : 1;
  const plants = new Map(f.scene.places.filter((p) => p.id.startsWith('model:')).map((p) => [p.id.slice(6), p]));
  let live = false;
  towers.forEach((p, rank) => {
    const m = d.metrics.places.get(p.id)!, plant = plants.get(grid.modelOf.get(p.id) ?? '');
    const top = markTop(f, p), ptop = plant && stackTop(plant);
    const hot = m.tokens5 > 0;
    if (top && ptop && (hot || rank < 3)) {
      // From the stack to the roof: live (orange, solid, 2 px), or for today's biggest users a thin grey dotted line.
      const a0 = [ptop[0], ptop[1] + 4], b0 = [top[0], top[1] + 8];
      const n = Math.max(Math.abs(b0[0] - a0[0]), Math.abs(b0[1] - a0[1]));
      if (hot) wire(px, a0, b0, '#FF8A2B');
      else for (let i = 0; i < n; i += 3) px(Math.round(lerp(a0[0], b0[0], i / n)), Math.round(lerp(a0[1], b0[1], i / n)), 1, 1, '#8A93A3');
      if (hot) {
        live = true;
        const k = clamp(Math.ceil(m.tokens5 / 8000), 1, 4), spd = 0.2 + Math.min(1, m.tokens5 / 40000) * 0.6;
        for (let j = 0; j < k; j++) {
          const u = f.reducedMotion || !f.time ? (j + 0.5) / k : (f.time * spd + j / k + rank * 0.13) % 1;
          const x = Math.round(lerp(a0[0], b0[0], u)), y = Math.round(lerp(a0[1], b0[1], u));
          px(x - 1, y - 1, 4, 4, INK); px(x, y, 2, 2, '#FFC928');
        }
      }
    }
    // The meter: today's tokens, beside the tower.
    // The meter beside the tower: a case 3 px wide, filled from the bottom with today's share of the top user.
    const fp = p.building?.footprint ?? 0.7, q = artXY(p.at[0] + fp + 0.3, p.at[1] + fp, 0), H = 34, h = Math.max(2, Math.round(H * Math.sqrt(m.tokens / max)));
    px(q[0] - 1, q[1] - H - 1, 5, H + 2, INK); px(q[0], q[1] - H, 3, H, '#39415A'); px(q[0], q[1] - h, 3, h, '#FFC928');
    if (rank < 3 && top) bolt(px, top[0] - 4, top[1] - 24 - (f.time && (Math.floor(f.time * 2) & 1) ? 2 : 0));
  });
  // Load bars over the plants.
  for (const [model, p] of plants) {
    if (!model) continue;
    // The load bar, 40 × 6, centred 6 px above the stack's beacon: green, orange, red past 80 % of today's peak.
    const rate = d.metrics.places.get(p.id)?.tokens5 ?? 0, peak = Math.max(60_000, grid.peak.get(model) ?? 0), load = Math.min(1, rate / peak);
    const [x, sy] = stackTop(p), y = sy - 8 - 6 - 6, w = Math.round(40 * load);
    px(x - 21, y - 1, 42, 8, INK); px(x - 20, y, 40, 6, '#FFFFFF');
    if (w) px(x - 20, y, w, 6, load > 0.8 ? '#E5433D' : load > 0.5 ? '#FF8A2B' : '#35B37A');
  }
  return live;
}

/** Token counts: the plants (today), the three biggest towers. */
export function powerTags(f: OverlayFrame, d: LayerData, fmt: (n: number) => string, t: (k: string, p?: Record<string, string | number>) => string, at: (p: ScenePlace, dy: number) => [number, number] | undefined): Tag[] {
  const out: Tag[] = [];
  const towers = f.scene.places.filter((p) => p.tier === 'building' && (d.metrics.places.get(p.id)?.tokens ?? 0) > 0)
    .sort((a, b) => d.metrics.places.get(b.id)!.tokens - d.metrics.places.get(a.id)!.tokens);
  towers.forEach((p, rank) => {
    const m = d.metrics.places.get(p.id)!;
    const q = at(p, rank < 3 ? 26 : 2);   // over the bolt of the top three
    if (q && (rank < 3 || m.tokens5 > 0)) out.push({ x: q[0], y: q[1], text: t('td.tok', { n: fmt(m.tokens) }), bg: m.tokens5 > 0 ? '#E8873A' : '#59627A', fg: '#FFFFFF', prio: m.tokens });
  });
  for (const p of f.scene.places) {
    if (!p.id.startsWith('model:') || p.id === 'model:') continue;
    // The plant's label directly above its load bar.
    const m = d.metrics.places.get(p.id), [x, sy] = stackTop(p);
    if (m) out.push({ x, y: sy - 8 - 6 - 6 - 1, text: t('td.tok', { n: fmt(m.tokens) }), bg: '#8E7BD6', fg: '#FFFFFF', prio: 1e12 });
  }
  return out;
}
