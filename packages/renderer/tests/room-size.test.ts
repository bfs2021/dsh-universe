// Floor size follows the building ("bigger buildings have bigger floors"; "small building could get
// taller, then means bigger floors"): the tier comes from the tower as the city draws it at T.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cityTemplate, createStore, emptyPlacement, freezeTheme, place, type PlacementState, type UCapabilities, type UEvent } from '@dsh-universe/model';
import { createArtKit, ROOMS, roomTier } from '@dsh-universe/art';
import { RoomView, buildScene, interiorOf, type ArtKit, type InteriorInput, type RoomSpec, type RoomTier } from '../src/index.ts';
import { fakeSurface } from './fake-canvas.ts';

const DAY = new Date(2026, 10, 18).getTime();
const at = (h: number, m = 0, s = 0) => DAY + ((h * 60 + m) * 60 + s) * 1000;
const CAPS: UCapabilities = {
  approvals: true, schedules: true, subagents: true, jobs: true, deliverables: true, skills: true, memory: false, tokens: true, cost: false, latency: true,
  sessionTitles: true, actions: { openSession: true, draftFollowUp: true },
};
const kit = createArtKit({ make: fakeSurface });
const RANK: Record<RoomTier, number> = { small: 0, medium: 1, large: 2 };
const KINDS = ['read', 'edit', 'exec', 'delegate'] as const;

/** One session that works from 9:00 to 17:00: a call every 30 s on each kind of floor in turn, tokens with every call. */
function growing(): UEvent[] {
  const ev: UEvent[] = [{ type: 'workspace', data: { id: 'w', title: 'W', displayPath: 'w' } }];
  ev.push({ type: 'agent', data: { id: 'a', sessionId: 'g', workspaceId: 'w', label: 'x', kind: 'main', state: 'running', startedAt: at(9) } });
  ev.push({ type: 'turn', data: { t: at(9), agentId: 'a', phase: 'start' } });
  for (let k = 0; k < 960; k++) {
    const t = at(9, 0, 30 + k * 30), c = KINDS[k % 4];
    ev.push({ type: 'activity', data: { id: 'c' + k, t, agentId: 'a', category: c, tool: c } });
    ev.push({ type: 'usage', data: { id: 'u' + k, t, agentId: 'a', model: 'm', input: 900, output: 300 } });
  }
  return ev;
}
function input(T: number, o: Partial<InteriorInput> = {}, ev = growing()): InteriorInput {
  const store = createStore(); store.applyAll(ev);
  let placement: PlacementState = place(cityTemplate(), emptyPlacement(), [{ sessionId: 'g', workspaceId: 'w', startedAt: at(9) }]).state;
  placement = freezeTheme(placement, 'g', 'finance');
  return { store, placement, T, placeId: 'b:g', catalog: ROOMS, caps: CAPS, templateTags: kit.buildingTags, roomTier: kit.roomTier, ...o };
}
const tierAt = (T: number, o: Partial<InteriorInput> = {}) => interiorOf(input(T, o)).tier;

test('floor size: a growing building gets bigger floors at its thresholds, never smaller, and only ever steps up', () => {
  const seen: RoomTier[] = [];
  for (let T = at(9); T <= at(17, 10); T += 5 * 60_000) seen.push(tierAt(T));
  assert.equal(seen[0], 'small', 'a building at the groundbreaking has small floors');
  assert.equal(seen[seen.length - 1], 'large', 'the finished tower has full-size floors');
  assert.ok(seen.includes('medium'), 'and medium ones on the way');
  // No flicker: the tier never goes down and changes exactly twice (small → medium → large).
  for (let i = 1; i < seen.length; i++) assert.ok(RANK[seen[i]] >= RANK[seen[i - 1]], 'stepped down at ' + i + ': ' + seen.join(','));
  assert.equal(seen.filter((t, i) => i && t !== seen[i - 1]).length, 2, seen.join(','));
});

test('floor size: the switch happens exactly where the tower crosses the threshold, and looking back shows the earlier size', () => {
  // Find the moment the floors become medium (to the minute), then check both sides of it.
  let lo = at(9), hi = at(17);
  while (hi - lo > 60_000) { const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000 || lo + 60_000; if (tierAt(mid) === 'small') lo = mid; else hi = mid; }
  assert.equal(tierAt(lo), 'small');
  assert.equal(tierAt(hi), 'medium');
  // The renderer's tower at that moment is what decides: the same shape the city draws.
  const it = interiorOf(input(hi));
  const scene = buildScene({ ...input(hi), time: 0, night: false, templateTags: kit.buildingTags, names: { town: 'T', station: 'S', fire: 'F', school: 'Sc', library: 'L', defaultWorkspace: 'D' } });
  const b = scene.places.find((p) => p.id === 'b:g')!.building!;
  assert.deepEqual(it.shape, { template: b.template, footprint: b.footprint, segments: b.segments, stage: b.stage });
  assert.equal(it.tier, roomTier(b));
  // Look-back: an earlier T gives the smaller size; the same T always the same one.
  assert.equal(tierAt(lo - 60_000), 'small');
  assert.equal(tierAt(at(17)), 'large');
  assert.equal(tierAt(hi), tierAt(hi));
  // The room templates stay the same whatever the size: only the floor size changes.
  assert.deepEqual(interiorOf(input(lo)).rooms, interiorOf(input(at(17))).rooms);
});

