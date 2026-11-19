// How agents walk inside a room: along its walkways, not across the desks. A walkway is a rectangle of the plan;
// its centre line is a segment. A route goes from where the agent stands straight onto the nearest walkway, along
// the walkways (turning where they cross), and off the walkway to the spot. Pure; rooms without walkways (the small
// fixed scenes) walk straight.
export type P = readonly [number, number];
type Seg = { a: P; b: P };

const segOf = (r: readonly number[]): Seg => (r[2] - r[0] >= r[3] - r[1]
  ? { a: [r[0], (r[1] + r[3]) / 2], b: [r[2], (r[1] + r[3]) / 2] }
  : { a: [(r[0] + r[2]) / 2, r[1]], b: [(r[0] + r[2]) / 2, r[3]] });
const near = (s: Seg, p: P): P => {
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / L));
  return [s.a[0] + dx * u, s.a[1] + dy * u];
};
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Where two walkway centre lines meet (one horizontal, one vertical), if they do; ends within a walkway's width count. */
function meet(s: Seg, t: Seg): P | undefined {
  const h = s.a[1] === s.b[1] ? s : t, v = h === s ? t : s;
  if (h.a[1] !== h.b[1] || v.a[0] !== v.b[0]) return undefined;
  const x = v.a[0], y = h.a[1], slack = 0.6;
  const inX = x >= Math.min(h.a[0], h.b[0]) - slack && x <= Math.max(h.a[0], h.b[0]) + slack;
  const inY = y >= Math.min(v.a[1], v.b[1]) - slack && y <= Math.max(v.a[1], v.b[1]) + slack;
  return inX && inY ? [x, y] : undefined;
}

/** The waypoints from `from` to `to` (both included), along the walkways when that is shorter than a detour. */
export function route(aisles: readonly (readonly number[])[], from: P, to: P): P[] {
  if (!aisles.length) return [from, to];
  const segs = aisles.map(segOf);
  const pick = (p: P) => { let bi = 0, bd = Infinity; segs.forEach((s, i) => { const d = dist(near(s, p), p); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const i0 = pick(from), i1 = pick(to);
  const pa = near(segs[i0], from), pb = near(segs[i1], to);
  // Breadth-first over walkways that meet.
  const prev = new Map<number, number>([[i0, -1]]);
  const queue = [i0];
  while (queue.length) {
    const i = queue.shift()!;
    if (i === i1) break;
    segs.forEach((s, k) => { if (!prev.has(k) && meet(segs[i], s)) { prev.set(k, i); queue.push(k); } });
  }
  if (!prev.has(i1)) return [from, to];
  const chain: number[] = [];
  for (let i = i1; i !== -1; i = prev.get(i)!) chain.unshift(i);
  const pts: P[] = [from, pa];
  for (let n = 0; n + 1 < chain.length; n++) pts.push(meet(segs[chain[n]], segs[chain[n + 1]])!);
  pts.push(pb, to);
  // Drop repeated points; a short hop (same walkway, close by) stays straight.
  const out: P[] = [];
  for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > 0.02) out.push(p);
  return dist(from, to) < 1.2 ? [from, to] : out;
}
