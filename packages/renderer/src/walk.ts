// Walking: an agent whose calls move from one place to
// another walks there along the roads, at 4.4 tiles a second. Pure: where it is follows from the time it set off,
// so replay and reduced motion need no state (under reduced motion it is simply at its destination).
import { BLOCK_ORIGINS, isRoad } from '@dsh-universe/model';

export const WALK_SPEED = 4.4;
type Tile = [number, number];

/** Road tiles a place is entered from. */
export function gatesOf(placeId: string, at: readonly [number, number]): Tile[] {
  switch (placeId) {
    case 'town': return [[13, 12], [15, 12], [11, 16], [17, 16], [14, 22]];
    case 'station': return [[12, 12], [6, 13]];
    case 'fire': return [[12, 23], [16, 23]];
    case 'school': return [[12, 4], [16, 4]];
    case 'library': return [[3, 28], [6, 25]];
  }
  if (placeId.startsWith('conn:')) { const y = Math.floor(at[1]); return [[12, y], [16, y]]; }
  // A tower: the nearest road beside its block.
  const [cx, cy] = at, ci = Math.floor(cx), cj = Math.floor(cy);
  const bx = BLOCK_ORIGINS.find((o) => cx - 1 === o || cx - 4 === o) ?? ci - 1, by = BLOCK_ORIGINS.find((o) => cy - 1 === o || cy - 4 === o) ?? cj - 1;
  const g: Tile[] = [[bx - 1, cj], [bx + 5, cj], [ci, by - 1], [ci, by + 5]];
  return [g.sort((a, b) => Math.hypot(a[0] + 0.5 - cx, a[1] + 0.5 - cy) - Math.hypot(b[0] + 0.5 - cx, b[1] + 0.5 - cy))[0]];
}

const routes = new Map<string, Tile[]>();
/** The shortest road route between two sets of gates (breadth first; cached). */
export function route(from: Tile[], to: Tile[], growth: number): Tile[] {
  const key = growth + ':' + from.join(';') + '>' + to.join(';');
  const hit = routes.get(key);
  if (hit) return hit;
  const k = (p: Tile) => (p[0] + 20) * 100 + p[1] + 20;
  const goal = new Set(to.map(k));
  const prev = new Map<number, Tile | null>();
  const q: Tile[] = [];
  for (const f of from) { prev.set(k(f), null); q.push(f); }
  let end: Tile | undefined;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (goal.has(k(c))) { end = c; break; }
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n: Tile = [c[0] + d[0], c[1] + d[1]];
      if (!prev.has(k(n)) && (isRoad(n[0], n[1], growth) || goal.has(k(n)))) { prev.set(k(n), c); q.push(n); }
    }
  }
  const out: Tile[] = [];
  for (let p: Tile | null | undefined = end; p; p = prev.get(k(p))) out.push(p);
  out.reverse();
  if (routes.size > 2000) routes.clear();
  routes.set(key, out);
  return out;
}

/** Where a walker is after `ms` on the polyline `pts` (tiles), or undefined once it has arrived. */
export function along(pts: readonly (readonly [number, number])[], ms: number): [number, number] | undefined {
  let left = (ms / 1000) * WALK_SPEED;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= d) { const u = d ? left / d : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
    left -= d;
  }
  return undefined;
}
