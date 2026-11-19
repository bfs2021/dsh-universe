import test from 'node:test';
import assert from 'node:assert/strict';
import { cityTemplate, createStore, emptyPlacement, freezeTheme, place, type PlacementState, type RoomInfo, type UCapabilities, type UEvent } from '@dsh-universe/model';
import {
  POSE_OF, RoomView, createStubKit, defaultFloor, interiorOf, placeKind, roomSpecOf, shortTool, type ArtKit, type InteriorInput, type PersonSpec,
} from '../src/index.ts';
import { fakeSurface } from './fake-canvas.ts';

const DAY = new Date(2026, 10, 18).getTime();
const at = (h: number, m = 0, s = 0) => DAY + ((h * 60 + m) * 60 + s) * 1000;
const CAPS: UCapabilities = {
  approvals: true, schedules: true, subagents: true, jobs: true, deliverables: true, skills: true, memory: false, tokens: true, cost: false, latency: true,
  sessionTitles: true, actions: { openSession: true, draftFollowUp: true },
};
/** A catalog with several templates per floor kind (tags decide). */
const CATALOG: RoomInfo[] = [
  { id: 'market', tags: ['finance'], floors: ['library'] }, { id: 'archive', tags: ['docs'], floors: ['library'] },
  { id: 'sheets', tags: ['finance'], floors: ['workshop'] }, { id: 'writers', tags: ['docs'], floors: ['workshop'] },
  { id: 'servers', tags: ['code'], floors: ['machine'] }, { id: 'counting', tags: ['finance'], floors: ['machine'] },
  { id: 'boardroom', tags: ['finance'], floors: ['meeting'] }, { id: 'standup', tags: ['code'], floors: ['meeting'] },
];

/** One session: reading at 10:00, then editing; a subagent; a job; a failed call at 10:30:50. */
function day(): UEvent[] {
  const ev: UEvent[] = [{ type: 'workspace', data: { id: 'w', title: 'W', displayPath: 'w' } }];
  ev.push({ type: 'agent', data: { id: 'a', sessionId: 's1', workspaceId: 'w', label: 'secret title', kind: 'main', state: 'running', startedAt: at(10) } });
  ev.push({ type: 'turn', data: { t: at(10), agentId: 'a', phase: 'start' } });
  for (let k = 0; k < 30; k++) ev.push({ type: 'activity', data: { id: 'r' + k, t: at(10, 0, k * 10), agentId: 'a', category: 'read', tool: 'read' } });
  for (let k = 0; k < 6; k++) ev.push({ type: 'activity', data: { id: 'e' + k, t: at(10, 30, k * 10), agentId: 'a', category: 'edit', tool: 'edit', ok: k !== 5 } });
  ev.push({ type: 'agent', data: { id: 'b', sessionId: 's1b', parentAgentId: 'a', workspaceId: 'w', label: 'sub', kind: 'subagent', state: 'running', startedAt: at(10, 5) } });
  ev.push({ type: 'turn', data: { t: at(10, 5), agentId: 'b', phase: 'start' } });
  ev.push({ type: 'activity', data: { id: 'b1', t: at(10, 30, 40), agentId: 'b', category: 'exec', tool: 'mcp__shell__bash' } });
  ev.push({ type: 'job', data: { id: 'j', agentId: 'a', kind: 'bash', startedAt: at(10, 20) } as never });
  return ev;
}
function input(T = at(10, 31), o: Partial<InteriorInput> = {}, ev = day()): InteriorInput {
  const store = createStore(); store.applyAll(ev);
  let placement: PlacementState = place(cityTemplate(), emptyPlacement(), [{ sessionId: 's1', workspaceId: 'w', startedAt: at(10) }]).state;
  placement = freezeTheme(placement, 's1', 'finance');
  return { store, placement, T, placeId: 'b:s1', catalog: CATALOG, caps: CAPS, ...o };
}

