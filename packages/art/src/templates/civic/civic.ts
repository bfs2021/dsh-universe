// The 14 civic templates: town hall, station, fire station, skill school, library, two power
// stations, three connector shapes and four plugin shops.
// Windows are lit at night only when someone works inside; clocks
// show the real time; nothing else moves.
import type { CivicSpec } from '@dsh-universe/renderer';
import { P4, box, disc, fillQ, flat, g, iso, lerp, line, oval, ring, shadow, winQ, type Quad } from '../../iso.ts';
import { env, P, tone } from '../../light.ts';
import { BOLD, FC } from '../../palette.ts';

export const CIVIC_TEMPLATES = ['town', 'station', 'fire', 'school', 'library', 'power-0', 'power-1', 'connector-0', 'connector-1', 'connector-2', 'shop-0', 'shop-1', 'shop-2', 'shop-3'] as const;

const litOr = (on: boolean) => (on && env.night > 0.5 ? P.lit : env.night > 0.5 ? P.dark : P.lit);
const hands = (c: [number, number], minutes: number, ink: string) => {
  const hh = (minutes / 60) % 12 / 12 * 6.283 - 1.571, mm = Math.floor(minutes / 5) * 5 / 60 * 6.283 - 1.571;
  disc(c, 7, '#FFFFFF'); g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.arc(c[0], c[1], 7, 0, 6.3);
  g.moveTo(c[0], c[1]); g.lineTo(c[0] + Math.cos(hh) * 3.4, c[1] + Math.sin(hh) * 3.4); g.moveTo(c[0], c[1]); g.lineTo(c[0] + Math.cos(mm) * 5.5, c[1] + Math.sin(mm) * 5.5); g.stroke();
};

/** The town hall: the largest site in town; floodlit at night while someone waits in the square. Returns its top. */
export function paintTown(s: CivicSpec): number {
  const x0 = 12.6, x1 = 16.4, y0 = 13.6, y1 = 16.2, W0 = '#FFF6CF', G0 = '#FFC928', n0 = env.night;
  if (s.active) env.night = n0 * 0.25;
  try {
    box(x0 - 0.25, y0 - 0.25, x1 + 0.25, y1 + 0.55, 0, 4, '#E3E0D6'); box(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.3, 4, 8, '#F4F1E8');
    box(x0, y0, x1, y1, 8, 40, W0, '#F4F1E8');
    for (let k = 0; k < 9; k++) { const x = x0 + 0.22 + k * 0.42; line(iso(x, y1, 8), iso(x, y1, 36), '#FFFFFF', 5); line(iso(x + 0.09, y1, 8), iso(x + 0.09, y1, 36), '#CDD2DA', 2); }
    for (let k = 0; k < 5; k++) { const y = y1 - 0.3 - k * 0.5; line(iso(x1, y, 8), iso(x1, y, 36), '#F4F1E8', 5); }
    P4(iso(x0, y1, 36), iso(x1, y1, 36), iso(x1, y1, 40), iso(x0, y1, 40), tone(G0, 0)); P4(iso(x1, y1, 36), iso(x1, y0, 36), iso(x1, y0, 40), iso(x1, y1, 40), tone(G0, -0.3));
    P4(iso(14.2, y1, 8), iso(14.8, y1, 8), iso(14.8, y1, 27), iso(14.2, y1, 27), '#8E5BE8'); P4(iso(14.47, y1, 8), iso(14.53, y1, 8), iso(14.53, y1, 27), iso(14.47, y1, 27), '#141A30');
    const a = iso(13.3, y1, 40), b = iso(15.7, y1, 40), r = iso(14.5, y1, 58); g.fillStyle = tone(G0, 0); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(r[0], r[1]); g.closePath(); g.fill();
    hands(iso(14.5, y1, 46), s.clock, '#141A30');
    box(13.5, 14.2, 15.5, 15.6, 40, 54, W0, '#F4F1E8');
    const c = iso(14.5, 14.9, 54); g.fillStyle = tone('#22C3E6', -0.3); g.beginPath(); g.ellipse(c[0], c[1], 46, 23, 0, 0, 6.3); g.fill();
    g.fillStyle = tone('#22C3E6', 0); g.beginPath(); g.ellipse(c[0], c[1] - 2, 42, 40, 0, Math.PI, 0); g.fill(); g.fillStyle = '#FFFFFF'; g.fillRect(c[0] - 24, c[1] - 30, 6, 12);
    line([c[0], c[1] - 42], [c[0], c[1] - 68], '#59627A', 4); g.fillStyle = '#E5433D'; g.fillRect(c[0] + 2, c[1] - 68, 18, 12);
    for (const x of [x0 + 0.1, x1 - 0.1]) { const f = iso(x, y1 + 0.25, 8); line(f, [f[0], f[1] - 40], '#59627A', 2); g.fillStyle = x < 14 ? '#FF4FA3' : '#8BD93E'; g.fillRect(f[0], f[1] - 40, 14, 9); }
    if (s.hover) ring([iso(x0 - 0.4, y0 - 0.4), iso(x1 + 0.4, y0 - 0.4), iso(x1 + 0.4, y1 + 0.7), iso(x0 - 0.4, y1 + 0.7)], FC.appr, 4);
  } finally { env.night = n0; }
  return 150;
}

