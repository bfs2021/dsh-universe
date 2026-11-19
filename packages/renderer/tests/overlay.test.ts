import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, carsFor, cityTemplate, createStore, emptyPlacement, metricsAt, place, type UEvent } from '@dsh-universe/model';
import {
  Traffic, buildScene, createDataViews, createStubKit, createSquareBadge, paintCity,
  type OverlayFrame, type SceneInput,
} from '../src/index.ts';
import { fakeSurface } from './fake-canvas.ts';

const DAY = new Date(2026, 10, 18).getTime();
const at = (h: number, m = 0, s = 0) => DAY + ((h * 60 + m) * 60 + s) * 1000;
const names = { town: 'T', station: 'S', fire: 'F', school: 'K', library: 'L' };
const tr = (k: string, p?: Record<string, string | number>) => k + (p ? JSON.stringify(p) : '');
const fmt = { t: tr, tokens: (n: number) => String(n), duration: (ms: number) => Math.round(ms / 1000) + 's', clock: (x: number) => new Date(x).toISOString().slice(11, 16) };

function day(): UEvent[] {
  const ev: UEvent[] = [{ type: 'workspace', data: { id: 'w1', title: 'Finance', displayPath: 'fin' } }, { type: 'connector', data: { id: 'erp', title: 'ERP', state: 'connected' } }];
  const add = (id: string, start: number, o: Partial<{ kind: 'main' | 'scheduled'; scheduleId: string }> = {}) => {
    ev.push({ type: 'agent', data: { id, sessionId: id, workspaceId: 'w1', label: 'secret title', kind: 'main', state: 'running', startedAt: start, ...o } });
    ev.push({ type: 'turn', data: { t: start, agentId: id, phase: 'start' } });
  };
  add('run', at(9));
  for (let k = 0; k < 30; k++) ev.push({ type: 'activity', data: { id: 'r' + k, t: at(9, 58) + k * 3000, agentId: 'run', category: k % 2 ? 'edit' : 'connector', connectorId: k % 2 ? undefined : 'erp', tool: k % 2 ? 'edit' : 'mcp__erp__q', ok: k % 7 !== 3 } });
  ev.push({ type: 'usage', data: { t: at(9, 59), agentId: 'run', model: 'm1', input: 20000, output: 900 } });
  add('wait', at(9, 10));
  ev.push({ type: 'approval', data: { id: 'a', agentId: 'wait', kind: 'approval', askedAt: at(9, 40) } });
  add('fail', at(9, 5));
  ev.push({ type: 'activity', data: { id: 'f1', t: at(9, 20), agentId: 'fail', category: 'exec', tool: 'bash', ok: false } });
  ev.push({ type: 'turn', data: { t: at(9, 30), agentId: 'fail', phase: 'end', reason: 'error' } });
  add('sch', at(8), { kind: 'scheduled', scheduleId: 'daily' });
  ev.push({ type: 'turn', data: { t: at(8, 20), agentId: 'sch', phase: 'end', reason: 'completed' } });
  ev.push({ type: 'schedule', data: { id: 'daily', title: 'Daily', status: 'active', nextAt: at(15), runs: [{ at: at(8), agentId: 'sch', ok: true }] } });
  return ev;
}
const placementOf = (ev: UEvent[]) => place(cityTemplate(), emptyPlacement(), ev.flatMap((e) => (e.type === 'agent' ? [{ sessionId: e.data.sessionId, workspaceId: e.data.workspaceId, startedAt: e.data.startedAt }] : []))).state;
function input(ev = day(), T = at(10)): SceneInput {
  const store = createStore(); store.applyAll(ev);
  return { store, placement: placementOf(ev), T, templateTags: [[]], names, time: 0, night: false, city: 'dsh' };
}

/** Paints the city into a fake buffer and runs one overlay over it; returns the drawing log and the people drawn. */
function frame(layer: string, inp = input(), o: { reducedMotion?: boolean; time?: number } = {}) {
  const kit = createStubKit(fakeSurface);
  const people: number[][] = [];
  const person = kit.person.bind(kit);
  kit.person = (pen, X, Y, spec) => { people.push([X, Y, spec.placard]); person(pen, X, Y, spec); };
  const scene = buildScene(inp);
  const buf = fakeSurface(900, 600);
  const last = paintCity(buf.ctx as never, kit, scene, new Traffic(), { time: 0, zoom: 1, bw: 900, bh: 600, camX: 0, camY: 232 });
  people.length = 0;
  buf.log.length = 0;
  const views = createDataViews(fmt);
  const f: OverlayFrame = { ctx: buf.ctx as never, kit, scene, input: inp, last, layer, time: o.time ?? 0, reducedMotion: !!o.reducedMotion, dpr: 1, zoom: 1 };
  views.art!(f);
  return { log: buf.log, people, tags: views.tags(), scene, animated: views.animated!(f), last };
}

