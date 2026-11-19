import type { Category, UAgent, UCapabilities, UEvent } from '../src/types.ts';

export const H = 3600_000, M = 60_000, S = 1000;
export const DAY = Date.UTC(2026, 10, 18);
export const at = (h: number, m = 0, s = 0) => DAY + h * H + m * M + s * S;

export const CAPS: UCapabilities = {
  approvals: true, schedules: true, subagents: true, jobs: true, deliverables: true, skills: true, memory: false,
  tokens: true, cost: false, latency: true, sessionTitles: true, actions: { openSession: true, draftFollowUp: true },
};

export function agent(id: string, startedAt: number, o: Partial<UAgent> = {}): UEvent {
  return { type: 'agent', data: { id, sessionId: id, workspaceId: 'w1', label: id, kind: 'main', state: 'running', startedAt, ...o } };
}
export function call(agentId: string, t: number, category: Category, tool: string = category, o: { ok?: boolean; connectorId?: string; id?: string; durationMs?: number } = {}): UEvent {
  return { type: 'activity', data: { agentId, t, category, tool, ...o } };
}
export function usage(agentId: string, t: number, input: number, output: number, model = 'm1'): UEvent {
  return { type: 'usage', data: { agentId, t, model, input, output } };
}
export function turn(agentId: string, t: number, phase: 'start' | 'end', reason?: 'completed' | 'error' | 'cancelled'): UEvent {
  return { type: 'turn', data: { agentId, t, phase, ...(reason ? { reason } : {}) } };
}
export function wait(agentId: string, id: string, askedAt: number, decidedAt?: number, kind: 'approval' | 'question' | 'plan' = 'approval'): UEvent {
  return { type: 'approval', data: { id, agentId, kind, askedAt, ...(decidedAt !== undefined ? { decidedAt } : {}) } };
}
