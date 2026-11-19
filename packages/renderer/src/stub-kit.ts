// A stand-in art kit: flat grey boxes. Enough for tests and mock-data dev mode without the art package.
import { storeysOf } from '@dsh-universe/model';
import type { ArtKit, Canvas2D, Drawn, RoomLayout, Sprite } from './artkit.ts';

export interface StubSurface { canvas: CanvasImageSource & { width: number; height: number }; ctx: Canvas2D }
export type StubSurfaceFactory = (w: number, h: number) => StubSurface;

function defaultSurface(w: number, h: number): StubSurface {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return { canvas, ctx: (canvas as HTMLCanvasElement).getContext('2d') as Canvas2D };
}

/** The room geometry of the stub kit: a 12×12 room, agents on a grid of chairs, the lift at the back right. */
export const STUB_ROOM: RoomLayout = {
  size: 12, lift: [11.4, 0.7], w: 404, h: 236, ox: 202, oy: 30,
  spots: Array.from({ length: 12 }, (_, i) => [1.5 + (i % 4) * 2.6, 2 + Math.floor(i / 4) * 3] as const),
};

export function createStubKit(make: StubSurfaceFactory = defaultSurface): ArtKit {
  const cache = new Map<string, Sprite>();
  let draws = 0, dark = false;
  const box = (key: string, w: number, h: number, fill: string): Sprite => {
    let s = cache.get(key);
    if (s) return s;
    const sf = make(w, h);
    sf.ctx.fillStyle = fill;
    sf.ctx.fillRect(0, 0, w, h);
    draws++;
    s = { image: sf.canvas, dx: -(w >> 1), dy: -h, w, h };
    cache.set(key, s);
    return s;
  };
  const drawn = (s: Sprite, top: number): Drawn => ({ ...s, top });
  return {
    id: 'stub',
    version: '0',
    rooms: (['library', 'workshop', 'machine', 'meeting'] as const).map((f) => ({ id: 'stub-' + f, tags: [], floors: [f] })),
    buildingTemplates: 1,
    buildingTags: [[]],
    setLight(l) { dark = l.dark; return dark ? 'night' : 'day'; },
    sky: () => (dark ? '#0A0F24' : '#EEF7FB'),
    street: () => ({ items: [] }),
    ground: () => box('ground', 64, 32, '#E3E0D6'),
    building(spec) { const h = Math.max(1, storeysOf(spec.segments)) * 5; return drawn(box('b' + h, 24, h, '#AEB5C2'), h); },
    civic: () => drawn(box('civic', 40, 24, '#8A93A3'), 24),
    item: () => box('item', 2, 2, '#59627A'),
    car: () => box('car', 8, 4, '#59627A'),
    train: () => box('train', 20, 8, '#2F6BDE'),
    person(px, X, Y) { px(X - 2, Y - 9, 4, 9, '#59627A'); },
    smoke() {},
    pool: () => box('pool', 2, 1, '#FFD37E'),
    balloon(px, X, Y) { px(X - 4, Y - 70, 8, 9, '#F0A020'); },
    memory: () => ({ sprites: cache.size, bytes: 0, draws, hits: 0, evictions: 0 }),
    room: () => { const r = box('room', STUB_ROOM.w, STUB_ROOM.h, '#E3E0D6'); return { ...r, dx: -STUB_ROOM.ox, dy: -STUB_ROOM.oy }; },
    roomLayout: () => STUB_ROOM,
    stack: (fl) => box('stack' + fl.length, 48, 26 + fl.length * 13 + 14, '#CDD2DA'),
  };
}
