import test from 'node:test';
import assert from 'node:assert/strict';
import { cityTemplate, inGrowth, MAX_GROWTH, SQUARE_FRONT_CAP } from '../src/template/city.ts';
import { emptyPlacement, growthAt, lotOf, place, readPlacement, type Arrival } from '../src/placement.ts';
import { segmentsOf, storeysOf } from '../src/building.ts';
import { rng } from '../src/hash.ts';
import { at } from './helpers.ts';

const T = cityTemplate();
const arrivals = (n: number, wsCount = 3, seed = 1): Arrival[] => {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => ({ sessionId: 's' + i + '-' + Math.floor(r() * 1e6), workspaceId: 'w' + (i % wsCount), startedAt: at(8) + i * 60_000 }));
};

test('template: the civic baseline is always there and the border starts at 4×4 blocks', () => {
  assert.deepEqual(T.civic.map((c) => c.id).sort(), ['fire', 'library', 'power', 'school', 'station', 'town']);
  const buildable = T.blocks.filter((b) => inGrowth(b, 0));
  assert.equal(buildable.length, 16);
  assert.equal(cityTemplate().blocks.map((b) => b.zone).join(), T.blocks.map((b) => b.zone).join(), 'zoning is the same every time');
});

test('an empty workspace has no session buildings', () => {
  const r = place(T, emptyPlacement(), []);
  assert.deepEqual(r.state.lots, {});
  assert.equal(r.state.growth, 0);
});

test('placement is deterministic: same history, same city; input order does not matter', () => {
  const list = arrivals(40);
  const a = place(T, emptyPlacement(), list).state;
  const b = place(T, emptyPlacement(), list).state;
  const c = place(T, emptyPlacement(), [...list].reverse()).state;
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('a placed building never moves: adding sessions keeps every earlier lot', () => {
  const list = arrivals(60);
  const first = place(T, emptyPlacement(), list.slice(0, 20)).state;
  const later = place(T, first, list).state;
  for (const [id, lot] of Object.entries(first.lots)) assert.equal(later.lots[id], lot, id);
  // Even an arrival that started earlier than everything placed does not move anyone.
  const early = place(T, later, [{ sessionId: 'early', workspaceId: 'w0', startedAt: at(1) }]).state;
  for (const [id, lot] of Object.entries(later.lots)) assert.equal(early.lots[id], lot);
  assert.ok(early.lots.early);
});

test('stepwise placement equals placing the whole history at once', () => {
  const list = arrivals(50);
  let st = emptyPlacement();
  for (const a of list) st = place(T, st, [a]).state;
  assert.deepEqual(st, place(T, emptyPlacement(), list).state);
});

test('no two sessions share a lot; a workspace fills its blocks before claiming another', () => {
  const st = place(T, emptyPlacement(), arrivals(120, 4)).state;
  const lots = Object.values(st.lots);
  assert.equal(new Set(lots).size, lots.length);
  // Every claimed block of a workspace except its last is full.
  for (const ws of ['w0', 'w1', 'w2', 'w3']) {
    const blocks = st.claims.filter((c) => c.workspaceId === ws).map((c) => c.block);
    for (const b of blocks.slice(0, -1)) assert.equal(lots.filter((l) => l.startsWith(b + '#')).length, 4, b);
  }
});

test('the border only grows, in the fixed order, and stops at 8×8', () => {
  let st = emptyPlacement();
  let last = 0;
  for (const a of arrivals(400, 5)) {
    st = place(T, st, [a]).state;
    assert.ok(st.growth >= last);
    last = st.growth;
  }
  assert.equal(st.growth, MAX_GROWTH);
  const r = place(T, st, arrivals(400, 5, 9));
  assert.ok(r.unplaced.length > 0, 'a full 8×8 city leaves the rest unplaced rather than moving anyone');
  assert.equal(growthAt(st, at(0)), 0);
  assert.ok(growthAt(st, at(23)) === MAX_GROWTH);
});

test('every lot of a session is inside the border at the time it was placed', () => {
  const st = place(T, emptyPlacement(), arrivals(200, 3)).state;
  for (const id of Object.keys(st.lots)) {
    const L = lotOf(T, st, id)!;
    const claim = st.claims.find((c) => c.block === L.bx + ',' + L.by)!;
    assert.ok(inGrowth({ bx: L.bx, by: L.by }, growthAt(st, claim.t)));
  }
});

test('a stored placement that cannot be read starts afresh; a good one round-trips', () => {
  assert.deepEqual(readPlacement(null), emptyPlacement());
  assert.deepEqual(readPlacement({ version: 2 }), emptyPlacement());
  const st = place(T, emptyPlacement(), arrivals(10)).state;
  assert.deepEqual(readPlacement(JSON.parse(JSON.stringify(st))).lots, st.lots);
});

test('cap: a building on a lot in front of the square never exceeds 13 storeys', () => {
  const capped = T.blocks.flatMap((b) => b.lots).filter((L) => L.cap > 0);
  assert.ok(capped.length > 0);
  for (const L of capped) assert.equal(L.cap, SQUARE_FRONT_CAP);
  const huge = { library: 1e6, workshop: 1e6, machine: 1e6, meeting: 1e6 };
  assert.ok(storeysOf(segmentsOf(huge, true)) <= SQUARE_FRONT_CAP);
  assert.ok(storeysOf(segmentsOf(huge, false)) > SQUARE_FRONT_CAP);
  assert.deepEqual(segmentsOf({}, false), [{ id: 'podium', storeys: 2 }]);
});