export function paintStation(s: CivicSpec): number {
  shadow(7.2, 13.1, 10.2, 13.8, 18); box(7.2, 13.1, 10.2, 13.8, 0, 16, '#F3E7D3', '#2F6BDE');
  const lit: Quad[] = [], dark: Quad[] = [];
  winQ(lit, dark, 7.2, 13.1, 10.2, 13.8, 5, 12, 7, 0, (c, f) => !f && c % 2 === 0 && (s.active || env.night <= 0.5)); fillQ(dark, P.dark); fillQ(lit, P.lit);
  flat(6.9, 13.9, 11.3, 14.15, 3, tone('#CDD2DA', 0)); box(11.5, 14.3, 11.7, 14.7, 0, 7, '#E5564B'); box(10.5, 13.15, 11.0, 13.65, 0, 58, '#F3E7D3', '#2F6BDE');
  hands(iso(11.0, 13.4, 47), s.clock, '#27304F');
  if (s.hover) oval(iso(9, 13.45), 110, 55, FC.plat, 4);
  return 66;
}

export function paintFire(s: CivicSpec): number {
  const [cx, cy] = s.at;
  box(cx - 1.1, cy - 0.6, cx + 1.1, cy + 0.6, 0, 20, '#E5433D', '#F4F1E8');
  for (let k = 0; k < 2; k++) P4(iso(cx - 0.9 + k, cy + 0.6, 0), iso(cx - 0.1 + k, cy + 0.6, 0), iso(cx - 0.1 + k, cy + 0.6, 13), iso(cx - 0.9 + k, cy + 0.6, 13), '#F4F1E8');
  for (let k = 0; k < 2; k++) for (let r = 1; r < 4; r++) line(iso(cx - 0.9 + k, cy + 0.6, r * 3.2), iso(cx - 0.1 + k, cy + 0.6, r * 3.2), '#CDD2DA', 1);
  box(cx + 0.6, cy - 0.5, cx + 1.05, cy - 0.05, 20, 44, '#E5433D', '#FFC928');
  P4(iso(cx + 0.7, cy - 0.05, 34), iso(cx + 0.95, cy - 0.05, 34), iso(cx + 0.95, cy - 0.05, 40), iso(cx + 0.7, cy - 0.05, 40), litOr(s.active));
  if (s.hover) oval(iso(cx, cy), 84, 42, '#E5433D', 4);
  return 64;
}

