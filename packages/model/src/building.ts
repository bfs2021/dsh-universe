// What a session building looks like in numbers: segments and storeys from calls per
// kind of floor, footprint from tokens, stage from state. No drawing.
import { FLOOR_KINDS, FLOOR_OF, rootOf, type FloorKind } from './places.ts';
import { cumAt, idxAt, stateAt, type Store } from './store.ts';
import type { StateAt } from './types.ts';

export interface Segment { id: 'podium' | FloorKind; storeys: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A two-storey podium, then 2–9 storeys per kind of work used; a capped lot gets 1 + up to 3 per kind (≤ 13). */
export function segmentsOf(calls: Partial<Record<FloorKind, number>>, capped: boolean): Segment[] {
  const out: Segment[] = [{ id: 'podium', storeys: capped ? 1 : 2 }];
  for (const f of FLOOR_KINDS) {
    const n = calls[f] ?? 0;
    if (n <= 0) continue;
    out.push({ id: f, storeys: capped ? clamp(Math.ceil(Math.sqrt(n) / 3.2), 1, 3) : clamp(Math.ceil(Math.sqrt(n) / 1.5), 2, 9) });
  }
  return out;
}

export const storeysOf = (segs: readonly Segment[]) => segs.reduce((a, s) => a + s.storeys, 0);

/** Half-width of the footprint in a 2×2 lot, 0.58–0.90, from the tokens used so far. */
export const footprintOf = (tokens: number) => 0.58 + 0.32 * Math.min(1, Math.sqrt(Math.max(0, tokens) / 5e5));

export type Stage = 'site' | 'groundbreaking' | 'construction' | 'topped';

/** Growth stage: running or waiting → under construction; ended or idle → topped out. */
export function stageOf(state: StateAt, calls: number): Stage {
  if (state === 'future') return 'site';
  if (state === 'running' || state === 'waiting') return calls === 0 ? 'groundbreaking' : 'construction';
  return 'topped';
}

/**
 * A building's size as the host keeps it: calls per kind of floor, tokens and the state it ended
 * in. Sizes only: no titles, no tool names. Earlier days' buildings are drawn from this, so they look the way their
 * session really ended.
 */
export interface BuildingSize {
  calls: Partial<Record<FloorKind, number>>; tokens: number; state: Exclude<StateAt, 'future'>;
  /** When the session started (ms): the date on its door plate on later days. */
  started?: number;
}

/** The size of every root session's building at T (its own calls and its subagents'). */
export function sizesOf(store: Store, T: number): Record<string, BuildingSize> {
  const out: Record<string, BuildingSize> = {};
  for (const s of store.agents()) {
    if (s.agent.startedAt > T) continue;
    const root = rootOf(store, s), id = root.agent.sessionId;
    const b = out[id] ?? (out[id] = { calls: {}, tokens: 0, state: 'running' });
    const k = idxAt(s, T);
    for (let i = 0; i < k; i++) { const f = FLOOR_OF[s.ev[i].category]; if (f) b.calls[f] = (b.calls[f] ?? 0) + 1; }
    b.tokens += cumAt(s, T);
    if (s === root) { const st = stateAt(s, T); if (st !== 'future') b.state = st; b.started = s.agent.startedAt; }
  }
  return out;
}

const STATES = new Set(['running', 'waiting', 'idle', 'done', 'failed']);
/** Reads a stored size back; anything malformed is dropped. */
export function readSize(v: unknown): BuildingSize | undefined {
  const r = v as Partial<BuildingSize> | null;
  if (!r || typeof r !== 'object' || typeof r.tokens !== 'number' || !STATES.has(String(r.state)) || !r.calls || typeof r.calls !== 'object') return undefined;
  const calls: Partial<Record<FloorKind, number>> = {};
  for (const f of FLOOR_KINDS) { const n = (r.calls as Record<string, unknown>)[f]; if (typeof n === 'number' && n > 0 && Number.isFinite(n)) calls[f] = Math.floor(n); }
  return { calls, tokens: Math.max(0, r.tokens), state: r.state as BuildingSize['state'], ...(typeof r.started === 'number' && Number.isFinite(r.started) ? { started: r.started } : {}) };
}
