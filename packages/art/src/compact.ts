// Compact rooms ("bigger buildings have bigger floors"; "keep all rooms, small and big"). A compact
// room is its full-size room pushed together, the way a smaller building of the same kind would be fitted out: every
// thing on the floor keeps its order (what stood left of something still does, what stood behind still does), the
// empty floor between things shrinks to at most a walkway, and the room's zones (centrepiece, side room, corner,
// job printers) all stay. When that is still too big, workstations, plants and columns are left out, the one
// furthest out first, until everything fits with the door, the lift and the filing cabinets clear. The walkways
// are then laid where the floor is free, starting at the door. Pure: the same room and size always give the same
// compact room.
import type { RoomTier } from '@dsh-universe/renderer';

export type Rect = readonly [number, number, number, number];
/** Side of a room in tiles for each tier. The small size is the smallest whose back wall still holds the template's
 * main wall (6 tiles), the error beacon, the door and the lift. */
export const TIER_SIZE: Readonly<Record<RoomTier, number>> = { small: 9, medium: 10.5, large: 12 };

/** One thing on the floor, as the full-size room draws it (before the mirror). */
export interface Thing {
  tag: string;
  /** Solid parts (what agents and doors must keep clear of). */
  solid: Rect[];
  /** Everything it covers, rugs and mats included. */
  all: Rect[];
  /** May be left out (a workstation, a plant, a column); the zones may not. */
  optional: boolean;
  /** How much keeping it is worth (workstations most). */
  worth: number;
  /** The agent spots that belong to it (they move with it). */
  spots: [number, number][];
}

export interface PackRules {
  size: number;
  /** Floor that must stay clear in the compact room (before the door and the lift, the filing cabinets), before the mirror. */
  clear: Rect[];
  /** Tests and tuning: told the last attempt when nothing fits. */
  debug?: (boxes: { tag: string; r: Rect; bad: number }[]) => void;
}

/** Where each thing kept went: its move (dx, dy); things left out are missing. */
export type Packing = Map<string, readonly [number, number]>;

const hit = (a: Rect, b: Rect, e = 0): boolean => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > e && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > e;
const bbox = (rs: readonly Rect[]): [number, number, number, number] => [Math.min(...rs.map((r) => r[0])), Math.min(...rs.map((r) => r[1])), Math.max(...rs.map((r) => r[2])), Math.max(...rs.map((r) => r[3]))];
/** The most floor left between two things, or between a thing and a wall, in a compact room. */
const GAP = 0.45, WALL = 0.3, CLEAR_GAP = 0.15, EDGE = 0.1;
/** Two things share a row (or a column) when they overlap across it by more than this. */
const BAND = 0.25;

interface Box { t: Thing; b: [number, number, number, number]; x: number; y: number; w: number; h: number }

/**
 * Pushes the kept things together, keeping their order: two things that shared a row (or a column) of the full room
 * keep their order along it, and the floor between them shrinks to at most a walkway. Things that were apart on
 * both axes may slide past each other; when they would then meet, they keep their order along the axis where that
 * costs least. Each thing goes as far back and left as all that allows.
 */
function squeeze(bs: Box[], clear: readonly Rect[]): [Map<Box, Box>, Map<Box, Box>] {
  const pred: [Map<Box, Box>, Map<Box, Box>] = [new Map(), new Map()];
  const key = (a: Box, b: Box) => a.t.tag + '|' + b.t.tag;
  const cons = new Map<string, 0 | 1>();
  const sep = (a: Box, b: Box, ax: 0 | 1) => Math.max(b.b[ax] - a.b[ax + 2], a.b[ax] - b.b[ax + 2]);
  for (const a of bs) for (const b of bs) if (a !== b) {
    const sx = sep(a, b, 0), sy = sep(a, b, 1);
    if (sx >= 0 && sy < -BAND) cons.set(key(a, b), 0);
    else if (sy >= 0 && sx < -BAND) cons.set(key(a, b), 1);
  }
  const solve = (ax: 0 | 1) => {
    const lo = (b: Box) => b.b[ax], hi = (b: Box) => b.b[ax + 2];
    const order = [...bs].sort((a, b) => lo(a) - lo(b) || a.t.tag.localeCompare(b.t.tag));
    for (const b of order) {
      let at = Math.min(lo(b), WALL);
      pred[ax].delete(b);
      for (const o of order) {
        if (o === b || cons.get(key(o, b)) !== ax || hi(o) > lo(b) + 1e-6) continue;
        const v = (ax ? o.y + o.h : o.x + o.w) + Math.min(GAP, Math.max(0, lo(b) - hi(o)));
        if (v > at) { at = v; pred[ax].set(b, o); }
      }
      // (a clear floor against this wall keeps things off it the way a thing behind them would)
      const bLo = ax ? b.x : b.y, bHi = bLo + (ax ? b.w : b.h);
      for (const c of clear) if (c[ax] <= 0.01 && Math.min(bHi, c[3 - ax]) - Math.max(bLo, c[1 - ax]) > 0.02 && c[ax + 2] + CLEAR_GAP > at) { at = c[ax + 2] + CLEAR_GAP; pred[ax].delete(b); }
      if (ax) b.y = at; else b.x = at;
    }
  };
  for (let guard = 0; guard < 4 * bs.length + 8; guard++) {
    solve(0); solve(1); solve(0); solve(1);
    let added = false;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (cons.has(key(a, b))) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 0.01 || oy <= 0.01) continue;
      const ax: 0 | 1 = ox <= oy ? 0 : 1;
      cons.set(key(a, b), ax); cons.set(key(b, a), ax); added = true;
    }
    if (!added) return pred;
  }
  return pred;
}

