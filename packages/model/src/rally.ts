// The square: who needs the member at T, what for, for how long, and how loud they are. Nothing is
// invented: one entry per real wait, in the order the member should answer them (longest wait first).
//
// Wait kinds:
// - approval: a tool call asked for approval and nothing has been decided yet;
// - question: `ask_user_question` was called and has no result yet;
// - plan:     `exit_plan_mode` was called and has no result yet (the plan waits for the member's approval);
// - error:    the session stopped on an error less than 90 minutes ago.
import { PLACE } from './places.ts';
import { failedAt, waitAt, type AgentTrack, type Store } from './store.ts';
import { whereabouts } from './whereabouts.ts';

export type WaitKind = 'approval' | 'question' | 'plan' | 'error';
/** 0: holding up a sign; 1: bigger sign, an extra "!", bouncing faster; 2: bigger again, "!!!", a megaphone. */
export type RallyTier = 0 | 1 | 2;

/** Tier boundaries: under 2 minutes, 2–10 minutes, over 10 minutes. */
export const TIER_MS: readonly [number, number] = [2 * 60_000, 10 * 60_000];

export const tierOf = (ageMs: number): RallyTier => (ageMs >= TIER_MS[1] ? 2 : ageMs >= TIER_MS[0] ? 1 : 0);

export interface RallyEntry {
  agentId: string;
  sessionId: string;
  kind: WaitKind;
  /** When the wait began (asked, or stopped on the error). */
  since: number;
  /** How long it has lasted at T. */
  age: number;
  tier: RallyTier;
  /** The tool waiting for approval, when the platform names it (shown in the card, never on the placard). */
  tool?: string;
}

/** The wait of one agent at T, or undefined when it is not in the square. */
export function rallyEntry(store: Store, s: AgentTrack, T: number): RallyEntry | undefined {
  if (whereabouts(store, s, T)?.place !== PLACE.town) return undefined;
  const w = waitAt(s, T);
  const since = w ? w.askedAt : failedAt(s, T);
  if (since === undefined) return undefined;
  const age = Math.max(0, T - since);
  return {
    agentId: s.agent.id, sessionId: s.agent.sessionId, kind: w ? w.kind : 'error', since, age, tier: tierOf(age),
    ...(w?.tool ? { tool: w.tool } : {}),
  };
}

/** Everyone in the square at T: longest wait first; equal waits by agent id (stable). */
export function rallyAt(store: Store, T: number): RallyEntry[] {
  const out: RallyEntry[] = [];
  for (const s of store.agents()) {
    const e = rallyEntry(store, s, T);
    if (e) out.push(e);
  }
  return out.sort((a, b) => b.age - a.age || a.agentId.localeCompare(b.agentId));
}

/** The agents in the square at T, in the same order as `rallyAt`. */
export function rally(store: Store, T: number): AgentTrack[] {
  return rallyAt(store, T).map((e) => store.agent(e.agentId)!);
}

/** Placard symbol on the sign (no tool names in the pixels): 1 "!", 2 "?", 3 "×". */
export const placardOf = (kind: WaitKind): 1 | 2 | 3 => (kind === 'error' ? 3 : kind === 'approval' ? 1 : 2);
