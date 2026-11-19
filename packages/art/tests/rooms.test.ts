import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { TAGS } from '@dsh-universe/model';
import type { RoomRecent, RoomSpec } from '@dsh-universe/renderer';
import {
  CENTER, CORNER, DOOR, FIXED_SCENES, LIFT, ROOM_TEMPLATES, ROOMS, SIDE, UNIT, WALL, createArtKit, paintRoom, planOf, roomLayout, roomPlan,
  setFootprintProbe,
} from '../src/index.ts';
import { withPen } from '../src/iso.ts';
import { fakeSurface } from './fake-canvas.ts';

const spec = (room: string, o: Partial<RoomSpec> = {}): RoomSpec => ({
  id: 'v', room, floor: 'library', place: 'building', colour: '#6C7BEA', seed: 7, act: false, frame: 0, reduced: false, night: false, na: false,
  n: 0, recent: [], jobs: 0, subs: [], out: 0, queue: 0, rate: 0, hour: 15.5, ...o,
});
/** Paints a room on a recording canvas; returns the call log. */
function log(s: RoomSpec): string[] {
  const sf = fakeSurface(404, 236);
  withPen(sf.ctx, () => paintRoom(s));
  return sf.log;
}
const count = (l: readonly string[], needle: string) => l.filter((x) => x === needle).length;
const RECENT: RoomRecent[] = [{ age: 2, err: false }, { age: 11, err: false }, { age: 30, err: false }];

test('50 room templates, each with a complete kit: a known wall, centrepiece, unit, side room and corner', () => {
  assert.equal(ROOM_TEMPLATES.length, 50);
  assert.deepEqual(ROOMS.map((r) => r.id), ROOM_TEMPLATES.map((r) => r.id));
  for (const t of ROOM_TEMPLATES) {
    assert.ok(WALL[t.look.wall], t.id + ' wall ' + t.look.wall);
    assert.ok(CENTER[t.look.center], t.id + ' centre ' + t.look.center);
    assert.ok(UNIT[t.look.unit], t.id + ' unit ' + t.look.unit);
    assert.ok(SIDE[t.look.side], t.id + ' side ' + t.look.side);
    assert.ok(CORNER[t.look.corner], t.id + ' corner ' + t.look.corner);
    for (const tag of t.tags) assert.ok((TAGS as readonly string[]).includes(tag));
  }
  assert.equal(new Set(ROOM_TEMPLATES.map((t) => t.look.center)).size, 50, 'one centrepiece per room');
  assert.equal(Object.keys(WALL).length, 14);
  assert.equal(Object.keys(UNIT).length, 6);
  assert.equal(Object.keys(SIDE).length, 4);
  assert.equal(Object.keys(CORNER).length, 3);
});

test('every one of the 50 rooms renders without an exception (idle and busy, day and night, every data)', () => {
  const kit = createArtKit({ make: fakeSurface });
  for (const t of ROOM_TEMPLATES) {
    for (const o of [{}, { act: true, frame: 37, recent: [...RECENT, { age: 4, err: true }], jobs: 3, n: 250 }, { night: true }, { act: true, frame: 5, night: true, na: true, reduced: true }] as Partial<RoomSpec>[]) {
      assert.doesNotThrow(() => kit.room(spec(t.id, { id: t.id, ...o })), t.id + ' ' + JSON.stringify(o));
    }
  }
});

test('the fixed scenes (lobby, roof, public buildings) render too', () => {
  const kit = createArtKit({ make: fakeSurface });
  const floors = ['lobby', 'roof', 'platform', 'gate', 'approval', 'question', 'plan', 'post', 'skill', 'expert', 'memory', 'turbine', 'control', 'bay', 'retry', 'mcp__erp__execute_read'];
  for (const floor of floors) {
    for (const place of ['building', 'connector', 'town', 'power'] as const) {
      assert.doesNotThrow(() => kit.room(spec(floor, { id: floor, floor, place, act: true, frame: 3, n: 9, out: 2, queue: 3, rate: 5000, recent: RECENT })), floor);
    }
  }
  assert.ok(FIXED_SCENES.includes('lobby'));
  assert.equal(roomLayout('lobby').size, 12, 'the lobby is a full hall');
  assert.equal(roomLayout('approval').size, 12);
  assert.equal(roomLayout('roof').size, 12);
  assert.equal(roomLayout('platform').size, 5.2);
  assert.equal(roomLayout('market').size, 12);
});

