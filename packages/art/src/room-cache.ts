// Room sprites. A room is composed the way the city is: every prop (a workstation, the
// centrepiece, the side room, a plant, the lamps …) is painted on its own, snapped to the palette (coverage under
// 47 % dropped, so no blended fringes against the floor) and outlined one pixel, then laid over the room's shell in
// depth order. The shell (floor, walls, what hangs on them) is snapped too but not outlined. A room is redrawn only
// when its spec changes: at most ten times a second while an agent works there, never while it is idle.
import { withPen } from './iso.ts';
import { setItemHook } from './props/pen.ts';
import { outline, quantize } from './quantize.ts';

/**
 * Items drawn on the room's 2-pixel art grid: snapped to their own colours, reduced to 2×2
 * blocks and outlined at that size, so they match the people, plants and columns. Only items drawn for that
 * grid use it (chunky parts, no 1-pixel detail): the redrawn workstations (`unitc…`) and wall art (`wallc`, and `walld` for the video wall, which keeps its lines).
 */
const COARSE = /^(unitc\d*|wallc|walld|sidec|cornerc|centrec|(reception|pallet|seats|lounge|counter|queue|bench|desk|housing|tank|panel|hvac|bed)c[\d.]*)$/;

/** In place: every drawn pixel becomes the nearest of `inks` (so a coarse item's edges never take an in-between colour). */
export function snapTo(data: Uint8ClampedArray, inks: readonly string[]): void {
  if (!inks.length) return;
  const c = inks.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    let best = 0, bd = Infinity;
    for (let k = 0; k < c.length; k++) { const dr = data[i] - c[k][0], dg = data[i + 1] - c[k][1], db = data[i + 2] - c[k][2], d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < bd) { bd = d; best = k; } }
    data[i] = c[best][0]; data[i + 1] = c[best][1]; data[i + 2] = c[best][2];
  }
}
import { AS, defaultSurface, type Sprite, type Surface, type SurfaceFactory } from './sprites.ts';
import type { Canvas2D } from '@dsh-universe/renderer';

/** An item as the room cache laid it down (see RoomCache.trace). */
export interface TracedItem { tag: string; outlined: boolean; x: number; y: number; w: number; h: number; data: Uint8ClampedArray }

interface Slot { surface: Surface; key: string; sprite: Sprite }

/** Bounds of what is drawn through a context, in canvas pixels (the room transform is a fixed scale and offset). */
class Bounds {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity; lw = 1;
  /** The solid colours drawn with since the last reset. */
  readonly inks = new Set<string>();
  ox: number; oy: number;
  constructor(ox: number, oy: number) { this.ox = ox; this.oy = oy; }
  add(x: number, y: number, r = 0): void {
    const px = this.ox + x * AS, py = this.oy + y * AS, rr = r * AS;
    if (px - rr < this.x0) this.x0 = px - rr; if (px + rr > this.x1) this.x1 = px + rr;
    if (py - rr < this.y0) this.y0 = py - rr; if (py + rr > this.y1) this.y1 = py + rr;
  }
  reset(): void { this.x0 = this.y0 = Infinity; this.x1 = this.y1 = -Infinity; this.lw = 1; this.inks.clear(); }
}

/** A context that draws through to `x` and records the bounds of every path and rectangle. */
function tracking(x: Canvas2D, b: Bounds): Canvas2D {
  const t = x as unknown as Record<string, unknown>;
  const wrap: Record<string, unknown> = {
    moveTo: (px: number, py: number) => { b.add(px, py); x.moveTo(px, py); },
    lineTo: (px: number, py: number) => { b.add(px, py); x.lineTo(px, py); },
    arc: (px: number, py: number, r: number, a0: number, a1: number, ccw?: boolean) => { b.add(px, py, r); x.arc(px, py, r, a0, a1, ccw); },
    ellipse: (px: number, py: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean) => { b.add(px, py, Math.max(rx, ry)); x.ellipse(px, py, rx, ry, rot, a0, a1, ccw); },
    fillRect: (px: number, py: number, w: number, h: number) => { b.add(px, py); b.add(px + w, py + h); x.fillRect(px, py, w, h); },
    rect: (px: number, py: number, w: number, h: number) => { b.add(px, py); b.add(px + w, py + h); x.rect(px, py, w, h); },
  };
  const bound = new Map<string, unknown>();
  return new Proxy(t, {
    get(target, k: string) {
      if (k in wrap) return wrap[k];
      const v = target[k];
      if (typeof v !== 'function') return v;
      let f = bound.get(k);
      if (!f) { f = (v as (...a: unknown[]) => unknown).bind(target); bound.set(k, f); }
      return f;
    },
    set(target, k: string, v) {
      if (k === 'lineWidth' && typeof v === 'number' && v > b.lw) b.lw = v;
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) b.inks.add(v);
      target[k] = v; return true;
    },
  }) as unknown as Canvas2D;
}

