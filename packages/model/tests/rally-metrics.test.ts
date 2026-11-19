import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.ts';
import { rallyAt, rally, tierOf, placardOf, TIER_MS } from '../src/rally.ts';
import { FAILED_IN_SQUARE_MS } from '../src/whereabouts.ts';
import { metricsAt, carsFor, CALLS_PER_CAR, MAX_CARS, RECENT_MS, fireTier, burning } from '../src/metrics.ts';
import { congestion, congestionLevel, tileKey, CONGESTION_AT } from '../src/congestion.ts';
import { coloredSet, LAYERS, LAYER_OF_TODAY } from '../src/layers.ts';
import { todayAt, TODAY_ORDER } from '../src/today.ts';
import { isRoad } from '../src/template/city.ts';
import { agent, at, call, turn, usage, wait, M } from './helpers.ts';

test('rally: waiting 1, 5 and 15 minutes are the three tiers; the longest wait stands in front', () => {
  const st = createStore();
  st.applyAll([
    agent('a1', at(9)), wait('a1', 'w1', at(10, 59)),
    agent('a5', at(9)), wait('a5', 'w5', at(10, 55)),
    agent('a15', at(9)), wait('a15', 'w15', at(10, 45)),
  ]);
  const r = rallyAt(st, at(11));
  assert.deepEqual(r.map((e) => [e.agentId, e.tier, e.age / M]), [['a15', 2, 15], ['a5', 1, 5], ['a1', 0, 1]]);
  assert.deepEqual(rally(st, at(11)).map((s) => s.agent.id), ['a15', 'a5', 'a1'], 'the agent list keeps the same order');
  assert.equal(tierOf(TIER_MS[0] - 1), 0);
  assert.equal(tierOf(TIER_MS[0]), 1);
  assert.equal(tierOf(TIER_MS[1]), 2);
});

test('rally: the four kinds of wait, each with its placard; tool names stay off the placard', () => {
  const st = createStore();
  st.applyAll([
    agent('ap', at(9)), { type: 'approval', data: { id: 'x', agentId: 'ap', kind: 'approval', tool: 'bash', askedAt: at(10) } },
    agent('q', at(9)), wait('q', 'y', at(10, 1), undefined, 'question'),
    agent('pl', at(9)), wait('pl', 'z', at(10, 2), undefined, 'plan'),
    agent('er', at(9)), turn('er', at(9), 'start'), turn('er', at(10, 3), 'end', 'error'),
  ]);
  const r = rallyAt(st, at(10, 10));
  assert.deepEqual(r.map((e) => [e.agentId, e.kind, placardOf(e.kind)]), [['ap', 'approval', 1], ['q', 'question', 2], ['pl', 'plan', 2], ['er', 'error', 3]]);
  assert.equal(r[0].tool, 'bash', 'the card may name the tool');
});

test('rally: an unanswered plan (exit_plan_mode) brings the agent to the square; the result sends it back', () => {
  const st = createStore();
  st.applyAll([agent('p', at(9)), turn('p', at(9), 'start'), call('p', at(9, 30), 'plan', 'exit_plan_mode', { id: 'c1' }), wait('p', 'q:c1', at(9, 30), undefined, 'plan')]);
  assert.deepEqual(rallyAt(st, at(9, 40)).map((e) => e.kind), ['plan']);
  st.applyAll([wait('p', 'q:c1', at(9, 30), at(9, 45), 'plan'), call('p', at(9, 30), 'plan', 'exit_plan_mode', { id: 'c1', ok: true })]);
  assert.deepEqual(rallyAt(st, at(9, 40)).map((e) => e.agentId), ['p'], 'look-back still shows the wait');
  assert.deepEqual(rallyAt(st, at(9, 46)), [], 'answered: back to work');
});

test('rally: a session that stopped on an error stays 90 minutes; after 91 it has gone home', () => {
  const st = createStore();
  st.applyAll([agent('f', at(9)), turn('f', at(9), 'start'), turn('f', at(10), 'end', 'error')]);
  assert.equal(rallyAt(st, at(10, 89))[0]?.kind, 'error');
  assert.equal(rallyAt(st, at(10) + FAILED_IN_SQUARE_MS - 1).length, 1);
  assert.deepEqual(rallyAt(st, at(11, 31)), [], '91 minutes later the agent is not in the square');
  st.apply(turn('f', at(10, 20), 'start'));
  assert.deepEqual(rallyAt(st, at(10, 30)), [], 'working again: it leaves the square at once');
});

