// A floor as a room (the full-size branch of `scene()`, `vStack`): the shell
// (floor, back and left wall, lift), then either a 12×12 template room laid out by its plan, or a 5.2×5.2 fixed
// scene. Indoor light is constant; the dark theme only changes what is outside the windows and turns the lamps on.
// Everything that moves is one of this floor's own numbers or machinery that runs only while an agent works here.
// No people are drawn: people are agents, drawn by the renderer on top. All rights reserved.
import { CENTER_C, CORNER_C, SIDE_C } from './props/rooms-coarse.ts';
import { COARSE_CENTER, COARSE_CORNER, COARSE_SIDE, COARSE_UNIT, COARSE_WALL_ART, onGrid, wallTag } from './props/units-coarse.ts';
import { STACK_BASE, STACK_PITCH, type RoomLayout, type RoomProp, type RoomPropId, type RoomSpec, type RoomTier, type StackFloor } from '@dsh-universe/renderer';
import { hs } from '@dsh-universe/model';
import { box, iso, P4 as P4raw, withPen } from './iso.ts';
import { clearOf, pack, TIER_SIZE, walkways, type Packing, type Rect, type Thing } from './compact.ts';
import { env, tone } from './light.ts';
import { BOLD, mix, SC } from './palette.ts';
import { SHIRT } from './people.ts';
import { DOOR, finishPlan, LIFT, planOf, ROOM_SIZE, SUB_VARIANTS, type RoomPlan, type Unit, type XY } from './plans.ts';
import { CORNER } from './props/corners.ts';
import { CENTER } from './props/centers.ts';
import { f as fixedData, paintFixed } from './props/fixed.ts';
import { civic, hasCivic, paintCivic } from './props/civic.ts';
import { BAYS, hall, HALLS, paintCounter, paintLobby, paintRoof } from './props/halls.ts';
import { item, act, B, cfg, cyl, errNow, F, fl2, flat, fN, g, hr, jobs, L, line, disc, nt, P4, pt, rec, rm, setFlip, setFootprintProbe, setPen, setShift, setZone, tm, W } from './props/pen.ts';
import { SIDE } from './props/sides.ts';
import { bush, palm, UNIT } from './props/units.ts';
import { WALL } from './props/walls.ts';
import { lookOf } from './templates/buildings/tower.ts';
import { ROOM_TEMPLATES, roomTemplate } from './templates/rooms/index.ts';

/** Wall height of a room (drawing units). */
export const ROOM_WALL = 46;
/** Side of a fixed scene, in tiles. */
export const SMALL_ROOM = 5.2;

/** Fixed scene of a floor id (model ids → scene names). */
const SCENE_OF: Record<string, string> = {
  lobby: 'lobby', roof: 'roof', platform: 'plat', gate: 'gate', approval: 'appr', question: 'ask', plan: 'ask', post: 'post',
  skill: 'skill', expert: 'expert', memory: 'mem', turbine: 'turb', control: 'ctrl', bay: 'bay', retry: 'retry',
};
/** A floor that is not a template room comes as `fixed:<floor id>` (so a floor id never meets a template id). */
const bare = (room: string): string => (room.startsWith('fixed:') ? room.slice(6) : room);
export const sceneOf = (spec: Pick<RoomSpec, 'room' | 'floor' | 'place'>): string => SCENE_OF[bare(spec.room)] ?? (spec.place === 'connector' ? 'tool' : bare(spec.room));

/** Where agents stand in the fixed scenes. */
const SPOTS: Record<string, readonly (readonly [number, number])[]> = {
  lobby: [[2.2, 1.9], [3.4, 1.9], [1.3, 3.1], [3, 3.7], [4.3, 3]], roof: [[2, 2.3], [3.4, 3.3], [1.6, 4.1]],
  tool: [[1.4, 1.9], [2.6, 1.9], [3.8, 1.9], [1.7, 3.6], [3.5, 3.8]], plat: [[1.4, 2.4], [2.8, 2.6], [4.2, 2.4], [2.2, 4]],
  gate: [[1.8, 1.7], [3.6, 1.7], [1.4, 3.4], [4.1, 3.4]], skill: [[1.45, 2.85], [2.95, 2.85], [4.45, 2.85], [1.45, 4.25], [2.95, 4.25], [4.45, 4.25]],
  turb: [[1.6, 3.1], [3.9, 3.1], [2.8, 4.3]], expert: [[2.05, 2.35], [3.95, 2.35], [2.0, 3.9], [3.6, 4.0]],
  mem: [[2.15, 3.62], [3.75, 3.62], [2.4, 2.0], [3.3, 4.4]], bay: [[1.6, 2.6], [3.0, 2.6], [1.2, 3.4], [2.8, 4.3]], retry: [[1.9, 2.4], [3.2, 2.4], [1.6, 3.8], [3.4, 4.0]], ctrl: [[1.4, 2], [2.8, 2], [4.2, 2]], any: [[2, 2.5], [3.2, 3.2], [1.6, 3.8], [4, 2.4]],
};
/** Floors drawn as full-size halls: the lobby of every building and the town hall's counters. */
const HALL_OF: Record<string, 'lobby' | 'counter' | 'roof'> = { lobby: 'lobby', approval: 'counter', question: 'counter', plan: 'counter', roof: 'roof' };
const HALL_AISLES = [[9.75, 0.3, 10.55, 11.7], [0.3, 6.7, 9.75, 7.3]] as const;
const SMALL_BOX = { w: 184, h: 132, ox: 92, oy: 30 };

const plans = new Map<string, RoomPlan | null>();
/**
 * Which arrangement of its plan type a template gets: the templates of one plan type take the three in turn (in
 * catalog order, so the first of each type keeps the original arrangement and the trading floor stays as
 * designed). Rooms of the same plan type no longer have their zones in the same places.
 */