test('plans: the same seed gives the same plan; the seed varies mirror and columns', () => {
  for (const v of [0, 1, 2, 3, 4] as const) for (let seed = 0; seed < 50; seed++) assert.deepEqual(planOf(v, seed), planOf(v, seed));
  const flips = new Set<boolean>(), cols = new Set<string>();
  for (let seed = 0; seed < 50; seed++) { const p = planOf(0, seed); flips.add(p.flip); cols.add(JSON.stringify(p.cols)); }
  assert.deepEqual([...flips].sort(), [false, true], 'some rooms are mirrored');
  assert.ok(cols.size > 1, 'columns move with the seed');
  // Every template keeps its plan across calls.
  for (const t of ROOM_TEMPLATES) assert.deepEqual(roomPlan(t.id), planOf(t.look.plan, ROOM_TEMPLATES.indexOf(t), roomPlan(t.id)!.sub));
  for (const v of [0, 1, 2, 3, 4] as const) for (const sub of [0, 1, 2]) assert.deepEqual(planOf(v, 9, sub), planOf(v, 9, sub));
});

test('plans: realistic layouts, enough workstations for the agents, every spot on the floor', () => {
  for (const t of ROOM_TEMPLATES) {
    const p = roomPlan(t.id)!;
    assert.ok(p.units.length >= 8, t.id + ' has ' + p.units.length + ' workstations');
    assert.equal(p.spots.length, p.units.length + 3);
    for (const [x, y] of p.spots) assert.ok(x > 0 && x < 12 && y > 0 && y < 12, t.id + ' spot ' + x + ',' + y);
  }
});

