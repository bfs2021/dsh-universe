// How big a session building's floors are ("bigger buildings have bigger floors"; "small building
// could get taller, then means bigger floors"). The tier comes from the building as the city draws it at that
// moment: the floor plate its silhouette really has at its footprint, times its storeys. Both only grow while a
// session works (storeys from calls, footprint from tokens), so a building's floors only ever get bigger, and
// looking back at an earlier moment gives the size it had then. A building still at the groundbreaking has small
// floors whatever it will become. No state, no hysteresis needed: the inputs never go down.
import type { BuildingShape, RoomTier } from '@dsh-universe/renderer';
import { storeysOf } from '@dsh-universe/model';
import { partsOf } from './templates/buildings/silhouettes.ts';
import { TOWER_TEMPLATES } from './templates/buildings/templates.ts';

/** Floor area × storeys (tile² · storeys) from which a building's floors are medium, and large. */
export const TIER_AT = { medium: 9, large: 22 } as const;

/** The floor plate of the tower's first storeys above the podium (tiles²), as its silhouette draws it. */
export function plateOf(template: number, footprint: number): number {
  const tp = TOWER_TEMPLATES[((template % TOWER_TEMPLATES.length) + TOWER_TEMPLATES.length) % TOWER_TEMPLATES.length];
  if (tp.form === 8) { const r = footprint * 0.88; return Math.PI * r * r; }   // the round tower
  return partsOf(tp.form, 1, 0, 0, footprint).reduce((a, p) => a + (p[2] - p[0]) * (p[3] - p[1]), 0);
}

/** The building's size: floor plate × storeys. */
export const bulkOf = (b: BuildingShape): number => plateOf(b.template, b.footprint) * storeysOf(b.segments);

export function roomTier(b: BuildingShape): RoomTier {
  if (b.stage === 'site' || b.stage === 'groundbreaking') return 'small';
  const v = bulkOf(b);
  return v >= TIER_AT.large ? 'large' : v >= TIER_AT.medium ? 'medium' : 'small';
}
