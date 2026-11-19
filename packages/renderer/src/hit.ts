// Hit testing: people before houses before buildings; within a tier, the one in front.
export type HitTier = 'person' | 'house' | 'building';
export interface HitArea { id: string; tier: HitTier; /** Art-pixel rectangle. */ r: readonly [number, number, number, number]; depth: number }
const RANK: Record<HitTier, number> = { person: 3, house: 2, building: 1 };

export function hitTest(areas: readonly HitArea[], ax: number, ay: number): HitArea | undefined {
  let best: HitArea | undefined;
  for (const a of areas) {
    if (ax < a.r[0] || ax > a.r[2] || ay < a.r[1] || ay > a.r[3]) continue;
    if (!best || RANK[a.tier] > RANK[best.tier] || (RANK[a.tier] === RANK[best.tier] && a.depth > best.depth)) best = a;
  }
  return best;
}
