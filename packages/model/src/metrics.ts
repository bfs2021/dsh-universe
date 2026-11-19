// What every place has seen up to T: failed calls and when the last one was,
// calls in the last five minutes, and tokens (today and the last five minutes). The data views draw from this:
// fire from errors, power from tokens, traffic from calls. Counts only, never content.
import { PLACE, buildingOf, connectorPlace, modelPlace } from './places.ts';
import { idxAt, upperBound, type AgentTrack, type Store } from './store.ts';
import type { UActivity } from './types.ts';

/** "Recent" for the data views: the last five minutes. */
export const RECENT_MS = 5 * 60 * 1000;
/** A fire burns this long after the last failed call; then it only smoulders. */
export const BURN_MS = 30 * 60 * 1000;
/** Cars on the roads: one per two calls in the last five minutes, at most 64. */
export const CALLS_PER_CAR = 2;
export const MAX_CARS = 64;
export const carsFor = (calls5: number) => Math.max(0, Math.min(MAX_CARS, Math.round(calls5 / CALLS_PER_CAR)));

/** Where a call happens: a connector, the station (web), the school (skills), the library (memory), or at home. */
export function placeOfCall(store: Store, s: AgentTrack, e: UActivity): string {
  return e.category === 'connector' && e.connectorId ? connectorPlace(e.connectorId)
    : e.category === 'web' ? PLACE.station : e.category === 'skill' ? PLACE.school : e.category === 'memory' ? PLACE.library
      : buildingOf(store, s);
}

export interface PlaceMetrics {
  /** All calls made here by T. */
  calls: number;
  /** Calls in (T − 5 min, T]. */
  calls5: number;
  /** Failed calls by T. */
  errors: number;
  /** Time of the last failed call, if any. */
  lastErrorAt?: number;
  /** Failed calls per tool name (the fire panel lists these: names and counts only). */
  errorTools: Map<string, number>;
  /** Tokens (input + output) by T: a session building's own, or a power plant's (its model's). */
  tokens: number;
  /** Tokens in (T − 5 min, T]. */
  tokens5: number;
}

export interface CityMetrics {
  T: number;
  places: Map<string, PlaceMetrics>;
  /** All calls in the last five minutes (the traffic). */
  calls5: number;
  /** Cars wanted on the roads. */
  cars: number;
  tokens: number;
  errors: number;
}

const blank = (): PlaceMetrics => ({ calls: 0, calls5: 0, errors: 0, errorTools: new Map(), tokens: 0, tokens5: 0 });

export function metricsAt(store: Store, T: number): CityMetrics {
  const places = new Map<string, PlaceMetrics>();
  const at = (id: string) => { let m = places.get(id); if (!m) places.set(id, m = blank()); return m; };
  let calls5 = 0, tokens = 0, errors = 0;
  for (const s of store.agents()) {
    if (s.agent.startedAt > T) continue;
    const k = idxAt(s, T);
    for (let i = 0; i < k; i++) {
      const e = s.ev[i];
      const m = at(placeOfCall(store, s, e));
      m.calls++;
      if (e.t > T - RECENT_MS) { m.calls5++; calls5++; }
      if (e.ok === false) {
        m.errors++;
        errors++;
        m.errorTools.set(e.tool, (m.errorTools.get(e.tool) ?? 0) + 1);
        if (m.lastErrorAt === undefined || e.t > m.lastErrorAt) m.lastErrorAt = e.t;
      }
    }
    const home = buildingOf(store, s);
    for (let i = 0, n = upperBound(s.usage, T); i < n; i++) {
      const u = s.usage[i], v = u.input + u.output, recent = u.t > T - RECENT_MS;
      tokens += v;
      const b = at(home);
      b.tokens += v;
      if (recent) b.tokens5 += v;
      if (u.model) {
        const p = at(modelPlace(u.model));
        p.tokens += v;
        if (recent) p.tokens5 += v;
      }
    }
  }
  return { T, places, calls5, cars: carsFor(calls5), tokens, errors };
}

/** Fire size from the number of failed calls: 1–2, 3–5, 6 or more. */
export const fireTier = (errors: number): 0 | 1 | 2 | 3 => (errors >= 6 ? 3 : errors >= 3 ? 2 : errors >= 1 ? 1 : 0);
/** Still burning (failed within 30 minutes), or put out and smouldering. */
export const burning = (m: PlaceMetrics | undefined, T: number) => !!m && m.lastErrorAt !== undefined && T - m.lastErrorAt < BURN_MS;
