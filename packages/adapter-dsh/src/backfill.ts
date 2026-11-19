// At start, the events of today's sessions that happened before the plugin was running.
// Each session is read with `sessionQuery.inspectSession(id, getter)`: the getter runs on the host and converts the
// events right there, so only model events leave it. Bounded in sessions, events and time.
import type { UEvent } from '@dsh-universe/model';
import type { Aggregator, SessionEventLike, SessionLike } from './aggregator.ts';

export interface SessionQueryLike {
  filterSessions?(filters: readonly unknown[], signal?: AbortSignal): Promise<readonly unknown[]>;
  inspectSession?<T>(id: string, read: (s: unknown) => T, signal?: AbortSignal): Promise<T>;
}

export const BACKFILL = { maxSessions: 200, maxEvents: 50_000, budgetMs: 15_000 };

export async function backfill(o: {
  query: SessionQueryLike | undefined;
  aggregator: Aggregator;
  dayStart: number;
  now: () => number;
  /** Also read these (live sessions created before today). */
  extraIds?: readonly string[];
  signal?: AbortSignal;
}): Promise<{ events: UEvent[]; sessions: number; complete: boolean }> {
  const q = o.query;
  if (!q?.filterSessions || !q.inspectSession) return { events: [], sessions: 0, complete: false };
  const started = o.now();
  const rows = await q.filterSessions([{ kind: 'created-at', from: o.dayStart }], o.signal);
  const ids = new Set<string>(o.extraIds ?? []);
  for (const r of rows) {
    const id = (r as { header?: { id?: unknown; sessionId?: unknown } })?.header;
    const sid = typeof id?.id === 'string' ? id.id : typeof id?.sessionId === 'string' ? id.sessionId : undefined;
    if (sid) ids.add(sid);
  }
  const events: UEvent[] = [];
  let sessions = 0, complete = true;
  for (const id of [...ids].slice(0, BACKFILL.maxSessions)) {
    if (o.now() - started > BACKFILL.budgetMs || events.length >= BACKFILL.maxEvents || o.signal?.aborted) { complete = false; break; }
    try {
      const got = await q.inspectSession(id, (raw) => {
        const ses = raw as SessionLike & { ownEvents?: () => Iterable<SessionEventLike>; events?: Iterable<SessionEventLike> };
        const like: SessionLike = { id, header: ses.header };
        const list = typeof ses.ownEvents === 'function' ? ses.ownEvents() : ses.events ?? [];
        // No explicit session(): event() emits the agent with its first event, so a session with nothing today
        // (a blank New Session) is not read in.
        const out: UEvent[] = [];
        for (const ev of list) if (typeof ev?.time !== 'number' || ev.time >= o.dayStart) out.push(...o.aggregator.event(like, ev));
        return out;
      }, o.signal);
      if (Array.isArray(got)) { events.push(...got); sessions++; }
    } catch { /* one unreadable session does not stop the rest */ }
  }
  if (ids.size > BACKFILL.maxSessions) complete = false;
  return { events, sessions, complete };
}