/** The skill school. */
export function paintSchool(s: CivicSpec): number {
  const [cx, cy] = s.at, dx = cx - 14.5, dy = cy - 4.5;
  shadow(13.6 + dx, 3.8 + dy, 15.4 + dx, 5.2 + dy, 24); box(13.6 + dx, 3.8 + dy, 15.4 + dx, 5.2 + dy, 0, 22, '#F3E7D3', FC.skill);
  for (let k = 0; k < 4; k++) { const x = 13.8 + dx + k * 0.46; line(iso(x, 5.2 + dy, 0), iso(x, 5.2 + dy, 20), tone('#FFFFFF', 0), 4); }
  const q = iso(cx, cy, 22);
  g.fillStyle = tone(FC.skill, 0.1); g.beginPath(); g.moveTo(q[0] - 30, q[1] + 6); g.lineTo(q[0] + 12, q[1] - 22); g.lineTo(q[0] + 44, q[1] - 1); g.lineTo(q[0], q[1] + 23); g.closePath(); g.fill();
  g.fillStyle = tone('#3F9070', 0); g.beginPath(); g.moveTo(q[0] + 12, q[1] - 22); g.lineTo(q[0] + 44, q[1] - 1); g.lineTo(q[0], q[1] + 23); g.closePath(); g.fill();
  if (s.active && env.night > 0.5) for (let k = 0; k < 3; k++) { const x = 13.9 + dx + k * 0.46; P4(iso(x + 0.1, 5.2 + dy, 8), iso(x + 0.3, 5.2 + dy, 8), iso(x + 0.3, 5.2 + dy, 16), iso(x + 0.1, 5.2 + dy, 16), P.lit); }
  if (s.hover) oval(iso(cx, cy), 84, 42, FC.skill, 4);
  return 46;
}

/** The library: tall windows like book spines. */
export function paintLibrary(s: CivicSpec): number {
  const [cx, cy] = s.at, nite = env.night > 0.5, on = s.active;
  shadow(cx - 1.6, cy - 1.2, cx + 1.6, cy + 1.2, 30); box(cx - 1.7, cy - 1.3, cx + 1.7, cy + 1.3, 0, 4, '#E3E0D6'); box(cx - 1.5, cy - 1.1, cx + 1.5, cy + 1.1, 4, 30, '#F4F1E8', '#CDD2DA');
  for (let k = 0; k < 9; k++) { const x = cx - 1.4 + k * 0.32; P4(iso(x, cy + 1.1, 7), iso(x + 0.2, cy + 1.1, 7), iso(x + 0.2, cy + 1.1, 27), iso(x, cy + 1.1, 27), nite ? (on ? '#FFD37E' : P.dark) : tone(BOLD[(k * 3) % 9], 0)); }
  for (let k = 0; k < 5; k++) { const y = cy + 0.95 - k * 0.44; P4(iso(cx + 1.5, y, 7), iso(cx + 1.5, y - 0.28, 7), iso(cx + 1.5, y - 0.28, 27), iso(cx + 1.5, y, 27), nite ? (on ? '#FFC928' : P.dark) : tone('#2FA8F0', -0.1)); }
  box(cx - 1.65, cy - 1.25, cx + 1.65, cy + 1.25, 30, 33, '#59627A', '#8A93A3'); box(cx - 0.9, cy - 0.7, cx + 0.9, cy + 0.7, 33, 44, '#BFF1EE', '#7FD0FF');
  box(cx - 1, cy - 0.8, cx + 1, cy + 0.8, 44, 46, '#F4F1E8'); box(cx - 0.5, cy + 1.1, cx + 0.5, cy + 1.6, 0, 3, '#CDD2DA');
  if (s.hover) oval(iso(cx, cy), 110, 55, '#2FA8F0', 4);
  return 64;
}

export const POWER_COLOURS = ['#8E7BD6', '#D9628A', '#14A8A4', '#E8873A'];
/** A compute power station, one per model: the stack height is today's tokens (`level`). Two shapes. */
export function paintPower(s: CivicSpec): number {
  const [cx, cy] = s.at, h = s.level, col = POWER_COLOURS[s.variant % 4], twin = (s.variant & 1) === 1;
  shadow(cx - 1.7, cy - 0.9, cx + 0.1, cy + 0.9, 22); shadow(cx + 0.6, cy - 0.5, cx + 1.6, cy + 0.5, h);
  box(cx - 1.7, cy - 0.9, cx + 0.1, cy + 0.9, 0, 22, '#CDD2DA', col);
  const lit: Quad[] = [], dark: Quad[] = [];
  winQ(lit, dark, cx - 1.7, cy - 0.9, cx + 0.1, cy + 0.9, 8, 16, 5, 1, () => s.active); fillQ(dark, P.dark); fillQ(lit, P.lit);
  if (twin) { for (const dx of [0.75, 1.45]) for (let i = 0; i < 4; i++) { const w = 0.26 - 0.03 * i; box(cx + dx - w, cy - w, cx + dx + w, cy + w, i * h * 0.22, (i + 1) * h * 0.22, i % 2 ? '#F4F1E8' : col); } }
  else for (let i = 0; i < 4; i++) { const w = 0.56 - 0.09 * i; box(cx + 1.1 - w, cy - w, cx + 1.1 + w, cy + w, i * h / 4, (i + 1) * h / 4, i % 2 ? '#F4F1E8' : col); }
  const tp = iso(cx + (twin ? 0.75 : 1.1), cy, twin ? h * 0.88 : h); g.fillStyle = s.active && (s.frames.blink & 1) ? '#FFD37E' : col; g.fillRect(tp[0] - 4, tp[1] - 8, 8, 8);
  if (s.hover) oval(iso(cx, cy), 120, 60, col, 4);
  return h + 14;
}

