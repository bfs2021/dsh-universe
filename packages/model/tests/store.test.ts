import test from 'node:test';
import assert from 'node:assert/strict';
import { BIN_MS, createStore, cumAt, errsAt, idxAt, stateAt } from '../src/store.ts';
import { rng } from '../src/hash.ts';
import { CATEGORIES } from '../src/types.ts';
import { agent, at, call, turn, usage, wait, M } from './helpers.ts';

test('stateAt: future, running, waiting, idle, done, failed', () => {
  const st = createStore();
  st.applyAll([
    agent('a', at(9)), turn('a', at(9), 'start'), wait('a', 'w1', at(9, 10), at(9, 20)), turn('a', at(9, 30), 'end', 'cancelled'),
    turn('a', at(10), 'start'), turn('a', at(10, 30), 'end', 'completed'),
    agent('b', at(11)), turn('b', at(11), 'start'), turn('b', at(11, 5), 'end', 'error'),
  ]);
  const a = st.agent('a')!, b = st.agent('b')!;
  assert.equal(stateAt(a, at(8)), 'future');
  assert.equal(stateAt(a, at(9, 5)), 'running');
  assert.equal(stateAt(a, at(9, 15)), 'waiting');
  assert.equal(stateAt(a, at(9, 45)), 'idle');
  assert.equal(stateAt(a, at(10, 10)), 'running');
  assert.equal(stateAt(a, at(11)), 'done');
  assert.equal(stateAt(b, at(11, 6)), 'failed');
});

test('stateAt: a session ended by the host keeps its final state; an open wait stays waiting', () => {
  const st = createStore();
  st.applyAll([agent('a', at(9), { endedAt: at(10), state: 'failed' }), agent('b', at(9)), wait('b', 'w', at(9, 30))]);
  assert.equal(stateAt(st.agent('a')!, at(11)), 'failed');
  assert.equal(stateAt(st.agent('b')!, at(15)), 'waiting');
});

test('cumAt, errsAt and the ten-minute buckets match a naive count, whatever the arrival order', () => {
  const r = rng(7);
  const events = [agent('a', at(8)), agent('b', at(8))];
  const raw: { id: string; t: number; tok: number; ok: boolean; cat: (typeof CATEGORIES)[number] }[] = [];
  for (let i = 0; i < 400; i++) {
    raw.push({ id: r() < 0.5 ? 'a' : 'b', t: at(8) + Math.floor(r() * 10 * 60 * M), tok: Math.floor(r() * 5000), ok: r() > 0.05, cat: CATEGORIES[Math.floor(r() * CATEGORIES.length)] });
  }
  for (const x of raw) events.push(call(x.id, x.t, x.cat, x.cat, { ok: x.ok }), usage(x.id, x.t, x.tok, 1));
  // shuffle
  for (let i = events.length - 1; i > 2; i--) { const j = 2 + Math.floor(r() * (i - 1)); [events[i], events[j]] = [events[j], events[i]]; }
  const st = createStore();
  st.applyAll(events);
  for (let k = 0; k < 50; k++) {
    const T = at(8) + Math.floor(r() * 11 * 60 * M);
    for (const id of ['a', 'b']) {
      const mine = raw.filter((x) => x.id === id && x.t <= T);
      assert.equal(idxAt(st.agent(id)!, T), mine.length);
      assert.equal(cumAt(st.agent(id)!, T), mine.reduce((a, x) => a + x.tok + 1, 0));
      assert.equal(errsAt(st.agent(id)!, T), mine.filter((x) => !x.ok).length);
    }
  }
  const naive = new Map<number, { calls: number; work: number }>();
  for (const x of raw) {
    const b = Math.floor(x.t / BIN_MS) * BIN_MS;
    const v = naive.get(b) ?? { calls: 0, work: 0 };
    v.calls++; if (x.cat === 'edit' || x.cat === 'exec') v.work++;
    naive.set(b, v);
  }
  assert.deepEqual(new Map([...st.bins()].sort((a, b) => a[0] - b[0])), new Map([...naive].sort((a, b) => a[0] - b[0])));
});

test('a call with the same id is counted once (backfill overlapping live events)', () => {
  const st = createStore();
  st.applyAll([agent('a', at(9)), call('a', at(9, 1), 'read', 'read', { id: 'c1' }), call('a', at(9, 1), 'read', 'read', { id: 'c1' })]);
  assert.equal(idxAt(st.agent('a')!, at(10)), 1);
});

test('a result completes its call: ok and duration update, the time and count stay', () => {
  const st = createStore();
  st.applyAll([agent('a', at(9)), call('a', at(9, 1), 'exec', 'bash', { id: 'c1' }), call('a', at(9, 2), 'exec', 'bash', { id: 'c1', ok: false, durationMs: 60000 })]);
  const s = st.agent('a')!;
  assert.equal(idxAt(s, at(10)), 1);
  assert.equal(s.ev[0].t, at(9, 1));
  assert.equal(s.ev[0].durationMs, 60000);
  assert.equal(errsAt(s, at(10)), 1);
});
