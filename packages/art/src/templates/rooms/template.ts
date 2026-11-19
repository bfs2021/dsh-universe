// The room template format: what a floor looks like, never what it means. The meaning of
// a floor (which kind of call happens there) comes from data; the template only furnishes it.
import type { FloorKind, RoomInfo } from '@dsh-universe/model';
import type { RoomLook } from '../../props/pen.ts';
import type { PlanType } from '../../plans.ts';

export interface RoomTemplate extends RoomInfo {
  look: RoomLook;
}

/** One template: id, 1–3 tags, the floor it is made for, then plan type, wall, centrepiece, unit, side, corner, colours. */
export const T = (
  id: string, tags: string[], floor: FloorKind, plan: PlanType, wall: string, center: string, unit: string, side: string, corner: string,
  t: string, a: string, a2: string,
): RoomTemplate => ({ id, tags, floors: [floor], look: { plan, wall, center, unit, side, corner, t, a, a2 } });
