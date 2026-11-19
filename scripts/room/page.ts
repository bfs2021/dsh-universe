// The page scripts/room-check.mjs drives: the inside view (RoomView) with the real art kit on the sample day.
// window.show({ place, floor, room, dark, reduced, w, h }) opens a place; window.perf(...) measures frames;
// window.grid(...) paints rooms side by side (review sheets).
import { createArtKit, ROOMS } from '@dsh-universe/art';
import { createStore, FLOOR_KINDS, idxAt, FLOOR_OF, type FloorKind } from '@dsh-universe/model';
import { RoomView, interiorOf, defaultFloor, tokenRate, type Interior } from '@dsh-universe/renderer';
import { dshSample } from '../../fixtures/dsh-sample.ts';

const midnight = new Date(2026, 10, 18).getTime();
const fx = dshSample(midnight);
const store = createStore(); store.applyAll(fx.events);
const kit = createArtKit();
let clock = 0, reduced = false;
const canvas = document.getElementById('cv') as HTMLCanvasElement;
const view = new RoomView({ kit, canvas, reducedMotion: () => reduced, raf: () => 0, cancelRaf: () => {}, clock: () => clock });
view.start();

/** The building with the most calls on a kind of floor (where a template preview gets real data). */
function busiest(kind: FloorKind): string {
  const per = new Map<string, number>();
  for (const s of store.agents()) {
    const root = s.agent.parentAgentId ? store.agent(s.agent.parentAgentId) ?? s : s;
    const k = idxAt(s, fx.now);
    for (let i = 0; i < k; i++) if (FLOOR_OF[s.ev[i].category] === kind) per.set(root.agent.sessionId, (per.get(root.agent.sessionId) ?? 0) + 1);
  }
  return 'b:' + [...per].sort((a, b) => b[1] - a[1])[0][0];
}
let it: Interior | undefined;
declare global { interface Window { show(o: Record<string, unknown>): unknown; perf(frames: number, step: number): unknown; ROOM_IDS: string[]; frame(ms: number): unknown; go(floor: string, frames: number): unknown; grid(ids: string[], o: Record<string, unknown>, cols: number): void } }
window.ROOM_IDS = ROOMS.map((r) => r.id);
window.show = (o) => {
  const room = o.room as string | undefined;
  const kind = room ? (ROOMS.find((r) => r.id === room)!.floors[0]) : undefined;
  const placeId = (o.place as string) ?? (kind ? busiest(kind) : 'b:s7');
  const T = (o.T as number) ?? fx.now;
  reduced = !!o.reduced;
  const ovFloor = ((o.floor as FloorKind | undefined) ?? kind) as FloorKind;
  it = interiorOf({ store, placement: fx.placement!, T, placeId, catalog: ROOMS, caps: fx.platform.caps, override: room && kind ? { floor: ovFloor, room, ...(o.tier ? { tier: o.tier as never } : {}) } : undefined, templateTags: kit.buildingTags, roomTier: kit.roomTier });
  if (o.tier) it = { ...it, tier: o.tier as never };
  const floor = (o.floor as string) ?? (kind && it.floors.some((f) => f.id === kind) ? kind : defaultFloor(it));
  view.setDark(!!o.dark);
  view.resize((o.w as number) ?? 1280, (o.h as number) ?? 760, (o.dpr as number) ?? 1);
  canvas.style.width = ((o.w as number) ?? 1280) + 'px'; canvas.style.height = ((o.h as number) ?? 760) + 'px'; canvas.style.background = kit.sky();
  view.setInput({ interior: it, floor, T, rate: tokenRate(store, placeId, T) });
  clock += 1000; view.paint(clock); clock += 1000; view.paint(clock);
  return { placeId, floor, floors: it.floors.map((f) => [f.id, f.room, f.people.length, f.act, f.recent.length, f.jobs]), animated: view.animated, geometry: view.geometry };
};
window.go = (floor, frames) => { if (!it) return; const cur = (view as unknown as { input: { T: number; rate?: number } }).input; view.setInput({ interior: it, floor, T: cur.T, rate: cur.rate }); for (let i = 0; i < frames; i++) { clock += 16; view.paint(clock); } return view.animated; };
window.frame = (ms) => { clock += ms; view.paint(clock); return view.animated; };
window.perf = (frames, step) => {
  view.resetStats();
  for (let i = 0; i < frames; i++) { clock += step; view.paint(clock); }
  return { ...view.stats(), roomPaints: view.roomPaints };
};
window.grid = (ids, o, cols) => {
  const cv = canvas, W = 404, H = 236;
  cv.style.width = W * cols + 'px'; cv.style.height = H * Math.ceil(ids.length / cols) + 'px';
  cv.width = W * cols; cv.height = H * Math.ceil(ids.length / cols);
  const c = cv.getContext('2d')!; kit.setLight({ dark: !!o.dark }); c.imageSmoothingEnabled = false; c.fillStyle = kit.sky(); c.fillRect(0, 0, cv.width, cv.height);
  ids.forEach((room, i) => {
    const s = kit.room({ id: 'g' + i, room, floor: 'library', place: 'building', colour: '#6C7BEA', seed: 7, act: !!o.act, frame: o.act ? 33 : 0, reduced: false, night: !!o.dark, na: false, n: 40, recent: [{ age: 2, err: false }, { age: 9, err: true }], jobs: 1, subs: [], out: 0, queue: 0, rate: 0, hour: 15.5 })!;
    c.drawImage(s.image, (i % cols) * W, Math.floor(i / cols) * H);
  });
};
void FLOOR_KINDS;
