// Cars: sedan, van, truck, bus, taxi (yellow with a roof light and a check band), and the fire
// engine (phase 5). All have windows, wheels and lights (white in front, red behind). A car is an aggregate:
// one car ≈ two calls in the last five minutes; with no calls the roads are empty.
import { P4, box, g, iso, line, type Pt } from './iso.ts';
import { env } from './light.ts';

export const CAR_COLOURS = ['#E5433D', '#2F8BFF', '#8BD93E', '#FFFFFF', '#19B8A0', '#8E5BE8', '#59627A', '#FF8A2B'];

export function paintCar(m: number, col: string, dx: number, dy: number): void {
  const ax = dx !== 0, fw = dx + dy > 0, L = [0.3, 0.34, 0.42, 0.5, 0.3, 0.44][m], Wd = 0.14;
  const body = m === 4 ? '#FFC928' : m === 5 ? '#E5433D' : col, glass = env.night > 0.5 ? '#FFD37E' : '#27304F';
  const bx = (a: number, b: number, z0: number, z1: number, c: string, tp?: string) => { const u0 = Math.min(a, b), u1 = Math.max(a, b); if (ax) box(u0, -Wd, u1, Wd, z0, z1, c, tp); else box(-Wd, u0, Wd, u1, z0, z1, c, tp); };
  const S = (u: number, z: number): Pt => (ax ? iso(u, Wd, z) : iso(Wd, u, z));
  const E = (v: number, z: number): Pt => (ax ? iso(L, v, z) : iso(v, L, z));
  const sQ = (u0: number, u1: number, z0: number, z1: number, c: string) => P4(S(u0, z0), S(u1, z0), S(u1, z1), S(u0, z1), c);
  const d = fw ? 1 : -1;
  if (m === 0 || m === 4) { bx(-L, L, 2, 8, body); bx(-L * 0.5, L * 0.45, 8, 12, glass, body); if (m === 4) { bx(-0.05, 0.05, 12, 15, '#FFFFFF'); for (let k = 0; k < 4; k++) sQ(-L + k * L * 0.5, -L + k * L * 0.5 + L * 0.25, 4, 6, '#141A30'); } }
  else if (m === 1) { bx(-L, L, 2, 13, body); sQ(-L * 0.8, L * 0.85, 8, 12, glass); sQ(-L, L, 4, 5, '#FFFFFF'); }
  else if (m === 2) { bx(-L * d, L * 0.25 * d, 2, 15, '#F4F1E8', '#CDD2DA'); bx(L * 0.32 * d, L * d, 2, 11, body); sQ(Math.min(L * 0.4 * d, L * 0.9 * d), Math.max(L * 0.4 * d, L * 0.9 * d), 7, 10, glass); }
  else if (m === 3) { bx(-L, L, 2, 15, body, '#F4F1E8'); sQ(-L * 0.9, L * 0.9, 8, 13, glass); sQ(-L, L, 4, 6, '#FFFFFF'); }
  else { bx(-L * d, L * 0.3 * d, 2, 11, '#E5433D', '#F4F1E8'); bx(L * 0.36 * d, L * d, 2, 12, '#E5433D'); sQ(Math.min(L * 0.45 * d, L * 0.9 * d), Math.max(L * 0.45 * d, L * 0.9 * d), 8, 11, glass); line(S(-L * 0.9 * d, 13), S(L * 0.2 * d, 13), '#CDD2DA', 3); bx(L * 0.6 * d, L * 0.7 * d, 12, 14, '#2F8BFF'); }
  for (const u of [-L * 0.6, L * 0.6]) { const q = S(u, 1.5); g.fillStyle = '#141A30'; g.fillRect(q[0] - 3, q[1] - 3, 6, 6); g.fillStyle = '#AEB5C2'; g.fillRect(q[0] - 1, q[1] - 1, 2, 2); }
  for (const v of [-Wd * 0.6, Wd * 0.6]) { const q = E(v, 5); g.fillStyle = fw ? '#FFF6CF' : '#E5433D'; g.fillRect(q[0] - 2, q[1] - 2, 4, 4); }
}

/** One car of a train: the engine in blue, carriages in white with a blue roof; windows lit at night. */
export function paintTrainCar(k: number, night: boolean): void {
  box(-1.15, -0.23, 0, 0.23, 2, 15, k ? '#F4F1E8' : '#2F6BDE', k ? '#2F6BDE' : '#1F4FB0');
  for (let w = 0; w < 4; w++) P4(iso(-1.05 + w * 0.26, 0.23, 8), iso(-0.87 + w * 0.26, 0.23, 8), iso(-0.87 + w * 0.26, 0.23, 12), iso(-1.05 + w * 0.26, 0.23, 12), night ? '#FFD37E' : '#27304F');
}

/** A hard-edged dithered pool of light, r art pixels wide each way (no transparency). */
export function paintPool(x: { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void }, col: string, r: number): void {
  x.fillStyle = col;
  for (let y = 0; y < r; y++) for (let xx = 0; xx < r * 2; xx++) {
    const d = Math.abs(xx - r) / r + Math.abs(y - r / 2) / (r / 2);
    if (d <= 1 && ((xx + y) & 1 || d < 0.45)) x.fillRect(xx, y, 1, 1);
  }
}