test('interior: floors bottom first, a template per room floor from the frozen theme, none twice', () => {
  const it = interiorOf(input());
  assert.equal(it.place, 'building');
  assert.deepEqual(it.floors.map((f) => f.id), ['lobby', 'library', 'workshop', 'machine', 'roof'], 'only floors with work');
  assert.deepEqual(it.floors.map((f) => f.room), ['fixed:lobby', 'market', 'sheets', 'counting', 'fixed:roof'], 'finance theme');
  assert.equal(it.rooms.meeting, 'boardroom', 'chosen before the floor exists, so it never changes');
  const rooms = it.floors.filter((f) => f.template).map((f) => f.room);
  assert.equal(new Set(rooms).size, rooms.length, 'no room twice in a building');
  // Rooms come from the frozen theme id only: the title is never read.
  const other = input(); other.store.apply({ type: 'agent', data: { id: 'a', sessionId: 's1', workspaceId: 'w', label: 'code code code script bug', kind: 'main', state: 'running', startedAt: at(10) } });
  assert.deepEqual(interiorOf(other).rooms, it.rooms);
});

test('interior: a building never repeats a room, whatever its theme and seed', () => {
  for (let i = 0; i < 60; i++) {
    const ev = day().map((e) => (e.type === 'agent' && e.data.id === 'a' ? { ...e, data: { ...e.data, sessionId: 'x' + i } } : e));
    let placement = place(cityTemplate(), emptyPlacement(), [{ sessionId: 'x' + i, workspaceId: 'w', startedAt: at(10) }]).state;
    placement = freezeTheme(placement, 'x' + i, (['finance', 'code', 'docs', 'neutral'] as const)[i % 4] as never);
    const it = interiorOf({ ...input(at(10, 31), {}, ev), placement, placeId: 'b:x' + i });
    const ids = Object.values(it.rooms);
    assert.equal(ids.length, 4);
    assert.equal(new Set(ids).size, 4);
  }
});

test('interior: agents only from data; recent calls, jobs and errors per floor', () => {
  const it = interiorOf(input());
  const lib = it.floors.find((f) => f.id === 'library')!, ws = it.floors.find((f) => f.id === 'workshop')!, mach = it.floors.find((f) => f.id === 'machine')!;
  assert.deepEqual(ws.people.map((p) => p.id), ['a'], 'the agent is where its latest call is');
  assert.deepEqual(mach.people.map((p) => p.id), ['b']);
  assert.equal(lib.people.length, 0);
  assert.equal(it.floors.reduce((a, f) => a + f.people.length, 0), 2, 'two agents, two people');
  assert.equal(ws.recent.length, 5, 'edits of the last minute (the one 60 s ago is out)');
  assert.deepEqual(ws.recent[0], { age: 10, err: true }, 'newest first, the failed one is marked');
  assert.equal(ws.errors, 1);
  assert.equal(lib.recent.length, 0, 'reading stopped half an hour ago');
  assert.equal(ws.jobs, 1, 'running jobs on every room floor');
  assert.equal(ws.people[0].tool, 'edit');
  assert.equal(shortTool('mcp__shell__bash'), 'bash');
  assert.equal(defaultFloor(it), 'workshop', 'most people (tie: the lowest)');
});

test('room spec: an idle floor is still, a busy one runs; data maps one to one', () => {
  const it = interiorOf(input());
  const lib = it.floors.find((f) => f.id === 'library')!, ws = it.floors.find((f) => f.id === 'workshop')!;
  const idle = roomSpecOf(it, lib, { time: 12.34, reduced: false, night: false, T: at(10, 31) });
  assert.equal(idle.act, false);
  assert.equal(idle.frame, 0, 'no clock in an idle room');
  const busy = roomSpecOf(it, ws, { time: 12.34, reduced: false, night: true, T: at(10, 31) });
  assert.equal(busy.act, true);
  assert.equal(busy.frame, 123);
  assert.equal(busy.jobs, 1);
  assert.equal(busy.n, 6);
  assert.deepEqual(busy.recent.filter((r) => r.err), [{ age: 10, err: true }]);
  assert.equal(busy.hour, 10 + 31 / 60);
  assert.equal(roomSpecOf(it, ws, { time: 12.34, reduced: true, night: false, T: at(10, 31) }).frame, 0, 'reduced motion: still');
  // Only metadata: nothing in the spec carries a title.
  assert.ok(!JSON.stringify(busy).includes('secret'));
  assert.equal(placeKind('conn:erp'), 'connector');
  assert.equal(placeKind('model:x'), 'power');
  assert.equal(placeKind('town'), 'town');
});

