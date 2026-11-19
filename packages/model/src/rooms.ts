// Picking a room template for each floor. The floor's meaning comes from data; the template only
// decides how it is furnished. The catalog (ids, tags, floors) comes from the art kit; this file has no art.
import { hs, seedOf } from './hash.ts';
import { themeIdOf, type PlacementState } from './placement.ts';
import { FLOOR_KINDS, type FloorKind } from './places.ts';
import { themeOf, type Theme } from './theme.ts';

export interface RoomInfo { id: string; tags: readonly string[]; floors: readonly FloorKind[] }
export type RoomChoice = Partial<Record<FloorKind, string>>;

function score(seed: number, room: RoomInfo, theme: Theme): number {
  const id = room.id;
  let sc = hs(seed, id.length * 7 + id.charCodeAt(0), id.charCodeAt(1) || 0) * 0.9;
  for (const t of room.tags) sc += (theme as Record<string, number | undefined>)[t] ?? 0;
  return sc;
}

/**
 * Chooses the room of one floor, keeping every choice already made (a floor's room is chosen when the floor first
 * appears, then kept). Best tag match among the templates made for that kind of floor, a seeded tie-break, and no
 * template twice in one building. Returns the same object when nothing changes.
 */
export function chooseRoom(prev: RoomChoice, floor: FloorKind, seed: number, theme: Theme, catalog: readonly RoomInfo[]): RoomChoice {
  if (prev[floor]) return prev;
  const used = new Set(Object.values(prev));
  let best: RoomInfo | undefined, bs = -1;
  for (const r of catalog) {
    if (!r.floors.includes(floor) || used.has(r.id)) continue;
    const sc = score(seed, r, theme);
    if (sc > bs) { bs = sc; best = r; }
  }
  return best ? { ...prev, [floor]: best.id } : prev;
}

/** All four floors at once, in catalog order. */
export function chooseRooms(seed: number, theme: Theme, catalog: readonly RoomInfo[], floors: readonly FloorKind[] = FLOOR_KINDS): RoomChoice {
  let out: RoomChoice = {};
  for (const f of FLOOR_KINDS) if (floors.includes(f)) out = chooseRoom(out, f, seed, theme, catalog);
  return out;
}

/**
 * The building template of a session: the template whose
 * tags best match the theme, with a seeded tie-break so equal themes still spread over many designs. `tags[i]` are
 * the tags of template i. Pure: the same seed and theme always give the same template.
 */
export function chooseTemplate(seed: number, theme: Theme, tags: readonly (readonly string[])[]): number {
  let best = 0, bs = -1;
  for (let i = 0; i < tags.length; i++) {
    let sc = hs(seed, i, 29) * 1.5;
    for (const t of tags[i]) sc += (theme as Record<string, number | undefined>)[t] ?? 0;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}

/**
 * The rooms of a session building: picked from the session's frozen theme id (never its title or
 * content), with the session's seed as the tie-break, one template per floor kind and none twice in the building.
 * Pure: the same placement record always furnishes the building the same way, whatever order its floors appear in.
 */
export function roomsOfSession(placement: PlacementState, sessionId: string, catalog: readonly RoomInfo[]): RoomChoice {
  return chooseRooms(seedOf(sessionId), themeOf({ themeId: themeIdOf(placement, sessionId) }), catalog);
}