export function subOf(id: string): number {
  const t = roomTemplate(id);
  if (!t) return 0;
  return ROOM_TEMPLATES.filter((x) => x.look.plan === t.r.look.plan).findIndex((x) => x.id === id) % SUB_VARIANTS;
}

/**
 * The plan of a template room at a size (cached: pure in the room's seed and the size). The full-size plan is the
 * template's own; a compact one is derived from it (compact.ts). A template with no compact plan that works keeps
 * its full size (none today: the tests check every template at every size).
 */
export function roomPlan(id: string, tier: RoomTier = 'large'): RoomPlan | undefined {
  if (id.startsWith('fixed:')) return undefined;
  const key = id + '|' + tier;
  const hit = plans.get(key);
  if (hit !== undefined) return hit ?? roomPlan(id);
  const t = roomTemplate(id);
  if (!t) return undefined;
  const full = tier === 'large' ? planOf(t.r.look.plan, t.i, subOf(id)) : roomPlan(id)!;
  // A compact room comes from the template's own arrangement; when that one cannot be pushed together, from the
  // next arrangement of the same plan type (same template, same seed, same mirror).
  let p: RoomPlan | undefined = full;
  if (tier !== 'large') {
    p = undefined;
    for (let k = 0; k < SUB_VARIANTS && !p; k++) p = compactPlan(id, k ? planOf(t.r.look.plan, t.i, (full.sub + k) % SUB_VARIANTS) : full, TIER_SIZE[tier]);
  }
  plans.set(key, p ?? null);
  return p ?? full;
}

/** A context that draws nothing (the footprint probe still hears every box). */
const NULL_CTX = new Proxy({} as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => undefined), set: (t, k: string, v) => { t[k] = v; return true; } });

/** What a painting puts on the floor, by probe tag: everything (rugs and mats too) and the solid parts. */
function measure(paint: () => void, flip = false): Map<string, { all: Rect[]; solid: Rect[] }> {
  const by = new Map<string, { all: Rect[]; solid: Rect[] }>();
  const un = (r: readonly number[]): Rect => (flip ? [r[1], r[0], r[3], r[2]] : [r[0], r[1], r[2], r[3]]);
  const at = (z: string) => by.get(z) ?? (by.set(z, { all: [], solid: [] }), by.get(z)!);
  for (const flats of [true, false]) {
    setFootprintProbe((r, z) => at(z)[flats ? 'all' : 'solid'].push(un(r)), flats);
    try { withPen(NULL_CTX as never, paint); } finally { setFootprintProbe(null); }
  }
  by.delete('room');
  return by;
}

/** What the full-size room of a template puts on its floor, thing by thing (before the mirror). */
export function thingsOf(id: string, plan: RoomPlan): Thing[] {
  const n = plan.units.length;
  const unflip = (q: XY): [number, number] => (plan.flip ? [q[1], q[0]] : [q[0], q[1]]);
  return [...measure(() => paintRoom(probeSpec(id), plan), plan.flip)].filter(([tag]) => tag !== 'cabinets').map(([tag, e]) => {
    const unit = /^unit(\d+)$/.exec(tag), k = unit ? Number(unit[1]) : -1;
    const optional = !!unit || tag.startsWith('plant') || tag.startsWith('column');
    const spots = unit ? [unflip(plan.spots[k])] : tag === 'centre' ? [unflip(plan.spots[n]), unflip(plan.spots[n + 1])] : tag === 'corner' ? [unflip(plan.spots[n + 2])] : [];
    return { tag, all: e.all, solid: e.solid, optional, worth: unit ? 10 : optional ? 1 : 0, spots };
  });
}
const probeSpec = (id: string): RoomSpec => ({
  id: 'probe', room: id, floor: 'library', place: 'building', colour: '#6C7BEA', seed: 0, act: true, frame: 3, reduced: false, night: false, na: false,
  n: 250, recent: [], jobs: 3, subs: [], out: 0, queue: 0, rate: 0, hour: 12,
});

/** The compact plan of a template room of side `size`: its full plan pushed together (compact.ts). */
export function compactPlan(id: string, full: RoomPlan, size: number): RoomPlan | undefined {
  const things = thingsOf(id, full);
  const moved = pack(things, { size, clear: clearOf(size, full.flip) });
  if (!moved) return undefined;
  const sh = (tag: string): readonly [number, number] => moved.get(tag) ?? [0, 0];
  const zone = (q: XY, tag: string): XY => [q[0] + sh(tag)[0], q[1] + sh(tag)[1]];
  const units: Unit[] = [];
  full.units.forEach((u, k) => { const m = moved.get('unit' + k); if (m) units.push([u[0] + m[0], u[1] + m[1], u[2]]); });
  const keep = <T extends readonly number[]>(xs: readonly T[], pre: string): T[] => xs.flatMap((q, i) => { const m = moved.get(pre + i); return m ? [[q[0] + m[0], q[1] + m[1], ...q.slice(2)] as unknown as T] : []; });
  const plan0 = finishPlan({
    type: full.type, sub: full.sub, units, c: zone(full.c, 'centre'), s: zone(full.s, 'side'), k: zone(full.k, 'corner'), j: zone(full.j, 'jobs'),
    aisles: [], cols: keep(full.cols, 'column'), plants: keep(full.plants, 'plant'), flip: full.flip, size,
  });
  return { ...plan0, aisles: walkways(size, takenOf(things, moved, size, full.flip), DOOR[0] + size - ROOM_SIZE + 0.05) };
}