/** Connectors: a power plant with cooling towers, a telecom mast, a warehouse (slots 0–2, drawn in turn). */
export function paintConnector(s: CivicSpec): number {
  const slot = s.variant % 3, col = FC.tool;
  // The three shapes are drawn at their reference place and moved to the connector's lot.
  const ref: [number, number] = slot === 0 ? [14.5, 14.5] : slot === 1 ? [14.5, 9.8] : [14.5, 24.5];
  const dx = s.at[0] - ref[0], dy = s.at[1] - ref[1];
  g.save(); g.translate((dx - dy) * 32, (dx + dy) * 16);
  try {
    if (s.hover) oval(iso(ref[0], ref[1]), 96, 48, col, 4);
    if (slot === 0) {
      shadow(13.3, 13.4, 15.0, 14.6, 30); box(13.3, 13.4, 15.0, 14.6, 0, 30, '#CDD2DA', col); box(13.5, 13.6, 14.1, 14.0, 30, 40, '#AEB5C2');
      g.fillStyle = tone(col, 0); for (let k = 0; k < 4; k++) { const q = iso(13.5 + k * 0.4, 14.6, 12); g.fillRect(q[0], q[1] - 8, 6, 8); }
      for (const [x, y] of [[13.9, 15.35], [15.1, 15.2]]) {
        const b = iso(x, y), tp = [b[0], b[1] - 44];
        g.fillStyle = tone('#E3E0D6', env.kR * 0.6); g.beginPath(); g.moveTo(b[0] - 17, b[1]); g.quadraticCurveTo(b[0] - 8, b[1] - 22, tp[0] - 11, tp[1]); g.lineTo(tp[0] + 11, tp[1]);
        g.quadraticCurveTo(b[0] + 8, b[1] - 22, b[0] + 17, b[1]); g.ellipse(b[0], b[1], 17, 8, 0, 0, Math.PI); g.fill();
        g.fillStyle = tone('#AEB5C2', 0); g.beginPath(); g.ellipse(tp[0], tp[1], 11, 5, 0, 0, 6.3); g.fill(); g.fillStyle = tone(col, 0); g.fillRect(b[0] - 13, b[1] - 22, 26, 4);
      }
    } else if (slot === 1) {
      shadow(13.7, 9.2, 15.3, 10.4, 16); box(13.7, 9.2, 15.3, 10.4, 0, 16, '#E9DDF5', '#8E7BD6');
      const b = iso(14.5, 9.8, 16), tp = [b[0], b[1] - 112];
      g.strokeStyle = tone('#8E7BD6', 0); g.lineWidth = 2; g.beginPath(); g.moveTo(b[0] - 10, b[1]); g.lineTo(tp[0], tp[1]); g.lineTo(b[0] + 10, b[1]);
      for (let k = 1; k < 6; k++) { const y = lerp(b[1], tp[1], k / 6), w = 10 * (1 - k / 6); g.moveTo(b[0] - w, y); g.lineTo(b[0] + w, y - 9); g.moveTo(b[0] + w, y); g.lineTo(b[0] - w, y - 9); }
      g.stroke();
      disc([tp[0] - 7, tp[1] + 22], 6, tone('#F4F1E8', 0)); disc([tp[0] + 7, tp[1] + 36], 5, tone('#F4F1E8', 0)); g.fillStyle = '#E5564B'; g.fillRect(tp[0] - 3, tp[1] - 3, 6, 6);
    } else {
      shadow(13.6, 23.9, 15.4, 25.1, 20); box(13.6, 23.9, 15.4, 25.1, 0, 20, '#F3E7D3', '#E8873A'); box(13.8, 25.2, 14.4, 25.7, 0, 8, '#2F6BDE'); box(14.6, 25.2, 15.2, 25.7, 0, 8, '#E5564B');
    }
  } finally { g.restore(); }
  return slot === 1 ? 130 : slot === 0 ? 62 : 40;
}

