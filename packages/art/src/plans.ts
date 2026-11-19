// Floor plans of the full-size rooms. Five plan types, each the way a real
// room of that kind is laid out; the room's seed then decides the mirror image, the columns and the plants. A
// walkway leads from the door and from the lift, and nothing stands in front of either. Pure and seeded: the same
// seed always gives the same plan.
import { hs } from '@dsh-universe/model';

export type PlanType = 0 | 1 | 2 | 3 | 4;
/** What each plan type is (for docs and tests). */
export const PLAN_TYPES: Record<PlanType, string> = {
  0: 'rows of stations facing the main wall',
  1: 'centrepiece in the front corner, islands in the middle',
  2: 'stations on three sides of the centrepiece, a walkway round them',
  3: 'centrepiece in the middle, stations all round',
  4: 'centrepiece against the wall by the door, rows behind it',
};

/** A unit (workstation) origin: x, y, and 1 when it stands in a column (turned 90°). */
export type Unit = readonly [number, number, 0 | 1];
export type XY = readonly [number, number];

export interface RoomPlan {
  type: PlanType;
  /** Which of the type's arrangements (0 = the original one). */
  sub: number;
  /** Workstations, before the mirror. */
  units: readonly Unit[];
  /** Offsets of the centrepiece, side room, corner and the job printers (zones) from where the room shell puts them. */
  c: XY; s: XY; k: XY; j: XY;
  /** Walkways (x0, y0, x1, y1), before the mirror. */
  aisles: readonly (readonly [number, number, number, number])[];
  /** Columns and plants (x, y, kind 0 bush / 1 palm / 2 water cooler), before the mirror. */
  cols: readonly XY[];
  plants: readonly (readonly [number, number, number])[];
  /** Mirrored across the room's diagonal. */
  flip: boolean;
  /** Where agents stand (room tiles, after the mirror): one per workstation chair, then two by the centrepiece and one in the corner. */
  spots: readonly XY[];
  /** Pendant lamps (room tiles, before the mirror). */
  lamps: readonly XY[];
  /** Side of the room in tiles: 12, or a compact size (compact.ts). */
  size: number;
  /** A compact room: the strips of floor taken out of the full-size plan (x0 and y0 of each, their width), before the mirror. */
  cut?: { x: number; y: number; d: number };
}

/** The side of a full-size room, in tiles. */
export const ROOM_SIZE = 12;
/** The lift: in the back wall, at its right end (room tiles). Newcomers step out here. */
export const LIFT: XY = [ROOM_SIZE - 0.6, 0.7];
/** The door: in the back wall, by the lift (room tiles, before the mirror). */
export const DOOR: readonly [number, number] = [9.7, 10.6];

/** Each plan type comes in three seeded arrangements (0 is the original one). */
export const SUB_VARIANTS = 3;

/**
 * The plan of a room of plan type `v`; `seed` is the room's own seed (its index in the catalog); `sub`
 * picks one of three arrangements of the same plan type (0 = the original; 1 and 2 move the side room, corner,
 * centrepiece and job printers about, with the aisles to match). Every arrangement keeps the door and the lift
 * clear and nothing stands on anything else (tests/rooms.test.ts).
 */