test('metrics: per-place errors, last error time, 5-minute calls and tokens', () => {
  const st = createStore();
  st.applyAll([
    agent('a', at(9)),
    call('a', at(9, 50), 'exec', 'bash', { ok: false }), call('a', at(9, 58), 'exec', 'bash', { ok: false }),
    call('a', at(9, 59), 'connector', 'mcp__erp__read', { connectorId: 'erp', ok: false }), call('a', at(9, 57), 'read'),
    usage('a', at(9, 30), 1000, 100), usage('a', at(9, 58), 400, 100, 'm2'),
    agent('k', at(9, 1), { parentAgentId: 'a', kind: 'subagent' }), call('k', at(9, 56), 'web', 'fetch'),
  ]);
  const m = metricsAt(st, at(10));
  const home = m.places.get('b:a')!;
  assert.equal(home.errors, 2);
  assert.equal(home.lastErrorAt, at(9, 58));
  assert.deepEqual([...home.errorTools], [['bash', 2]]);
  assert.equal(home.calls5, 2, 'bash at 9:58 and read at 9:57; 9:50 is older than five minutes');
  assert.equal(m.places.get('conn:erp')!.errors, 1);
  assert.equal(m.places.get('station')!.calls5, 1, 'the subagent fetch happens at the station');
  assert.equal(home.tokens, 1600);
  assert.equal(home.tokens5, 500);
  assert.equal(m.places.get('model:m1')!.tokens, 1100);
  assert.equal(m.places.get('model:m2')!.tokens5, 500);
  assert.equal(m.calls5, 4);
  assert.equal(m.errors, 3);
  assert.equal(fireTier(0), 0); assert.equal(fireTier(2), 1); assert.equal(fireTier(3), 2); assert.equal(fireTier(6), 3);
  assert.ok(burning(home, at(10)));
  assert.ok(!burning(home, at(10, 29)), '30 minutes after the last failure the fire is out (smouldering)');
});

test('traffic: the number of cars is calls in the last five minutes ÷ 2, at most 64', () => {
  for (const n of [0, 1, 2, 3, 7, 40, 127, 128, 500]) assert.equal(carsFor(n), Math.min(MAX_CARS, Math.round(n / CALLS_PER_CAR)));
  const st = createStore();
  const ev = [agent('a', at(9))];
  for (let i = 0; i < 31; i++) ev.push(call('a', at(10) - i * 9_000, 'read'));
  ev.push(call('a', at(10) - RECENT_MS, 'read'));
  st.applyAll(ev);
  const m = metricsAt(st, at(10));
  assert.equal(m.calls5, 31, 'a call exactly five minutes ago is not recent');
  assert.equal(m.cars, 16);
});

test('congestion: levels by calls, one level less every three tiles, roads only, the fire station ignored', () => {
  assert.equal(congestionLevel(0), 0);
  assert.equal(congestionLevel(1), 1);
  assert.equal(congestionLevel(CONGESTION_AT[0]), 2);
  assert.equal(congestionLevel(CONGESTION_AT[1]), 3);
  const gates = new Map<string, [number, number][]>([['b:a', [[6, 3]]], ['fire', [[16, 24]]]]);
  const c = congestion(gates, (id) => (id === 'b:a' ? 50 : 99), 0);
  assert.equal(c.get(tileKey(6, 3)), 3);
  assert.equal(c.get(tileKey(6, 6)), 2, 'three tiles out: one level less');
  assert.equal(c.get(tileKey(6, 9)), 1);
  assert.equal(c.get(tileKey(6, 12)), undefined, 'beyond 2 + 2·3 tiles');
  for (const k of c.keys()) { const [i, j] = k.split(',').map(Number); assert.ok(isRoad(i, j, 0), k + ' is a road'); }
  assert.ok(![...c.keys()].some((k) => k === tileKey(16, 24)), 'engines are not calls');
});

test('layers: agents in the square keep their colour in every layer; each today button has its layer', () => {
  const st = createStore();
  st.applyAll([
    agent('w', at(9)), wait('w', 'x', at(9, 50)),
    agent('r', at(9)), turn('r', at(9), 'start'), call('r', at(9, 58), 'connector', 'mcp__erp__q', { connectorId: 'erp', ok: false }), usage('r', at(9, 58), 10, 10),
  ]);
  for (const l of LAYERS) {
    const set = coloredSet(l, st, at(10), 'dsh');
    if (l === 'all') { assert.equal(set, null); continue; }
    assert.ok(set!.has('w'), l + ' keeps the waiting agent');
  }
  assert.ok(coloredSet('errors', st, at(10), 'dsh')!.has('conn:erp'));
  assert.ok(coloredSet('errors', st, at(10), 'dsh')!.has('fire'));
  assert.ok(coloredSet('tokens', st, at(10), 'dsh')!.has('model:m1'));
  assert.ok(coloredSet('tokens', st, at(10), 'dsh')!.has('b:r'));
  assert.ok(coloredSet('calls', st, at(10), 'dsh')!.has('conn:erp'));
  assert.ok(coloredSet('running', st, at(10), 'dsh')!.has('conn:erp'), 'where a running agent is now');
  assert.deepEqual(TODAY_ORDER.map((c) => LAYER_OF_TODAY[c]), ['all', 'scheduled', 'running', 'review', 'errors', 'tokens']);
  const t = todayAt(st, at(10), 'dsh');
  assert.deepEqual(t.waits.map((x) => [x.agentId, x.kind]), [['w', 'approval']]);
});