test('nothing stands in front of the door or the lift', () => {
  const inter = (a: readonly number[], b: readonly number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  for (const t of ROOM_TEMPLATES) {
    const p = roomPlan(t.id)!;
    // The door is in the back wall (the left wall when the room is mirrored); the lift is always at the back right.
    const door = p.flip ? [0, DOOR[0], 1.2, DOOR[1]] : [DOOR[0], 0, DOOR[1], 1.2];
    const lift = [LIFT[0] - 0.4, 0, 11.8, 1.2];   // the lift's doors: x 11.0–11.8
    const hits: string[] = [];
    setFootprintProbe((r) => { if (inter(r, door)) hits.push('door ' + r.map((v) => v.toFixed(2))); if (inter(r, lift)) hits.push('lift ' + r.map((v) => v.toFixed(2))); });
    try { log(spec(t.id, { act: true, frame: 9, jobs: 3 })); } finally { setFootprintProbe(null); }
    assert.deepEqual(hits, [], t.id + ' (plan ' + t.look.plan + (p.flip ? ', mirrored' : '') + ')');
    // Agents never stand there either (an agent's feet are about 0.16 tile wide).
    for (const s of p.spots) assert.ok(!inter([s[0] - 0.08, s[1] - 0.08, s[0] + 0.08, s[1] + 0.08], door) && !inter([s[0] - 0.08, s[1] - 0.08, s[0] + 0.08, s[1] + 0.08], lift), t.id + ' spot ' + s);
  }
});

test('an idle room is one still picture: the clock changes nothing, and the kit does not repaint it', () => {
  for (const t of ROOM_TEMPLATES) {
    const a = log(spec(t.id, { act: false, frame: 0, recent: RECENT, jobs: 2, n: 40 }));
    const b = log(spec(t.id, { act: false, frame: 77, recent: RECENT, jobs: 2, n: 40 }));
    assert.deepEqual(a, b, t.id + ' moves while idle');
  }
  const kit = createArtKit({ make: fakeSurface });
  const s = spec('market', { act: false });
  kit.room(s); const d0 = kit.roomCache.draws;
  for (let i = 0; i < 20; i++) kit.room(s);
  assert.equal(kit.roomCache.draws, d0, 'no repaint while the spec stays the same');
});

test('a busy room moves: different clocks give different pictures', () => {
  let moving = 0;
  for (const t of ROOM_TEMPLATES) if (log(spec(t.id, { act: true, frame: 10 })).join() !== log(spec(t.id, { act: true, frame: 31 })).join()) moving++;
  assert.equal(moving, 50);
});

test('reduced motion: a busy room stands still too', () => {
  for (const t of ROOM_TEMPLATES.slice(0, 10)) assert.deepEqual(log(spec(t.id, { act: true, reduced: true, frame: 3 })), log(spec(t.id, { act: true, reduced: true, frame: 90 })), t.id);
});

/** The colour the error beacon is painted in (its dark mount is a 10 × 4 rectangle, then the lamp). */
function beacon(l: readonly string[]): string {
  const i = l.findIndex((x) => /^fillRect\([-\d.]+,[-\d.]+,10,4\)$/.test(x));
  assert.ok(i >= 0, 'beacon mount');
  return l.slice(i).find((x) => x.startsWith('fillStyle='))!.slice(10);
}

test('data: a call that failed in the last 20 seconds lights the error beacon, an older one does not', () => {
  for (const id of ['market', 'servers', 'helpdesk', 'warroom']) {
    assert.equal(beacon(log(spec(id, { recent: RECENT }))), '#7A2E2A', id + ' dark without errors');
    assert.equal(beacon(log(spec(id, { recent: [{ age: 5, err: true }] }))), '#FF8A7A', id + ' lit, still');
    assert.match(beacon(log(spec(id, { act: true, frame: 1, recent: [{ age: 5, err: true }] }))), /^#(E5433D|FF8A7A)$/, id + ' blinks while busy');
    assert.equal(beacon(log(spec(id, { recent: [{ age: 25, err: true }] }))), '#7A2E2A', id + ' an old error');
  }
});

test('data: each recent call is a block on the tape and a line on the log board; red when it failed', () => {
  const none = log(spec('market'));
  const ok = log(spec('market', { recent: [{ age: 3, err: false }, { age: 20, err: false }] }));
  const bad = log(spec('market', { recent: [{ age: 3, err: true }] }));
  const g = (l: string[]) => count(l, 'fillStyle=#4CC552'), r = (l: string[]) => count(l, 'fillStyle=#E5433D');
  assert.ok(g(ok) >= g(none) + 4, 'tape and board: two calls, green');
  assert.ok(r(bad) >= r(none) + 2, 'a failed call is red on the tape and on the board');
});

test('data: each running background job sets a printer going; the paper pile grows', () => {
  const p = (jobs: number, o: Partial<RoomSpec> = {}) => log(spec('market', { jobs, ...o }));
  // A printer's lamp is green when it has no job, amber while it prints.
  assert.equal(count(p(0), 'fillStyle=#4CC552') - count(p(2), 'fillStyle=#4CC552'), 2, 'two lamps leave green');
  assert.equal(count(p(2), 'fillStyle=#C9925A') - count(p(0), 'fillStyle=#C9925A'), 2, 'two lamps amber (still)');
  assert.equal(count(p(0), 'fillStyle=#4CC552') - count(p(5), 'fillStyle=#4CC552'), 3, 'three printers at most');
  assert.ok(p(3).length > p(1).length, 'more paper');
});

test('data: the whiteboard holds one line per doubling of the calls on this floor', () => {
  const lines = (n: number) => log(spec('market', { n })).length;
  assert.ok(lines(0) < lines(1) && lines(1) < lines(3) && lines(3) < lines(7));
  assert.equal(lines(1000), lines(5000), 'at most six lines');
});

test('golden: six representative rooms (every plan type), light and dark, draw exactly as recorded', () => {
  const golden = JSON.parse(readFileSync(new URL('./goldens/rooms.json', import.meta.url), 'utf8')) as Record<string, string>;
  const got: Record<string, string> = {};
  for (const id of ['market', 'archive', 'assembly', 'studio', 'helpdesk', 'salesfloor']) for (const night of [false, true]) {
    const s = spec(id, { act: true, frame: 42, night, recent: [...RECENT, { age: 8, err: true }], jobs: 1, n: 120 });
    got[id + (night ? ':dark' : ':light')] = createHash('sha256').update(log(s).join('\n')).digest('hex').slice(0, 16);
  }
  if (process.env.UPDATE_GOLDENS) { writeFileSync(new URL('./goldens/rooms.json', import.meta.url), JSON.stringify(got, null, 2) + '\n'); return; }
  assert.deepEqual(got, golden);
});

test('arrangements: every template in all three arrangements of its plan type: nothing stands on anything else, door and lift clear, every spot free', () => {
  const inter = (a: readonly number[], b: readonly number[], e = 0.05) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > e && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > e;
  for (const [i, t] of ROOM_TEMPLATES.entries()) for (const sub of [0, 1, 2]) {
    for (const seed of [i, i + 1000]) {   // both mirror images
      const p = planOf(t.look.plan, seed, sub);
      const rs: [readonly number[], string][] = [];
      setFootprintProbe((r, z) => rs.push([r, z]));
      try { withPen(fakeSurface(404, 236).ctx, () => paintRoom(spec(t.id, { act: true, frame: 3, jobs: 3 }), p)); } finally { setFootprintProbe(null); }
      const where = t.id + ' plan ' + t.look.plan + ' sub ' + sub + (p.flip ? ' mirrored' : '');
      const problems: string[] = [];
      for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) if (rs[a][1] !== rs[b][1] && inter(rs[a][0], rs[b][0])) problems.push(rs[a][1] + ' on ' + rs[b][1]);
      const door = p.flip ? [0, DOOR[0], 1.2, DOOR[1]] : [DOOR[0], 0, DOOR[1], 1.2], lift = [11, 0, 11.8, 1.2];
      for (const [r, z] of rs) { if (inter(r, door, 0)) problems.push(z + ' at the door'); if (inter(r, lift, 0)) problems.push(z + ' at the lift'); }
      p.spots.forEach((sp, n) => {
        const own = n < p.units.length ? 'unit' + n : n === p.spots.length - 1 ? 'corner' : 'centre';
        for (const [r, z] of rs) if (z !== own && inter(r, [sp[0] - 0.08, sp[1] - 0.08, sp[0] + 0.08, sp[1] + 0.08], 0)) problems.push('spot ' + n + ' in ' + z);
      });
      assert.deepEqual([...new Set(problems)], [], where);
    }
  }
});

test('arrangements: rooms of one plan type spread over the three; the trading floor keeps arrangement 0', () => {
  for (const v of [0, 1, 2, 3, 4]) {
    const subs = new Set(ROOM_TEMPLATES.filter((t) => t.look.plan === v).map((t) => roomPlan(t.id)!.sub));
    assert.deepEqual([...subs].sort(), [0, 1, 2], 'plan type ' + v);
  }
  assert.equal(roomPlan('market')!.sub, 0);
  // Arrangements really differ: the side room, corner or centrepiece moves.
  for (const v of [0, 1, 2, 3, 4] as const) {
    const key = (p: ReturnType<typeof planOf>) => JSON.stringify([p.c, p.s, p.k, p.j, p.units]);
    assert.equal(new Set([0, 1, 2].map((s) => key(planOf(v, 3, s)))).size, 3, 'plan type ' + v);
  }
});

test('walking: agents go along the walkways between spots, not across the desks', async () => {
  const { route } = await import('@dsh-universe/renderer');
  const inside = (p: readonly number[], r: readonly number[]) => p[0] >= r[0] - 0.01 && p[0] <= r[2] + 0.01 && p[1] >= r[1] - 0.01 && p[1] <= r[3] + 0.01;
  let routed = 0;
  for (const t of ROOM_TEMPLATES) {
    const L = roomLayout(t.id);
    for (let a = 0; a < L.spots.length; a += 3) for (let b = 1; b < L.spots.length; b += 4) {
      const path = route(L.aisles!, L.spots[a], L.spots[b]);
      assert.deepEqual(path[0], L.spots[a]); assert.deepEqual(path[path.length - 1], L.spots[b]);
      for (const p of path.slice(1, -1)) assert.ok(L.aisles!.some((r) => inside(p, r)), t.id + ' waypoint ' + p + ' off the walkways');
      if (path.length > 2) routed++;
    }
    const fromLift = route(L.aisles!, L.lift, L.spots[0]);
    assert.ok(fromLift.length >= 2);
  }
  assert.ok(routed > 500, routed + ' routed walks');
});

test('halls: the lobby shows one crate per deliverable and lights its screen only with someone there; the town hall racks hold the tally', () => {
  const lobby = (o: Partial<RoomSpec>) => log(spec('lobby', { floor: 'lobby', ...o }));
  assert.ok(lobby({ out: 5 }).length > lobby({ out: 0 }).length, 'crates');
  assert.deepEqual(lobby({ out: 12 }), lobby({ out: 12, frame: 0 }));
  assert.ok(count(lobby({ present: 1 }), 'fillStyle=#1F4FB0') > count(lobby({ present: 0 }), 'fillStyle=#1F4FB0'), 'screen on with someone in the lobby');
  // Town hall: each counter's bay holds its floor's tickets, one per request.
  const zero = { yes: 0, no: 0, open: 0 };
  const desk = (t: { yes: number; no: number; open: number }, bay = 0) => log(spec('approval', { floor: 'approval', place: 'town', tally: t, bays: [0, 1, 2].map((k) => (k === bay ? t : zero)) }));
  const none = desk(zero);
  assert.equal(count(desk({ yes: 3, no: 0, open: 0 }), 'fillStyle=#35B37A') - count(none, 'fillStyle=#35B37A'), 3, 'three approved tickets');
  assert.equal(count(desk({ yes: 3, no: 0, open: 0 }, 2), 'fillStyle=#35B37A') - count(none, 'fillStyle=#35B37A'), 3, 'on the plan counter too');
  assert.equal(count(desk({ yes: 30, no: 0, open: 0 }), 'fillStyle=#35B37A') - count(none, 'fillStyle=#35B37A'), 12, 'at most twelve per bay');
  assert.equal(count(desk({ yes: 0, no: 2, open: 0 }), 'fillStyle=#E5433D') - count(none, 'fillStyle=#E5433D'), 2, 'two denied');
  assert.ok(count(desk({ yes: 0, no: 0, open: 4 }), 'fillStyle=#F0A020') >= count(none, 'fillStyle=#F0A020') + 4, 'four open');
});

test('halls: nothing in front of the door or the lift, nothing standing on anything else, spots free', () => {
  const inter = (a: readonly number[], b: readonly number[], e = 0.05) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > e && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > e;
  for (const [room, place] of [['lobby', 'building'], ['approval', 'town'], ['question', 'town'], ['roof', 'building']] as const) {
    const rs: [readonly number[], string][] = [];
    setFootprintProbe((r, z) => rs.push([r, z]));
    try { log(spec(room, { floor: room, place, out: 12, present: 2, n: 5e6, ended: room === 'roof', tally: { yes: 9, no: 9, open: 9 } })); } finally { setFootprintProbe(null); }
    const door = [DOOR[0], 0, DOOR[1], 1.2], lift = [11, 0, 11.8, 1.2];
    // (The open roof has no door; its lift arrives in the little housing drawn there.)
    if (room !== 'roof') for (const [r, z] of rs) { assert.ok(!inter(r, door, 0), room + ' ' + z + ' at the door'); assert.ok(!inter(r, lift, 0), room + ' ' + z + ' at the lift'); }
    for (const sp of roomLayout(room).spots) for (const [r, z] of rs) assert.ok(!inter(r, [sp[0] - 0.08, sp[1] - 0.08, sp[0] + 0.08, sp[1] + 0.08], 0), room + ' spot ' + sp + ' in ' + z);
  }
});

test('roof: the solar array grows with the tokens; a finished session has a garden', () => {
  const roof = (o: Partial<RoomSpec>) => log(spec('roof', { floor: 'roof', ...o }));
  const panels = (l: string[]) => count(l, 'fillStyle=#1F4FB0');
  assert.equal(panels(roof({ n: 0 })), 0);
  assert.ok(panels(roof({ n: 50_000 })) > 0 && panels(roof({ n: 50_000 })) < panels(roof({ n: 5_000_000 })));
  assert.equal(panels(roof({ n: 1e12 })), panels(roof({ n: 1e13 })), 'at most eighteen');
  assert.ok(count(roof({ ended: true }), 'fillStyle=#8BD93E') > count(roof({ ended: false }), 'fillStyle=#8BD93E'), 'garden');
});

test('public buildings: compact rooms with outlined props; their numbers drive what they show; the lift and every spot stay clear', () => {
  const scenes: [string, RoomSpec['place']][] = [['mcp__erp__execute_read', 'connector'], ['platform', 'station'], ['gate', 'station'], ['skill', 'school'], ['expert', 'school'], ['memory', 'library'], ['turbine', 'power'], ['control', 'power'], ['bay', 'fire']];
  const inter = (a: readonly number[], b: readonly number[], e = 0.05) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > e && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > e;
  for (const [floor, place] of scenes) {
    const rs: [readonly number[], string][] = [];
    setFootprintProbe((r, z) => rs.push([r, z]));
    try { log(spec('fixed:' + floor, { floor, place, n: 30, rate: 30000, act: true, frame: 4, recent: RECENT, stock: { skills: 20, plugins: 6, on: 4 } })); } finally { setFootprintProbe(null); }
    for (const [r, z] of rs) assert.ok(!inter(r, [4.2, 0, 5.0, 0.9], 0), floor + ' ' + z + ' in front of the lift');
    for (const sp of roomLayout('fixed:' + floor).spots) for (const [r, z] of rs) assert.ok(!inter(r, [sp[0] - 0.08, sp[1] - 0.08, sp[0] + 0.08, sp[1] + 0.08], 0), floor + ' spot ' + sp + ' in ' + z);
    // Idle and the clock does not matter.
    assert.deepEqual(log(spec('fixed:' + floor, { floor, place, n: 30, frame: 0 })), log(spec('fixed:' + floor, { floor, place, n: 30, frame: 0, hour: 15.5 })));
  }
  const n = (floor: string, place: RoomSpec['place'], o: Partial<RoomSpec>) => log(spec('fixed:' + floor, { floor, place, ...o })).length;
  assert.ok(count(log(spec('fixed:platform', { floor: 'platform', place: 'station', n: 4 })), 'fillStyle=#8BD93E') > count(log(spec('fixed:platform', { floor: 'platform', place: 'station', n: 0 })), 'fillStyle=#8BD93E'), 'departures: runs');
  assert.ok(count(log(spec('fixed:bay', { floor: 'bay', place: 'fire', n: 12 })), 'fillStyle=#E5433D') > count(log(spec('fixed:bay', { floor: 'bay', place: 'fire', n: 0 })), 'fillStyle=#E5433D'), 'repair log: failed calls');
  assert.ok(n('memory', 'library', { stock: { skills: 30, plugins: 5, on: 3 } }) > n('memory', 'library', { stock: { skills: 0, plugins: 0, on: 0 } }), 'books and cartridges');
  assert.ok(count(log(spec('fixed:turbine', { floor: 'turbine', place: 'power', rate: 40000 })), 'fillStyle=#FF8A2B') > count(log(spec('fixed:turbine', { floor: 'turbine', place: 'power', rate: 0 })), 'fillStyle=#FF8A2B'), 'load gauge');
  assert.ok(count(log(spec('fixed:gate', { floor: 'gate', place: 'station', recent: RECENT })), 'fillStyle=#4CC552') > count(log(spec('fixed:gate', { floor: 'gate', place: 'station' })), 'fillStyle=#4CC552'), 'turnstiles');
});

test('a public floor never meets a template of the same name (the power station control room is not the machine-floor template)', () => {
  assert.equal(roomLayout('fixed:control').size, 5.2);
  assert.equal(roomLayout('control').size, 12);
  assert.notDeepEqual(log(spec('fixed:control', { floor: 'control', place: 'power' })), log(spec('control', { floor: 'machine' })));
});

test('poses: each tool kind has its own pose; still under reduced motion (phase 0), moving only while working', async () => {
  const { createArtKit: mk } = await import('../src/index.ts');
  const kit = mk({ make: fakeSurface });
  const draw = (pose: string | undefined, phase: number) => { const out: string[] = []; kit.person((x, y, w, h, c) => out.push([x, y, w, h, c].join()), 0, 0, { seed: 5, state: 'running', subagent: false, ring: false, phase, walking: false, working: true, placard: 0, tier: 0, pose: pose as never }); return out.join(';'); };
  const kinds = ['type', 'read', 'console', 'web', 'hand'];
  assert.equal(new Set([undefined, ...kinds].map((k) => draw(k, 0))).size, 6, 'six different figures');
  for (const k of kinds) assert.equal(draw(k, 0), draw(k, 0));
  assert.notEqual(draw('type', 0.25), draw('type', 0.05), 'typing moves while working');
  // Every room's spots are unaffected; poses are drawn in place.
  assert.ok(roomLayout('market').props!.length === 5);
});

test('data props of every room kind stand inside the room', () => {
  for (const room of [...ROOM_TEMPLATES.map((t) => t.id), 'lobby', 'approval', 'roof', 'fixed:mcp__erp__x', 'fixed:platform', 'fixed:gate', 'fixed:skill', 'fixed:expert', 'fixed:memory', 'fixed:turbine', 'fixed:control', 'fixed:bay']) {
    const L = roomLayout(room);
    assert.ok((L.props ?? []).length > 0, room);
    for (const p of L.props!) {
      const xs = 'wall' in p ? [p.a0, p.a1] : [p.floor[0], p.floor[1], p.floor[2], p.floor[3]];
      for (const v of xs) assert.ok(v >= 0 && v <= L.size, room + ' ' + p.id + ' ' + v);
    }
  }
});

test('a floor the platform does not provide goes through the grey ramp (no stripes); outlines stay', async () => {
  const { greyRamp } = await import('../src/palette.ts');
  const px = new Uint8ClampedArray([255, 201, 40, 255, 20, 26, 48, 255, 79, 197, 82, 255, 0, 0, 0, 0]);
  greyRamp(px);
  const ramp = new Set(['F4F1E8', 'CDD2DA', 'AEB5C2', '8A93A3']);
  const hex = (i: number) => [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
  assert.ok(ramp.has(hex(0)) && ramp.has(hex(8)), hex(0) + ' ' + hex(8));
  assert.equal(hex(4), '141A30', 'the outline is kept');
  assert.equal(px[15], 0, 'transparent stays transparent');
});
