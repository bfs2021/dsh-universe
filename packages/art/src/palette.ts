// The master palette: about 120 colours, every sprite pixel is snapped to one of them.
// All rights reserved.

/** The bold flat colours buildings are painted in. */
export const BOLD: readonly string[] = ['#FF4FA3', '#22C3E6', '#8BD93E', '#FFC928', '#E5433D', '#8E5BE8', '#FF8A2B', '#2F8BFF', '#19B8A0', '#F4F1E8'];

/** State colours of the city (pixels only; the interface has its own). */
export const SC = { running: '#2F8BFF', waiting: '#F0A020', done: '#35B37A', failed: '#E5564B', idle: '#8A93A3', future: '#8A93A3' } as const;

/** Floor and place colours: one per kind of floor, used for the band on top of each segment. */
export const FC = {
  lobby: '#8A93A3', library: '#6C7BEA', workshop: '#E8873A', machine: '#59627A', meeting: '#B565D9', roof: '#2F8BFF',
  tool: '#14A8A4', plat: '#2F6BDE', gate: '#4DA3FF', appr: '#E0A01C', skill: '#35B37A', bay: '#E5433D',
} as const;

/** Workspace colours, by the order a workspace first appeared (block tint, name plate). */
export const WORKSPACE_WALL: readonly string[] = ['#F2B233', '#5FAE6B', '#8E7BD6', '#4DA3FF', '#FF8A2B', '#19B8A0', '#D9628A', '#6C7BEA'];

const BASE = ['#FFFFFF', '#F4F1E8', '#E3E0D6', '#CDD2DA', '#AEB5C2', '#8A93A3', '#6F7A8C', '#59627A', '#39415A', '#27304F', '#141A30',
  '#0A0F24', '#131C40', '#1E2A55', '#2B3A6B', '#3D4F85', '#C4D7A0', '#A9D49B', '#7CC67F', '#5FAE6B', '#3F9070', '#2A6B55', '#1F4A45',
  '#F3E7D3', '#E8DCC6', '#D9C7A8', '#C9A27A', '#B48C69', '#8D6B52', '#5A4636', '#FBE3C4', '#F6C49A', '#E8873A', '#E8705A', '#E5564B', '#C8643C', '#B5573A', '#7A2E2A',
  '#FFD37E', '#F2B233', '#F0A020', '#BFF1EE', '#8ADBDD', '#58C2C8', '#14A8A4', '#0E8C89', '#12405A', '#DDF0F8', '#BDE2F4', '#9CC9E8', '#4DA3FF', '#2F8BFF', '#2F6BDE', '#1F4FB0',
  '#E9DDF5', '#D6C8EF', '#B565D9', '#8E7BD6', '#6C7BEA', '#D9628A', '#F0D2A4', '#BCE0CC', '#BBD6F0', '#F2D8C2', '#FFF4DC', '#F2C9A5', '#E3B089', '#C98F6A', '#35B37A', '#7A8FB5', '#56618A', '#C3C9D4', '#A7AEBC', '#2FA8F0', '#7FD0FF', '#C9925A', '#A8743F', '#4CC552', '#2E9E48', '#EEF7FB', '#FFE9F3', '#FFF6CF', '#E6F7D6', '#A8553A', '#8D4A36', '#7A5548'];

export const hx = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex = (c: readonly number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix0 = (a: string, b: string, k: number) => { const A = hx(a), B = hx(b); return hex(A.map((v, i) => v * (1 - k) + B[i] * k)); };

/** The master palette: the base set, then each bold colour with a dark, a light and a night shade. */
export const MASTER: readonly string[] = (() => {
  const out = BASE.slice();
  for (const c of BOLD) out.push(c, mix0(c, '#27304F', 0.3), mix0(c, '#FFFFFF', 0.28), mix0(c, '#131C40', 0.55));
  return out.map((c) => c.toUpperCase());
})();

/** Palette entries as little-endian RGBA words (the layout of ImageData read through a Uint32Array). */
export const PAL32: Uint32Array = new Uint32Array(MASTER.map((h) => { const c = hx(h); return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }));

/** 15-bit colour → palette index (weighted nearest). Built on first use (about 20 ms), 32768 entries. */
let lutCache: Uint8Array | undefined;
export function lut(): Uint8Array {
  if (lutCache) return lutCache;
  lutCache = (() => {
  const P3 = MASTER.map(hx);
  const lut = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    let best = 0, bd = Infinity;
    const R8 = r * 8 + 4, G8 = g * 8 + 4, B8 = b * 8 + 4;
    for (let i = 0; i < P3.length; i++) {
      const c = P3[i];
      const d = (c[0] - R8) * (c[0] - R8) * 3 + (c[1] - G8) * (c[1] - G8) * 4 + (c[2] - B8) * (c[2] - B8) * 2;
      if (d < bd) { bd = d; best = i; }
    }
    lut[(r << 10) | (g << 5) | b] = best;
  }
  return lut;
  })();
  return lutCache;
}

const mixCache = new Map<string, string>();
/** a → b by k, in 32 steps (so the results are few and cacheable). */
export function mix(a: string, b: string, k: number): string {
  const q = (Math.min(1, Math.max(0, k)) * 32 + 0.5) | 0;
  if (!q) return a;
  const key = a + b + q;
  let v = mixCache.get(key);
  if (v) return v;
  const A = hx(a), B = hx(b);
  v = '#' + A.map((c, i) => Math.round(c + (B[i] - c) * q / 32).toString(16).padStart(2, '0')).join('');
  mixCache.set(key, v);
  return v;
}

/** Outline colours: day #141A30, night #0A0F24, as RGBA words. */
export const OUTLINE_DAY = 0xFF301A14;
export const OUTLINE_NIGHT = 0xFF240F0A;

const PAL_SET = new Set<number>(PAL32);
/** Whether an RGBA word is fully opaque and in the palette (or one of the outline colours). */
export const inPalette = (word: number) => PAL_SET.has(word >>> 0) || (word >>> 0) === OUTLINE_DAY || (word >>> 0) === OUTLINE_NIGHT;

/**
 * A floor whose data the platform does not provide: the whole room through the grey ramp the
 * data views use, by lightness, outlines kept. Night uses the same ramp two steps darker.
 */
const RAMP_DAY = ['#8A93A3', '#AEB5C2', '#CDD2DA', '#F4F1E8'].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const RAMP_NIGHT = ['#39415A', '#59627A', '#6F7A8C', '#8A93A3'].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
export function greyRamp(px: Uint8ClampedArray, night = false): void {
  const R = night ? RAMP_NIGHT : RAMP_DAY;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    if (l < 0.16) continue;   // outlines and the darkest ink stay
    const c = R[l > 0.82 ? 3 : l > 0.66 ? 2 : l > 0.48 ? 1 : 0];
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
}