test('floor size: a building of an earlier day has the size it ended with; public places and kits without the rule stay full size', () => {
  const o = input(at(12));
  const placement = { ...place(cityTemplate(), o.placement, [{ sessionId: 'old', workspaceId: 'w', startedAt: at(9) - 86_400_000 }]).state };
  placement.sizes = { old: { calls: { library: 1 }, tokens: 0, state: 'done', started: at(9) - 86_400_000 } };
  assert.equal(interiorOf({ ...o, placement, placeId: 'b:old' }).tier, 'small', 'a small session of yesterday');
  placement.sizes = { old: { calls: { library: 400, workshop: 300, machine: 200, meeting: 100 }, tokens: 2e6, state: 'done', started: at(9) - 86_400_000 } };
  assert.equal(interiorOf({ ...o, placement, placeId: 'b:old' }).tier, 'large', 'a big one');
  assert.equal(interiorOf({ ...o, placeId: 'town' }).tier, 'large');
  assert.equal(interiorOf({ ...o, roomTier: undefined }).tier, 'large');
  assert.equal(interiorOf({ ...o, override: { floor: 'library', room: 'market', tier: 'medium' } }).tier, 'medium', 'previews may pick a size');
});

function harness(rm = false) {
  const cv = fakeSurface(1280, 760);
  const frames: ((t: number) => void)[] = [];
  const specs: RoomSpec[] = [];
  const k: ArtKit = { ...kit, room: (s, p) => { specs.push(s); return kit.room(s, p); }, person: () => {} };
  const view = new RoomView({
    kit: k, canvas: { width: 1280, height: 760, getContext: () => cv.ctx } as never, reducedMotion: () => rm,
    raf: (fn) => { frames.push(fn); return frames.length; }, cancelRaf: () => {}, clock: () => 0,
    artBuffer: () => { const s = fakeSurface(2, 2); return { canvas: { width: 2, height: 2 }, ctx: s.ctx as never }; },
  });
  view.resize(1280, 760, 1);
  const run = (ms: number, t0 = 0, step = 1000 / 60) => { let n = 0; for (let t = t0; t <= t0 + ms; t += step) { const f = frames.shift(); if (!f) break; f(t); n++; } return n; };
  return { view, run, specs, cv };
}

test('room view: the room is drawn at its building\'s size; growing past a threshold while inside cross-fades in place', () => {
  const h = harness();
  const small = interiorOf(input(at(9, 1))), big = interiorOf(input(at(17)));
  assert.equal(small.tier, 'small'); assert.equal(big.tier, 'large');
  h.view.start();
  h.view.setInput({ interior: small, floor: 'library', T: at(9, 1) });
  h.run(1000);
  assert.equal(h.specs[h.specs.length - 1].tier, 'small');
  assert.equal(h.view.kit.roomLayout(h.specs[h.specs.length - 1].room, 'small').size, 9);
  const w0 = h.view.geometry.w;
  // The building grows while the member looks at the same floor: one short cross-fade, no slide, then the new size.
  const before = h.cv.log.length;
  h.view.setInput({ interior: big, floor: 'library', T: at(17) });
  h.run(1000, 2000);
  assert.equal(h.specs[h.specs.length - 1].tier, undefined, 'full size (the default)');
  const faded = h.cv.log.slice(before).filter((l) => /^globalAlpha=0\.\d/.test(l)).length;
  assert.ok(faded >= 4, faded + ' cross-fade frames');
  assert.ok(h.view.geometry.w > w0 * 0.99, 'not smaller');
  // Under reduced motion the new size comes at once.
  const r = harness(true);
  r.view.start();
  r.view.setInput({ interior: small, floor: 'library', T: at(9, 1) }); r.run(1000);
  const b2 = r.cv.log.length;
  r.view.setInput({ interior: big, floor: 'library', T: at(17) }); r.run(1000, 2000);
  assert.ok(!r.cv.log.slice(b2).some((l) => /^globalAlpha=0\.\d/.test(l)), 'hard cut');
});
