// The city template: a lattice of blocks with roads between them, a cross-shaped civic axis in
// the middle, zoning, the civic baseline that is always there, the order the border grows in, and lot attributes.
// Coordinates are ground tiles; this file holds layout rules only, no art.
import { hs } from '../hash.ts';

/** Road lines (both axes). */
export const ROAD_LINES: readonly number[] = [-12, -6, 0, 6, 12, 16, 22, 28, 34, 40];
/** Block origins (both axes); a block is 5×5 tiles, four 2×2 lots round a cross lane. */
export const BLOCK_ORIGINS: readonly number[] = [-11, -5, 1, 7, 17, 23, 29, 35];
export type Rect = readonly [x0: number, y0: number, x1: number, y1: number];
/**
 * The border, one rectangle per growth step: 4×4 blocks to start, then one strip of blocks at a time in a fixed
 * order (east, south, west, north, and round again) up to 8×8.
 */
export const GROWTH: readonly Rect[] = [
  [0, 0, 29, 29], [0, 0, 35, 29], [0, 0, 35, 35], [-6, 0, 35, 35], [-6, -6, 35, 35],
  [-6, -6, 41, 35], [-6, -6, 41, 41], [-12, -6, 41, 41], [-12, -12, 41, 41],
];
export const MAX_GROWTH = GROWTH.length - 1;
/** Height cap of the lots in front of the square, in storeys (lot attribute `cap`). */
export const SQUARE_FRONT_CAP = 13;

export type Zone = 'build' | 'park' | 'power' | 'shops' | 'library';

export interface Lot { key: string; x: number; y: number; bx: number; by: number; slot: number; cap: number }
export interface Block { key: string; bx: number; by: number; zone: Zone; lots: Lot[] }

export type CivicId = 'town' | 'station' | 'fire' | 'school' | 'library' | 'power';
export interface CivicPlace { id: CivicId; at: readonly [number, number] }

export interface CityTemplate {
  blocks: Block[];
  /** Always there, with or without sessions. */
  civic: CivicPlace[];
  /** Blocks reserved for power plants (one per model, the first is always built), shops and the library. */
  powerBlocks: readonly (readonly [number, number])[];
  shopBlocks: readonly (readonly [number, number])[];
}

export const blockKey = (bx: number, by: number) => bx + ',' + by;

/** A lot in front of the square keeps the town hall and the square in view. */
function capOf(cx: number, cy: number): number {
  return cx > 11 && cy > 11 && cx < 23 && cy < 29 && (cx > 16 || cy > 21) ? SQUARE_FRONT_CAP : 0;
}

const POWER_BLOCKS = [[7, 1], [17, 1], [1, 1], [23, 1]] as const;
const SHOP_BLOCKS = [[23, 7], [23, 17]] as const;
const LIBRARY_BLOCK = [1, 23] as const;

export function cityTemplate(): CityTemplate {
  const blocks: Block[] = [];
  const isAt = (list: readonly (readonly [number, number])[], bx: number, by: number) => list.some(([x, y]) => x === bx && y === by);
  for (const bx of BLOCK_ORIGINS) for (const by of BLOCK_ORIGINS) {
    let zone: Zone = 'build';
    if (isAt(POWER_BLOCKS, bx, by)) zone = 'power';
    else if (isAt(SHOP_BLOCKS, bx, by)) zone = 'shops';
    else if (bx === LIBRARY_BLOCK[0] && by === LIBRARY_BLOCK[1]) zone = 'library';
    else {
      const core = bx >= 1 && bx <= 23 && by >= 1 && by <= 23;
      const mid = (bx === 7 || bx === 17) && (by === 7 || by === 17);
      if (!mid && hs(bx, by, 9) < (core ? 0.2 : 0.36)) zone = 'park';
    }
    const lots = zone === 'build'
      ? [0, 3, 1, 2].map((slot) => {
        const x = bx + (slot & 1) * 3, y = by + (slot >> 1) * 3;
        return { key: blockKey(bx, by) + '#' + slot, x, y, bx, by, slot, cap: capOf(x + 1, y + 1) };
      })
      : [];
    blocks.push({ key: blockKey(bx, by), bx, by, zone, lots });
  }
  return {
    blocks,
    civic: [
      { id: 'town', at: [14.5, 14.9] },
      { id: 'station', at: [9, 13.45] },
      { id: 'fire', at: [14.5, 23.8] },
      { id: 'school', at: [14.5, 4.5] },
      { id: 'library', at: [3.5, 25.5] },
      { id: 'power', at: [POWER_BLOCKS[0][0] + 2.5, POWER_BLOCKS[0][1] + 2.5] },
    ],
    powerBlocks: POWER_BLOCKS,
    shopBlocks: SHOP_BLOCKS,
  };
}

/** Whether a block lies inside the border at a growth step. */
export function inGrowth(b: { bx: number; by: number }, g: number): boolean {
  const G = GROWTH[Math.max(0, Math.min(MAX_GROWTH, g))];
  return b.bx > G[0] && b.by > G[1] && b.bx + 5 < G[2] && b.by + 5 < G[3];
}

/** Whether a tile is a road inside the border at a growth step (the civic precinct is closed to traffic). */
export function isRoad(i: number, j: number, g: number): boolean {
  const G = GROWTH[Math.max(0, Math.min(MAX_GROWTH, g))];
  if (i < G[0] || j < G[1] || i >= G[2] || j >= G[3]) return false;
  if (i >= 12 && i <= 16 && j >= 13 && j <= 21) return false;
  return ROAD_LINES.includes(i) || ROAD_LINES.includes(j);
}
