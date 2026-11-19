// The in-memory store: events per agent in time order, prefix sums
// for tokens and errors, ten-minute buckets, and the state of any agent at any moment of the day.
import type {
  StateAt, UActivity, UAgent, UApproval, UConnector, UDeliverable, UEvent, UInventory, UJob, USchedule, UTurn,
  UPlanMode, URetry, UUsage, UWorkspace,
} from './types.ts';

export const BIN_MS = 10 * 60 * 1000;

export interface AgentTrack {
  agent: UAgent;
  /** Calls in time order. */
  ev: UActivity[];
  /** errs[i]: failed calls among ev[0..i]. */
  errs: number[];
  usage: UUsage[];
  /** cum[i]: tokens (input + output) of usage[0..i]. */
  cum: number[];
  waits: UApproval[];
  turns: UTurn[];
  jobs: UJob[];
  deliverables: UDeliverable[];
  /** Model-request retries, in time order (merged by id: `startedAt` arrives later). */
  retries: URetry[];
  /** Plan mode on and off, in time order. */
  planMode: UPlanMode[];
}

export interface Store {
  apply(e: UEvent): void;
  applyAll(events: Iterable<UEvent>): void;
  agent(id: string): AgentTrack | undefined;
  agents(): AgentTrack[];
  workspaces(): UWorkspace[];
  schedules(): USchedule[];
  connectors(): UConnector[];
  inventory(): UInventory;
  /** calls[bucket], work[bucket]: all calls and edit/exec calls per ten-minute bucket, keyed by bucket start (ms). */
  bins(): Map<number, { calls: number; work: number }>;
  /** Bumps on every applied event; views use it to know when to recompute. */
  version(): number;
}

const byT = <T extends { t: number }>(a: T, b: T) => a.t - b.t;

/** Index of the first element with t > T (binary search). */
export function upperBound<T extends { t: number }>(list: readonly T[], T: number): number {
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (list[m].t <= T) lo = m + 1; else hi = m;
  }
  return lo;
}

/** How many calls an agent had made by T. */
export const idxAt = (s: AgentTrack, T: number): number => upperBound(s.ev, T);
/** Tokens an agent had used by T. */
export function cumAt(s: AgentTrack, T: number): number {
  const i = upperBound(s.usage, T);
  return i ? s.cum[i - 1] : 0;
}
/** Failed calls by T. */
export function errsAt(s: AgentTrack, T: number): number {
  const i = idxAt(s, T);
  return i ? s.errs[i - 1] : 0;
}
export function lastEvAt(s: AgentTrack, T: number): UActivity | undefined {
  const i = idxAt(s, T);
  return i ? s.ev[i - 1] : undefined;
}
export function waitAt(s: AgentTrack, T: number): UApproval | undefined {
  return s.waits.find((w) => T >= w.askedAt && (w.decidedAt === undefined || T < w.decidedAt));
}

/**
 * The state of an agent at T.
 * - before it started: `future`; after it ended (`endedAt`): its final state (done or failed);
 * - inside an open approval or question: `waiting`;
 * - otherwise the last turn boundary at or before T: a turn running → `running`; a turn that ended with an
 *   error → `failed`, completed → `done`, cancelled or other → `idle`;
 * - no turn boundary yet: `running` (it has started and not stopped).
 */
export function stateAt(s: AgentTrack, T: number): StateAt {
  const a = s.agent;
  if (T < a.startedAt) return 'future';
  if (a.endedAt !== undefined && T >= a.endedAt) return a.state === 'failed' ? 'failed' : 'done';
  if (waitAt(s, T)) return 'waiting';
  const i = upperBound(s.turns, T);
  if (!i) return 'running';
  const last = s.turns[i - 1];
  if (last.phase === 'start') return 'running';
  return last.reason === 'error' ? 'failed' : last.reason === 'completed' ? 'done' : 'idle';
}

/** Whether the session is in plan mode at T (the last switch at or before T; off until switched on). */
export function planModeAt(s: AgentTrack, T: number): boolean {
  const i = upperBound(s.planMode, T);
  return i > 0 && s.planMode[i - 1].active;
}

/** How long the agent has been waiting at T (0 when not waiting). */
export function waitSince(s: AgentTrack, T: number): number {
  const w = waitAt(s, T);
  return w ? T - w.askedAt : 0;
}

/** When the agent last stopped on an error at or before T (for the 90-minute square rule). */
export function failedAt(s: AgentTrack, T: number): number | undefined {
  if (s.agent.endedAt !== undefined && s.agent.state === 'failed' && T >= s.agent.endedAt) return s.agent.endedAt;
  const i = upperBound(s.turns, T);
  const last = i ? s.turns[i - 1] : undefined;
  return last && last.phase === 'end' && last.reason === 'error' ? last.t : undefined;
}

function insertSorted<T extends { t: number }>(list: T[], item: T): number {
  const i = upperBound(list, item.t);
  list.splice(i, 0, item);
  return i;
}