test('interior: public places have their fixed floors and move only with calls', () => {
  const ev: UEvent[] = [...day(), { type: 'activity', data: { id: 'w1', t: at(10, 30, 55), agentId: 'a', category: 'web', tool: 'web_fetch' } }, { type: 'turn', data: { t: at(10, 32), agentId: 'a', phase: 'end', reason: 'other' } }];
  const it = interiorOf(input(at(10, 31), { placeId: 'station' }, ev));
  assert.deepEqual(it.floors.map((f) => f.id), ['platform', 'gate']);
  const gate = it.floors[1];
  assert.equal(gate.recent.length, 1);
  assert.equal(gate.act, true);
  assert.equal(interiorOf(input(at(12), { placeId: 'station' }, ev)).floors[1].act, false, 'an hour later it is still');
});

test('interior: ?room=<id> shows that template on its floor (dev and mock mode)', () => {
  const it = interiorOf(input(at(10, 31), { override: { floor: 'library', room: 'archive' } }));
  assert.equal(it.floors.find((f) => f.id === 'library')!.room, 'archive');
});

function harness(kit: ArtKit, rm = false) {
  const cv = fakeSurface(1280, 760);
  const frames: ((t: number) => void)[] = [];
  const people: PersonSpec[] = [];
  const k: ArtKit = { ...kit, person: (px, X, Y, s) => { people.push(s); kit.person(px, X, Y, s); } };
  let rooms = 0;
  const k2: ArtKit = { ...k, room: (s, p) => { rooms++; return kit.room(s, p); } };
  const view = new RoomView({
    kit: k2, canvas: { width: 1280, height: 760, getContext: () => cv.ctx } as never, reducedMotion: () => rm,
    raf: (fn) => { frames.push(fn); return frames.length; }, cancelRaf: () => {}, clock: () => 0,
    artBuffer: () => { const s = fakeSurface(2, 2); return { canvas: { width: 2, height: 2 }, ctx: s.ctx as never }; },
  });
  view.resize(1280, 760, 1);
  const run = (ms: number, t0 = 0, step = 1000 / 60) => { let n = 0; for (let t = t0; t <= t0 + ms; t += step) { const f = frames.shift(); if (!f) break; f(t); n++; } return n; };
  return { view, run, people, rooms: () => rooms, pending: () => frames.length, cv };
}

test('room view: an idle floor paints once and stops (no animation frames)', () => {
  const h = harness(createStubKit(fakeSurface));
  const it = interiorOf(input(at(12)));   // long after: nobody works
  h.view.start();
  h.view.setInput({ interior: it, floor: 'library', T: at(12) });
  h.run(3000);
  assert.equal(h.view.animated, false);
  assert.equal(h.pending(), 0, 'the frame loop stopped');
  const f0 = h.view.stats().frames;
  assert.ok(f0 <= 30, f0 + ' frames: only the entry fade');
  assert.equal(h.rooms(), 1, 'the room itself was painted once');
  h.view.invalidate(); h.run(1000);
  assert.equal(h.view.stats().frames, f0 + 1, 'one repaint on request, then still again');
  assert.equal(h.pending(), 0);
});