/** The floor taken in a packed room (before the mirror): everything kept, the agents' spots, the cabinets and the lift. */
function takenOf(things: readonly Thing[], moved: Packing, n: number, flip: boolean): Rect[] {
  const out: Rect[] = [];
  for (const t of things) {
    const m = moved.get(t.tag);
    if (!m) continue;
    for (const r of t.all) out.push([r[0] + m[0], r[1] + m[1], r[2] + m[0], r[3] + m[1]]);
    for (const q of t.spots) out.push([q[0] + m[0] - 0.12, q[1] + m[1] - 0.12, q[0] + m[0] + 0.12, q[1] + m[1] + 0.12]);
  }
  out.push([0, n - 2.05, 0.7, n - 0.9], [n - 1.1, 0, n, 1.3]);
  if (flip) out.push([0, n - 1.1, 1.3, n]);
  return out;
}

/** A hall at a size: where agents stand and walk, its data props, and (compact) where each group of things went. */
export interface HallPlan {
  size: number;
  spots: readonly XY[];
  aisles: readonly (readonly [number, number, number, number])[];
  props: RoomProp[];
  /** Compact: the move of each group of things (undefined: left out); null in the full-size hall. */
  shift: ((tag: string) => readonly [number, number] | undefined) | null;
  /** The roof: the solar panel places kept, in the order panels fill them. */
  slots: readonly number[];
}
/** Which group each of a hall's agent spots belongs to ('' = a spot of its own on the open floor). */
const HALL_SPOT_OWNER: Record<string, readonly string[]> = {
  lobby: ['reception', 'reception', 'reception', 'lounge', 'lounge', 'seats', 'seats', ''], roof: ['', '', ''],
};
/** Groups a compact hall may leave out, and what keeping each is worth (the rest always stay). */
const HALL_OPTIONAL: [RegExp, number][] = [[/^(lounge|seats)$/, 5], [/^(bed|panel)\d+$/, 2], [/^spot\d+$/, 3], [/^(palm|bush|hvac|tank|antenna|bench|vents)/, 1]];
const hallPlans = new Map<string, HallPlan | null>();
/** The full-size hall's solar panel places (six by three). */
export const ROOF_SLOTS = 18;

/** The plan of a hall (the lobby and the roof of a session building follow its size; the town hall is always full). */
export function hallPlan(room: string, tier: RoomTier = 'large'): HallPlan | undefined {
  const kind = HALL_OF[room];
  if (!kind) return undefined;
  const t: RoomTier = kind === 'counter' ? 'large' : tier, key = room + '|' + t;
  const hit = hallPlans.get(key);
  if (hit) return hit;
  const full: HallPlan = { size: ROOM_SIZE, spots: HALLS[room] ?? [], aisles: HALL_AISLES, props: SCENE_PROPS[kind], shift: null, slots: [...Array(ROOF_SLOTS).keys()] };
  const p = t === 'large' ? full : compactHall(room, full, TIER_SIZE[t]) ?? full;
  hallPlans.set(key, p);
  return p;
}

function compactHall(room: string, full: HallPlan, n: number): HallPlan | undefined {
  const spec = (ended: boolean): RoomSpec => ({ ...probeSpec(room), floor: room, out: 12, present: 1, n: 1e12, ended });
  const by = measure(() => paintRoom(spec(false)));
  for (const [tag, e] of measure(() => paintRoom(spec(true)))) { const o = by.get(tag); if (o) { o.all.push(...e.all); o.solid.push(...e.solid); } else by.set(tag, e); }
  const owner = HALL_SPOT_OWNER[room] ?? [];
  const things: Thing[] = [...by].filter(([tag]) => tag !== 'housing').map(([tag, e]) => {
    const opt = HALL_OPTIONAL.find(([re]) => re.test(tag));
    return { tag, all: e.all, solid: e.solid, optional: !!opt, worth: opt?.[1] ?? 0, spots: full.spots.flatMap((q, i) => (owner[i] === tag ? [[q[0], q[1]] as [number, number]] : [])) };
  });
  full.spots.forEach((q, i) => { if (!owner[i]) things.push({ tag: 'spot' + i, all: [[q[0] - 0.08, q[1] - 0.08, q[0] + 0.08, q[1] + 0.08]], solid: [], optional: true, worth: 3, spots: [[q[0], q[1]]] }); });
  const moved = pack(things, { size: n, clear: clearOf(n, false).slice(0, 1) });
  if (!moved) return undefined;
  const spots: XY[] = [];
  full.spots.forEach((q, i) => { const m = moved.get(owner[i] || 'spot' + i); if (m) spots.push([q[0] + m[0], q[1] + m[1]]); });
  const aisles = walkways(n, takenOf(things, moved, n, false).slice(0, -2).concat([[n - 1.1, 0, n, 1.3]]), n - 2.25);
  const slots = [...Array(ROOF_SLOTS).keys()].filter((k) => moved.has('panel' + k));
  const mv = (tag: string, r: readonly [number, number, number, number]): [number, number, number, number] => { const m = moved.get(tag) ?? [0, 0]; return [r[0] + m[0], r[1] + m[1], r[2] + m[0], r[3] + m[1]]; };
  const props = (full.props ?? []).map((pr): RoomProp => {
    if (!('floor' in pr)) return pr;
    if (pr.id === 'reception') return { ...pr, floor: mv('reception', pr.floor) };
    if (pr.id === 'crates') return { ...pr, floor: mv('pallet', pr.floor) };
    // the solar array: round the panels kept
    const rs = slots.map((k) => mv('panel' + k, roofSlot(k)));
    return rs.length ? { ...pr, floor: [Math.min(...rs.map((r) => r[0])), Math.min(...rs.map((r) => r[1])), Math.max(...rs.map((r) => r[2])), Math.max(...rs.map((r) => r[3]))] } : pr;
  });
  // The roof's access housing stands over the lift and moves with it.
  moved.set('housing', [n - ROOM_SIZE, 0]);
  return { size: n, spots, aisles, props, shift: (tag) => moved.get(tag), slots };
}
/** Where solar panel place k of the full-size roof is (tiles). */
export const roofSlot = (k: number): [number, number, number, number] => { const x = 1.2 + (k % 6) * 1.3, y = 1.6 + Math.floor(k / 6) * 1.5; return [x, y + 0.1, x + 1.1, y + 0.9]; };

