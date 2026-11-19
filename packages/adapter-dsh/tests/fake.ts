// A DSH day as raw session events, full of content that must never come out.
import type { SessionEventLike, SessionLike } from '../src/aggregator.ts';

export const SECRETS = [
  'cat ~/.ssh/id_rsa', 'Q3 revenue was 4.2M', 'please reconcile the invoices for ACME', 'I reconciled 14 invoices',
  '/Users/me/secret/report.pdf', 'connection refused: password=hunter2', 'Weekly report for the board', 'thinking about it',
];
const [cmd, result, prompt, reply, path, errText, label, thinking] = SECRETS;

export const T0 = Date.UTC(2026, 10, 18, 1, 0, 0);
export const ses = (id: string, o: Partial<NonNullable<SessionLike['header']>> = {}): SessionLike => ({ id, header: { createdAt: T0, cwd: '/Users/me/work/finance', ...o } });

let seq = 0;
const ev = (type: string, time: number, data: unknown): SessionEventLike => ({ type, seq: ++seq, time, data });

export function dayOfEvents(): { s: SessionLike; e: SessionEventLike }[] {
  const a = ses('s1'), k = ses('s1k', { parentSession: 's1', origin: 'subagent' });
  const m = 60_000;
  return [
    { s: a, e: ev('user/message', T0 + 1, { message: { role: 'user', content: [{ type: 'text', text: prompt }] } }) },
    { s: a, e: ev('turn/start', T0 + 2, { turn: 't1' }) },
    { s: a, e: ev('assistant/message', T0 + m, { turn: 't1', step: 1, message: { content: [{ type: 'text', text: reply }, { type: 'thinking', text: thinking }], source: { model: 'deepseek-v4', provider: 'deepseek' } }, stream: [{ text: reply }], usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 50 } }) },
    { s: a, e: ev('tool/call', T0 + 2 * m, { turn: 't1', step: 1, callId: 'c1', name: 'bash', arguments: JSON.stringify({ command: cmd }) }) },
    { s: a, e: ev('tool/result', T0 + 3 * m, { turn: 't1', step: 1, message: { toolCallId: 'c1', isError: true, content: [{ type: 'text', text: result }] }, error: { name: 'Exec', code: 'E1', reason: errText }, meta: { stdout: result } }) },
    { s: a, e: ev('tool/call', T0 + 4 * m, { callId: 'c2', name: 'mcp__erp__execute_read', arguments: JSON.stringify({ q: prompt }) }) },
    { s: a, e: ev('tool/result', T0 + 5 * m, { message: { toolCallId: 'c2', content: [{ type: 'text', text: result }] } }) },
    { s: a, e: ev('approval/asked', T0 + 6 * m, { id: 'ap1', toolName: 'mcp__erp__execute_write', callId: 'c3', reason: prompt }) },
    { s: a, e: ev('approval/decided', T0 + 7 * m, { id: 'ap1', outcome: 'allowed-once' }) },
    { s: a, e: ev('job/registered', T0 + 8 * m, { jobId: 'j1', owner: 's1', kind: 'bash', label: cmd, startedAt: T0 + 8 * m }) },
    { s: a, e: ev('job/settled', T0 + 9 * m, { jobId: 'j1', owner: 's1', kind: 'bash', label: cmd, startedAt: T0 + 8 * m, finishedAt: T0 + 9 * m, status: 'failed', cause: errText, detail: result }) },
    { s: a, e: ev('deliverables/presented', T0 + 10 * m, { turn: 't1', callId: 'c9', files: [{ path, description: label }, { path: path + '2' }] }) },
    { s: a, e: ev('tool/call', T0 + 11 * m, { callId: 'q1', name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ question: prompt }] }) }) },
    { s: a, e: ev('tool/result', T0 + 12 * m, { message: { toolCallId: 'q1', content: [{ type: 'text', text: reply }] } }) },
    { s: a, e: ev('session/title', T0 + 12 * m, { title: label }) },
    { s: a, e: ev('llm/retry', T0 + 12 * m, { retryId: 'r', failure: { message: errText, code: 'x' } }) },
    { s: a, e: ev('turn/end', T0 + 13 * m, { turn: 't1', reason: { kind: 'error', error: { message: errText, code: 'E' } } }) },
    { s: k, e: ev('turn/start', T0 + 2 * m, { turn: 'k1' }) },
    { s: k, e: ev('tool/call', T0 + 3 * m, { callId: 'k1', name: 'read', arguments: JSON.stringify({ path }) }) },
    { s: k, e: ev('tool/result', T0 + 3 * m + 500, { message: { toolCallId: 'k1', content: [{ type: 'text', text: result }] } }) },
    { s: k, e: ev('turn/end', T0 + 4 * m, { turn: 'k1', reason: { kind: 'completed' } }) },
  ];
}
