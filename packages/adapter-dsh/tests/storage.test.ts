import test from 'node:test';
import assert from 'node:assert/strict';
import { createDayStore, dayOf, memoryKv, RETENTION_DAYS, CHUNK } from '../src/index.ts';
import type { UEvent } from '@dsh-universe/model';

const ev = (i: number): UEvent => ({ type: 'activity', data: { t: i, agentId: 'a', category: 'read', tool: 'read' } });
const DAY = 86_400_000;

test('events are numbered; since returns what came after, bounded', async () => {
  const kv = memoryKv();
  const s = createDayStore({ table: kv, now: () => Date.UTC(2026, 10, 18, 12), flushMs: 0 });
  await s.load();
  for (let i = 0; i < 1200; i++) s.append(ev(i));
  const a = s.since(0, 500);
  assert.equal(a.events.length, 500);
  assert.equal(a.more, true);
  const b = s.since(a.seq, 2000);
  assert.equal(b.events.length, 700);
  assert.equal(b.more, false);
  assert.deepEqual(s.since(b.seq, 10).events, []);
});

test('a restart reads today back from storage', async () => {
  const kv = memoryKv();
  const now = () => Date.UTC(2026, 10, 18, 12);
  const s = createDayStore({ table: kv, now, flushMs: 0 });
  await s.load();
  for (let i = 0; i < CHUNK + 20; i++) s.append(ev(i));
  await s.flush();
  const again = createDayStore({ table: kv, now, flushMs: 0 });
  await again.load();
  assert.equal(again.today().events.length, CHUNK + 20);
  assert.equal(again.append(ev(9)), CHUNK + 21, 'numbering continues');
});

test('retention: a 15-day-old partition is deleted, a 13-day-old one is kept', async () => {
  const kv = memoryKv();
  let t = Date.UTC(2026, 10, 1, 12);
  const s = createDayStore({ table: kv, now: () => t, flushMs: 0 });
  await s.load();
  s.append(ev(1)); await s.flush();
  const first = dayOf(t);
  t += 2 * DAY; s.append(ev(2)); await s.flush();
  const second = dayOf(t);
  t = Date.UTC(2026, 10, 1, 12) + 15 * DAY; s.append(ev(3)); await s.flush();
  const removed = await s.prune();
  assert.ok(removed >= 1);
  assert.ok(![...kv.data.keys()].some((k) => k.startsWith('day:' + first)), 'old day gone');
  assert.ok([...kv.data.keys()].some((k) => k.startsWith('day:' + second)), 'the 13-day-old day stays');
  assert.ok(!s.days().includes(first));
  assert.equal(RETENTION_DAYS, 14);
});

test('a new day restarts the numbering; a client on yesterday\'s numbers gets today from the start', async () => {
  let t = Date.UTC(2026, 10, 18, 12);
  const s = createDayStore({ table: memoryKv(), now: () => t, flushMs: 0 });
  await s.load();
  for (let i = 0; i < 10; i++) s.append(ev(i));
  t += DAY;
  s.append(ev(99));
  const r = s.since(10, 100);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].seq, 1);
});

test('storage that throws does not break appending', async () => {
  const bad = { get() { throw new Error('x'); }, put: async () => { throw new Error('x'); } };
  const errors: unknown[] = [];
  const s = createDayStore({ table: bad, now: () => Date.UTC(2026, 10, 18), flushMs: 0, onError: (e) => errors.push(e) });
  await s.load();
  assert.equal(s.append(ev(1)), 1);
  await s.flush();
  assert.ok(errors.length > 0);
});
