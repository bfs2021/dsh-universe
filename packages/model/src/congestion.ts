// Road congestion for the call-volume layer: the more calls a place had in the
// last five minutes, the redder the road tiles at its gates, one level less every three tiles outwards. Pure: the
// gates (road tiles in front of each place) come from the scene, the counts from `metricsAt`.
import { isRoad } from './template/city.ts';
import { PLACE } from './places.ts';

export type CongestionLevel = 1 | 2 | 3;
/** Calls in five minutes for levels 2 and 3 (level 1 is any call at all). */
export const CONGESTION_AT: readonly [number, number] = [12, 40];

export const congestionLevel = (calls5: number): CongestionLevel | 0 =>
  calls5 >= CONGESTION_AT[1] ? 3 : calls5 >= CONGESTION_AT[0] ? 2 : calls5 > 0 ? 1 : 0;

export const tileKey = (i: number, j: number) => i + ',' + j;

/**
 * Road tiles → level (1 yellow, 2 orange, 3 red). A place at level L colours the road tiles within 2 + 2L steps
 * (Manhattan) of each of its gates, at L − ⌊d / 3⌋ (at least 1); where two places overlap the higher level wins.
 * The fire station is not counted (its engines are not calls).
 */
export function congestion(
  gates: ReadonlyMap<string, readonly (readonly [number, number])[]>,
  calls5: (placeId: string) => number,
  growth: number,
): Map<string, CongestionLevel> {
  const out = new Map<string, CongestionLevel>();
  for (const [id, gs] of gates) {
    if (id === PLACE.fire) continue;
    const lv = congestionLevel(calls5(id));
    if (!lv) continue;
    const R = 2 + lv * 2;
    for (const [gi, gj] of gs) {
      for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) {
        const d = Math.abs(di) + Math.abs(dj), i = gi + di, j = gj + dj;
        if (d > R || !isRoad(i, j, growth)) continue;
        const l = Math.max(1, lv - Math.floor(d / 3)) as CongestionLevel;
        const k = tileKey(i, j);
        if ((out.get(k) ?? 0) < l) out.set(k, l);
      }
    }
  }
  return out;
}