export class RoomCache {
  private readonly slots = new Map<string, Slot>();
  private readonly make: SurfaceFactory;
  private scratch: Surface | undefined;
  draws = 0;
  /**
   * When set (checks only): every item composed into the next rooms, as laid down (snapped and outlined, before it is
   * drawn over the room), with its tag and place in the sprite. scripts/room-check.mjs `--crisp` measures the props'
   * pixel size and detail from it.
   */
  trace: TracedItem[] | null = null;
  /** Props composed (each snapped and outlined on its own). */
  items = 0;
  constructor(make: SurfaceFactory = defaultSurface) { this.make = make; }

  /**
   * See ArtKit.room. `box` = [w, h, ox, oy] in art pixels; `night` picks the outline colour; `finish` recolours the result. A `part` is accepted
   * for the renderer's frame budget but the room is composed at once (props are small; see scripts/room-check).
   */
  get(owner: string, key: string, box: readonly [number, number, number, number], paint: () => void, night = false, _part?: { i: number; n: number }, finish?: (px: Uint8ClampedArray) => void): Sprite | undefined {
    const slot0 = this.slots.get(owner);
    if (slot0 && slot0.key === key) return slot0.sprite;
    const [w, h, ox, oy] = box;
    let slot = slot0;
    if (!slot || slot.surface.canvas.width !== w || slot.surface.canvas.height !== h) {
      const surface = this.make(w, h);
      slot = { surface, key: '', sprite: { image: surface.canvas, dx: -ox, dy: -oy, w, h } };
      this.slots.set(owner, slot);
    }
    if (!this.scratch || this.scratch.canvas.width < w || this.scratch.canvas.height < h) this.scratch = this.make(Math.max(w, 404), Math.max(h, 236));
    const S = this.scratch.ctx, D = slot.surface.ctx;
    D.setTransform(1, 0, 0, 1, 0, 0); D.clearRect(0, 0, w, h);
    S.setTransform(1, 0, 0, 1, 0, 0); S.clearRect(0, 0, w, h);
    const b = new Bounds(ox, oy);
    let outlined = false;
    // Finish what has been painted since the last boundary: snap, outline, lay it down, clear the scratch.
    const flush = () => {
      if (b.x0 > b.x1) return;
      if (coarse) { flushCoarse(); return; }
      const m = Math.ceil(b.lw * AS) + 2;
      const x0 = Math.max(0, Math.floor(b.x0) - m), y0 = Math.max(0, Math.floor(b.y0) - m);
      const x1 = Math.min(w, Math.ceil(b.x1) + m), y1 = Math.min(h, Math.ceil(b.y1) + m);
      b.reset();
      if (x1 <= x0 || y1 <= y0) return;
      S.setTransform(1, 0, 0, 1, 0, 0);
      const im = S.getImageData(x0, y0, x1 - x0, y1 - y0);
      quantize(im.data);
      if (outlined) outline(im.data, x1 - x0, y1 - y0, night);
      this.trace?.push({ tag, outlined, x: x0, y: y0, w: x1 - x0, h: y1 - y0, data: new Uint8ClampedArray(im.data) });
      S.putImageData(im, x0, y0);
      D.drawImage(S.canvas as CanvasImageSource, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      S.clearRect(x0, y0, x1 - x0, y1 - y0);
      S.setTransform(AS, 0, 0, AS, ox, oy);
      this.items++;
    };
    // A coarse item is drawn at full size like any other, then each 2×2 block takes its most
    // common colour (antialiased seams, one pixel wide, lose the vote), the outline is drawn at that size and the
    // result laid down at twice the size: the item sits on the same 2-pixel grid as the people, plants and columns.
    const flushCoarse = () => {
      const m = Math.ceil(b.lw * AS) + 4;
      let x0 = Math.max(0, Math.floor(b.x0) - m), y0 = Math.max(0, Math.floor(b.y0) - m);
      let x1 = Math.min(w, Math.ceil(b.x1) + m), y1 = Math.min(h, Math.ceil(b.y1) + m);
      x0 -= x0 & 1; y0 -= y0 & 1; x1 -= x1 & 1; y1 -= y1 & 1;
      const inks = [...b.inks];
      b.reset();
      if (x1 <= x0 || y1 <= y0) return;
      const fw = x1 - x0, fh = y1 - y0, hw = fw >> 1, hh = fh >> 1;
      S.setTransform(1, 0, 0, 1, 0, 0);
      const im = S.getImageData(x0, y0, fw, fh);
      quantize(im.data);
      snapTo(im.data, inks);
      const d = new Uint32Array(im.data.buffer, im.data.byteOffset, fw * fh), half = new Uint32Array(hw * hh);
      // Wall art keeps its lines: there a block takes its commonest colour other than the item's background, so a
      // one-pixel line becomes a two-pixel one instead of losing the vote.
      let bg = 0;
      if (detail) { const n = new Map<number, number>(); for (const v of d) if (v) n.set(v, (n.get(v) ?? 0) + 1); let bn = 0; for (const [v, c] of n) if (c > bn) { bn = c; bg = v; } }
      for (let by = 0; by < hh; by++) for (let bx = 0; bx < hw; bx++) {
        const i = by * 2 * fw + bx * 2, q = [d[i], d[i + 1], d[i + fw], d[i + fw + 1]];
        if (detail && q.some((v) => v && v !== bg)) { const f = q.filter((v) => v && v !== bg); let best = f[0], bn = 0; for (const v of f) { const n = f.filter((u) => u === v).length; if (n > bn) { bn = n; best = v; } } half[by * hw + bx] = best; continue; }
        let best = 0, bn = 0, tie = false;
        for (const v of q) { if (!v) continue; let n = 0; for (const u of q) if (u === v) n++; if (n > bn) { bn = n; best = v; tie = false; } else if (n === bn && v !== best) tie = true; }
        if (tie) {   // two colours two each (a one-pixel line across the block): the one the surroundings have more of
          const around = (c: number) => { let n = 0; for (let yy = Math.max(0, by * 2 - 1); yy < Math.min(fh, by * 2 + 3); yy++) for (let xx = Math.max(0, bx * 2 - 1); xx < Math.min(fw, bx * 2 + 3); xx++) if (d[yy * fw + xx] === c) n++; return n; };
          const other = q.find((v) => v && v !== best)!;
          if (around(other) > around(best)) best = other;
        }
        half[by * hw + bx] = q.filter((v) => v).length >= 2 ? best : 0;
      }
      if (outlined) outline(new Uint8ClampedArray(half.buffer), hw, hh, night);
      for (let by = 0; by < hh; by++) for (let bx = 0; bx < hw; bx++) { const v = half[by * hw + bx], i = by * 2 * fw + bx * 2; d[i] = d[i + 1] = d[i + fw] = d[i + fw + 1] = v; }
      this.trace?.push({ tag, outlined, x: x0, y: y0, w: fw, h: fh, data: new Uint8ClampedArray(im.data) });
      S.putImageData(im, x0, y0);
      D.drawImage(S.canvas as CanvasImageSource, x0, y0, fw, fh, x0, y0, fw, fh);
      S.clearRect(x0, y0, fw, fh);
      S.setTransform(AS, 0, 0, AS, ox, oy);
      this.items++;
    };
    S.setTransform(AS, 0, 0, AS, ox, oy);
    let coarse = false;
    let detail = false;
    let tag = '';
    setItemHook((t, ol) => { flush(); tag = t; outlined = ol; coarse = COARSE.test(t); detail = t === 'walld'; });
    try { withPen(tracking(S, b), paint); flush(); } finally { setItemHook(null); S.setTransform(1, 0, 0, 1, 0, 0); }
    // A last pass over the finished room (an unavailable floor goes through the grey ramp).
    if (finish) { const im = D.getImageData(0, 0, w, h); finish(im.data); D.putImageData(im, 0, 0); }
    slot.key = key;
    this.draws++;
    return slot.sprite;
  }

  drop(owner: string): void { this.slots.delete(owner); }
  clear(): void { this.slots.clear(); }
  bytes(): number { let n = 0; for (const s of this.slots.values()) n += s.surface.canvas.width * s.surface.canvas.height * 4; if (this.scratch) n += this.scratch.canvas.width * this.scratch.canvas.height * 4; return n; }
}
