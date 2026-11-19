// Room sizes ("bigger buildings have bigger floors"; "keep all rooms, small and big, let agent
// pick"): every template, the lobby and the roof come in three sizes; the building picks one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { route, type BuildingShape, type RoomRecent, type RoomSpec, type RoomTier } from '@dsh-universe/renderer';
import { segmentsOf } from '@dsh-universe/model';
import {
  ROOM_TEMPLATES, TIER_AT, TIER_SIZE, bulkOf, createArtKit, hallPlan, paintRoom, roomBox, roomLayout, roomPlan, roomTier, setFootprintProbe,
} from '../src/index.ts';
import { withPen } from '../src/iso.ts';
import { fakeSurface } from './fake-canvas.ts';

const TIERS: readonly RoomTier[] = ['small', 'medium', 'large'];
const spec = (room: string, o: Partial<RoomSpec> = {}): RoomSpec => ({
  id: 'v', room, floor: 'library', place: 'building', colour: '#6C7BEA', seed: 7, act: false, frame: 0, reduced: false, night: false, na: false,
  n: 0, recent: [], jobs: 0, subs: [], out: 0, queue: 0, rate: 0, hour: 15.5, ...o,
});
function log(s: RoomSpec): string[] {
  const sf = fakeSurface(404, 236);
  withPen(sf.ctx, () => paintRoom(s));
  return sf.log;
}
const count = (l: readonly string[], needle: string) => l.filter((x) => x === needle).length;
const RECENT: RoomRecent[] = [{ age: 2, err: false }, { age: 11, err: false }, { age: 30, err: false }];
const inter = (a: readonly number[], b: readonly number[], e = 0.05) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > e && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > e;
const shape = (template: number, tokens: number, calls: Partial<Record<'library' | 'workshop' | 'machine' | 'meeting', number>>, stage: BuildingShape['stage'] = 'construction'): BuildingShape =>
  ({ template, footprint: 0.58 + 0.32 * Math.min(1, Math.sqrt(tokens / 5e5)), segments: segmentsOf(calls, false), stage });

test('size rule: small, medium and large from the drawn floor plate × storeys; the same building always the same size', () => {
  const fresh = shape(0, 0, { library: 2 }), tower = shape(0, 2e6, { library: 400, workshop: 300, machine: 200, meeting: 100 });
  assert.equal(roomTier(fresh), 'small', 'a new building');
  assert.equal(roomTier(tower), 'large', 'a big tower: full 12×12 floors');
  assert.equal(roomTier(shape(0, 2e6, { library: 400 }, 'groundbreaking')), 'small', 'still at the groundbreaking');
  assert.equal(roomTier(shape(0, 1e5, { library: 40, workshop: 20 })), 'medium');
  assert.deepEqual([TIER_SIZE.small, TIER_SIZE.medium, TIER_SIZE.large], [9, 10.5, 12]);
  // Deterministic: a pure function of the shape.
  for (let tpl = 0; tpl < 60; tpl++) for (const tok of [0, 5e4, 5e5]) for (const n of [1, 30, 300]) {
    const b = shape(tpl, tok, { library: n, workshop: n >> 1 });
    assert.equal(roomTier(b), roomTier(structuredClone(b)));
    const v = bulkOf(b);
    assert.equal(roomTier(b), v >= TIER_AT.large ? 'large' : v >= TIER_AT.medium ? 'medium' : 'small');
  }
  // A narrow silhouette has smaller floors than a broad one of the same height and footprint (its real floor plate).
  const pencil = 24, box = 0;   // tower-6-0 is the pencil, tower-0-0 the glass box
  assert.ok(bulkOf(shape(pencil, 3e5, { library: 100, workshop: 60 })) < bulkOf(shape(box, 3e5, { library: 100, workshop: 60 })));
});

