// The sprite cache: a thing is painted with vectors once, snapped to the palette, outlined, and then
// only blitted. Entries are keyed by everything that changes the drawing (identity, state, frame, light). Two kinds:
// a slot per owner (a building keeps exactly one sprite, redrawn in place when its key changes) and shared sprites
// (props, trees, cars) evicted least-recently-used once the byte budget is reached.
import type { Canvas2D } from '@dsh-universe/renderer';
import { withPen } from './iso.ts';
import { env } from './light.ts';
import { outline, quantize } from './quantize.ts';

/** Art pixels per drawing unit. */
export const AS = 0.5;

export interface Surface { canvas: CanvasImageSource & { width: number; height: number }; ctx: Canvas2D }
export type SurfaceFactory = (w: number, h: number) => Surface;

export interface Sprite {
  image: CanvasImageSource;
  /** Top-left of the image in art pixels, relative to the art-pixel position of the anchor tile. */
  dx: number;
  dy: number;
  w: number;
  h: number;
}

interface Entry extends Sprite { key: string; surface: Surface; bytes: number }

export function defaultSurface(w: number, h: number): Surface {
  const canvas: Surface['canvas'] = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = (canvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true }) as Canvas2D;
  return { canvas, ctx };
}

export interface SpriteStats { sprites: number; bytes: number; draws: number; hits: number; evictions: number }

export class SpriteCache {
  private readonly slots = new Map<string, Entry>();
  private bytes = 0;
  private draws = 0;
  private hits = 0;
  private evictions = 0;
  private readonly make: SurfaceFactory;
  readonly budgetBytes: number;
  constructor(make: SurfaceFactory = defaultSurface, budgetBytes = 48 * 1024 * 1024) { this.make = make; this.budgetBytes = budgetBytes; }

  /**
   * The sprite of `owner` for `key`. A hit returns the cached sprite without painting. A miss paints `paint` with
   * the pen on a w×h surface whose drawing origin is the anchor tile (tx0, ty0) placed at art pixel (ox, oy).
   */
  get(owner: string, key: string, w: number, h: number, ox: number, oy: number, paint: () => void, o: { tx0?: number; ty0?: number; outline?: boolean } = {}): Sprite {
    const e = this.slots.get(owner);
    if (e && e.key === key) {
      this.hits++;
      this.slots.delete(owner);
      this.slots.set(owner, e);
      return e;
    }
    const tx0 = o.tx0 ?? 0, ty0 = o.ty0 ?? 0;
    let surface = e && e.surface.canvas.width === w && e.surface.canvas.height === h ? e.surface : undefined;
    if (e) { this.bytes -= e.bytes; this.slots.delete(owner); }
    surface ??= this.make(w, h);
    const x = surface.ctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, w, h);
    x.setTransform(AS, 0, 0, AS, ox - (tx0 - ty0) * 16, oy - (tx0 + ty0) * 8);
    withPen(x, paint);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const im = x.getImageData(0, 0, w, h);
    quantize(im.data);
    if (o.outline !== false) outline(im.data, w, h, env.night > 0.5);
    x.putImageData(im, 0, 0);
    this.draws++;
    const n: Entry = { key, surface, image: surface.canvas, dx: -ox, dy: -oy, w, h, bytes: w * h * 4 };
    this.slots.set(owner, n);
    this.bytes += n.bytes;
    this.evict(owner);
    return n;
  }

  /** The sprite an owner has now, whatever its key (a stale one is better than none when the frame is busy). */
  peek(owner: string): Sprite | undefined { return this.slots.get(owner); }

  /** A shared sprite: its key is its owner. */
  shared(key: string, w: number, h: number, ox: number, oy: number, paint: () => void, o?: { outline?: boolean }): Sprite {
    return this.get(key, key, w, h, ox, oy, paint, o);
  }

  /** Forgets an owner (a building that is no longer drawn). */
  drop(owner: string): void {
    const e = this.slots.get(owner);
    if (!e) return;
    this.bytes -= e.bytes;
    this.slots.delete(owner);
  }

  private evict(keep: string): void {
    for (const [k, e] of this.slots) {
      if (this.bytes <= this.budgetBytes) break;
      if (k === keep) continue;
      this.bytes -= e.bytes;
      this.slots.delete(k);
      this.evictions++;
    }
  }

  stats(): SpriteStats { return { sprites: this.slots.size, bytes: this.bytes, draws: this.draws, hits: this.hits, evictions: this.evictions }; }
  clear(): void { this.slots.clear(); this.bytes = 0; }
}
