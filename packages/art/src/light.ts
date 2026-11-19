// Light: stepped, not continuous, so sprites can be cached. Default is a constant bright midday;
// the dark theme is the night city; "sky follows the clock" is optional (five night levels, three warm levels).
// `env` and `P` are module state read by the painters; `setLight` is the only writer.
import { mix } from './palette.ts';

export interface Light {
  /** Dark theme → night. */
  dark: boolean;
  /** Optional: follow the time of day (hours, 0–24). Off by default (always midday or always night). */
  clockHour?: number;
}

export interface Env { night: number; warm: number; sx: number; sy: number; kL: number; kR: number; key: string }
export const env: Env = { night: 0, warm: 0, sx: 0, sy: -1, kL: -0.02, kR: -0.3, key: '' };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** A colour in the current light: s < 0 shades towards ink, s > 0 lifts towards white; then warm, then night. */
export function tone(c: string, s: number): string {
  let v = s < 0 ? mix(c, '#27304F', -s) : mix(c, '#FFFFFF', s);
  if (env.warm > 0.03) v = mix(v, '#F6C49A', env.warm * 0.25);
  return env.night > 0.02 ? mix(v, '#131C40', env.night * 0.55) : v;
}

export interface GroundPalette {
  sky: string; grass: string; side: string; road: string; dash: string; plaza: string; wood: string; wood2: string;
  water: string; water2: string; rail: string; sleeper: string; tree1: string; tree2: string; pine: string; trunk: string;
  shadow: string; lit: string; dark: string; crane: string;
}
export const P: GroundPalette = {} as GroundPalette;

/** Sets the light; returns its key (part of every sprite key). */
export function setLight(l: Light): string {
  const h = l.clockHour ?? 12;
  const u = Math.round(clamp((h - 6) / 12, 0, 1) * 6) / 6;
  env.night = Math.round((l.clockHour !== undefined ? clamp(smooth(18.2, 19.6, h) + 1 - smooth(5.2, 6.6, h), 0, 1) : (l.dark ? 1 : 0)) * 4) / 4;
  env.warm = l.clockHour !== undefined ? Math.round((1 - env.night) * Math.max(smooth(16.2, 18.4, h), 1 - smooth(6, 8.4, h)) * 2) / 2 : 0;
  const th = lerp(135, 315, u) * Math.PI / 180, len = (0.4 + 0.85 * Math.abs(2 * u - 1)) * 0.5;
  env.sx = Math.cos(th) * len; env.sy = Math.sin(th) * len; env.kL = -0.02; env.kR = -0.3;
  const key = env.night + '|' + env.warm + '|' + u.toFixed(3);
  if (key === env.key) return key;
  env.key = key;
  const n = env.night, m = (a: string, b: string) => mix(a, b, n);
  Object.assign(P, {
    sky: m('#EEF7FB', '#0A0F24'),
    grass: tone('#4CC552', 0), side: tone('#E3E0D6', 0), road: tone('#C3C9D4', 0), dash: m('#FFFFFF', '#8A93A3'), plaza: tone('#FFF6CF', 0),
    wood: tone('#C9925A', 0), wood2: tone('#A8743F', 0), water: m('#2FA8F0', '#1F4FB0'), water2: m('#7FD0FF', '#2F6BDE'),
    rail: m('#39415A', '#8A93A3'), sleeper: tone('#8D6B52', 0), tree1: tone('#2E9E48', 0), tree2: tone('#4CC552', 0), pine: tone('#2A6B55', 0),
    trunk: tone('#8D6B52', 0), shadow: n > 0.5 ? 'rgba(10,15,36,.35)' : 'rgba(39,48,79,.22)',
    lit: m('#DDF0F8', '#FFD37E'), dark: m('#7A8FB5', '#1E2A55'), crane: m('#F2B233', '#F0A020'),
  } satisfies GroundPalette);
  return key;
}
setLight({ dark: false });