/** Where the shared data props of a template room are (the numbers below are the shell's own, in paintBig). */
function propsOf(plan: RoomPlan): RoomProp[] {
  const back = plan.flip ? 'left' : 'back', left = plan.flip ? 'back' : 'left';
  const jx = plan.j[0], jy = plan.j[1], w = wallsOf(plan);
  const fl = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => (plan.flip ? [y0 + jy, x0 + jx, y1 + jy, x1 + jx] : [x0 + jx, y0 + jy, x1 + jx, y1 + jy]);
  return [
    { id: 'tape', wall: back, a0: 0.4, a1: 6.4, z0: 38, z1: 46 },
    { id: 'beacon', wall: back, a0: 6.45, a1: 6.85, z0: 38, z1: 54 },
    { id: 'board', wall: w.boardLeft ? left : back, a0: 6.8 + w.board, a1: 9.4 + w.board, z0: 5, z1: 23 },
    { id: 'whiteboard', wall: left, a0: w.white, a1: w.white + 0.76, z0: 14, z1: 38 },
    { id: 'printers', floor: fl(8.3, 7.5, 11.6, 8.1), z1: 14 },
  ];
}

/**
 * Where the walls' things go in a room of the plan's size (before the mirror). The full-size room keeps the
 * template's own walls. A compact room keeps the template's main wall on the back wall (6 tiles), with the error
 * beacon, the door and the lift; the log board and its clocks move to the left wall, in place of the second and
 * third window; the whiteboard and the filing cabinets stay at the front of the left wall.
 */
export function wallsOf(plan: Pick<RoomPlan, 'size'>): { size: number; windows: number[]; boardLeft: boolean; board: number; white: number; art: boolean; door: number } {
  const n = plan.size, door = n - ROOM_SIZE, white = 10.2 + door;
  if (n >= ROOM_SIZE) return { size: n, windows: [0.5, 3.9, 7.3], boardLeft: false, board: 0, white, art: true, door: 0 };
  return { size: n, windows: [0.5], boardLeft: true, board: 3.9 - 6.8, white, art: white >= 7.4, door };
}

/** The data props of the halls and the public floors (no mirror in these rooms): where each stands. */
const W_ = (id: RoomPropId, a0: number, a1: number, z0: number, z1: number): RoomProp => ({ id, wall: 'back', a0, a1, z0, z1 });
const L_ = (id: RoomPropId, a0: number, a1: number, z0: number, z1: number): RoomProp => ({ id, wall: 'left', a0, a1, z0, z1 });
const F_ = (id: RoomPropId, x0: number, y0: number, x1: number, y1: number, z1: number): RoomProp => ({ id, floor: [x0, y0, x1, y1], z1 });
const SCENE_PROPS: Record<string, RoomProp[]> = {
  lobby: [F_('reception', 3.6, 2.0, 8.2, 4.0, 22), F_('crates', 4.6, 4.6, 7.0, 6.0, 20)],
  counter: [F_('racks', 2.6, 0.7, 9.4, 1.6, 38)],
  roof: [F_('solar', 1.2, 1.6, 8.9, 6.1, 14)],
  tool: [W_('menu', 0.5, 3.9, 22, 42)],
  plat: [L_('departures', 1.7, 3.6, 14, 42)],
  gate: [L_('webtally', 0.6, 3.6, 14, 40), F_('turnstiles', 0.8, 4.2, 4.5, 4.9, 14)],
  skill: [W_('blackboard', 0.8, 4.0, 10, 42)],
  expert: [W_('portraits', 0.6, 4.0, 14, 40)],
  mem: [F_('books', 0.3, 0.1, 4.0, 0.5, 42), F_('cartridges', 0.1, 1.0, 0.56, 2.6, 26)],
  turb: [W_('load', 0.5, 2.2, 30, 42), W_('meter', 2.35, 4.0, 30, 42)],
  ctrl: [W_('dial', 2.15, 3.05, 14, 46)],
  bay: [L_('repairlog', 0.6, 3.4, 14, 42), F_('engine', 0.4, 0.9, 4.1, 2.1, 20)],
  retry: [W_('repairlog', 0.4, 3.9, 8, 44)],
};

/** The sprite box of a room of side n (art pixels): the full-size room's 404 × 236 for 12. */
export const boxOf = (n: number): { w: number; h: number; ox: number; oy: number } => {
  const w = Math.round(n * 32) + 20;
  return { w, h: Math.round(n * 16) + 44, ox: w / 2, oy: 30 };
};

const layouts = new Map<string, RoomLayout>();
export function roomLayout(room: string, tier: RoomTier = 'large'): RoomLayout {
  const key = room + '|' + tier;
  const hit = layouts.get(key);
  if (hit) return hit;
  const l = layoutOf(room, tier);
  layouts.set(key, l);
  return l;
}
function layoutOf(room0: string, tier: RoomTier): RoomLayout {
  const plan = roomPlan(room0, tier), room = bare(room0);
  if (plan) {
    const aisles = plan.aisles.map((a) => (plan.flip ? [a[1], a[0], a[3], a[2]] as const : a));
    return { size: plan.size, spots: plan.spots, lift: [plan.size - 0.6, LIFT[1]], aisles, props: propsOf(plan), ...boxOf(plan.size) };
  }
  const hp = hallPlan(room, tier);
  if (hp) return { size: hp.size, spots: hp.spots, lift: [hp.size - 0.6, LIFT[1]], aisles: hp.aisles, props: hp.props, ...(HALL_OF[room] === 'counter' ? { bays: BAYS.map((floor, k) => ({ floor, at: [3.9 + k * 2.2, 0, 56] as const })) } : {}), ...boxOf(hp.size) };
  const id = SCENE_OF[room] ?? room;
  const scene = SCENE_OF[room] ?? 'tool';
  return { size: SMALL_ROOM, spots: SPOTS[id] ?? (SCENE_OF[room] ? SPOTS.any : SPOTS.tool), lift: [SMALL_ROOM - 0.6, 0.7], props: SCENE_PROPS[scene], ...SMALL_BOX };
}

