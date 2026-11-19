import test from 'node:test';
import assert from 'node:assert/strict';
import { conformanceProblems } from '@dsh-universe/adapter-kit';
import { createHandler, dispatch, LIMITS, memoryKv, startDshHost, backfill, createAggregator, dshCategories, type RouteDeps } from '../src/index.ts';
import { SECRETS, T0, dayOfEvents, ses } from './fake.ts';

const req = (body: unknown, raw?: string) => new Request('http://x/api/khglobal-dsh-universe', { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const deps: RouteDeps = {
  snapshot: () => ({ platform: { id: 'dsh', title: 'DSH', adapterVersion: '0', caps: {} as never }, day: 'd', seq: 0, events: [], truncated: false, full: false, placement: {} as never, placementVersion: 0, history: [], backfill: 'none' }),
  since: (seq, limit) => ({ day: 'd', seq, events: [], more: false, placementVersion: 0, limit } as never),
};

test('routes: input checks, size limit, unknown method, no internal detail on errors', async () => {
  assert.deepEqual(await dispatch(deps, 'nope', {}), { ok: false, reason: 'unsupported' });
  assert.deepEqual(await dispatch(deps, 'since', { seq: -1 }), { ok: false, reason: 'invalid' });
  assert.deepEqual(await dispatch(deps, 'since', { seq: 1.5 }), { ok: false, reason: 'invalid' });
  assert.deepEqual(await dispatch(deps, 'since', 'x'), { ok: false, reason: 'invalid' });
  assert.equal(((await dispatch(deps, 'since', { seq: 3, limit: 1e9 })) as { value: { limit: number } }).value.limit, LIMITS.sinceMax);
  const h = createHandler(deps);
  const ok = await h(req({ type: 'client-request', rpcId: 7, payload: { method: 'since', payload: { seq: 0 } } }));
  const body = await ok.json();
  assert.equal(body.type, 'server-response');
  assert.equal(body.rpcId, 7);
  assert.equal(body.result.ok, true);
  assert.equal((await h(req(null, 'x'.repeat(LIMITS.bodyBytes + 1)))).status, 413);
  assert.equal((await h(req(null, '{bad'))).status, 400);
  assert.equal((await h(req({ type: 'other' }))).status, 400);
  const boom = createHandler({ ...deps, snapshot: () => { throw new Error('/secret/path stack'); } });
  const r = await boom(req({ type: 'client-request', rpcId: 1, payload: { method: 'snapshot' } }));
  assert.equal(r.status, 500);
  assert.ok(!(await r.text()).includes('secret'));
});

function fakeCtx(services: Record<string, unknown> = {}) {
  const listeners = new Map<string, ((...a: unknown[]) => void)[]>();
  return {
    on(name: string, fn: (...a: unknown[]) => void) { listeners.set(name, [...(listeners.get(name) ?? []), fn]); return () => listeners.set(name, (listeners.get(name) ?? []).filter((f) => f !== fn)); },
    emit(name: string, ...a: unknown[]) { for (const f of listeners.get(name) ?? []) f(...a); },
    service: (n: string) => services[n],
    listeners,
  };
}

test('host: starts with no optional services, records live events, places the building, serves snapshot and since', async () => {
  const ctx = fakeCtx();
  const events = memoryKv(), places = memoryKv();
  const host = await startDshHost({ on: ctx.on, service: ctx.service, events, places, now: () => T0 + 3600_000, noBackfill: true, flushMs: 0, refreshMs: 1e9 });
  ctx.emit('session/created', ses('s1'));
  for (const { s, e } of dayOfEvents()) ctx.emit('session/event', s, e);
  const snap = host.snapshot();
  assert.ok(snap.events.length > 10);
  assert.deepEqual(conformanceProblems(snap.events.map((x) => x.e), SECRETS), []);
  assert.ok(snap.placement.lots.s1, 'the root session has a lot');
  assert.equal(snap.placement.lots.s1k, undefined, 'subagents live in the parent building');
  assert.equal(snap.platform.caps.schedules, false, 'no schedule service: no schedules');
  const later = host.since(snap.seq, 100, snap.placementVersion);
  assert.deepEqual(later.events, []);
  assert.equal(later.placement, undefined, 'placement only sent when it changed');
  ctx.emit('session/event', ses('s2'), { type: 'turn/start', time: T0 + 10, data: {} });
  const more = host.since(snap.seq, 100, snap.placementVersion);
  assert.ok(more.events.length >= 2);
  assert.ok(more.placement?.lots.s2);
  await host.dispose();
  assert.equal([...ctx.listeners.values()].flat().length, 0, 'all listeners removed');
  // A restart keeps the lots.
  const again = await startDshHost({ on: ctx.on, service: ctx.service, events, places, now: () => T0 + 3600_000, noBackfill: true, flushMs: 0, refreshMs: 1e9 });
  assert.equal(again.snapshot().placement.lots.s1, snap.placement.lots.s1);
  assert.ok(again.snapshot().events.length >= snap.events.length);
  await again.dispose();
});

test('host: optional sources are read; prompts and configuration are not', async () => {
  const ctx = fakeCtx({
    workspaceRegistry: { list: () => [{ id: 'w1', path: '/Users/me/work/finance', title: 'Finance', sessionIds: ['s1'] }] },
    schedule: { list: async () => ({ items: [{ id: 'a1', title: 'Daily stock alert', prompt: SECRETS[2], status: 'active', scheduledAt: '2026-11-18T07:45:00Z', kind: 'daily' }] }) },
    mcpManager: { list: () => [{ name: 'erp', configured: true, status: { state: 'connected', toolCount: 4 }, config: { env: { TOKEN: SECRETS[5] } } }] },
    pluginInventory: { list: async () => ({ entries: [{ entryId: 'e', moduleName: 'pdf-tools', enabled: true, meta: { description: SECRETS[6] } }] }) },
  });
  const host = await startDshHost({ on: ctx.on, service: ctx.service, events: memoryKv(), places: memoryKv(), now: () => T0, noBackfill: true, flushMs: 0, refreshMs: 1e9 });
  ctx.emit('session/created', ses('s1'));
  ctx.emit('session/event', ses('s1'), { type: 'turn/start', time: T0, data: {} });
  const evs = host.snapshot().events.map((x) => x.e);
  assert.deepEqual(conformanceProblems(evs, SECRETS), []);
  assert.ok(!JSON.stringify(evs).includes('/Users/me'), 'workspace path never stored, only the folder name');
  const types = new Set(evs.map((e) => e.type));
  for (const t of ['workspace', 'schedule', 'connector', 'inventory', 'agent']) assert.ok(types.has(t as never), t);
  assert.equal((evs.find((e) => e.type === 'agent')!.data as { workspaceId: string }).workspaceId, 'w1');
  assert.equal(host.snapshot().platform.caps.schedules, true);
  await host.refresh();
  assert.equal(host.snapshot().events.length, evs.length, 'unchanged sources are not stored again');
  await host.dispose();
});

test('backfill: the getter reads full sessions on the host; only model events come back', async () => {
  const days = dayOfEvents();
  const query = {
    filterSessions: async () => [{ header: { id: 's1', createdAt: T0 } }, { header: { id: 's1k', createdAt: T0 } }],
    inspectSession: async <T>(id: string, read: (s: unknown) => T) => read({ header: { id, createdAt: T0 }, ownEvents: () => days.filter((x) => x.s.id === id).map((x) => x.e) }),
  };
  const aggregator = createAggregator({ categories: dshCategories(), workspaceOf: () => '', now: () => T0 });
  const r = await backfill({ query, aggregator, dayStart: T0 - 3600_000, now: () => T0 });
  assert.equal(r.sessions, 2);
  assert.equal(r.complete, true);
  assert.deepEqual(conformanceProblems(r.events, SECRETS), []);
  assert.ok(r.events.some((e) => e.type === 'activity'));
  assert.deepEqual(await backfill({ query: undefined, aggregator, dayStart: 0, now: () => 0 }), { events: [], sessions: 0, complete: false });
});

test('host: a restart does not store today\'s backfilled events a second time', async () => {
  const days = dayOfEvents();
  const sessionQuery = {
    filterSessions: async () => [{ header: { id: 's1', createdAt: T0 } }],
    inspectSession: async <T>(id: string, read: (s: unknown) => T) => read({ header: { id, createdAt: T0 }, ownEvents: () => days.filter((x) => x.s.id === id).map((x) => x.e) }),
  };
  const ctx = fakeCtx({ sessionQuery });
  const events = memoryKv(), places = memoryKv();
  const start = () => startDshHost({ on: ctx.on, service: ctx.service, events, places, now: () => T0 + 3600_000, flushMs: 0, refreshMs: 1e9, registryWaitMs: 0 });
  const first = await start();
  await first.ready;
  const seq = first.snapshot().seq;
  assert.ok(seq > 5, 'the first start backfills today');
  await first.dispose();
  const second = await start();
  await second.ready;
  assert.equal(second.snapshot().backfill, 'done');
  assert.equal(second.snapshot().seq, seq, 'nothing new happened, so nothing new is stored');
  await second.dispose();
});

test('host: a new session goes to its workspace\'s district even before the registry lists it', async () => {
  // On DSH 0.2.2-rc.2 `session/created` arrives before workspaceRegistry.list() names the session; the header's
  // cwd (the workspace folder) is known at once. Paths are only matched on the host and never stored.
  const rows = [
    { id: 'w-fin', path: '/Users/me/work/finance', title: 'finance', sessionIds: [] as string[] },
    { id: 'w-ops', path: '/Users/me/work/finance-ops/', title: 'ops', sessionIds: [] as string[] },
  ];
  const ctx = fakeCtx({ workspaceRegistry: { list: () => rows } });
  const host = await startDshHost({ on: ctx.on, service: ctx.service, events: memoryKv(), places: memoryKv(), now: () => T0 + 3600_000, noBackfill: true, flushMs: 0, refreshMs: 1e9 });
  for (const [id, cwd] of [['a', '/Users/me/work/finance'], ['b', '/Users/me/work/finance-ops/sub'], ['c', '/elsewhere']]) {
    ctx.emit('session/created', ses(id, { cwd }));
    ctx.emit('session/event', ses(id, { cwd }), { type: 'turn/start', time: T0 + 10, data: {} });
  }
  const snap = host.snapshot();
  const claimOf = (id: string) => snap.placement.claims.find((c) => c.block === snap.placement.lots[id]?.split('#')[0])?.workspaceId;
  assert.equal(claimOf('a'), 'w-fin');
  assert.equal(claimOf('b'), 'w-ops', 'longest matching folder wins; finance is not a prefix of finance-ops');
  assert.equal(claimOf('c'), 'default');
  assert.ok(!JSON.stringify(snap).includes('/Users/me'), 'no path leaves the host');
  await host.dispose();
});

test('host: a blank "New Session" gets no building until something happens in it', async () => {
  // DSH 0.2.2-rc.2 creates the session when the member clicks New Session, before any prompt. Placed then, every
  // abandoned blank session would hold a lot for good and count as running.
  const ctx = fakeCtx();
  const host = await startDshHost({ on: ctx.on, service: ctx.service, events: memoryKv(), places: memoryKv(), now: () => T0 + 3600_000, noBackfill: true, flushMs: 0, refreshMs: 1e9 });
  ctx.emit('session/created', ses('blank'));
  let snap = host.snapshot();
  assert.equal(snap.placement.lots.blank, undefined);
  assert.ok(!snap.events.some((x) => x.e.type === 'agent' && x.e.data.id === 'blank'));
  ctx.emit('session/event', ses('blank'), { type: 'turn/start', time: T0 + 20, data: {} });
  snap = host.snapshot();
  assert.ok(snap.placement.lots.blank, 'the first turn places it');
  const first = snap.events.find((x) => x.e.type === 'agent' && x.e.data.id === 'blank')?.e;
  assert.equal(first?.type === 'agent' ? first.data.startedAt : undefined, T0, 'started when it was created');
  // A subagent is real work from the start.
  ctx.emit('session/created', ses('kid', { parentSession: 'blank' }));
  assert.ok(host.snapshot().events.some((x) => x.e.type === 'agent' && x.e.data.id === 'kid'));
  await host.dispose();
});

test('backfill: a session with no events today is not read in as an agent', async () => {
  const query = {
    filterSessions: async () => [{ header: { id: 'empty', createdAt: T0 } }],
    inspectSession: async <T>(id: string, read: (s: unknown) => T) => read({ header: { id, createdAt: T0 }, ownEvents: () => [] }),
  };
  const aggregator = createAggregator({ categories: dshCategories(), workspaceOf: () => '', now: () => T0 });
  const r = await backfill({ query, aggregator, dayStart: T0 - 3600_000, now: () => T0 });
  assert.deepEqual(r.events, []);
});

test('host: the backfill waits for a workspace registry that appears after start', async () => {
  const days = dayOfEvents();
  let rows: unknown[] = [];
  setTimeout(() => { rows = [{ id: 'w-fin', path: '/Users/me/work/finance', title: 'finance', sessionIds: [] }]; }, 300);
  const sessionQuery = {
    filterSessions: async () => [{ header: { id: 's1', createdAt: T0 } }],
    inspectSession: async <T>(id: string, read: (s: unknown) => T) => read({ header: { id, createdAt: T0, cwd: '/Users/me/work/finance' }, ownEvents: () => days.filter((x) => x.s.id === id).map((x) => x.e) }),
  };
  const ctx = fakeCtx({ sessionQuery, workspaceRegistry: { list: () => rows } });
  const host = await startDshHost({ on: ctx.on, service: ctx.service, events: memoryKv(), places: memoryKv(), now: () => T0 + 3600_000, flushMs: 0, refreshMs: 1e9 });
  await host.ready;
  const snap = host.snapshot();
  const block = snap.placement.lots.s1?.split('#')[0];
  assert.equal(snap.placement.claims.find((c) => c.block === block)?.workspaceId, 'w-fin');
  await host.dispose();
});

test('host: the snapshot says when today is kept in memory only (storage unavailable)', async () => {
  const { startDshHost, memoryKv } = await import('../src/index.ts');
  const h = await startDshHost({ on: () => () => {}, service: () => undefined, events: memoryKv(), places: memoryKv(), storage: 'memory', noBackfill: true });
  assert.equal(h.snapshot().storage, 'memory');
  await h.dispose();
  const h2 = await startDshHost({ on: () => () => {}, service: () => undefined, events: memoryKv(), places: memoryKv(), noBackfill: true });
  assert.equal(h2.snapshot().storage, 'persistent');
  await h2.dispose();
});
