// Per-day totals for the last 14 days: sessions started and sessions that stopped on an error, from what this
// plugin stored (DSH has no cheap cross-session query).
import type { UDay, UEvent } from '@dsh-universe/model';

export function dayTotals(day: string, events: readonly UEvent[]): UDay {
  const roots = new Set<string>(), failed = new Set<string>();
  for (const e of events) {
    if (e.type === 'agent' && !e.data.parentAgentId && e.data.startedAt !== undefined) roots.add(e.data.id);
    if (e.type === 'turn' && e.data.phase === 'end' && e.data.reason === 'error') failed.add(e.data.agentId);
  }
  return { day, sessions: roots.size, failed: [...failed].filter((x) => roots.has(x)).length };
}
