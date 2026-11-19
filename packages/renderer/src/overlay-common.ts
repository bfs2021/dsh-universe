// Shared parts of the data views: what each layer needs from the data at T (computed once per data
// version and moment, not per frame), a whole-pixel pen on the art buffer, the gates of each place, and the path a
// vehicle takes along the roads. Nothing here writes text into the art buffer.
import {
  coloredSet, congestion, isRoad, metricsAt, type CityMetrics, type CongestionLevel, type LayerId,
} from '@dsh-universe/model';
import type { ArtKit, Canvas2D, PixelPen } from './artkit.ts';
import { artXY } from './geometry.ts';
import type { Scene, ScenePlace } from './scene.ts';
import type { ViewInput } from './view.ts';

export interface LayerData {
  key: string;
  layer: LayerId;
  metrics: CityMetrics;
  /** Places and agents kept in colour (null: the default layer, nothing greyed). */
  colour: Set<string> | null;
  /** Road tiles → congestion level (the call-volume layer only). */
  jam: Map<string, CongestionLevel>;
  gates: Map<string, [number, number][]>;
}

/** Recomputes only when the data, the moment or the layer change. */
export function layerData(cache: { v?: LayerData }, input: ViewInput, scene: Scene, layer: string): LayerData {
  const key = input.store.version() + '|' + input.T + '|' + layer + '|' + scene.growth + '|' + scene.places.length;
  if (cache.v?.key === key) return cache.v;
  const id = (layer as LayerId);
  const metrics = metricsAt(input.store, input.T);
  const colour = coloredSet(id, input.store, input.T, input.city ?? 'dsh', input.seen, input.drafts);
  const gates = gatesOf(scene);
  const jam = id === 'calls' ? congestion(gates, (p) => metrics.places.get(p)?.calls5 ?? 0, scene.growth) : new Map<string, CongestionLevel>();
  return (cache.v = { key, layer: id, metrics, colour, jam, gates });
}

/** The road tile in front of each place (its door), found by a ring search outwards. */
export function gatesOf(scene: Scene): Map<string, [number, number][]> {
  const out = new Map<string, [number, number][]>();
  for (const p of scene.places) {
    const g = nearestRoad(doorOf(p), scene.growth);
    if (g) out.set(p.id, [g]);
  }
  return out;
}

export const doorOf = (p: ScenePlace): [number, number] => (p.tier === 'building' ? [p.at[0] + 0.1, p.at[1] + 1.12] : [p.at[0], p.at[1] + 1]);

export function nearestRoad(p: readonly [number, number], growth: number): [number, number] | undefined {
  const i0 = Math.floor(p[0]), j0 = Math.floor(p[1]);
  for (let r = 0; r <= 6; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (isRoad(i0 + di, j0 + dj, growth)) return [i0 + di, j0 + dj];
  }
  return undefined;
}

/** A road route between two road tiles (BFS), as tile centres; empty when there is none. */
export function roadRoute(a: readonly [number, number], b: readonly [number, number], growth: number): [number, number][] {
  const key = (i: number, j: number) => (i + 100) * 1000 + (j + 100);
  const prev = new Map<number, number>([[key(a[0], a[1]), -1]]);
  const q: [number, number][] = [[a[0], a[1]]];
  for (let h = 0; h < q.length && !prev.has(key(b[0], b[1])); h++) {
    const [i, j] = q[h];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (prev.has(k) || !isRoad(ni, nj, growth)) continue;
      prev.set(k, key(i, j));
      q.push([ni, nj]);
    }
  }
  if (!prev.has(key(b[0], b[1]))) return [];
  const out: [number, number][] = [];
  for (let k = key(b[0], b[1]); k !== -1; k = prev.get(k)!) out.push([Math.floor(k / 1000) - 100 + 0.5, (k % 1000) - 100 + 0.5]);
  return out.reverse();
}

/**
 * Where a place's markers go (art pixels, world): for a tower, 10 px above the middle of its roof (the kit knows the
 * roof; a crown, spire or crane can stand far above it); for anything else, its top.
 */
export function markTop(f: { kit: ArtKit; last: { tops: Map<string, [number, number]> } }, p: ScenePlace): [number, number] | undefined {
  const roof = p.building ? f.kit.building(p.building).roof : undefined;
  if (roof) { const q = artXY(p.at[0], p.at[1]); return [q[0] + roof.dx, q[1] + roof.dy - 10]; }
  // The station: over its clock tower (the art kit's station: a tower 58 units tall at tile (10.5–11.0, 13.15–13.65)).
  if (p.id === 'station') return artXY(10.75, 13.4, 64);
  return f.last.tops.get(p.id);
}

export const pen = (g: Canvas2D): PixelPen => (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/** The art buffer's world offset (where art pixel (0, 0) of the world is). */
export function worldOffset(g: Canvas2D): [number, number] {
  const m = (g as { getTransform?: () => DOMMatrix }).getTransform?.();
  return m ? [m.e, m.f] : [0, 0];
}

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Colours of the data views. */
export const INK = '#141A30';
export const JAM = ['#FFC928', '#FF8A2B', '#E5433D'] as const;
