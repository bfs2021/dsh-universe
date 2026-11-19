// The camera: a centre in art pixels and a zoom level. One art pixel is always a whole number of
// device pixels at levels ≥ 1 (the scale is rounded to the device pixel ratio), so pixel art stays crisp.
import { GROWTH } from '@dsh-universe/model';
import { ZOOM_LEVELS } from './geometry.ts';

export interface Camera { x: number; y: number; zi: number }
export interface Viewport { w: number; h: number; dpr: number }

/**
 * How far out the camera goes: narrow screens to 0.25, desktops to 0.5, but never below one device pixel per art
 * pixel, which would drop pixels and turn the city to speckle; the view pans instead.
 */
export const minZoom = (vp: Viewport) => {
  let i = vp.w <= 760 ? 0 : 1;
  // Below a device pixel ratio of 1 (a page zoomed out on a 1× screen) level 1 is under one device pixel too.
  while (i < ZOOM_LEVELS.length - 1 && ZOOM_LEVELS[i] * vp.dpr < 1) i++;
  return i;
};
/**
 * The device pixel ratio the city draws at: the screen's own, so the backing store maps one to one onto device pixels
 * (a ratio held at 1 on a 0.9× page left the browser shrinking the canvas, dropping pixel columns), at most 3.
 */
export const deviceRatio = (dpr: number) => (Number.isFinite(dpr) && dpr > 0 ? Math.max(0.5, Math.min(3, dpr)) : 1);
/** The home view: desktop level 2 (3 on very wide screens), narrow level 1; centred on the square. */
export function homeCamera(vp: Viewport): Camera {
  return { x: 0, y: 232, zi: vp.w > 760 ? 3 : 2 };
}
/** The whole city in view: the largest zoom level at which the border fits, centred on it. */
export function wholeCity(vp: Viewport, growth = 0): Camera {
  const G = GROWTH[Math.max(0, Math.min(GROWTH.length - 1, growth))];
  const xs = [G[0] - G[1], G[2] - G[1], G[0] - G[3], G[2] - G[3]].map((v) => v * 16);
  const ys = [G[0] + G[1], G[2] + G[3]].map((v) => v * 8);
  const w = Math.max(...xs) - Math.min(...xs) + 40, h = ys[1] - ys[0] + 180;
  let zi = minZoom(vp);
  for (let i = ZOOM_LEVELS.length - 1; i >= minZoom(vp); i--) if (w * ZOOM_LEVELS[i] <= vp.w && h * ZOOM_LEVELS[i] <= vp.h) { zi = i; break; }
  return { x: Math.round((Math.max(...xs) + Math.min(...xs)) / 2), y: Math.round((ys[0] + ys[1]) / 2 + 20), zi };
}

/** Device pixels per art pixel at this camera. */
export function scaleOf(cam: Camera, vp: Viewport): number {
  const z = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, cam.zi))] * vp.dpr;
  return z >= 1 ? Math.round(z) : z;
}

/** One zoom step, keeping the art pixel under (sx, sy) (CSS pixels) where it is. */
export function zoomStep(cam: Camera, d: number, vp: Viewport, sx?: number, sy?: number): Camera {
  const zi = Math.max(minZoom(vp), Math.min(ZOOM_LEVELS.length - 1, cam.zi + d));
  if (zi === cam.zi) return cam;
  if (sx === undefined || sy === undefined) return { ...cam, zi };
  const s0 = scaleOf(cam, vp) / vp.dpr, s1 = scaleOf({ ...cam, zi }, vp) / vp.dpr;
  const wx = cam.x + (sx - vp.w / 2) / s0, wy = cam.y + (sy - vp.h / 2) / s0;
  return { x: wx - (sx - vp.w / 2) / s1, y: wy - (sy - vp.h / 2) / s1, zi };
}

/** Pan by CSS pixels. */
export const pan = (cam: Camera, dx: number, dy: number, vp: Viewport): Camera => {
  const s = scaleOf(cam, vp) / vp.dpr;
  return { ...cam, x: cam.x - dx / s, y: cam.y - dy / s };
};

/** Art pixel → CSS pixel. */
export function toScreen(ax: number, ay: number, cam: Camera, vp: Viewport): [number, number] {
  const s = scaleOf(cam, vp) / vp.dpr;
  return [(ax - Math.round(cam.x)) * s + vp.w / 2, (ay - Math.round(cam.y)) * s + vp.h / 2];
}
/** CSS pixel → art pixel. */
export function toArt(sx: number, sy: number, cam: Camera, vp: Viewport): [number, number] {
  const s = scaleOf(cam, vp) / vp.dpr;
  return [(sx - vp.w / 2) / s + Math.round(cam.x), (sy - vp.h / 2) / s + Math.round(cam.y)];
}
