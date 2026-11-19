// The room pen (the full-size room branch): the drawing state a room is painted with and the
// primitives the prop library draws through. Every prop reads this state; `paintRoom` is its only writer.
//
// - `act`: an agent is working on this floor now. Nothing moves unless it is true: screens
//   are off, machines stand still, no steam. `tm` is the animation clock in seconds and is 0 whenever `act` is false
//   or motion is reduced, so an idle room is one still picture.
// - The data of the floor: `rec` (calls in the last minute, newest first: age in seconds, failed or not), `errNow`
//   (a call failed less than 20 s ago), `jobs` (background jobs running), `fN` (calls on this floor so far) and `LG`
//   (the log of it, for things that pile up), `hr` (the workspace clock, hours).
// - Zones: the floor plan moves whole zones about (`setZone`) and may mirror the room across its diagonal
//   (`setFlip`). `pt`, `B`, `flat`, `F` and `cyl` follow both; `W` and `L` (back and left wall) swap when mirrored.
import { hs } from '@dsh-universe/model';
import { box, cyl as cyl0, disc as disc0, flat as flat0, iso, line as line0, P4, type Pt } from '../iso.ts';
import type { RoomRecent } from '@dsh-universe/renderer';

export { g, P4 } from '../iso.ts';
export { BOLD } from '../palette.ts';
export { hs };
export type { Pt };

/** One room template's look: floor plan type, the five kit choices and three floor colours. */
export interface RoomLook {
  plan: 0 | 1 | 2 | 3 | 4;
  wall: string;
  center: string;
  unit: string;
  side: string;
  corner: string;
  /** Carpet tile, aisle and aisle inlay colours. */
  t: string;
  a: string;
  a2: string;
}

// eslint-disable-next-line import/no-mutable-exports
export let act = false, tm = 0, rm = false, nt = false, errNow = false, jobs = 0, fN = 0, LG = 0, hr = 0, fl2 = 0;
// eslint-disable-next-line import/no-mutable-exports
export let rec: readonly RoomRecent[] = [];
// eslint-disable-next-line import/no-mutable-exports
export let cfg: RoomLook = { plan: 0, wall: 'video', center: 'pit', unit: 'desk', side: 'glass', corner: 'lounge', t: '#E9DDF5', a: '#2F6BDE', a2: '#7FA8F5' };

export interface PenState {
  act: boolean; time: number; reduced: boolean; night: boolean; recent: readonly RoomRecent[]; jobs: number; n: number; hour: number; look: RoomLook;
}
/** Sets the state for one painting. */
export function setPen(s: PenState): void {
  act = s.act; rm = s.reduced; nt = s.night;
  tm = rm || !act ? 0 : s.time;
  rec = s.recent; errNow = rec.some((e) => e.err && e.age < 20); jobs = s.jobs; fN = s.n; hr = s.hour; cfg = s.look;
  LG = Math.min(8, Math.floor(Math.log2((fN || 0) + 1)));
  fl2 = Math.floor(tm * 8);
  TR = null; FLP = false; SX = 0; SY = 0; zoneTag = 'room';
}

let TR: readonly [number, number, number] | null = null;
let FLP = false;
/** Moves the origin to a zone; `z[2]` turns a unit placed in a column. `null` = the room itself. */
export function setZone(z: readonly [number, number, number] | null, tag = 'room'): void { TR = z; zoneTag = tag; }
/** Mirrors the room across its diagonal (a seeded plan variation). */
export function setFlip(f: boolean): void { FLP = f; }

/** A compact hall moves each group of things by a whole strip (`setShift`); 0 in every room drawn as designed. */
let SX = 0, SY = 0;
let SHIFT: ((tag: string) => readonly [number, number] | undefined) | null = null;
/** A compact hall: where each group goes (undefined: the group is left out). `null` = every group where it was drawn. */
export function setShift(fn: typeof SHIFT): void { SHIFT = fn; SX = 0; SY = 0; }
/**
 * Starts a group of things on the floor of a hall (a desk, a plant, a seating group): its footprint is told to the
 * probe under `tag`, and in a compact hall it moves with its strip. False when the compact hall leaves it out.
 */
export function grp(tag: string): boolean {
  zoneTag = tag;
  const s = SHIFT ? SHIFT(tag) : [0, 0] as const;
  if (!s) return false;
  SX = s[0]; SY = s[1];
  return true;
}

