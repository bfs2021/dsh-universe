import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.ts';
import { whereabouts, FAILED_IN_SQUARE_MS } from '../src/whereabouts.ts';
import { rally } from '../src/rally.ts';
import type { Category } from '../src/types.ts';
import { agent, at, call, turn, wait } from './helpers.ts';

const where = (cat: Category, extra: { connectorId?: string } = {}) => {
  const st = createStore();
  st.applyAll([agent('a', at(9)), call('a', at(9, 1), cat, 'tool_x', extra)]);
  return whereabouts(st, st.agent('a')!, at(9, 2));
};

test('whereabouts: each category of the last call', () => {
  assert.deepEqual(where('read'), { place: 'b:a', floor: 'library' });
  assert.deepEqual(where('search'), { place: 'b:a', floor: 'library' });
  assert.deepEqual(where('edit'), { place: 'b:a', floor: 'workshop' });
  assert.deepEqual(where('exec'), { place: 'b:a', floor: 'machine' });
  assert.deepEqual(where('delegate'), { place: 'b:a', floor: 'meeting' });
  assert.deepEqual(where('connector', { connectorId: 'erp' }), { place: 'conn:erp', floor: 'tool_x' });
  assert.deepEqual(where('web'), { place: 'station', floor: 'gate' });
  assert.deepEqual(where('skill'), { place: 'school', floor: 'skill' });
  assert.deepEqual(where('memory'), { place: 'library', floor: 'memory' });
  assert.deepEqual(where('other'), { place: 'b:a', floor: 'lobby' });
});

test('whereabouts: three kinds of wait, idle, done, failed, no call yet, not started', () => {
  const st = createStore();
  st.applyAll([
    agent('q', at(9)), wait('q', 'w1', at(9, 5), undefined, 'question'),
    agent('p', at(9)), wait('p', 'w2', at(9, 5), undefined, 'plan'),
    agent('ap', at(9)), wait('ap', 'w3', at(9, 5)),
    agent('i', at(9)), turn('i', at(9, 1), 'start'), turn('i', at(9, 2), 'end', 'cancelled'),
    agent('d', at(9)), turn('d', at(9, 1), 'start'), turn('d', at(9, 2), 'end', 'completed'),
    agent('f', at(9)), turn('f', at(9, 1), 'start'), turn('f', at(9, 2), 'end', 'error'),
    agent('n', at(9)),
    agent('later', at(12)),
  ]);
  const T = at(9, 10);
  const w = (id: string) => whereabouts(st, st.agent(id)!, T);
  assert.deepEqual(w('q'), { place: 'town', floor: 'question' });
  assert.deepEqual(w('p'), { place: 'town', floor: 'plan' });
  assert.deepEqual(w('ap'), { place: 'town', floor: 'approval' });
  assert.deepEqual(w('i'), { place: 'b:i', floor: 'lobby' });
  assert.deepEqual(w('d'), { place: 'b:d', floor: 'done' });
  assert.deepEqual(w('f'), { place: 'town', floor: 'failed' });
  assert.deepEqual(whereabouts(st, st.agent('f')!, at(9, 2) + FAILED_IN_SQUARE_MS + 1), { place: 'b:f', floor: 'failed' });
  assert.deepEqual(w('n'), { place: 'b:n', floor: 'lobby' });
  assert.equal(w('later'), null);
});

test('a subagent works in its parent building; the square is ordered longest wait first', () => {
  const st = createStore();
  st.applyAll([
    agent('root', at(9)), agent('kid', at(9, 1), { parentAgentId: 'root', kind: 'subagent' }), call('kid', at(9, 2), 'edit'),
    agent('x', at(9)), wait('x', 'w', at(9, 30)), agent('y', at(9)), wait('y', 'w', at(9, 10)),
  ]);
  assert.deepEqual(whereabouts(st, st.agent('kid')!, at(9, 3)), { place: 'b:root', floor: 'workshop' });
  assert.deepEqual(rally(st, at(9, 40)).map((s) => s.agent.id), ['y', 'x']);
});
