// The two post-processing steps of every sprite: snap each pixel to the master palette (no
// semi-transparent pixels: anything under 47 % opacity is dropped), then a one-pixel dark outline around the shape.
// Both work on raw RGBA bytes, so they are tested without a canvas.
import { lut, OUTLINE_DAY, OUTLINE_NIGHT, PAL32 } from './palette.ts';

/** Alpha below this (of 255) is dropped; the rest becomes fully opaque. */
export const ALPHA_CUT = 120;

/** In place: every pixel either transparent (0) or an opaque palette colour. */
export function quantize(data: Uint8ClampedArray): void {
  const d = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2), LUT = lut();
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    d[i] = (v >>> 24) < ALPHA_CUT ? 0 : PAL32[LUT[(((v >> 3) & 31) << 10) | (((v >> 11) & 31) << 5) | ((v >> 19) & 31)]];
  }
}

/** In place: transparent pixels next to the shape (4-neighbours) become the outline colour. Exactly one pixel wide. */
export function outline(data: Uint8ClampedArray, w: number, h: number, night: boolean): void {
  const d = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
  const col = night ? OUTLINE_NIGHT : OUTLINE_DAY;
  const o = new Uint8Array(d.length);
  for (let y = 0; y < h; y++) {
    for (let i = y * w, e = i + w; i < e; i++) {
      if (d[i]) continue;
      if ((i > y * w && d[i - 1]) || (i < e - 1 && d[i + 1]) || (y && d[i - w]) || (y < h - 1 && d[i + w])) o[i] = 1;
    }
  }
  for (let i = 0; i < d.length; i++) if (o[i]) d[i] = col;
}