test('room view: people are exactly the agents on the floor; a busy floor keeps animating', () => {
  const h = harness(createStubKit(fakeSurface));
  const it = interiorOf(input());
  h.view.start();
  h.view.setInput({ interior: it, floor: 'workshop', T: at(10, 31) });
  h.run(2000);
  assert.equal(h.view.animated, true);
  assert.ok(h.pending() > 0);
  const last = h.people.slice(-1);
  assert.equal(last.length, 1);
  assert.equal(last[0].state, 'running');
  assert.equal(h.view.hits.length, 1);
  const [x0, y0, x1, y1] = h.view.hits[0].r;
  assert.equal(h.view.hitAt((x0 + x1) / 2, (y0 + y1) / 2), 'a');
  assert.ok(h.cv.log.some((l) => l.startsWith('fillText(edit')), 'its tool over its head, drawn as text at screen resolution');
});

test('room view: reduced motion: no fade, no walking, at most two frames a second', () => {
  const h = harness(createStubKit(fakeSurface), true);
  const it = interiorOf(input());
  h.view.start();
  h.view.setInput({ interior: it, floor: 'workshop', T: at(10, 31) });
  h.run(3000);
  assert.equal(h.view.animated, false);
  const n = h.view.stats().frames;
  assert.ok(n >= 1 && n <= 2, n + ' frames in 3 s');
  for (let i = 0; i < 6; i++) { h.view.invalidate(); h.run(250, 3000 + i * 250); }
  assert.ok(h.view.stats().frames - n <= 4, 'at most two frames a second while asked every 250 ms');
  assert.ok(!h.cv.log.some((l) => /^globalAlpha=0\.\d/.test(l)), 'no fade');
});

test('room view: entering fades in; newcomers step out of the lift', () => {
  const h = harness(createStubKit(fakeSurface));
  const it = interiorOf(input());
  h.view.start();
  h.view.setInput({ interior: it, floor: 'workshop', T: at(10, 31) });
  h.run(50);
  assert.ok(h.cv.log.some((l) => /^globalAlpha=0\.\d/.test(l)), 'fading in');
  h.run(1000, 100);
  assert.ok(h.cv.log.slice(-200).some((l) => l === 'globalAlpha=1'));
});

test('room view: the floor stack lists every floor (wide); labels for the floor buttons', () => {
  const h = harness(createStubKit(fakeSurface));
  const it = interiorOf(input());
  h.view.start();
  h.view.setInput({ interior: it, floor: 'library', T: at(10, 31) });
  h.run(100);
  assert.equal(h.view.geometry.wide, true);
  assert.equal(h.view.geometry.labels.length, it.floors.length);
  assert.ok(h.view.geometry.labels[0][1] > h.view.geometry.labels[1][1], 'bottom floor lowest');
});

test('room view: leaving fades out, then hands back to the city; reduced motion leaves at once', () => {
  const h = harness(createStubKit(fakeSurface));
  h.view.start();
  h.view.setInput({ interior: interiorOf(input(at(12))), floor: 'library', T: at(12) });
  h.run(1000);
  let left = 0;
  h.view.leave(() => left++);
  assert.equal(left, 0);
  h.run(1000, 2000);
  assert.equal(left, 1);
  assert.equal(h.pending(), 0, 'stopped');
  const r = harness(createStubKit(fakeSurface), true);
  r.view.start();
  r.view.setInput({ interior: interiorOf(input(at(12))), floor: 'library', T: at(12) });
  let now = 0;
  r.view.leave(() => now++);
  assert.equal(now, 1);
});

test('room view: on a 390 px phone a 12×12 room is drawn at 2× (or more) in whole device pixels, filling the width, and drags', () => {
  for (const dpr of [1, 2, 3]) {
    const h = harness(createStubKit(fakeSurface));
    h.view.resize(390, 760, dpr);
    h.view.start();
    h.view.setInput({ interior: interiorOf(input()), floor: 'workshop', T: at(10, 31) });
    h.run(100);
    const g = h.view.geometry, left = g.x + (202 - 192 - 1) * g.zoom, right = left + 386 * g.zoom;
    assert.ok(g.zoom >= 2, `dpr ${dpr}: zoom ${g.zoom}`);
    assert.ok(left <= 1 && right >= 389, `dpr ${dpr}: the room covers the width (${left}–${right})`);
    assert.equal((g.zoom * dpr) % 1, 0, 'whole device pixels');
    assert.equal(g.wide, false);
    // Dragging moves it, never past its edges.
    h.view.panBy(-5000, 0); h.run(50);
    const g2 = h.view.geometry, r2 = g2.x + (202 - 192 - 1 + 386) * g2.zoom;
    assert.ok(g2.x < g.x && Math.abs(r2 - 389) <= 1, `dpr ${dpr}: dragged to the right edge (${r2})`);
  }
});