/** The sprite box of a room: [w, h, ox, oy] (art pixels). */
export const roomBox = (room: string, tier: RoomTier = 'large'): [number, number, number, number] => {
  const l = roomLayout(room, tier);
  return [l.w, l.h, l.ox, l.oy];
};

const WALL_OF: Record<RoomSpec['place'], string> = {
  building: '', connector: '#BFF1EE', town: '#FFF6CF', school: '#E6F7D6', power: '#E9DDF5', fire: '#FFE9F3', station: '#DDF0F8', library: '#DDF0F8',
};

/** Night: the room's floor and walls one night step down, like the city. Lamp
 * pools, screens and windows keep their own colours. */
const N = (c: string): string => (nt ? mix(c, '#131C40', 0.55) : c);

/** Paints one room with the pen. The caller has set up the sprite surface. */
export function paintRoom(spec: RoomSpec, planOverride?: RoomPlan): void {
  const tier = spec.tier ?? 'large';
  const plan = planOverride ?? roomPlan(spec.room, tier), hallId = plan ? undefined : HALL_OF[bare(spec.room)], hp = hallId ? hallPlan(bare(spec.room), tier) : undefined;
  const RR = plan ? plan.size : hp ? hp.size : SMALL_ROOM, scene = plan || hallId ? '' : sceneOf(spec), open = scene === 'roof' || hallId === 'roof';
  const fc = spec.colour;
  const wallc = spec.place === 'building' ? mix(BOLD[lookOf(spec.seed).hue], '#FFFFFF', 0.55) : WALL_OF[spec.place];
  const n0 = env.night, w0 = env.warm;
  env.night = 0; env.warm = 0;   // indoor light is constant
  try {
    setPen({ act: spec.act || (hallId === 'lobby' && (spec.present ?? 0) > 0), time: spec.frame / 10, reduced: spec.reduced, night: spec.night, recent: spec.recent, jobs: spec.jobs, n: spec.n, hour: spec.hour, look: plan ? roomTemplate(spec.room)!.r.look : cfg });
    box(0, 0, RR, RR, -8, 0, N('#8A93A3'), N(mix('#F4F1E8', fc, 0.16)));
    g.strokeStyle = N(mix('#F4F1E8', fc, 0.34)); g.lineWidth = 2; g.beginPath();
    for (let k = 1; k < RR; k++) { let a = iso(k, 0), b = iso(k, RR); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); a = iso(0, k); b = iso(RR, k); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
    if (!open) {
      P4raw(iso(0, 0, 0), iso(RR, 0, 0), iso(RR, 0, ROOM_WALL), iso(0, 0, ROOM_WALL), N(tone(wallc, 0.1)));
      P4raw(iso(0, 0, 0), iso(0, RR, 0), iso(0, RR, ROOM_WALL), iso(0, 0, ROOM_WALL), N(tone(wallc, -0.14)));
      P4raw(iso(0, 0, ROOM_WALL - 4), iso(RR, 0, ROOM_WALL - 4), iso(RR, 0, ROOM_WALL), iso(0, 0, ROOM_WALL), N(fc));
      P4raw(iso(0, 0, ROOM_WALL - 4), iso(0, RR, ROOM_WALL - 4), iso(0, RR, ROOM_WALL), iso(0, 0, ROOM_WALL), N(tone(fc, -0.2)));
      P4raw(iso(0, 0, 0), iso(RR, 0, 0), iso(RR, 0, 3), iso(0, 0, 3), N('#8A93A3'));
    } else { box(0, 0, RR, 0.14, 0, 8, '#AEB5C2'); box(0, 0, 0.14, RR, 0, 8, '#AEB5C2'); }
    if (plan) paintBig(plan);
    else if (hallId) {
      Object.assign(hall, { tokens: spec.n, done: !!spec.ended, out: spec.out, present: spec.present ?? 0, yes: spec.tally?.yes ?? 0, no: spec.tally?.no ?? 0, open: spec.tally?.open ?? spec.queue, kind: bare(spec.room), c: fc, bays: spec.bays ?? [] });
      setShift(hp!.shift);
      try { onGrid(true, () => { if (hallId === 'lobby') paintLobby(hp!); else if (hallId === 'roof') paintRoof(hp!); else paintCounter(); }); } finally { setShift(null); }
    } else if (hasCivic(scene)) {
      Object.assign(civic, { n: spec.n, rate: spec.rate, na: spec.na, recent: spec.recent, stock: spec.stock ?? { skills: 0, plugins: 0, on: 0 } });
      paintCivic(scene);
    } else {
      item('scene', true);
      Object.assign(fixedData, { n: spec.n, out: spec.out, queue: spec.queue, rate: spec.rate, c: fc, recent: spec.recent });
      paintFixed(scene);
    }
    item('top', false);
    if (!open) {   // the lift
      P4raw(iso(RR - 1, 0.04, 0), iso(RR - 0.2, 0.04, 0), iso(RR - 0.2, 0.04, 34), iso(RR - 1, 0.04, 34), '#59627A');
      P4raw(iso(RR - 0.62, 0.04, 0), iso(RR - 0.58, 0.04, 0), iso(RR - 0.58, 0.04, 34), iso(RR - 0.62, 0.04, 34), '#141A30');
      P4raw(iso(RR - 0.7, 0.04, 36), iso(RR - 0.5, 0.04, 36), iso(RR - 0.5, 0.04, 40), iso(RR - 0.7, 0.04, 40), '#FFC928');
    }
  } finally {
    env.night = n0; env.warm = w0;
    setZone(null); setFlip(false);
  }
}