export function planOf(v: PlanType, seed: number, sub = 0): RoomPlan {
  const h = Math.floor(hs(seed, 7, 3) * 4096);
  const U: Unit[] = [];
  const row = (x0: number, y: number, n: number, dx: number) => { for (let k = 0; k < n; k++) U.push([x0 + k * dx, y, 0]); };
  const col = (x: number, y0: number, n: number, dy: number) => { for (let k = 0; k < n; k++) U.push([x, y0 + k * dy, 1]); };
  let c: XY = [0, 0], s: XY = [0, 0], k: XY = [0, 0], j: XY = [0, 0], flip = false;
  let A: [number, number, number, number][], cols: XY[], plants: [number, number, number][];
  if (v === 0) {   // rows facing the wall
    row(0.5, 1.3, 5, 1.42); row(0.6, 7.55, 4, 1.7); row(0.6, 9.75, 4, 1.7);
    A = [[0.3, 6.15, 11.7, 7.05], [7.55, 0.3, 8.05, 11.7]];
    cols = h & 1 ? [[2.85, 5.85], [2.85, 3.4]] : [[0.9, 5.4]];
    plants = [[0.4, 4.4, 0], [2.3, 4.2, 1], [2.6, 5.2, 2], [7, 11.3, 0], [8.45, 8.55, 1], [10.6, 9.1, 0]];
    if (sub === 1) {   // the side room at the front right, the break corner at the back right
      s = [0, 6.0]; k = [0, -6.8];
      plants = [[0.4, 4.4, 0], [2.3, 4.2, 1], [2.6, 5.2, 2], [7, 11.3, 0], [8.45, 5.55, 1], [10.9, 5.5, 0]];
    } else if (sub === 2) {   // the centrepiece on the left, plants and columns on its right
      c = [-2.6, 0];
      cols = h & 1 ? [[4.95, 5.6], [4.95, 3.4]] : [[7.2, 4.4]];
      plants = [[5.3, 4.3, 1], [6.5, 5.3, 2], [6.9, 3.0, 0], [7, 11.3, 0], [8.45, 8.55, 1], [10.6, 9.1, 0]];
    }
    flip = !!(h & 2);
  } else if (v === 1) {   // the centrepiece in the front corner, islands in the middle
    c = [3.9, 4.6]; s = [-7.9, 0]; k = [0, -7.7]; j = [-3.9, -6.1];
    row(4.3, 3.4, 2, 1.5); row(4.3, 5.1, 2, 1.5);
    row(0.65, 10.3, 4, 1.5);
    if (sub === 2) row(0.65, 7.6, 2, 1.5); else col(0.5, 6.4, 2, 1.7);
    A = [[3.75, 0.3, 4.2, 3.1], [3.75, 2.7, 9.7, 3.1], [9.6, 0.3, 10.7, 1.2], [3.7, 6.5, 7.2, 6.95], [7.2 - 0.45, 6.5, 7.2, 10.2]];
    cols = [[7.7, 5.6], [3.2, 9.5]];
    plants = [[11.2, 5.3, 1], [0.4, 0.5, 0], [7.9, 0.5, 2], [6.9, 11.2, 0]];
    if (sub === 1) {   // the side room at the back right, the break corner at the back left
      s = [0, 0.4]; k = [-7.9, -6.6];
      plants = [[11.2, 6.5, 1], [0.4, 0.5, 0], [7.9, 0.5, 2], [6.9, 11.2, 0]];
    } else if (sub === 2) {   // a second front row instead of the side column; the printers by the left wall
      j = [-7.9, -6.1];
      plants = [[11.2, 5.3, 1], [5.2, 1.4, 0], [7.9, 0.5, 2], [6.9, 11.2, 0]];
    }
  } else if (v === 2) {   // stations on three sides of the centrepiece
    c = [0.6, 0.9]; s = [-7.9, 5.9]; j = [-4, 0.9];
    if (sub !== 2) row(3.2, 1.6, 4, 1.5);
    col(1.5, 3.6, 3, 1.5); col(8.5, 3.6, 3, 1.5);
    A = [[2.85, 3.1, 8.3, 3.5], [2.85, 7.3, 8.3, 7.7], [2.85, 3.1, 3.25, 7.7], [7.9, 3.1, 8.3, 7.7], [9.75, 0.3, 10.55, 3.5], [8.3, 3.1, 10.55, 3.5]];
    cols = [[10.7, 4.6], [0.9, 2.4]];
    plants = [[0.4, 0.5, 1], [0.5, 7.5, 0], [10.9, 8.3, 0], [2.2, 1.9, 2]];
    if (sub === 1) {   // the side room and the corner change places
      s = [0, 5.9]; k = [-7.75, 0];
      plants = [[0.4, 0.5, 1], [0.5, 7.5, 0], [10.9, 7.6, 0], [2.2, 1.9, 2]];
    } else if (sub === 2) {   // the U opens to the back: the centrepiece moves back, the third row comes to the front
      c = [0.6, -0.9];
      row(3.2, 6.4, 3, 1.5);
      A = [[2.85, 1.5, 8.3, 1.9], [2.85, 5.5, 8.3, 5.9], [2.85, 1.5, 3.25, 5.9], [7.9, 1.5, 8.3, 5.9], [9.75, 0.3, 10.55, 1.9], [8.3, 1.5, 10.55, 1.9]];
    }
  } else if (v === 3) {   // the centrepiece in the middle, stations all round
    c = [0.8, 1.45]; s = [-7.9, -1.8]; k = [-7.85, 0]; j = [0.3, 1.9];
    row(3.9, 1.4, 3, 1.7);
    if (sub === 0) row(3.9, 9.9, 3, 1.7); else row(4.3, 9.9, 3, sub === 1 ? 1.7 : 1.5);
    col(1.5, 4.3, 2, 1.9); col(9.4, 4.3, 2, 1.9);
    A = [[3.75, 3.6, 8.35, 4.0], [3.75, 8.3, 8.35, 8.7], [3.75, 3.6, 4.15, 8.7], [7.95, 3.6, 8.35, 8.7], [8.35, 3.6, 10.55, 4.0], [9.75, 0.3, 10.55, 4.0]];
    cols = [[8.9, 2.3], [3.3, 8.9]];
    plants = [[11.2, 11.2, 1], [9.1, 0.6, 2], [4.3, 3, 0], [8.7, 8.4, 0]];
    if (sub === 1) {   // the side room at the front left, the corner at the back left, the printers higher up
      s = [-7.6, 5.9]; k = [-7.9, -8.6]; j = [0.3, 1.3];
      cols = [[8.9, 2.3], [3.3, 7.9]];
      plants = [[11.2, 11.2, 1], [9.1, 0.6, 2], [4.3, 3, 0], [8.6, 8.0, 0]];
    } else if (sub === 2) {   // the corner at the front right, the printers at the front left
      k = [0.2, 0]; j = [-7.6, 2.4];
      plants = [[11.2, 8.4, 1], [9.1, 0.6, 2], [4.3, 3, 0], [8.7, 8.4, 0]];
    }
  } else {   // the centrepiece against the wall by the door, rows behind it
    c = [2.2, -1.7]; s = [0, 5.9]; k = [-8, -8.1]; j = [0, -1.4];
    row(0.6, 5.4, 4, 1.6); row(0.6, 7.5, 4, 1.6); row(0.6, 9.7, 3, 1.6);
    A = [[0.3, 4.5, 11.7, 4.95], [7.3, 4.95, 7.75, 11.7], [9.75, 0.3, 10.55, 4.5]];
    cols = h & 1 ? [[4.6, 2.2], [6.6, 10.4]] : [[4.6, 2.2]];
    plants = [[11.2, 5.2, 1], [4.4, 0.6, 0], [5.9, 10.2, 2], [6.5, 6.3, 0]];
    if (sub === 1) {   // the side room at the back left, the corner at the front right
      s = [-7.9, -1.8]; k = [0, 0];
    } else if (sub === 2) {   // the centrepiece against the back wall on the left, the break corner beside it
      c = [-1.4, -1.7]; k = [-2.4, -8.1];
      cols = h & 1 ? [[7.0, 4.2], [6.6, 10.4]] : [[7.0, 4.2]];
      plants = [[11.2, 5.2, 1], [0.4, 0.6, 0], [5.9, 10.2, 2], [6.5, 6.3, 0]];
    }
    flip = !!(h & 2);
  }
  return finishPlan({ type: v, sub, units: U, c, s, k, j, aisles: A, cols, plants, flip, size: ROOM_SIZE });
}