const SW = ['#FFF6CF', '#FFE9F3', '#E6F7D6', '#EEF7FB', '#F4F1E8', '#FFC928'], SR = ['#E5433D', '#22C3E6', '#8E5BE8', '#FF8A2B', '#8BD93E', '#FF4FA3'];
/** A plugin shop: one per installed plugin; a disabled one has its shutters down (grey). Four templates. */
export function paintShop(s: CivicSpec): number {
  const [cx, cy] = s.at, v = s.variant, tpl = v & 3, on = s.on, h = 12 + (v % 3) * 4;
  const wall = on ? SW[v % 6] : '#CDD2DA', roof = on ? SR[(v >> 3) % 6] : '#8A93A3', aw = on ? SR[(v >> 6) % 6] : '#8A93A3';
  shadow(cx - 0.7, cy - 0.6, cx + 0.7, cy + 0.6, h); box(cx - 0.7, cy - 0.6, cx + 0.7, cy + 0.6, 0, h, wall, roof);
  box(cx - 0.76, cy - 0.66, cx + 0.76, cy + 0.66, h, h + 3, roof);
  if (tpl & 1) box(cx - 0.5, cy - 0.4, cx - 0.1, cy, h + 3, h + 7, '#CDD2DA');
  P4(iso(cx - 0.5, cy + 0.6, 1), iso(cx + 0.5, cy + 0.6, 1), iso(cx + 0.5, cy + 0.6, 8), iso(cx - 0.5, cy + 0.6, 8), on && env.night <= 0.5 ? P.lit : on ? P.dark : tone('#8A93A3', 0));
  if (!on) for (let k = 1; k < 4; k++) line(iso(cx - 0.5, cy + 0.6, 1 + k * 1.75), iso(cx + 0.5, cy + 0.6, 1 + k * 1.75), '#6F7A8C', 1);   // shutters
  P4(iso(cx - 0.7, cy + 0.6, 10), iso(cx + 0.7, cy + 0.6, 10), iso(cx + 0.7, cy + 0.98, 7), iso(cx - 0.7, cy + 0.98, 7), tone(aw, 0));
  if (tpl & 2) for (let k = 0; k < 3; k++) P4(iso(cx - 0.6 + k * 0.5, cy + 0.6, 10), iso(cx - 0.4 + k * 0.5, cy + 0.6, 10), iso(cx - 0.4 + k * 0.5, cy + 0.98, 7), iso(cx - 0.6 + k * 0.5, cy + 0.98, 7), '#FFFFFF');
  const q = iso(cx, cy + 0.6, h + 4); g.fillStyle = tone(aw, 0.1);
  if ((v >> 2) & 1) g.fillRect(q[0] - 10, q[1] - 10, 20, 10); else { g.beginPath(); g.arc(q[0], q[1] - 6, 7, 0, 6.3); g.fill(); }
  g.fillStyle = '#FFFFFF'; g.fillRect(q[0] - 5, q[1] - 7, 10, 2);
  if (s.hover) oval(iso(cx, cy), 56, 28, aw, 4);
  return 30;
}

/** Sprite canvas sizes (w, h, ox, oy) per kind. */
export const CIVIC_BOX: Record<CivicSpec['kind'], [number, number, number, number]> = {
  town: [300, 240, 150, 176], station: [260, 150, 130, 100], fire: [200, 140, 100, 96], school: [200, 120, 100, 70],
  library: [260, 170, 130, 120], power: [260, 220, 130, 160], connector: [260, 220, 130, 150], shop: [100, 76, 50, 46],
};
