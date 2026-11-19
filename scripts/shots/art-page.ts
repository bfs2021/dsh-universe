// Dev page for scripts/room-shots.mjs: paints one room with the real art kit, no agents, scaled up.
import { createArtKit, ROOMS } from '@dsh-universe/art';
import type { RoomSpec } from '@dsh-universe/renderer';

declare global { interface Window { paintRoom(o: Partial<RoomSpec> & { room: string; scale?: number }): number; ROOM_IDS: string[] } }
const kit = createArtKit();
window.ROOM_IDS = ROOMS.map((r) => r.id);
window.paintRoom = (o) => {
  kit.setLight({ dark: !!o.night });
  const spec: RoomSpec = {
    id: 'v', floor: 'library', place: 'building', colour: '#6C7BEA', seed: 7, act: false, frame: 0, reduced: false, night: false, na: false,
    n: 0, recent: [], jobs: 0, subs: [], out: 0, queue: 0, rate: 0, hour: 15.5, ...o,
  };
  const t0 = performance.now();
  const s = kit.room(spec);
  const ms = performance.now() - t0;
  const sc = o.scale ?? 3;
  const cv = document.getElementById('c') as HTMLCanvasElement;
  cv.width = s.w * sc; cv.height = s.h * sc;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.fillStyle = kit.sky(); c.fillRect(0, 0, cv.width, cv.height);
  c.drawImage(s.image, 0, 0, s.w * sc, s.h * sc);
  return ms;
};
declare global { interface Window { bench(room: string, n: number): number[] } }
window.bench = (room, n) => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const spec: RoomSpec = {
      id: 'b', room, floor: 'library', place: 'building', colour: '#6C7BEA', seed: 7, act: true, frame: i + 1, reduced: false, night: false, na: false,
      n: 40, recent: [{ age: 1, err: false }, { age: 9, err: true }], jobs: 2, subs: [], out: 0, queue: 0, rate: 0, hour: 15.5,
    };
    const t0 = performance.now(); kit.room(spec); out.push(performance.now() - t0);
  }
  return out.sort((a, b) => a - b);
};
declare global { interface Window { grid(ids: string[], o: Partial<RoomSpec>, cols: number): void } }
window.grid = (ids, o, cols) => {
  const cv = document.getElementById('c') as HTMLCanvasElement, sc = 1;
  cv.width = 404 * cols * sc; cv.height = 236 * Math.ceil(ids.length / cols) * sc;
  const c = cv.getContext('2d')!; c.imageSmoothingEnabled = false; c.fillStyle = kit.sky(); c.fillRect(0, 0, cv.width, cv.height);
  ids.forEach((room, i) => {
    kit.setLight({ dark: !!o.night });
    const s = kit.room({ id: 'g' + i, room, floor: 'library', place: 'building', colour: '#6C7BEA', seed: 7, act: false, frame: 0, reduced: false, night: false, na: false, n: 40, recent: [{ age: 2, err: false }, { age: 9, err: true }], jobs: 1, subs: [], out: 0, queue: 0, rate: 0, hour: 15.5, ...o })!;
    c.drawImage(s.image, (i % cols) * 404 * sc, Math.floor(i / cols) * 236 * sc, 404 * sc, 236 * sc);
    c.fillStyle = '#000'; c.font = '12px monospace'; c.fillText(room, (i % cols) * 404 * sc + 4, Math.floor(i / cols) * 236 * sc + 14);
  });
};