test('interior: fixed scenes without data of their own are marked as illustrations; rooms are not', () => {
  const it = interiorOf(input());
  assert.deepEqual(it.floors.filter((f) => f.illustrative).map((f) => f.id), []);
  const fire = interiorOf(input(at(10, 31), { placeId: 'fire' })).floors;
  assert.equal(fire.find((f) => f.id === 'bay')!.illustrative, false, 'the repair log counts failed calls');
  assert.equal(fire.find((f) => f.id === 'retry')!.illustrative, false, 'the repair log floor counts model retries');
  const st = interiorOf(input(at(10, 31), { placeId: 'school' }));
  assert.equal(st.floors.find((f) => f.id === 'skill')!.illustrative, false, 'the classroom counts skill loads');
});

test('interior: a building of an earlier day opens as it ended (its kept floors, nobody inside, still)', () => {
  const o = input();
  const placement = { ...place(cityTemplate(), o.placement, [{ sessionId: 'old', workspaceId: 'w', startedAt: at(9) - 86_400_000 }]).state };
  placement.sizes = { old: { calls: { library: 40, machine: 5 }, tokens: 12000, state: 'done', started: at(9) - 86_400_000 } };
  const it = interiorOf({ ...o, placement, placeId: 'b:old' });
  assert.equal(it.past, true);
  assert.deepEqual(it.floors.map((f) => [f.id, f.n]), [['lobby', 0], ['library', 40], ['machine', 5], ['roof', 12000]]);
  assert.ok(it.floors.every((f) => f.people.length === 0 && !f.act));
  assert.ok(it.floors.find((f) => f.id === 'library')!.template);
});

test('entering a building with nobody inside opens the room where most of its work was done', () => {
  const it = interiorOf(input(at(10, 31)));
  for (const f of it.floors) f.people = [];
  assert.equal(defaultFloor(it), 'library', '30 reads beat 6 edits');
});

test('tool placards of agents close together do not cover each other; the front one keeps its place', async () => {
  const { unstack } = await import('../src/room.ts');
  const cv = fakeSurface(10, 10);
  const out = unstack(cv.ctx as never, [
    { x: 100, y: 100, text: 'read', bg: '#000', fg: '#FFF', small: true, depth: 5 },
    { x: 104, y: 98, text: 'grep', bg: '#000', fg: '#FFF', small: true, depth: 3 },
    { x: 400, y: 100, text: 'edit', bg: '#000', fg: '#FFF', small: true, depth: 1 },
  ], 1, 1);
  const front = out.find((p) => p.text === 'read')!, back = out.find((p) => p.text === 'grep')!, far = out.find((p) => p.text === 'edit')!;
  assert.equal(front.y, 100);
  assert.ok(back.y <= 100 - 15, 'moved above the front one: ' + back.y);
  assert.equal(far.y, 100, 'far away: unchanged');
});

test('town hall: nobody is drawn inside; waiting agents stand only in the square', () => {
  const ev: UEvent[] = [...day(), { type: 'approval', data: { id: 'q', agentId: 'a', kind: 'approval', askedAt: at(10, 30, 55) } } as UEvent];
  const it = interiorOf(input(at(10, 31), { placeId: 'town' }, ev));
  assert.equal(it.floors.find((f) => f.id === 'approval')!.n, 1, 'the count is there');
  assert.ok(it.floors.every((f) => f.people.length === 0));
});