/** The full-size room: floor, left wall, back wall with the shared data elements, then the plan's zones back to front. */
function paintBig(PL: RoomPlan): void {
  setFlip(PL.flip);
  const WL = wallsOf(PL), RR = WL.size, bo = WL.board, dr = WL.door;
  /** The log board and its clocks: on the back wall of a full-size room, on the left wall of a compact one. */
  const BW = WL.boardLeft ? (a0: number, a1: number, h0: number, h1: number, c: string) => L(a0 + bo, a1 + bo, h0, h1, c) : W;
  const BP = (a: number, z: number) => (WL.boardLeft ? pt(.04, a + bo, z) : pt(a, .04, z));
  for (let i = 0; i < RR * 2; i++) for (let j = 0; j < RR * 2; j++) if ((i + j) & 1) F(i * .5, j * .5, i * .5 + .5, j * .5 + .5, N(cfg.t));
  for (const a of PL.aisles) { F(a[0], a[1], a[2], a[3], N(cfg.a)); F(a[0] + .06, a[1] + .06, a[2] - .06, a[3] - .06, N(cfg.a2)); F(a[0] + .12, a[1] + .12, a[2] - .12, a[3] - .12, N(cfg.a)); }
  if (!nt) for (const y0 of WL.windows.map((w) => Math.round((w + .1) * 10) / 10)) P4(pt(.1, y0 + .2, .5), pt(.1, y0 + 2.4, .5), pt(1.9, y0 + 3.1, .5), pt(1.9, y0 + .9, .5), '#FFF6CF');
  if (nt) for (const [x, y] of PL.lamps) { const c0 = pt(x, y, .6); g.fillStyle = '#FFF6CF'; g.beginPath(); g.ellipse(c0[0], c0[1], 38, 19, 0, 0, 6.3); g.fill(); }
  // left wall: three windows on the skyline, the opening bell, framed art, an air vent, a whiteboard, filing cabinets, a cable tray
  for (const y0 of WL.windows) { L(y0, y0 + 2.8, 6, 42, '#FFFFFF'); L(y0 + .08, y0 + 2.72, 8, 40, nt ? '#27304F' : '#7FD0FF'); for (let i = 0; i < 8; i++) { const yy = y0 + .12 + i * .32, hh = 5 + ((i * 7 + Math.round(y0 * 3)) % 6) * 3.6; L(yy, yy + .28, 8, 8 + hh, nt ? '#141A30' : BOLD[(i * 2 + Math.round(y0)) % 9]); for (let r = 2; r < hh - 2; r += 4) L(yy + .05, yy + .12, 9 + r, 10.6 + r, nt ? (hs(i, r, 3) > .4 ? '#FFC928' : '#27304F') : '#FFFFFF'); } if (!nt) { const cx2 = y0 + 1.4; L(cx2, cx2 + .5, 33, 36, '#FFFFFF'); L(cx2 + .12, cx2 + .4, 36, 37.5, '#FFFFFF'); } L(y0 + 1.38, y0 + 1.42, 8, 40, '#FFFFFF'); L(y0 + .08, y0 + 2.72, 23.5, 24.5, '#FFFFFF'); }
  { const ring = rec.length && rec[0].age < 3 && !rm, c0 = pt(.06, 3.6, 34), sw = ring ? Math.sin(tm * 14) * 5 : 0; line(c0, [c0[0], c0[1] - 6], '#8D6B52', 2); g.fillStyle = '#FFC928'; g.beginPath(); g.moveTo(c0[0] - 5 + sw, c0[1] + 10); g.lineTo(c0[0] + 5 + sw, c0[1] + 10); g.lineTo(c0[0] + 3, c0[1]); g.lineTo(c0[0] - 3, c0[1]); g.closePath(); g.fill(); disc([c0[0] + sw * 1.4, c0[1] + 12], 2, '#C9925A'); }
  if (WL.art) { L(6.78, 7.22, 16, 34, '#141A30'); L(6.82, 7.18, 17.5, 32.5, '#FFC928'); L(6.9, 7.1, 21, 28, '#E5433D'); L(6.86, 7.0, 19, 21, '#2F6BDE'); } L(3.42, 3.8, 22, 27, '#AEB5C2'); for (let i = 0; i < 3; i++) L(3.45, 3.77, 22.8 + i * 1.4, 23.4 + i * 1.4, '#59627A');
  const sy = (v: number) => v + dr;   // the front of the left wall comes forward with the room's front
  L(sy(10.2), sy(10.96), 14, 38, '#141A30'); L(sy(10.26), sy(10.9), 15.5, 36.5, '#FFFFFF'); { const n = Math.min(6, fN ? 1 + Math.floor(Math.log2(fN + 1)) : 0); for (let r = 0; r < n; r++) L(sy(10.32), sy(10.32 + .5 * (.45 + .55 * hs(r, 3, 4))), 33 - r * 2.6, 34.2 - r * 2.6, ['#2F6BDE', '#E5433D', '#141A30', '#2E9E48'][r % 4]); }
  setZone(null, 'cabinets');
  for (let k = 0; k < 2; k++) { const y = sy((PL.flip ? 10.1 : 10.2) + k * .42); /* 10.1 when mirrored, so the second cabinet clears the lift */ B(.12, y, .6, y + .4, 0, 13, '#AEB5C2', '#CDD2DA'); for (let r = 0; r < 3; r++) { P4(pt(.6, y + .04, 1.2 + r * 4), pt(.6, y + .36, 1.2 + r * 4), pt(.6, y + .36, 4.4 + r * 4), pt(.6, y + .04, 4.4 + r * 4), '#CDD2DA'); P4(pt(.6, y + .17, 2.6 + r * 4), pt(.6, y + .26, 2.6 + r * 4), pt(.6, y + .26, 3.2 + r * 4), pt(.6, y + .17, 3.2 + r * 4), '#59627A'); } }
  setZone(null);
  L(.3, RR - .2, 43, 44.4, '#8A93A3'); for (let y = 1; y < RR - .2; y += 1.8) L(y, y + .05, 44.4, 46, '#59627A');
  // back wall: the tape, the video wall, world clocks, the order blotter, the alarm beacon, the door with its exit sign, sprinklers, sockets
  { const span = RR - 1.7; W(.4, RR - 1.2, 39, 45, '#141A30'); if (act) for (let k = 0; k < Math.round(span / .22); k++) { const x = .45 + ((k * .22 + span - (tm * .25) % .22) % span); if (k % 3) W(x, x + .1, 41, 43, '#39415A'); } for (const e of rec) { const x = (RR - 1.4) - e.age / 60 * (RR - 2); W(x, x + .18, 40, 44, e.err ? '#E5433D' : '#4CC552'); } }
  for (let x = .8; x < RR - 1; x += 1.7) { W(x, x + .05, 45, 46.4, '#8A93A3'); W(x - .02, x + .07, 46.4, 47.2, '#E5433D'); }
  item(wallTag(cfg.wall), false); (COARSE_WALL_ART[cfg.wall] ?? WALL[cfg.wall] ?? WALL.video)(); item('wall', false);
  { const c0 = pt(6.65, .04, 41); g.fillStyle = '#141A30'; g.fillRect(c0[0] - 5, c0[1] - 2, 10, 4); disc([c0[0], c0[1] - 6], 6, errNow && (rm || fl2 & 1) ? '#E5433D' : errNow ? '#FF8A7A' : '#7A2E2A'); if (errNow && !rm) line([c0[0], c0[1] - 6], [c0[0] + Math.cos(tm * 9) * 16, c0[1] - 6 + Math.sin(tm * 9) * 6], '#FF8A7A', 2); }
  for (let k = 0; k < 5; k++) { const c0 = BP(7.05 + k * .5, 31); disc(c0, 8, '#141A30'); disc(c0, 6, '#FFFFFF'); line(c0, [c0[0] + 5 * Math.sin(hr * 6.283), c0[1] - 5 * Math.cos(hr * 6.283)], '#141A30', 2); line(c0, [c0[0] + 3 * Math.sin((hr + k * 3) / 12 * 6.283), c0[1] - 3 * Math.cos((hr + k * 3) / 12 * 6.283)], '#E5433D', 2); BW(6.9 + k * .5, 7.2 + k * .5, 23.5, 25, BOLD[k * 2 % 9]); }
  BW(6.8, 9.4, 6, 22, '#F4F1E8'); BW(6.8, 9.4, 20, 22, '#2F6BDE'); rec.slice(0, 6).forEach((e, k) => { BW(6.86, 7, 17 - k * 2.4, 18.6 - k * 2.4, e.err ? '#E5433D' : '#4CC552'); BW(7.06, 7.5 + hs(k, 2, Math.round(e.age)) * 1.7, 17.3 - k * 2.4, 18.3 - k * 2.4, e.err ? '#FF8A7A' : '#59627A'); });
  W(9.7 + dr, 10.6 + dr, 0, 34, '#39415A'); W(9.78 + dr, 10.52 + dr, 0, 32, '#8D6B52'); W(9.9 + dr, 10.12 + dr, 18, 28, '#7FD0FF'); W(10.4 + dr, 10.46 + dr, 14, 17, '#FFC928'); W(9.8 + dr, 10.5 + dr, 35, 38.5, '#2E9E48'); for (let k = 0; k < 3; k++) W(9.9 + k * .2 + dr, 10 + k * .2 + dr, 36, 37.5, '#FFFFFF');
  for (const x of [.9, 3.1, 5.3, 7.5].filter((x) => x + .14 < 9.7 + dr)) { W(x, x + .14, 3.5, 5.7, '#FFFFFF'); W(x + .04, x + .06, 4.2, 5, '#141A30'); W(x + .08, x + .1, 4.2, 5, '#141A30'); }
  // everything that stands on the floor is placed by the room's plan and drawn back to front
  const Z: [number, readonly [number, number, number], () => void, string, string][] = [], put = (d: number, tr: readonly [number, number, number], fn: () => void, tag = 'thing', probe = tag) => Z.push([d, tr, fn, tag, probe]);
  PL.units.forEach((u, k) => put(u[0] + u[1] + .9, u, () => { item('floor', false); F(-.05, .64, 1.3, .7, '#AEB5C2'); const cu = COARSE_UNIT[cfg.unit]; item((cu ? 'unitc' : 'unit') + k); (cu ?? UNIT[cfg.unit] ?? UNIT.desk)(0, 0, k); }, 'unit' + k));
  put(9.9 + 4 + PL.s[0] + PL.s[1], [PL.s[0], PL.s[1], 0], () => { if (COARSE_SIDE.has(cfg.side)) item('sidec'); onGrid(COARSE_SIDE.has(cfg.side), () => (SIDE_C[cfg.side] ?? SIDE[cfg.side] ?? SIDE.glass)()); }, 'side');
  put(5.2 + 4.55 + PL.c[0] + PL.c[1], [PL.c[0], PL.c[1], 0], () => { item('floor', false); for (let i = 0; i < 8; i++) { F(3.2 + i * .55, 3.1, 3.24 + i * .55, 6, '#CDD2DA'); F(3.2, 3.1 + i * .41, 7.1, 3.14 + i * .41, '#CDD2DA'); } const cc = COARSE_CENTER.has(cfg.center); item(cc ? 'centrec' : 'centre'); onGrid(cc, () => (CENTER_C[cfg.center] ?? CENTER[cfg.center] ?? CENTER.pit)()); }, 'centre');
  put(10 + 10.4 + PL.k[0] + PL.k[1], [PL.k[0], PL.k[1], 0], () => { if (COARSE_CORNER.has(cfg.corner)) item('cornerc'); onGrid(COARSE_CORNER.has(cfg.corner), () => (CORNER_C[cfg.corner] ?? CORNER[cfg.corner] ?? CORNER.lounge)()); }, 'corner');
  put(9.9 + 7.8 + PL.j[0] + PL.j[1], [PL.j[0], PL.j[1], 0], () => {
  for (let k = 0; k < 3; k++) { const x = 8.3 + k * .8, on = k < jobs; B(x, 7.5, x + .62, 8.1, 0, 9, '#CDD2DA', '#F4F1E8'); B(x + .05, 7.55, x + .57, 7.9, 9, 13, '#AEB5C2', '#CDD2DA'); P4(pt(x + .08, 8.1, 5), pt(x + .2, 8.1, 5), pt(x + .2, 8.1, 7), pt(x + .08, 8.1, 7), on ? ((fl2 & 1) || rm ? '#FFC928' : '#C9925A') : '#4CC552'); flat(x + .18, 8.1, x + .46, 8.1 + (on ? .15 + ((tm * .5 + k * .4) % 1) * .6 : .1), 6, '#FFFFFF'); if (on) for (let i = 0; i < 3; i++) flat(x + .22, 8.16 + i * .14, x + .42, 8.2 + i * .14, 6.3, '#AEB5C2'); }
  B(10.75, 7.5, 11.6, 8.05, 0, 9, '#C9925A', '#FFF6CF'); for (let i = 0; i < Math.min(8, 1 + jobs * 2); i++) flat(10.82 + (i % 2) * .36, 7.58, 11.1 + (i % 2) * .36, 7.95, 9.4 + (i >> 1) * .5, i & 1 ? '#FFFFFF' : '#F4F1E8');
  }, 'jobs');
  for (const [pi, [x, y, kd]] of PL.plants.entries()) put(x + y + .3, [x, y, 0], () => { if (kd === 0) bush(0, 0); else if (kd === 1) palm(0, 0); else { B(0, 0, .4, .3, 0, 12, '#F4F1E8', '#CDD2DA'); cyl(.2, .15, .14, 12, 21, '#7FD0FF', '#BFF1EE'); if (act) for (let i = 0; i < 2; i++) disc(pt(.2, .26, 13 + ((tm * 5 + i * 5) % 7)), 2, '#FFFFFF'); } }, 'plant', 'plant' + pi);
  for (const [ci, [x, y]] of PL.cols.entries()) put(x + y + .2, [x, y, 0], () => { cyl(0, 0, .2, 0, 3, '#AEB5C2', '#CDD2DA'); cyl(0, 0, .16, 3, 46, '#F4F1E8', '#CDD2DA'); }, 'column', 'column' + ci);
  Z.sort((a, b) => a[0] - b[0]); for (const z of Z) { item(z[3]); setZone(z[1], z[4]); z[2](); } setZone(null);
  item('lamps');
  // overhead: a cable tray along the back, and the pendant lamps
  for (const [x, y] of PL.lamps) { const a = pt(x, y, 62), b2 = pt(x, y, 40); line(a, b2, '#59627A', 1); g.fillStyle = '#39415A'; g.beginPath(); g.moveTo(b2[0] - 4, b2[1]); g.lineTo(b2[0] + 4, b2[1]); g.lineTo(b2[0] + 10, b2[1] + 8); g.lineTo(b2[0] - 10, b2[1] + 8); g.closePath(); g.fill(); g.fillStyle = nt ? '#FFC928' : '#F4F1E8'; g.fillRect(b2[0] - 8, b2[1] + 8, 16, 3); }

  setFlip(false);
}