/**
 * Packs a room's things into a room of side `size`: the move of each thing kept. Undefined when even the zones
 * alone do not fit.
 */
export function pack(things: readonly Thing[], o: PackRules): Packing | undefined {
  const n = o.size;
  const r = (b: Box): Rect => [b.x, b.y, b.x + b.w, b.y + b.h];
  /** Packs a set of things; what is wrong: a thing past the front or the right wall, on the clear floor, or on another. */
  const attempt = (keep: readonly Thing[]) => {
    const bs: Box[] = keep.map((t) => {
      const b = bbox([...t.all, ...t.spots.map((s): Rect => [s[0] - 0.1, s[1] - 0.1, s[0] + 0.1, s[1] + 0.1])]);
      return { t, b, x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] };
    });
    const pred = squeeze(bs, o.clear);
    const bad = new Map<Box, number>();
    const blame = (b: Box, v: number) => bad.set(b, Math.max(bad.get(b) ?? 0, v));
    for (const b of bs) {
      const over = Math.max(b.x + b.w - (n - EDGE), b.y + b.h - (n - EDGE));
      if (over > 0) blame(b, 10 + over);
      if (o.clear.some((c) => hit(r(b), c))) blame(b, 5);
    }
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (hit(r(bs[i]), r(bs[j]), 0.01)) { blame(bs[i], 1); blame(bs[j], 1); }
    return { bs, bad, pred };
  };
  const result = (bs: readonly Box[]): Packing => new Map(bs.map((b) => [b.t.tag, [b.x - b.b[0], b.y - b.b[1]] as const]));
  let keep = [...things];
  for (let guard = 0; guard <= things.length; guard++) {
    const { bs, bad, pred } = attempt(keep);
    if (!bad.size) {
      // Fits. Then put back what was left out on the way, most worth first, wherever it still fits.
      let best = bs;
      const out = things.filter((t) => !keep.includes(t)).sort((a, b) => b.worth - a.worth || things.indexOf(a) - things.indexOf(b));
      for (const t of out) {
        const tryKeep = things.filter((x) => keep.includes(x) || x === t);
        const a = attempt(tryKeep);
        if (!a.bad.size) { keep = tryKeep; best = a.bs; }
      }
      return result(spread(best, n, o.clear));
    }
    // Leave out the least worth among the things in the way (the furthest out on a tie); fail if only zones are.
    let cands = [...bad.keys()].filter((b) => b.t.optional);
    if (!cands.length) {
      // Only zones are in the way: leave out what holds one of them where it is (the chain of what stands before it,
      // on the axis it is too far out on); when nothing optional does, clear the floor anyway, least worth first.
      const chain = new Set<Box>();
      for (const z of bad.keys()) for (const ax of [0, 1] as const) {
        if ((ax ? z.y + z.h : z.x + z.w) <= n - EDGE && bad.get(z)! >= 10) continue;
        for (let q = pred[ax].get(z), g = 0; q && g < bs.length; q = pred[ax].get(q), g++) chain.add(q);
      }
      cands = [...chain].filter((b) => b.t.optional);
      if (!cands.length) cands = bs.filter((b) => b.t.optional);
      for (const c of cands) bad.set(c, 0);
    }
    if (!cands.length) { o.debug?.(bs.map((b) => ({ tag: b.t.tag, r: r(b), bad: bad.get(b) ?? 0 }))); return undefined; }
    cands.sort((a, b) => a.t.worth - b.t.worth || bad.get(b)! - bad.get(a)! || (b.x + b.w + b.y + b.h) - (a.x + a.w + a.y + a.h) || a.t.tag.localeCompare(b.t.tag));
    keep = keep.filter((t) => t !== cands[0].t);
  }
  return undefined;
}

/**
 * Spreads a packed room over the floor it has left: every thing moves out from the back left wall in proportion to
 * how far out it already is, so the order stays and every gap grows a little (the room is not crammed into its back
 * corner). Less, or not at all, when spreading would put something on the clear floor.
 */