test('data views: "Everything" leaves the city as it is; every other layer greys it first', () => {
  assert.equal(frame('all').log.length, 0);
  for (const l of LAYERS.filter((x) => x !== 'all')) {
    const { log } = frame(l);
    assert.ok(log.includes("globalCompositeOperation=saturation"), l + ' greys the city');
  }
});

test('data views: agents in the square are drawn in colour in every layer', () => {
  for (const l of LAYERS.filter((x) => x !== 'all')) {
    const { people, scene } = frame(l);
    const square = scene.agents.filter((a) => a.inSquare);
    assert.equal(square.length, 2, 'the approval and the error');
    assert.ok(people.filter((p) => p[2]).length >= square.length, l + ': every agent with a placard is drawn again');
  }
});

test('data views: the art stage never writes text; the tags carry counts, times and tool names only', () => {
  for (const l of LAYERS) {
    const { log, tags } = frame(l);
    assert.ok(!log.some((x) => /^(fillText|strokeText)/.test(x)), l);
    for (const t of tags) assert.ok(!t.text.includes('secret'), 'no titles in the city');
  }
  const err = frame('errors').tags.map((t) => t.text);
  assert.ok(err.some((x) => x.startsWith('td.err')), 'error counts');
  const sch = frame('scheduled').tags.map((t) => t.text);
  assert.ok(sch.some((x) => x.startsWith('td.sched')), 'the next scheduled task over the station');
  assert.ok(sch.some((x) => /✓$/.test(x)), 'a scheduled run that finished');
  assert.ok(frame('running').tags.some((t) => t.text.includes('edit') || t.text.includes('mcp__erp__q')), 'the current tool');
  assert.ok(frame('tokens').tags.some((t) => t.text.startsWith('td.tok')));
  assert.ok(frame('calls').tags.some((t) => t.text.startsWith('ov.calls5')));
});

test('errors: a fire engine drives from the fire station; under reduced motion it stands at the fire and nothing moves', () => {
  const live = frame('errors', input(), { time: 3 });
  assert.equal(live.animated, true, 'burning: something moves');
  assert.ok(live.log.some((l) => l.startsWith('drawImage(')), 'the engine is drawn');
  const still = frame('errors', input(), { reducedMotion: true });
  assert.equal(still.animated, false);
  // Long after the last failure the fire is out: it smoulders, and no engine comes.
  const later = frame('errors', input(day(), at(11)), { time: 3 });
  assert.equal(later.animated, false, 'nothing burning, nothing moving');
});

test('traffic: the number of cars matches the formula (5-minute calls ÷ 2, at most 64)', () => {
  const inp = input();
  const s = buildScene(inp);
  const m = metricsAt(inp.store, inp.T);
  assert.equal(m.calls5, 30);
  assert.equal(s.cars, carsFor(m.calls5));
  assert.equal(s.cars, 15);
  const tr = new Traffic(3);
  tr.step(s.cars, s.growth, 0, false);
  assert.equal(tr.cars.length, 15, 'that many cars on the roads');
});

test('tokens: a live wire moves only while tokens were used in the last five minutes', () => {
  assert.equal(frame('tokens', input(), { time: 2 }).animated, true);
  assert.equal(frame('tokens', input(day(), at(10, 30)), { time: 2 }).animated, false, 'nothing used lately: still');
});