test('size rule: growing never makes the floors smaller (more calls, more tokens)', () => {
  const R: Record<RoomTier, number> = { small: 0, medium: 1, large: 2 };
  for (let tpl = 0; tpl < 60; tpl += 3) {
    let prev = 0;
    for (let step = 0; step < 60; step++) {
      const n = step * step * 2, b = shape(tpl, step * 20_000, { library: n, workshop: n >> 1, machine: n >> 2, meeting: n >> 3 }, step ? 'construction' : 'groundbreaking');
      const r = R[roomTier(b)];
      assert.ok(r >= prev, 'template ' + tpl + ' step ' + step);
      prev = r;
    }
  }
});

test('every room template has a compact version at every size: same template, every data element, enough workstations', () => {
  for (const t of ROOM_TEMPLATES) for (const tier of TIERS) {
    const p = roomPlan(t.id, tier)!, n = TIER_SIZE[tier];
    assert.equal(p.size, n, t.id + ' ' + tier);
    const L = roomLayout(t.id, tier);
    assert.equal(L.size, n);
    assert.deepEqual(roomBox(t.id, tier), [L.w, L.h, L.ox, L.oy]);
    assert.ok(p.units.length >= (tier === 'small' ? 2 : tier === 'medium' ? 6 : 8), t.id + ' ' + tier + ': ' + p.units.length + ' workstations');
    assert.equal(p.spots.length, p.units.length + 3, 'a spot per chair, two by the centrepiece, one in the corner');
    for (const [x, y] of p.spots) assert.ok(x > 0 && x < n && y > 0 && y < n, t.id + ' ' + tier + ' spot ' + x + ',' + y);
    assert.deepEqual(L.props!.map((q) => q.id).sort(), ['beacon', 'board', 'printers', 'tape', 'whiteboard']);
    // Smaller rooms keep fewer workstations, never more.
    if (tier !== 'small') assert.ok(roomPlan(t.id, tier)!.units.length >= roomPlan(t.id, tier === 'large' ? 'medium' : 'small')!.units.length);
  }
  // The plans are pure: asking again gives the same plan.
  for (const t of ROOM_TEMPLATES.slice(0, 5)) assert.deepEqual(roomPlan(t.id, 'small'), roomPlan(t.id, 'small'));
});

test('every room template renders at every size (idle and busy, day and night, every data)', () => {
  const kit = createArtKit({ make: fakeSurface });
  for (const t of ROOM_TEMPLATES) for (const tier of TIERS) {
    for (const o of [{}, { act: true, frame: 37, recent: [...RECENT, { age: 4, err: true }], jobs: 3, n: 250 }, { night: true }, { act: true, frame: 5, night: true, na: true, reduced: true }] as Partial<RoomSpec>[]) {
      assert.doesNotThrow(() => kit.room(spec(t.id, { id: t.id, tier, ...o })), t.id + ' ' + tier + ' ' + JSON.stringify(o));
    }
  }
});

test('at every size: nothing in front of the door or the lift, nothing standing on anything else, every spot free', () => {
  for (const t of ROOM_TEMPLATES) for (const tier of ['small', 'medium'] as const) {
    const p = roomPlan(t.id, tier)!, n = p.size;
    const rs: [readonly number[], string][] = [];
    setFootprintProbe((r, z) => rs.push([r, z]));
    try { log(spec(t.id, { tier, act: true, frame: 9, jobs: 3, n: 250 })); } finally { setFootprintProbe(null); }
    const where = t.id + ' ' + tier + ' (plan ' + t.look.plan + (p.flip ? ', mirrored' : '') + ')';
    // The door is in the back wall (the left wall when mirrored), by the lift; the lift is always at the back right.
    const door = p.flip ? [0, n - 2.3, 1.2, n - 1.4] : [n - 2.3, 0, n - 1.4, 1.2], lift = [n - 1, 0, n - 0.2, 1.2];
    const problems: string[] = [];
    for (const [r, z] of rs) {
      if (inter(r, door, 0)) problems.push(z + ' at the door');
      if (inter(r, lift, 0)) problems.push(z + ' at the lift');
      if (r[0] < -0.01 || r[1] < -0.01 || r[2] > n + 0.01 || r[3] > n + 0.01) problems.push(z + ' outside the room ' + r.map((v) => v.toFixed(2)));
    }
    for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) if (rs[a][1] !== rs[b][1] && inter(rs[a][0], rs[b][0])) problems.push(rs[a][1] + ' on ' + rs[b][1]);
    p.spots.forEach((sp, k) => {
      const own = k < p.units.length ? 'unit' + k : k === p.spots.length - 1 ? 'corner' : 'centre';
      const box = [sp[0] - 0.08, sp[1] - 0.08, sp[0] + 0.08, sp[1] + 0.08];
      if (inter(box, door, 0) || inter(box, lift, 0)) problems.push('spot ' + k + ' at the door or lift');
      for (const [r, z] of rs) if (z !== own && inter(r, box, 0)) problems.push('spot ' + k + ' in ' + z);
    });
    assert.deepEqual([...new Set(problems)], [], where);
  }
});