export function createStore(): Store {
  const tracks = new Map<string, AgentTrack>();
  const seen = new Set<string>();
  const workspaces = new Map<string, UWorkspace>();
  const schedules = new Map<string, USchedule>();
  const connectors = new Map<string, UConnector>();
  let inventory: UInventory = {};
  const bins = new Map<number, { calls: number; work: number }>();
  let version = 0;

  const track = (agentId: string): AgentTrack => {
    let s = tracks.get(agentId);
    if (!s) {
      // An event before its agent: keep it under a placeholder that the agent event fills in later.
      s = {
        agent: { id: agentId, sessionId: agentId, workspaceId: '', label: '', kind: 'main', state: 'running', startedAt: Number.POSITIVE_INFINITY },
        ev: [], errs: [], usage: [], cum: [], waits: [], turns: [], jobs: [], deliverables: [], retries: [], planMode: [],
      };
      tracks.set(agentId, s);
    }
    return s;
  };
  const once = (key: string | undefined): boolean => {
    if (key === undefined) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  function apply(e: UEvent): void {
    version++;
    switch (e.type) {
      case 'workspace': workspaces.set(e.data.id, { ...workspaces.get(e.data.id), ...e.data }); return;
      case 'agent': {
        // Agent events may be partial updates (model, role, parent): merged into what is known.
        const s = track(e.data.id);
        s.agent = { ...s.agent, ...e.data };
        return;
      }
      case 'activity': {
        const a = e.data;
        const s = track(a.agentId);
        if (!once(a.id && 'a:' + a.agentId + ':' + a.id)) {
          // The same call again: a result completes what the call started (ok, duration); the time stays the call's.
          const k = s.ev.findIndex((x) => x.id === a.id);
          if (k < 0) return;
          s.ev[k] = { ...s.ev[k], ...(a.ok !== undefined ? { ok: a.ok } : {}), ...(a.durationMs !== undefined ? { durationMs: a.durationMs } : {}) };
          for (let j = k; j < s.ev.length; j++) s.errs[j] = (j ? s.errs[j - 1] : 0) + (s.ev[j].ok === false ? 1 : 0);
          return;
        }
        const i = insertSorted(s.ev, a);
        s.errs.length = i;
        for (let k = i; k < s.ev.length; k++) s.errs.push((k ? s.errs[k - 1] : 0) + (s.ev[k].ok === false ? 1 : 0));
        const b = Math.floor(a.t / BIN_MS) * BIN_MS;
        const bin = bins.get(b) ?? { calls: 0, work: 0 };
        bin.calls++;
        if (a.category === 'edit' || a.category === 'exec') bin.work++;
        bins.set(b, bin);
        return;
      }
      case 'usage': {
        const u = e.data;
        if (!once(u.id && 'u:' + u.agentId + ':' + u.id)) return;
        const s = track(u.agentId);
        const i = insertSorted(s.usage, u);
        s.cum.length = i;
        for (let k = i; k < s.usage.length; k++) s.cum.push((k ? s.cum[k - 1] : 0) + s.usage[k].input + s.usage[k].output);
        return;
      }
      case 'turn': {
        const s = track(e.data.agentId);
        if (s.turns.some((x) => x.t === e.data.t && x.phase === e.data.phase)) return;
        insertSorted(s.turns, e.data);
        return;
      }
      case 'approval': {
        const s = track(e.data.agentId);
        const old = s.waits.findIndex((w) => w.id === e.data.id);
        // Merged by id; the first asked time stays (a decision may arrive with a placeholder `askedAt`).
        if (old >= 0) s.waits[old] = { ...s.waits[old], ...e.data, askedAt: s.waits[old].askedAt };
        else s.waits.push(e.data);
        return;
      }
      case 'job': {
        const s = track(e.data.agentId);
        const old = s.jobs.findIndex((j) => j.id === e.data.id);
        if (old >= 0) s.jobs[old] = { ...s.jobs[old], ...e.data };
        else s.jobs.push(e.data);
        return;
      }
      case 'retry': {
        const s = track(e.data.agentId);
        const old = s.retries.findIndex((r) => r.id === e.data.id);
        // Merged by id; the scheduled time stays (a start may arrive with only its own time).
        if (old >= 0) s.retries[old] = { ...s.retries[old], ...e.data, t: s.retries[old].t };
        else insertSorted(s.retries, e.data);
        return;
      }
      case 'planmode': {
        const s = track(e.data.agentId);
        if (!s.planMode.some((x) => x.t === e.data.t && x.active === e.data.active)) insertSorted(s.planMode, e.data);
        return;
      }
      case 'deliverable': insertSorted(track(e.data.agentId).deliverables, e.data); return;
      case 'schedule': schedules.set(e.data.id, e.data); return;
      case 'connector': connectors.set(e.data.id, e.data); return;
      case 'inventory': inventory = { ...inventory, ...e.data }; return;
    }
  }

  return {
    apply,
    applyAll(events) { for (const e of events) apply(e); },
    agent: (id) => tracks.get(id),
    agents: () => [...tracks.values()].filter((s) => Number.isFinite(s.agent.startedAt)),
    workspaces: () => [...workspaces.values()],
    schedules: () => [...schedules.values()],
    connectors: () => [...connectors.values()],
    inventory: () => inventory,
    bins: () => bins,
    version: () => version,
  };
}

export { byT };