test('the balloon badge: the number waiting, at screen resolution on whole pixels; none when nobody waits', () => {
  const inp = input();
  const scene = buildScene(inp);
  const g = fakeSurface(800, 600);
  const b = createSquareBadge();
  b.screen!({ ctx: g.ctx as never, kit: createStubKit(fakeSurface), scene, input: inp, last: undefined as never, layer: 'all', time: 0, reducedMotion: true, dpr: 2, zoom: 1, toScreen: (x, y) => [x + 0.4, y + 0.6] });
  const text = g.log.find((l) => l.startsWith('fillText('));
  assert.ok(text?.startsWith('fillText(2,'), String(text));
  for (const l of g.log.filter((x) => /^(fillRect|fillText)\(/.test(x))) for (const n of l.slice(l.indexOf('(') + 1, -1).split(',').slice(1).map(Number)) assert.ok(Number.isInteger(n), l);
  const empty = { ...scene, rally: 0 };
  const g2 = fakeSurface(10, 10);
  b.screen!({ ctx: g2.ctx as never, kit: createStubKit(fakeSurface), scene: empty, input: inp, last: undefined as never, layer: 'all', time: 0, reducedMotion: true, dpr: 1, zoom: 1, toScreen: (x, y) => [x, y] });
  assert.equal(g2.log.length, 0);
});

test('walking: a new wait walks out of its building to the square; answered, it walks back; look-back agrees', () => {
  const ev = day();
  const sceneAt = (e: UEvent[], T: number, time = 1) => buildScene({ ...input(e, T), time });
  const square = sceneAt(ev, at(9, 45)).agents.find((x) => x.id === 'wait')!;
  assert.ok(square.inSquare && !square.person.walking, 'standing in the square five minutes later');
  const out = sceneAt(ev, at(9, 40) + 500).agents.find((x) => x.id === 'wait')!;
  assert.ok(out.person.walking && !out.inSquare, 'half a second after asking: on the way');
  assert.ok(Math.hypot(out.pos[0] - square.pos[0], out.pos[1] - square.pos[1]) > 0.5, 'not there yet');
  assert.equal(sceneAt(ev, at(9, 39, 59)).agents.find((x) => x.id === 'wait'), undefined, 'before the wait: inside its building');
  // Answered at 9:50: it walks back without the sign, then goes in.
  const ans: UEvent[] = [...ev, { type: 'approval', data: { id: 'a', agentId: 'wait', kind: 'approval', askedAt: at(9, 40), decidedAt: at(9, 50), outcome: 'allowed' } }];
  const back = sceneAt(ans, at(9, 50) + 500).agents.find((x) => x.id === 'wait')!;
  assert.ok(back.person.walking && back.person.placard === 0 && !back.inSquare, 'walking home');
  assert.equal(sceneAt(ans, at(9, 55)).agents.find((x) => x.id === 'wait'), undefined, 'went in');
  // The same moment looked back to later gives the same picture (pure in T).
  assert.deepEqual(sceneAt(ans, at(9, 50) + 500).agents.find((x) => x.id === 'wait')!.pos, back.pos);
});

test('walking: an error stop walks to the square; after 90 minutes it walks home and sits at its door', () => {
  const ev = day();
  const sceneAt = (T: number) => buildScene({ ...input(ev, T), time: 1 });
  assert.ok(sceneAt(at(9, 30) + 500).agents.find((x) => x.id === 'fail')!.person.walking);
  assert.ok(sceneAt(at(10)).agents.find((x) => x.id === 'fail')!.inSquare);
  const home = sceneAt(at(11) + 500).agents.find((x) => x.id === 'fail')!;
  assert.ok(home.person.walking && !home.inSquare, '90 minutes later: on the way home');
  const sat = sceneAt(at(11, 5)).agents.find((x) => x.id === 'fail')!;
  assert.ok(!sat.person.walking && !sat.inSquare, 'sitting at its own door');
});

test('walking: under reduced motion nobody walks; people are where the data says', () => {
  const s = buildScene({ ...input(day(), at(9, 40) + 500), time: 0 });
  assert.ok(s.agents.every((a) => !a.person.walking));
  assert.ok(s.agents.find((x) => x.id === 'wait')!.inSquare);
});

test('reduced motion: no layer animates', () => {
  for (const l of LAYERS) assert.equal(frame(l, input(), { reducedMotion: true, time: 0 }).animated, false, l);
});

test('plan mode: a blueprint over the roof while planning, by the moment shown; never moving', async () => {
  const { createPlanBlueprints } = await import('../src/index.ts');
  const ev: UEvent[] = [...day(), { type: 'planmode', data: { t: at(9, 5), agentId: 'run', active: true } }, { type: 'planmode', data: { t: at(9, 50), agentId: 'run', active: false } }];
  const draw = (T: number) => {
    const inp = input(ev, T), kit = createStubKit(fakeSurface), scene = buildScene(inp), buf = fakeSurface(900, 600);
    const last = paintCity(buf.ctx as never, kit, scene, new Traffic(), { time: 0, zoom: 1, bw: 900, bh: 600, camX: 0, camY: 232 });
    buf.log.length = 0;
    const o = createPlanBlueprints();
    o.art!({ ctx: buf.ctx as never, kit, scene, input: inp, last, layer: 'all', time: 0, reducedMotion: false, dpr: 1, zoom: 1 });
    return { n: buf.log.filter((l) => l.startsWith('fillRect(')).length, log: buf.log, animated: o.animated };
  };
  assert.equal(draw(at(9)).n, 0, 'before plan mode');
  const on = draw(at(9, 30));
  assert.ok(on.n > 20, 'a blueprint while planning');
  assert.ok(on.log.includes('fillStyle=#2F8BFF'));
  assert.equal(on.animated, undefined, 'still');
  assert.equal(draw(at(9, 55)).n, 0, 'plan mode off again');
});

test('the square: twenty waiting agents on the paving; full placards only in the first row, and no placard covers a face', async () => {
  const { squareSpot, artXY, SQUARE_FULL, SQUARE_MAX, SQUARE_LIFT } = await import('../src/index.ts');
  assert.equal(SQUARE_FULL, 5);
  assert.equal(SQUARE_MAX, 20);
  // As people.ts draws them (feet at X, Y; standing, no bob): the face (eyes and mouth) X−2 … X+1, Y−17 … Y−12; the full
  // placard X+2 … X+5+bw, Y−32−2·tier … Y−21−2·tier; the small one X+2 … X+7, Y−19 … Y−13.
  const feet = (n: number) => artXY(...squareSpot(n));
  const face = (n: number) => { const [x, y] = feet(n); return [x - 2, y - 17, x + 2, y - 11]; };
  const full = (n: number, tier = 2) => { const [x, y] = feet(n); const bw = 9 + tier * 2, l = n & 1 ? SQUARE_LIFT : 0; return [x + 2, y - 32 - tier * 2 - l, x + 6 + bw, y - 21 - tier * 2 - l]; };
  const small = (n: number) => { const [x, y] = feet(n); return [x + 2, y - 19, x + 8, y - 12]; };
  const hit = (p: number[], q: number[]) => p[0] < q[2] && p[2] > q[0] && p[1] < q[3] && p[3] > q[1];
  for (let a = 0; a < 20; a++) {
    const card = a < SQUARE_FULL ? full(a) : small(a);
    for (let b = 0; b < 20; b++) if (b !== a) assert.ok(!hit(card, face(b)), `placard ${a} covers face ${b}`);
    for (let b = a + 1; b < SQUARE_FULL; b++) assert.ok(!hit(full(a), full(b)), `placards ${a} and ${b} overlap`);
  }
  // Every spot on the square's paving (ground.ts: 12.55 … 16.45 × 16.75 … 21.6); one past the last reuses the last.
  for (let n = 0; n < 20; n++) { const [x, y] = squareSpot(n); assert.ok(x > 12.6 && x < 16.4 && y > 16.8 && y < 21.5, 'on the paving: ' + n); }
  assert.deepEqual(squareSpot(25), squareSpot(19));
  // Five to a row, 11 pixels apart; rows 8 pixels lower.
  assert.equal(Math.round(feet(1)[0] - feet(0)[0]), 11);
  assert.equal(Math.round(feet(10)[1] - feet(5)[1]), 8);
});

test('walking: no jump at either end of a walk into or out of the square', () => {
  const ev: UEvent[] = [...day(), { type: 'approval', data: { id: 'a', agentId: 'wait', kind: 'approval', askedAt: at(9, 40), decidedAt: at(9, 50), outcome: 'allowed' } }];
  const posAt = (T: number) => { const a = buildScene({ ...input(ev, T), time: 1 }).agents.find((x) => x.id === 'wait'); return a && { p: a.pos, walking: a.person.walking, sq: a.inSquare }; };
  // In: the last step of the walk is next to the spot it then stands on.
  let last: [number, number] | undefined, t = at(9, 40);
  for (; t < at(9, 41); t += 50) { const x = posAt(t)!; if (!x.walking) break; last = [x.p[0], x.p[1]]; }
  const stand = posAt(t)!;
  assert.ok(stand.sq && last && Math.hypot(stand.p[0] - last[0], stand.p[1] - last[1]) < 0.3, 'arrives on its own spot');
  // Out: the first step leaves from where it stood.
  const before = posAt(at(9, 50) - 1)!.p, first = posAt(at(9, 50) + 50)!;
  assert.ok(first.walking && Math.hypot(first.p[0] - before[0], first.p[1] - before[1]) < 0.3, 'leaves from its own spot');
});