test('changing floors: a short lift slide (about 150 ms), then still; reduced motion cuts at once', () => {
  const h = harness(createStubKit(fakeSurface));
  const it = interiorOf(input(at(12)));
  h.view.start();
  h.view.setInput({ interior: it, floor: 'library', T: at(12) });
  h.run(1000);
  const before = h.cv.log.length;
  h.view.setInput({ interior: it, floor: 'roof', T: at(12) });
  const n = h.run(1000, 2000);
  const slid = h.cv.log.slice(before).filter((l) => /^globalAlpha=0\.\d/.test(l)).length;
  assert.ok(slid >= 4, slid + ' sliding frames');
  assert.ok(n <= 14, 'over in about 150 ms: ' + n + ' frames');
  assert.equal(h.pending(), 0, 'then still');
  const r = harness(createStubKit(fakeSurface), true);
  r.view.start();
  r.view.setInput({ interior: it, floor: 'library', T: at(12) });
  r.run(1000);
  const b2 = r.cv.log.length;
  r.view.setInput({ interior: it, floor: 'roof', T: at(12) });
  r.run(1000, 2000);
  assert.ok(!r.cv.log.slice(b2).some((l) => /^globalAlpha=0\.\d/.test(l)), 'hard cut');
});

test('poses come from the latest call: editing types, reading reads, a shell is at the console', () => {
  assert.equal(POSE_OF.edit, 'type'); assert.equal(POSE_OF.read, 'read'); assert.equal(POSE_OF.exec, 'console'); assert.equal(POSE_OF.web, 'web'); assert.equal(POSE_OF.delegate, 'hand');
  const it = interiorOf(input());
  assert.equal(it.floors.find((f) => f.id === 'workshop')!.people[0].category, 'edit');
  const h = harness(createStubKit(fakeSurface));
  h.view.start();
  h.view.setInput({ interior: it, floor: 'workshop', T: at(10, 31) });
  h.run(2000);
  assert.equal(h.people.slice(-1)[0].pose, 'type');
});

test('town hall tally: approved, denied and open today; a request cancelled by a restart is not a denial', async () => {
  const { tallyOf } = await import('../src/room-scene.ts');
  const ev: UEvent[] = [...day(),
    { type: 'approval', data: { id: 'y', agentId: 'a', kind: 'approval', askedAt: at(10, 1), decidedAt: at(10, 2), outcome: 'allowed' } },
    { type: 'approval', data: { id: 'n', agentId: 'a', kind: 'approval', askedAt: at(10, 3), decidedAt: at(10, 4), outcome: 'rejected' } },
    { type: 'approval', data: { id: 'c', agentId: 'a', kind: 'approval', askedAt: at(10, 5), decidedAt: at(10, 6), outcome: 'cancelled' } },
    { type: 'approval', data: { id: 'o', agentId: 'a', kind: 'approval', askedAt: at(10, 30) } }] as UEvent[];
  const store = createStore(); store.applyAll(ev);
  assert.deepEqual(tallyOf(store, at(10, 31), 'approval'), { yes: 1, no: 1, open: 1 });
});

test('room view: a whole number of device pixels per art pixel at every pixel ratio (an Electron page at 110 % too)', () => {
  const it = interiorOf(input(at(12)));
  // A small floor (the lobby) on a big screen meets the 4 CSS pixel cap: 4 × 2.2 is 8.8, not a whole number.
  for (const dpr of [0.9, 1, 1.25, 1.5, 2, 2.2, 3]) for (const [w, h] of [[2560, 1440], [1440, 844], [1043.3, 700.5], [390, 700]] as const) for (const floor of ['lobby', 'library']) {
    const h0 = harness(createStubKit(fakeSurface), true);
    h0.view.resize(w, h, dpr);
    h0.view.setInput({ interior: it, floor, T: at(12) });
    h0.view.paint(0);
    const S2 = h0.view.geometry.zoom * h0.view.vp.dpr;
    assert.ok(Math.abs(S2 - Math.round(S2)) < 1e-9 && S2 >= 1, `dpr ${dpr} ${w}×${h} ${floor}: ${S2}`);
  }
});
