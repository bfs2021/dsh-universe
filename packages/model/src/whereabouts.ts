// Where an agent is at T. Local tools keep it inside its own building; shared ones send it
// across town. Nothing here is stored; it is computed from the store.
import { FLOOR_OF, PLACE, buildingOf, connectorPlace } from './places.ts';
import { failedAt, lastEvAt, stateAt, waitAt, type AgentTrack, type Store } from './store.ts';

/** A session that stopped on an error stays in the square this long, then goes home. */
export const FAILED_IN_SQUARE_MS = 90 * 60 * 1000;

export interface Whereabouts { place: string; floor: string }

export function whereabouts(store: Store, s: AgentTrack, T: number): Whereabouts | null {
  const st = stateAt(s, T);
  if (st === 'future') return null;
  const home = buildingOf(store, s);
  if (st === 'waiting') return { place: PLACE.town, floor: waitAt(s, T)?.kind ?? 'approval' };
  if (st === 'failed') {
    const at = failedAt(s, T);
    if (at !== undefined && T - at < FAILED_IN_SQUARE_MS) return { place: PLACE.town, floor: 'failed' };
    return { place: home, floor: 'failed' };
  }
  if (st === 'idle') return { place: home, floor: 'lobby' };
  if (st === 'done') return { place: home, floor: 'done' };
  const e = lastEvAt(s, T);
  if (!e) return { place: home, floor: 'lobby' };
  switch (e.category) {
    case 'connector': return e.connectorId ? { place: connectorPlace(e.connectorId), floor: e.tool } : { place: home, floor: 'lobby' };
    case 'web': return { place: PLACE.station, floor: 'gate' };
    case 'skill': return { place: PLACE.school, floor: 'skill' };
    case 'memory': return { place: PLACE.library, floor: 'memory' };
    default: return { place: home, floor: FLOOR_OF[e.category] ?? 'lobby' };
  }
}