/**
 * The floor stack: one slab per floor, bottom first, in the floor's colour,
 * one slab per label row (the same pitch). The shown floor is outlined and stands out 4 px to the right. One 3×3
 * dot per agent on its slab, in the agent's state colour.
 */
export function paintStack(fl: readonly StackFloor[]): void {
  const pitch = STACK_PITCH * 2;   // drawing units
  fl.forEach((f, i) => {
    const z = i * pitch;
    if (f.selected) { g.save(); g.translate(8, 0); }
    box(0, 0, 1.3, 1.3, z, z + 12, f.selected ? '#FFFFFF' : '#CDD2DA', f.colour);
    if (f.selected) {
      const q = [iso(0, 0, z + 12), iso(1.3, 0, z + 12), iso(1.3, 0, z), iso(1.3, 1.3, z), iso(0, 1.3, z), iso(0, 1.3, z + 12)];
      g.strokeStyle = '#141A30'; g.lineWidth = 4; g.beginPath(); q.forEach((v, k) => (k ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath(); g.stroke();
    }
    const st = f.states ?? f.agents.map(() => 'running' as const);
    st.slice(0, 6).forEach((s, k) => {
      const q = iso(0.25 + (k % 3) * 0.4, 0.35 + Math.floor(k / 3) * 0.5, z + 12);
      g.fillStyle = '#141A30'; g.fillRect(q[0] - 4, q[1] - 4, 8, 8);
      g.fillStyle = s === 'future' ? SC.idle : SC[s]; g.fillRect(q[0] - 3, q[1] - 3, 6, 6);
    });
    if (f.selected) g.restore();
  });
}
/** The stack sprite box for n floors: [w, h, ox, oy]. */
export const stackBox = (n: number): [number, number, number, number] => { const sh = STACK_BASE + n * STACK_PITCH + 14; return [56, sh, 24, sh - STACK_BASE]; };

export { DOOR, LIFT, hs, act, cyl, errNow, fl2, fN, hr, jobs, nt, rm, tm, disc, line, P4, pt, rec, B, F, flat, W, L };