function spread(bs: readonly Box[], n: number, clear: readonly Rect[]): Box[] {
  const far = (ax: 0 | 1) => Math.max(...bs.map((b) => (ax ? b.y + b.h : b.x + b.w)));
  for (const k of [1, 0.6, 0.3]) {
    const fx = far(0), fy = far(1);
    const sx = fx > WALL + 1 ? ((n - EDGE - 0.05 - fx) * k) / (fx - WALL) : 0, sy = fy > WALL + 1 ? ((n - EDGE - 0.05 - fy) * k) / (fy - WALL) : 0;
    // (a thing's place grows with the stretch, its size does not: the order and every gap only grow)
    const moved = bs.map((b) => ({ ...b, x: b.x + (b.x - WALL) * Math.max(0, sx), y: b.y + (b.y - WALL) * Math.max(0, sy) }));
    const r = (b: Box): Rect => [b.x, b.y, b.x + b.w, b.y + b.h];
    const ok = moved.every((b) => b.x + b.w <= n - EDGE + 1e-9 && b.y + b.h <= n - EDGE + 1e-9 && !clear.some((c) => hit(r(b), c)))
      && moved.every((a, i) => moved.every((b, j) => j <= i || !hit(r(a), r(b), 0.01)));
    if (ok) return moved;
  }
  return [...bs];
}

/** The floor that stays clear in a compact room of side n (before the mirror): before the door and the lift, by the
 * filing cabinets, and (mirrored rooms) before the lift, which then stands at the front of the left wall. */
export function clearOf(n: number, flip: boolean): Rect[] {
  const out: Rect[] = [[n - 2.4, 0, n, 1.3], [0, n - 2.05, 0.75, n - 0.9]];
  if (flip) out.push([0, n - 1.1, 1.3, n]);
  return out;
}

/**
 * Walkways for a packed room: one from the door down into the room, then the longest free runs across the floor
 * that meet it (and one another), so agents walk between things, never over them.
 */
export function walkways(n: number, taken: readonly Rect[], door: number): [number, number, number, number][] {
  const free = (r: Rect) => r[0] >= 0.29 && r[1] >= 0.29 && r[2] <= n - 0.29 && r[3] <= n - 0.29 && !taken.some((q) => hit(q, r, 0.005));
  const out: [number, number, number, number][] = [];
  // From the door: as far into the room as the floor is free.
  let y1 = 0.3;
  while (y1 + 0.05 <= n - 0.3 && free([door, 0.3, door + 0.8, y1 + 0.05])) y1 = Math.round((y1 + 0.05) * 100) / 100;
  if (y1 - 0.3 < 0.4) return out;
  out.push([door, 0.3, door + 0.8, y1]);
  // Runs across and along the room, 0.4 wide, longest first; each must meet a walkway already laid.
  const runs: [number, number, number, number][] = [];
  for (let v = 0.3; v + 0.4 <= n - 0.3 + 1e-9; v = Math.round((v + 0.05) * 100) / 100) for (const ax of [0, 1] as const) {
    let a = 0.3;
    while (a < n - 0.3) {
      const r = (s: number, e: number): Rect => (ax ? [v, s, v + 0.4, e] : [s, v, e, v + 0.4]);
      if (!free(r(a, a + 0.05))) { a = Math.round((a + 0.05) * 100) / 100; continue; }
      let e = a + 0.05;
      while (e + 0.05 <= n - 0.3 + 1e-9 && free(r(a, e + 0.05))) e = Math.round((e + 0.05) * 100) / 100;
      if (e - a >= 2) runs.push(r(a, e) as [number, number, number, number]);
      a = Math.round((e + 0.05) * 100) / 100;
    }
  }
  runs.sort((p, q) => (q[2] - q[0] + q[3] - q[1]) - (p[2] - p[0] + p[3] - p[1]) || p[1] - q[1] || p[0] - q[0]);
  // Two walkways meet where their centre lines cross inside both (agents turn there).
  const across = (r: Rect) => r[2] - r[0] >= r[3] - r[1];
  const meets = (p: Rect, q: Rect) => {
    if (across(p) === across(q)) return false;
    const h = across(p) ? p : q, v = h === p ? q : p, cx = (v[0] + v[2]) / 2, cy = (h[1] + h[3]) / 2;
    return cx >= h[0] && cx <= h[2] && cy >= v[1] && cy <= v[3];
  };
  for (let added = true; added && out.length < 4;) {
    added = false;
    for (const r of runs) {
      if (out.length >= 4) break;
      if (out.some((q) => hit(q, r, 0) && !meets(q, r))) continue;   // (overlapping without crossing: a double walkway)
      // not alongside one already laid (a walkway every 1.2 tiles at most)
      if (out.some((q) => (q[2] - q[0] > q[3] - q[1]) === (r[2] - r[0] > r[3] - r[1]) && (r[2] - r[0] > r[3] - r[1] ? Math.abs(q[1] - r[1]) < 1.2 : Math.abs(q[0] - r[0]) < 1.2))) continue;
      if (!out.some((q) => meets(q, r))) continue;
      out.push(r); added = true;
    }
  }
  return out;
}
