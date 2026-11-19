// Place and floor ids. Building ids derive from the root session of an agent family.
import type { AgentTrack, Store } from './store.ts';
import type { Category } from './types.ts';

export type FloorKind = 'library' | 'workshop' | 'machine' | 'meeting';
export const FLOOR_KINDS: readonly FloorKind[] = ['library', 'workshop', 'machine', 'meeting'];

/** Which floor of the agent's own building a category of call happens on. */
export const FLOOR_OF: Partial<Record<Category, FloorKind>> = {
  read: 'library', search: 'library', edit: 'workshop', exec: 'machine', delegate: 'meeting',
};

export const PLACE = {
  town: 'town', station: 'station', school: 'school', library: 'library', fire: 'fire',
} as const;
export const buildingId = (rootSessionId: string) => 'b:' + rootSessionId;
export const connectorPlace = (connectorId: string) => 'conn:' + connectorId;
export const modelPlace = (model: string) => 'model:' + model;

/** The root agent of a family (subagents live in their parent's building). */
export function rootOf(store: Store, s: AgentTrack): AgentTrack {
  let cur = s;
  for (let guard = 0; cur.agent.parentAgentId && guard < 32; guard++) {
    const p = store.agent(cur.agent.parentAgentId);
    if (!p) break;
    cur = p;
  }
  return cur;
}

export const buildingOf = (store: Store, s: AgentTrack) => buildingId(rootOf(store, s).agent.sessionId);
