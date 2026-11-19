// Placement: buildings arrive in the order their sessions start. Each takes a seeded-random free
// lot in a block its workspace already holds; when those are full the workspace claims the nearest unclaimed
// building block inside the border; when there is none the border moves out one strip. A lot, once given, is never
// taken back, so a placed building never moves. Pure: the same history gives the same city.
import { hs, seedOf } from './hash.ts';
import { readThemeId, type ThemeId } from './theme.ts';
import { readSize, type BuildingSize } from './building.ts';
import { GROWTH, MAX_GROWTH, inGrowth, type Block, type CityTemplate, type Lot } from './template/city.ts';

export interface PlacementState {
  version: 1;
  /** Current growth step (index into GROWTH). Only ever increases. */
  growth: number;
  /** When each growth step happened (ms; the start time of the session that caused it). */
  growthLog: { t: number; g: number }[];
  /** Block key → workspace id, in claim order. */
  claims: { block: string; workspaceId: string; t: number }[];
  /** Session id → lot key. */
  lots: Record<string, string>;
  /** Workspace id → its order of first appearance (decides which quarter it starts from). */
  workspaces: Record<string, number>;
  /**
   * Session id → theme id (`themeFromTitle`), set once when the session's first real title arrives, never changed.
   * Only the id is kept, never the title.
   */
  themes?: Record<string, string>;
  /** Session id → the building's size (calls per floor, tokens, state). Kept so earlier days look as they ended. */
  sizes?: Record<string, BuildingSize>;
}

export interface Arrival { sessionId: string; workspaceId: string; startedAt: number }

export function emptyPlacement(): PlacementState {
  return { version: 1, growth: 0, growthLog: [{ t: Number.NEGATIVE_INFINITY, g: 0 }], claims: [], lots: {}, workspaces: {}, themes: {} };
}

/** Validates a stored placement; anything unreadable starts afresh rather than throwing. */
export function readPlacement(raw: unknown): PlacementState {
  const r = raw as Partial<PlacementState> | null;
  if (!r || r.version !== 1 || typeof r.growth !== 'number' || !Array.isArray(r.claims) || typeof r.lots !== 'object' || r.lots === null || typeof r.workspaces !== 'object' || r.workspaces === null) return emptyPlacement();
  const growth = Math.max(0, Math.min(MAX_GROWTH, Math.floor(r.growth)));
  return {
    version: 1,
    growth,
    growthLog: Array.isArray(r.growthLog) ? r.growthLog.filter((x) => typeof x?.t === 'number' && typeof x?.g === 'number') : [{ t: Number.NEGATIVE_INFINITY, g: growth }],
    claims: r.claims.filter((c) => typeof c?.block === 'string' && typeof c?.workspaceId === 'string'),
    lots: Object.fromEntries(Object.entries(r.lots).filter(([k, v]) => typeof k === 'string' && typeof v === 'string')),
    workspaces: Object.fromEntries(Object.entries(r.workspaces).filter(([, v]) => typeof v === 'number')),
    themes: Object.fromEntries(Object.entries(typeof r.themes === 'object' && r.themes !== null ? r.themes : {}).map(([k, v]) => [k, readThemeId(v)])),
    sizes: Object.fromEntries(Object.entries(typeof r.sizes === 'object' && r.sizes !== null ? r.sizes : {}).flatMap(([k, v]) => { const z = readSize(v); return z ? [[k, z]] : []; })),
  };
}

export interface PlaceResult {
  state: PlacementState;
  /** Session ids placed by this call. */
  placed: string[];
  /** Session ids that found no lot (the city is at its largest and full). */
  unplaced: string[];
}

/**
 * Places the arrivals that have no lot yet. Lots already given (in `prior`) are kept as they are.
 * Arrivals are taken in start order (ties by session id), so the result does not depend on input order.
 */
export function place(template: CityTemplate, prior: PlacementState, arrivals: readonly Arrival[]): PlaceResult {
  const state: PlacementState = structuredClone(prior);
  const blockByKey = new Map(template.blocks.map((b) => [b.key, b]));
  const used = new Set(Object.values(state.lots));
  const claimed = new Set(state.claims.map((c) => c.block));
  const placed: string[] = [];
  const unplaced: string[] = [];
  const todo = arrivals
    .filter((a) => state.lots[a.sessionId] === undefined)
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt || (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0));
  const seen = new Set<string>();
  for (const a of todo) {
    if (seen.has(a.sessionId)) continue;
    seen.add(a.sessionId);
    if (state.workspaces[a.workspaceId] === undefined) state.workspaces[a.workspaceId] = Object.keys(state.workspaces).length;
    const lot = lotFor(a);
    if (!lot) { unplaced.push(a.sessionId); continue; }
    state.lots[a.sessionId] = lot.key;
    used.add(lot.key);
    placed.push(a.sessionId);
  }
  return { state, placed, unplaced };

  function lotFor(a: Arrival): Lot | null {
    const seed = seedOf(a.sessionId);
    for (;;) {
      const home = state.claims.filter((c) => c.workspaceId === a.workspaceId).map((c) => blockByKey.get(c.block)).filter((b): b is Block => !!b);
      const free = home.flatMap((b) => b.lots.filter((L) => !used.has(L.key)));
      if (free.length) return free[Math.floor(hs(seed, 17, free.length) * free.length)];
      const q = state.workspaces[a.workspaceId] % 4;
      const o = home[0] ?? { bx: 12 + (q & 1 ? 5 : -5), by: 12 + (q & 2 ? 5 : -5) };
      const score = (b: Block) => Math.hypot(b.bx - o.bx, b.by - o.by) + hs(b.bx, b.by, 5) * 3;
      const cand = template.blocks
        .filter((b) => b.zone === 'build' && !claimed.has(b.key) && inGrowth(b, state.growth))
        .sort((x, y) => score(x) - score(y) || (x.key < y.key ? -1 : 1));
      if (cand.length) {
        state.claims.push({ block: cand[0].key, workspaceId: a.workspaceId, t: a.startedAt });
        claimed.add(cand[0].key);
        continue;
      }
      if (state.growth >= MAX_GROWTH) return null;
      state.growth++;
      state.growthLog.push({ t: a.startedAt, g: state.growth });
    }
  }
}

/** The lot of a placed session. */
export function lotOf(template: CityTemplate, state: PlacementState, sessionId: string): Lot | undefined {
  const key = state.lots[sessionId];
  if (!key) return undefined;
  for (const b of template.blocks) for (const L of b.lots) if (L.key === key) return L;
  return undefined;
}

/** The border at T (growth only moves outward). */
export function growthAt(state: PlacementState, T: number): number {
  let g = state.growthLog[0]?.g ?? 0;
  for (const e of state.growthLog) if (e.t <= T) g = Math.max(g, e.g);
  return g;
}

export { GROWTH };

/**
 * Freezes a session's theme: the first call wins, later calls (a renamed title) change nothing. Returns the same
 * state when nothing changes.
 */
export function freezeTheme(state: PlacementState, sessionId: string, theme: ThemeId): PlacementState {
  if (state.themes?.[sessionId] !== undefined) return state;
  return { ...state, themes: { ...state.themes, [sessionId]: theme } };
}

/** The frozen theme of a session (neutral until its title arrived). */
export const themeIdOf = (state: PlacementState, sessionId: string): ThemeId => readThemeId(state.themes?.[sessionId]);