/** Where agents stand and where the lamps hang follow from the workstations, the centrepiece and the corner. */
export function finishPlan(p: Omit<RoomPlan, 'spots' | 'lamps'>): RoomPlan {
  const { units: U, c, k, flip } = p;
  const sw = (q: XY): XY => (flip ? [q[1], q[0]] : q);
  const spots = U.map((u) => sw(u[2] ? [u[0] + 1.15, u[1] + 0.62] : [u[0] + 0.62, u[1] + 1.15]))
    .concat([sw([3.4 + c[0], 6.2 + c[1]]), sw([7 + c[0], 6.2 + c[1]]), sw([9.9 + k[0], 10.6 + k[1]])]);
  const lamps = U.filter((_u, n) => n % 2 === 0).map((u): XY => (u[2] ? [u[0] + 0.5, u[1] + 0.6] : [u[0] + 0.6, u[1] + 0.5]))
    .concat([[5.2 + c[0], 4.4 + c[1]]]);
  return { ...p, spots, lamps };
}

/** Where a zone of the plan sits (x, y of its origin offset): the same numbers `paintRoom` uses to place it. */
export const ZONES = {
  /** Side room: drawn at its own coordinates plus `s`; depth 9.9 + 4. */
  side: { x: 9.9, y: 4 },
  centre: { x: 5.2, y: 4.55 },
  corner: { x: 10, y: 10.4 },
  jobs: { x: 9.9, y: 7.8 },
} as const;