test('at every size the walkways are free floor, and agents walk along them from the lift to every spot', () => {
  for (const t of ROOM_TEMPLATES) for (const tier of ['small', 'medium'] as const) {
    const L = roomLayout(t.id, tier);
    assert.ok(L.aisles!.length >= 1, t.id + ' ' + tier + ' has a walkway from the door');
    const rs: (readonly number[])[] = [];
    setFootprintProbe((r) => rs.push(r));
    try { log(spec(t.id, { tier, act: true, frame: 9, jobs: 3 })); } finally { setFootprintProbe(null); }
    for (const a of L.aisles!) for (const r of rs) assert.ok(!inter(a, r, 0.01), t.id + ' ' + tier + ' walkway ' + a + ' under ' + r);
    const on = (p: readonly number[]) => L.aisles!.some((r) => p[0] >= r[0] - 0.01 && p[0] <= r[2] + 0.01 && p[1] >= r[1] - 0.01 && p[1] <= r[3] + 0.01);
    for (const s of L.spots) {
      const path = route(L.aisles!, L.lift, s);
      assert.deepEqual(path[path.length - 1], s);
      for (const q of path.slice(1, -1)) assert.ok(on(q), t.id + ' ' + tier + ' waypoint off the walkways');
    }
  }
});

test('compact rooms keep the data: beacon, tape, log board, printers and whiteboard answer as in the full room', () => {
  for (const tier of ['small', 'medium'] as const) for (const id of ['market', 'servers', 'helpdesk', 'warroom']) {
    const l = (o: Partial<RoomSpec>) => log(spec(id, { tier, ...o }));
    const lamp = (x: readonly string[]) => { const i = x.findIndex((s) => /^fillRect\([-\d.]+,[-\d.]+,10,4\)$/.test(s)); return x.slice(i).find((s) => s.startsWith('fillStyle='))!.slice(10); };
    assert.equal(lamp(l({ recent: RECENT })), '#7A2E2A', id + ' ' + tier + ' beacon dark');
    assert.equal(lamp(l({ recent: [{ age: 5, err: true }] })), '#FF8A7A', id + ' ' + tier + ' beacon lit');
    const none = l({}), ok = l({ recent: [{ age: 3, err: false }, { age: 20, err: false }] });
    assert.ok(count(ok, 'fillStyle=#4CC552') >= count(none, 'fillStyle=#4CC552') + 4, 'tape and board');
    assert.equal(count(l({ jobs: 0 }), 'fillStyle=#4CC552') - count(l({ jobs: 2 }), 'fillStyle=#4CC552'), 2, 'two printers busy');
    assert.ok(l({ n: 1 }).length < l({ n: 7 }).length, 'whiteboard lines');
  }
});

