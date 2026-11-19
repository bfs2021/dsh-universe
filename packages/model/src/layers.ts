// The seven layers: for each, the set of things that keep their colour. Everything else is drawn
// grey. Agents in the square (waiting for the member) stay in every layer.
import { PLACE, buildingOf, modelPlace } from './places.ts';
import { RECENT_MS, placeOfCall } from './metrics.ts';
import { rally } from './rally.ts';
import type { Drafts, Seen } from './seen.ts';
import { cumAt, idxAt, stateAt, type Store } from './store.ts';
import type { TodayCat } from './today.ts';
import { toReview } from './today.ts';
import { whereabouts } from './whereabouts.ts';

export const LAYERS = ['all', 'scheduled', 'running', 'review', 'errors', 'tokens', 'calls'] as const;
export type LayerId = (typeof LAYERS)[number];

/** Which layer each "today" button switches to (the first, "waiting for you", shows everything). */
export const LAYER_OF_TODAY: Record<TodayCat, LayerId> = {
  need: 'all', sched: 'scheduled', run: 'running', review: 'review', err: 'errors', tok: 'tokens',
};

/** Ids of places and agents kept in colour; `null` means everything (the default layer greys nothing). */
export function coloredSet(layer: LayerId, store: Store, T: number, city: string, seen?: Seen, drafts?: Drafts): Set<string> | null {
  if (layer === 'all') return null;
  const out = new Set<string>();
  for (const s of rally(store, T)) out.add(s.agent.id);
  for (const s of store.agents()) {
    const st = stateAt(s, T);
    if (st === 'future') continue;
    const home = buildingOf(store, s);
    switch (layer) {
      case 'scheduled':
        out.add(PLACE.station);
        if (s.agent.kind === 'scheduled' || s.agent.scheduleId) out.add(home);
        break;
      case 'running':
        if (st === 'running') {
          out.add(home);
          out.add(s.agent.id);
          const w = whereabouts(store, s, T);
          if (w) out.add(w.place);
        }
        break;
      case 'review':
        out.add(PLACE.town);
        if (toReview(s, T, city, seen, drafts)) out.add(home);
        break;
      case 'errors': {
        out.add(PLACE.fire);
        const k = idxAt(s, T);
        for (let i = 0; i < k; i++) if (s.ev[i].ok === false) out.add(placeOfCall(store, s, s.ev[i]));
        break;
      }
      case 'tokens':
        for (const u of s.usage) if (u.t <= T && u.model) out.add(modelPlace(u.model));
        if (cumAt(s, T) - cumAt(s, T - RECENT_MS) > 0) out.add(home);
        break;
      case 'calls': {
        const k = idxAt(s, T);
        for (let i = 0; i < k; i++) if (s.ev[i].t > T - RECENT_MS) out.add(placeOfCall(store, s, s.ev[i]));
        break;
      }
    }
  }
  return out;
}