const tp = (x: number, y: number): [number, number] => {
  if (TR) { if (TR[2]) { const q = x; x = y; y = q; } x += TR[0]; y += TR[1]; }
  x += SX; y += SY;
  return FLP ? [y, x] : [x, y];
};
const rc = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => {
  const a = tp(x0, y0), b = tp(x1, y1);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
};
/** A floor point (tiles, height in drawing units) through the zone and the mirror. */
export const pt = (x: number, y: number, z = 0): Pt => { const q = tp(x, y); return iso(q[0], q[1], z); };
/** Tests: told the floor rectangle (room tiles, after zone and mirror) of everything that stands on the floor. */
let probe: ((r: readonly [number, number, number, number], zone: string) => void) | null = null;
let zoneTag = 'room';
let probeFlats = false;
/** `flats`: also told the flat things on the floor (rugs, desk mats) of every zone, for the compact plans. */
export function setFootprintProbe(fn: typeof probe, flats = false): void { probe = fn; probeFlats = flats; }
export const B = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, c: string, top?: string): void => {
  const r = rc(x0, y0, x1, y1); box(r[0], r[1], r[2], r[3], z0, z1, c, top);
  if (probe && z0 < 4) probe(r, zoneTag);
};
/** Tells the probe a footprint without drawing it (a panel on legs: its legs are all `B` hears). */
export const mark = (x0: number, y0: number, x1: number, y1: number): void => { if (probe) probe(rc(x0, y0, x1, y1), zoneTag); };
/** A box that is part of a partition or frame (a post, a rail): drawn like `B`, but not a footprint on the floor. */
export const Bw = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, c: string, top?: string): void => {
  const r = rc(x0, y0, x1, y1); box(r[0], r[1], r[2], r[3], z0, z1, c, top);
};
export const flat = (x0: number, y0: number, x1: number, y1: number, z: number, c: string): void => {
  const r = rc(x0, y0, x1, y1); flat0(r[0], r[1], r[2], r[3], z, c);
  if (probe && probeFlats && z < 4 && zoneTag !== 'room') probe(r, zoneTag);
};
/** Something flat on the floor (a rug, a tile, an aisle). */
export const F = (x0: number, y0: number, x1: number, y1: number, c: string): void => flat(x0, y0, x1, y1, 0.4, c);
export const cyl = (x: number, y: number, r: number, z0: number, z1: number, c: string, top?: string): void => {
  const q = tp(x, y); cyl0(q[0], q[1], r, z0, z1, c, top);
  if (probe && z0 < 4) probe([q[0] - r, q[1] - r, q[0] + r, q[1] + r], zoneTag);
};
const W0 = (x0: number, x1: number, h0: number, h1: number, c: string) => P4(iso(x0, 0.04, h0), iso(x1, 0.04, h0), iso(x1, 0.04, h1), iso(x0, 0.04, h1), c);
const L0 = (y0: number, y1: number, h0: number, h1: number, c: string) => P4(iso(0.04, y0, h0), iso(0.04, y1, h0), iso(0.04, y1, h1), iso(0.04, y0, h1), c);
/** On the back wall (x along the wall, heights in drawing units); on the left wall when the room is mirrored. */
export const W = (a0: number, a1: number, h0: number, h1: number, c: string): void => (FLP ? L0 : W0)(a0, a1, h0, h1, c);
/** On the left wall (y along the wall); on the back wall when the room is mirrored. */
export const L = (a0: number, a1: number, h0: number, h1: number, c: string): void => (FLP ? W0 : L0)(a0, a1, h0, h1, c);

/** A line between two points (points may be computed arrays). */
export const line = (a: readonly number[], b: readonly number[], col: string, w: number): void => line0(a as Pt, b as Pt, col, w);
export const disc = (p: readonly number[], r: number, col: string): void => disc0(p as Pt, r, col);

/** The colour of a recent call: red when it failed. */
export const rcol = (e: RoomRecent): string => (e.err ? '#E5433D' : '#4CC552');
/** Nine points on the front half of a ring round the centre of the room. */
export const ring9 = (z: number, fn: (q: Pt, i: number) => void): void => {
  for (let i = 0; i < 9; i++) { const a = Math.PI * (i + 0.5) / 9; fn(pt(5.2 - Math.cos(a) * 1.2, 4.55 + Math.sin(a) * 1.2, z), i); }
};
/** A screen on a stand: blue when on. */
export const scr = (x: number, y: number, w: number, z0: number, z1: number, on: boolean): void => {
  B(x, y, x + w, y + 0.06, z0, z1, '#141A30');
  P4(pt(x + 0.04, y + 0.06, z0 + 1), pt(x + w - 0.04, y + 0.06, z0 + 1), pt(x + w - 0.04, y + 0.06, z1 - 1), pt(x + 0.04, y + 0.06, z1 - 1), on ? '#1F4FB0' : '#27304F');
};
export const stool = (x: number, y: number, c: string): void => cyl(x, y, 0.13, 0, 7, '#59627A', c);

/**
 * Item boundaries (every prop snapped to the palette and outlined on its own, like a city sprite).
 * The painter calls `item(tag, outline)` before each prop; a compositor listening here finishes the previous one.
 * Without a listener (tests, the plain painter) it does nothing.
 */
let itemHook: ((tag: string, outline: boolean) => void) | null = null;
export function setItemHook(fn: typeof itemHook): void { itemHook = fn; }
export function item(tag: string, outline = true): void { itemHook?.(tag, outline); }