test('halls: the lobby and the roof come in every size; the town hall stays full size', () => {
  const kit = createArtKit({ make: fakeSurface });
  for (const tier of TIERS) {
    for (const [floor, o] of [['lobby', { out: 12, present: 2 }], ['roof', { n: 1e9 }], ['roof', { n: 1e9, ended: true }]] as const) {
      const s = spec(floor, { floor, tier, act: true, frame: 3, ...o });
      assert.doesNotThrow(() => kit.room(s));
      const L = roomLayout(floor, tier), n = TIER_SIZE[tier];
      assert.equal(L.size, n, floor + ' ' + tier);
      const rs: [readonly number[], string][] = [];
      setFootprintProbe((r, z) => rs.push([r, z]));
      try { log(s); } finally { setFootprintProbe(null); }
      const lift = [n - 1, 0, n - 0.2, 1.2];
      for (const [r, z] of rs) {
        assert.ok(z === 'housing' || !inter(r, lift, 0), floor + ' ' + tier + ': ' + z + ' at the lift');   // (the roof's housing is the lift's own)
        assert.ok(r[0] >= -0.01 && r[1] >= -0.01 && r[2] <= n + 0.01 && r[3] <= n + 0.01, floor + ' ' + tier + ': ' + z + ' outside');
      }
      for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) assert.ok(rs[a][1] === rs[b][1] || !inter(rs[a][0], rs[b][0]), floor + ' ' + tier + ': ' + rs[a][1] + ' on ' + rs[b][1]);
      assert.ok(L.spots.length >= 2, floor + ' ' + tier + ' has room for agents');
      for (const sp of L.spots) for (const [r, z] of rs) assert.ok(!inter(r, [sp[0] - 0.08, sp[1] - 0.08, sp[0] + 0.08, sp[1] + 0.08], 0) || z === 'reception' || z === 'lounge' || z === 'seats', floor + ' ' + tier + ' spot in ' + z);
      // (compact halls lay their walkways on free floor; the full-size roof keeps its own, as designed)
      if (tier !== 'large') for (const a of L.aisles!) for (const [r] of rs) assert.ok(!inter(a, r, 0.01), floor + ' ' + tier + ' walkway under a thing');
    }
    // The data is still there: one crate per deliverable, panels from the tokens.
    const lob = (out: number) => log(spec('lobby', { floor: 'lobby', tier, out }));
    assert.ok(lob(5).length > lob(0).length, 'crates');
    const roof = (n: number) => log(spec('roof', { floor: 'roof', tier, n }));
    assert.ok(roof(1e6).length > roof(1e3).length, 'solar panels');
    assert.ok(hallPlan('roof', tier)!.slots.length >= 6, 'a roof keeps at least six panel places');
  }
  assert.equal(roomLayout('approval', 'small').size, 12, 'the town hall is a civic hall, always full size');
  assert.equal(roomLayout('platform', 'small').size, 5.2, 'the public places keep their scenes');
});

test('golden: compact rooms (every plan type) and halls, light and dark, draw exactly as recorded', () => {
  const golden = JSON.parse(readFileSync(new URL('./goldens/rooms-compact.json', import.meta.url), 'utf8')) as Record<string, string>;
  const got: Record<string, string> = {};
  for (const tier of ['small', 'medium'] as const) {
    for (const id of ['market', 'archive', 'assembly', 'studio', 'helpdesk', 'salesfloor', 'lobby', 'roof']) for (const night of [false, true]) {
      const s = spec(id, { tier, floor: id === 'lobby' || id === 'roof' ? id : 'library', act: true, frame: 42, night, recent: [...RECENT, { age: 8, err: true }], jobs: 1, n: 120, out: 3 });
      got[id + ':' + tier + (night ? ':dark' : ':light')] = createHash('sha256').update(log(s).join('\n')).digest('hex').slice(0, 16);
    }
  }
  if (process.env.UPDATE_GOLDENS) { writeFileSync(new URL('./goldens/rooms-compact.json', import.meta.url), JSON.stringify(got, null, 2) + '\n'); return; }
  assert.deepEqual(got, golden);
});
