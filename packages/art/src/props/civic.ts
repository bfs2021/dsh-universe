// The public buildings' floors, compact 5.2×5.2 rooms brought up to the room standard: kit
// props, each snapped and outlined on its own (`item`), and every changing thing one of the floor's own numbers:
//   connector tool  — today's calls as tallies on the menu board, the last minute's calls as tickets on the rail;
//   station         — the platform's departures board has one lit row per scheduled run today; the gate counts web
//                     calls today and lights one turnstile per call in the last minute;
//   school          — a chalk mark per skill load; one lit portrait per expert;
//   library         — one book per installed skill, one cartridge per plugin (lit when enabled);
//   power station   — the turbines turn with the last five minutes of the model's tokens, the load gauge shows them,
//                     the meter shows today's; the control room's dial shows the average call time;
//   fire station    — the garage's log has one red tick per failed call today; the engine's beacon turns only while
//                     a call failed in the last minute; the repair log floor has one red pip per model retry today.
// Nothing moves unless the floor is busy (`act`); there are no people: the floor's agents are drawn by the renderer.
// The lift (back wall, x 4.2–5.0) is kept clear. All rights reserved.
import { act, B, BOLD, cyl, disc, F, flat, g, hr, hs, item, L, line, nt, P4, pt, rm, tm, W } from './pen.ts';
import { bush } from './units.ts';

/** What a civic floor shows (set by `paintRoom`). */
export const civic = {
  n: 0, rate: 0, na: false,
  recent: [] as readonly { age: number; err: boolean }[],
  stock: { skills: 0, plugins: 0, on: 0 },
};

const BK = ['#6C7BEA', '#FF8A2B', '#35B37A', '#E5433D', '#FFC928', '#FF4FA3', '#22C3E6', '#8E5BE8'];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Tally marks on the back wall: one per unit, bundles of five, at most `max`. */
function tallyW(n: number, max: number, x0: number, z0: number, col: string): void {
  const m = Math.min(max, n);
  for (let k = 0; k < m; k++) { const row = Math.floor(k / 20), i = k % 20, x = x0 + i * 0.16 + Math.floor(i / 5) * 0.08; W(x, x + 0.05, z0 - row * 9, z0 - row * 9 + 6, col); }
}
/** Tally marks on the left wall. */
function tallyL(n: number, max: number, y0: number, z0: number, col: string): void {
  const m = Math.min(max, n);
  for (let k = 0; k < m; k++) { const row = Math.floor(k / 10), i = k % 10, y = y0 + i * 0.15 + Math.floor(i / 5) * 0.07; L(y, y + 0.05, z0 - row * 8, z0 - row * 8 + 5, col); }
}
/** A small window on the left wall with the skyline outside (night: lit windows). */
function windowL(y0: number, y1: number): void {
  L(y0, y1, 12, 40, '#FFFFFF'); L(y0 + 0.08, y1 - 0.08, 14, 38, nt ? '#27304F' : '#7FD0FF');
  const n = Math.floor((y1 - y0 - 0.16) / 0.3);
  for (let i = 0; i < n; i++) {
    const yy = y0 + 0.12 + i * 0.3, hh = 5 + ((i * 7 + Math.round(y0 * 3)) % 5) * 3;
    L(yy, yy + 0.24, 14, 14 + hh, nt ? '#141A30' : BOLD[(i * 2 + Math.round(y0 * 5)) % 9]);
    if (nt) for (let r = 2; r < hh - 2; r += 4) if (hs(i, r, 5) > 0.45) L(yy + 0.06, yy + 0.12, 15 + r, 16.5 + r, '#FFC928');
  }
}
/** The wall clock: the workspace's time. */
function clockW(x: number, z = 34): void {
  const c0 = pt(x, 0.04, z);
  disc(c0, 9, '#141A30'); disc(c0, 7, '#FFFFFF');
  line(c0, [c0[0] + 5 * Math.sin(hr * 6.283), c0[1] - 5 * Math.cos(hr * 6.283)], '#141A30', 2);
  line(c0, [c0[0] + 3.5 * Math.sin((hr / 12) * 6.283), c0[1] - 3.5 * Math.cos((hr / 12) * 6.283)], '#E5433D', 2);
}
function plant(x: number, y: number): void { item('plant'); bush(x, y); }
function stool(x: number, y: number, c: string): void { cyl(x, y, 0.13, 0, 7, '#59627A', c); }

/** Connector tool: the pass of a kitchen that cooks this one tool. */
function tool(): void {
  const rec = civic.recent;
  W(0.5, 3.9, 24, 40, '#27304F'); W(0.55, 3.85, 38, 39.5, '#FFC928');
  tallyW(civic.n, 60, 0.7, 31, '#FFFFFF');   // today's calls
  line(pt(0.5, 1.05, 41), pt(3.9, 1.05, 41), '#59627A', 3);
  rec.forEach((e, k) => {   // one ticket per call in the last minute, newest at the left
    const x = 0.65 + k * 0.42, sw = rm || !act ? 0 : Math.sin(tm * 2 + k) * 0.03, len = 15 * (1 - e.age / 110);
    P4(pt(x + sw, 1.05, 41), pt(x + 0.26 + sw, 1.05, 41), pt(x + 0.26 - sw, 1.05, 41 - len), pt(x - sw, 1.05, 41 - len), e.err ? '#E5433D' : '#FFFFFF');
  });
  item('pass');
  B(0.5, 0.4, 3.9, 1.05, 0, 14, '#F4F1E8', '#C9925A');
  for (let k = 0; k < 3; k++) { const x = 0.8 + k * 1.1; B(x, 0.55, x + 0.5, 0.85, 30, 33, '#39415A'); if (act) disc(pt(x + 0.25, 0.7, 29), 3, '#FF8A2B'); }
  for (let k = 0; k < Math.min(4, rec.length); k++) { const q = pt(0.9 + k * 0.8, 0.75, 14); g.fillStyle = '#F4F1E8'; g.beginPath(); g.arc(q[0], q[1], 8, Math.PI, 0); g.fill(); g.fillStyle = '#AEB5C2'; g.fillRect(q[0] - 10, q[1], 20, 3); }
  B(3.6, 0.55, 3.8, 0.75, 14, 17, '#FFC928');   // the bell
  item('stove');
  B(0.15, 1.5, 0.9, 3.2, 0, 12, '#59627A', '#39415A');
  for (const y of [1.9, 2.7]) { cyl(0.52, y, 0.24, 12, 18, '#AEB5C2', '#CDD2DA'); if (act) for (let i = 0; i < 2; i++) disc(pt(0.52, y, 21 + ((tm * 6 + i * 4 + y * 3) % 8)), 2, '#FFFFFF'); }
  item('shelf');
  B(0.15, 3.5, 0.6, 4.7, 0, 28, '#C9925A', '#A8743F');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) B(0.6, 3.6 + c * 0.37, 0.64, 3.85 + c * 0.37, 6 + r * 8, 11 + r * 8, BK[(r * 3 + c) % 8]);
  item('table');
  B(2.4, 2.8, 4.2, 3.55, 0, 11, '#C9925A', '#FFF6CF'); flat(2.6, 2.95, 3.3, 3.35, 11.4, '#8D6B52'); B(3.5, 3.0, 3.9, 3.3, 11, 13, '#E5433D');
  plant(4.4, 4.4);
}

/** Station platform: the train that carries scheduled runs, and the departures board. */
function plat(): void {
  F(0, 0.2, 5.2, 1.3, '#8D6B52');
  for (const y of [0.45, 1.05]) F(0, y, 5.2, y + 0.06, '#59627A');
  F(0, 1.45, 5.2, 1.6, '#FFC928');
  // Departures: one lit row per scheduled run today (at most six), the rest dark.
  L(1.7, 3.6, 14, 42, '#141A30');
  for (let k = 0; k < 6; k++) { L(1.82, 2.2, 16 + k * 4.2, 18.6 + k * 4.2, k < civic.n ? '#8BD93E' : '#27304F'); L(2.3, 3.45, 16 + k * 4.2, 18.6 + k * 4.2, k < civic.n ? '#FFC928' : '#27304F'); }
  { const c = pt(0.04, 4.3, 32); disc(c, 9, '#141A30'); disc(c, 7, '#FFFFFF'); line(c, [c[0] + 5 * Math.sin(hr * 6.283), c[1] - 5 * Math.cos(hr * 6.283)], '#141A30', 2); }
  item('train');
  B(0.3, 0.35, 3.9, 1.15, 3, 26, '#2F6BDE', '#1F4FB0');
  for (let k = 0; k < 4; k++) P4(pt(0.55 + k * 0.85, 1.15, 11), pt(1.1 + k * 0.85, 1.15, 11), pt(1.1 + k * 0.85, 1.15, 21), pt(0.55 + k * 0.85, 1.15, 21), act || nt ? '#FFF6CF' : '#DDF0F8');
  F(0.3, 1.13, 3.9, 1.15, '#FFFFFF');
  item('bench');
  B(1.6, 3.3, 3.4, 3.65, 0, 7, '#C9925A', '#FFF6CF'); B(1.6, 3.55, 3.4, 3.65, 7, 14, '#C9925A');
  item('machine');
  B(0.25, 4.2, 0.7, 4.75, 0, 20, '#E5433D', '#FF8A7A'); P4(pt(0.7, 4.3, 12), pt(0.7, 4.6, 12), pt(0.7, 4.6, 17), pt(0.7, 4.3, 17), act ? '#7FD0FF' : '#27304F');
  plant(4.5, 4.5);
}

/** Station gate: web calls leave the city here. */
function gate(): void {
  W(1.4, 3.8, 0, 42, '#DDF0F8'); W(1.4, 1.7, 0, 44, '#2F8BFF'); W(3.5, 3.8, 0, 44, '#2F8BFF'); W(1.4, 3.8, 40, 45, '#2F8BFF');
  L(0.6, 3.6, 14, 40, '#27304F'); tallyL(civic.n, 40, 0.75, 33, '#8BD93E');   // web calls today
  item('globe');
  B(2.2, 2.2, 3.2, 3.2, 0, 8, '#CDD2DA', '#F4F1E8');
  { const c = pt(2.7, 2.7, 26), a = act && !rm ? Math.abs(Math.cos(tm * 0.8)) : 0.45; disc(c, 15, '#141A30'); disc(c, 13, '#22C3E6'); g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.ellipse(c[0], c[1], Math.max(1, 13 * a), 13, 0, 0, 6.3); g.moveTo(c[0] - 13, c[1]); g.lineTo(c[0] + 13, c[1]); g.stroke(); }
  // Turnstiles: each lights for a call in the last minute.
  for (let k = 0; k < 3; k++) {
    item('turnstile' + k);
    B(0.8 + k * 1.4, 4.2, 1.0 + k * 1.4, 4.9, 0, 12, '#59627A', '#8A93A3'); B(0.8 + k * 1.4, 4.5, 1.7 + k * 1.4, 4.6, 9, 11, '#AEB5C2');
    disc(pt(0.9 + k * 1.4, 4.3, 14), 3, k < civic.recent.length ? '#4CC552' : '#27304F');
  }
  plant(0.4, 0.5);
}

/** School: the classroom where skills are loaded. */
function skill(): void {
  W(0.8, 4.0, 12, 42, '#2A6B55'); W(0.8, 4.0, 10, 13, '#C9925A');
  for (let k = 0; k < Math.min(36, civic.n); k++) { const row = Math.floor(k / 18), i = k % 18; W(1.0 + i * 0.16, 1.05 + i * 0.16, 30 - row * 10 + (i % 5 === 4 ? 3 : 0), 38 - row * 10, '#FFFFFF'); }
  windowL(2.2, 3.8);
  clockW(4.4);
  item('teacher');
  B(0.4, 0.7, 1.4, 1.2, 0, 11, '#8D6B52', '#C9925A'); disc(pt(0.7, 0.95, 16), 5, '#2FA8F0'); B(1.0, 0.85, 1.3, 1.05, 11, 13, '#FFFFFF');
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    item('desk' + r + c);
    const x = 1 + c * 1.5, y = 1.9 + r * 1.4;
    B(x, y, x + 0.9, y + 0.5, 0, 9, '#C9925A', '#FFF6CF'); flat(x + 0.15, y + 0.1, x + 0.45, y + 0.35, 9.4, '#FFFFFF');
    stool(x + 0.45, y + 0.62, BOLD[(r * 3 + c) % 9]);   // the agent stands just behind it
  }
  item('shelf');
  B(0.1, 4.0, 0.5, 5.0, 0, 30, '#8D6B52', '#A8743F');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) B(0.5, 4.08 + c * 0.22, 0.54, 4.26 + c * 0.22, 5 + r * 8, 11 + r * 8, BK[(r + c * 3) % 8]);
}

/** School: the experts' gallery, one lit portrait per expert. */
function expert(): void {
  for (let k = 0; k < 3; k++) {
    const x = 0.6 + k * 1.15;
    W(x, x + 0.9, 14, 40, '#C9925A'); W(x + 0.06, x + 0.84, 16, 38, k < civic.n ? '#3F9070' : '#CDD2DA');
    if (k < civic.n) { const c = pt(x + 0.45, 0.04, 29); disc(c, 5, '#F2C9A5'); W(x + 0.25, x + 0.65, 17, 24, '#27304F'); }
  }
  for (let k = 0; k < 2; k++) { const y = 1.4 + k * 1.3; L(y, y + 0.9, 14, 40, '#C9925A'); L(y + 0.06, y + 0.84, 16, 38, k + 3 < civic.n ? '#3F9070' : '#CDD2DA'); }
  F(1.4, 1.8, 4.4, 4.4, '#E6F7D6'); F(1.5, 1.9, 4.3, 4.3, '#BCE0CC');
  item('table'); B(2.5, 2.7, 3.3, 3.5, 0, 8, '#8D6B52', '#C9925A'); B(2.8, 2.95, 3.0, 3.15, 8, 12, '#FFFFFF');
  for (const [x, y] of [[1.7, 2.6], [3.6, 2.6]] as const) { item('chair'); B(x, y, x + 0.7, y + 0.8, 0, 6, '#3F9070', '#BCE0CC'); B(x, y, x + 0.7, y + 0.15, 6, 13, '#3F9070'); }
  item('lamp'); line(pt(4.6, 4.6, 0), pt(4.6, 4.6, 26), '#39415A', 2); disc(pt(4.6, 4.6, 28), 6, nt ? '#FFC928' : '#FFF6CF');
  plant(0.4, 4.4);
}

/** Library: one book per installed skill, one cartridge per plugin (lit when it is on). */
function mem(): void {
  windowL(3.0, 4.6);
  item('books');
  B(0.3, 0.1, 4.0, 0.5, 0, 42, '#8D6B52', '#A8743F');
  P4(pt(0.36, 0.5, 3), pt(3.94, 0.5, 3), pt(3.94, 0.5, 40), pt(0.36, 0.5, 40), '#5A4636');   // the bookcase's back
  for (let r = 0; r < 4; r++) P4(pt(0.36, 0.5, 3 + r * 12), pt(3.94, 0.5, 3 + r * 12), pt(3.94, 0.5, 5 + r * 12), pt(0.36, 0.5, 5 + r * 12), '#A8743F');
  const books = Math.min(48, civic.stock.skills);
  for (let k = 0; k < 48; k++) {
    const r = Math.floor(k / 16), c = k % 16, x = 0.38 + c * 0.22;
    if (k < books) P4(pt(x, 0.5, 5 + r * 12), pt(x + 0.16, 0.5, 5 + r * 12), pt(x + 0.16, 0.5, 13 + r * 12 - (k % 3)), pt(x, 0.5, 13 + r * 12 - (k % 3)), BK[(k * 5 + r) % 8]);
  }
  item('cartridges');
  B(0.1, 1.0, 0.5, 2.6, 0, 26, '#59627A', '#39415A');
  for (let k = 0; k < Math.min(12, civic.stock.plugins); k++) {
    const r = Math.floor(k / 4), c = k % 4, y = 1.06 + c * 0.38;
    B(0.5, y, 0.56, y + 0.3, 4 + r * 7, 9 + r * 7, '#AEB5C2'); disc(pt(0.56, y + 0.15, 7.5 + r * 7), 2, k < civic.stock.on ? '#4CC552' : '#59627A');
  }
  for (let k = 0; k < 2; k++) {
    item('table' + k);
    const x = 1.6 + k * 1.6;
    B(x, 2.4, x + 1.1, 3.0, 0, 10, '#A8743F', '#C9925A'); flat(x + 0.2, 2.55, x + 0.5, 2.85, 10.4, '#FFFFFF');
    line(pt(x + 0.85, 2.55, 10), pt(x + 0.85, 2.55, 17), '#2E9E48', 2); disc(pt(x + 0.85, 2.6, 18), 4, nt ? '#FFC928' : '#2E9E48');
    stool(x + 0.55, 3.35, '#8D6B52');
  }
  item('catalogue'); B(3.9, 3.8, 4.7, 4.6, 0, 14, '#C9925A', '#A8743F'); for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) P4(pt(3.95 + c * 0.38, 4.6, 2 + r * 4), pt(4.27 + c * 0.38, 4.6, 2 + r * 4), pt(4.27 + c * 0.38, 4.6, 5 + r * 4), pt(3.95 + c * 0.38, 4.6, 5 + r * 4), '#F4F1E8');
  plant(1.0, 4.4);
}

/** Power station: the turbine hall of one model. */
function turb(): void {
  const sp = clamp(civic.rate / 20000, 0, 3);
  // Load gauge: the last five minutes of tokens (eight steps); meter: today's tokens (a step per doubling).
  W(0.5, 4.0, 30, 42, '#141A30');
  const load = Math.round(clamp(civic.rate / 40000, 0, 1) * 8);
  for (let k = 0; k < 8; k++) W(0.6 + k * 0.2, 0.75 + k * 0.2, 32, 40, k < load ? (k < 5 ? '#FFC928' : '#FF8A2B') : '#39415A');
  const meter = clamp(Math.floor(Math.log2(civic.n / 1000 + 1)), 0, 10);
  for (let k = 0; k < 10; k++) W(2.4 + k * 0.15, 2.5 + k * 0.15, 33, 39, k < meter ? '#8E7BD6' : '#39415A');
  for (let k = 0; k < 2; k++) {
    item('turbine' + k);
    const x = 0.5 + k * 1.9;
    B(x, 0.7, x + 1.6, 2.1, 0, 20, '#CDD2DA', '#AEB5C2');
    const c = pt(x + 0.8, 2.1, 11), a0 = rm || !act ? 0.3 : tm * sp * 2.5 + k;
    disc(c, 13, '#141A30'); disc(c, 11, '#39415A');
    g.strokeStyle = sp ? '#FFC928' : '#8A93A3'; g.lineWidth = 3; g.beginPath();
    for (let b = 0; b < 3; b++) { g.moveTo(c[0], c[1]); g.lineTo(c[0] + Math.cos(a0 + b * 2.094) * 10, c[1] + Math.sin(a0 + b * 2.094) * 10); }
    g.stroke();
  }
  item('pipes');
  F(0.8, 2.6, 4.0, 2.9, '#FFC928'); B(0.3, 3.2, 0.5, 4.8, 0, 4, '#8A93A3'); cyl(0.4, 3.4, 0.12, 4, 30, '#AEB5C2', '#CDD2DA');
  item('cabinet'); B(4.2, 3.4, 4.9, 4.4, 0, 14, '#59627A', '#8A93A3'); for (let k = 0; k < 3; k++) disc(pt(4.9, 3.6 + k * 0.3, 9), 2, act ? '#4CC552' : '#27304F');
  plant(1.6, 4.5);
}

/** Power station: the control room; the dial shows the average call time. */
function ctrl(): void {
  { const c = pt(2.6, 0.04, 30), an = Math.PI * (1 - clamp(civic.n / 4000, 0, 1)); disc(c, 16, '#141A30'); disc(c, 14, '#FFFFFF'); g.strokeStyle = '#E5433D'; g.lineWidth = 3; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0] + Math.cos(an) * 11, c[1] - Math.sin(an) * 11); g.stroke(); }
  L(1.2, 3.8, 14, 40, '#27304F');
  for (let k = 0; k < 4; k++) L(1.4 + k * 0.55, 1.8 + k * 0.55, 18, 18 + 6 + hs(k, 2, 3) * 14, act ? BK[k] : '#39415A');
  item('console');
  B(0.5, 0.5, 3.9, 1.15, 0, 12, '#59627A', '#8A93A3');
  for (let k = 0; k < 4; k++) P4(pt(0.8 + k * 0.8, 1.15, 3), pt(1.3 + k * 0.8, 1.15, 3), pt(1.3 + k * 0.8, 1.15, 10), pt(0.8 + k * 0.8, 1.15, 10), k % 2 ? '#7FD0FF' : '#FFC928');
  for (let k = 0; k < 6; k++) flat(0.7 + k * 0.5, 0.65, 0.95 + k * 0.5, 0.85, 12.4, act && hs(k, 3, Math.floor(tm * 2)) > 0.5 ? '#4CC552' : '#27304F');
  for (const x of [1.2, 2.6]) { item('chair' + x); cyl(x, 1.7, 0.2, 0, 6, '#39415A', '#59627A'); B(x - 0.15, 1.85, x + 0.15, 1.92, 6, 13, '#39415A'); }
  item('rack'); B(4.2, 3.2, 4.9, 4.6, 0, 30, '#39415A', '#59627A'); for (let r = 0; r < 5; r++) disc(pt(4.9, 3.4 + (r % 3) * 0.4, 6 + r * 4), 2, act ? '#4CC552' : '#27304F');
  plant(0.4, 4.4);
}

/** Fire station: the engine bay and the repair log. */
function bay(): void {
  // Repair log: one red tick per failed call today (at most sixty).
  L(0.6, 3.4, 14, 42, '#FFFFFF'); L(0.6, 3.4, 40, 42, '#E5433D');
  tallyL(civic.n, 60, 0.75, 34, '#E5433D');
  W(3.7, 4.0, 0, 30, '#E5433D');
  const alarm = civic.recent.length > 0;   // a call failed in the last minute
  item('engine');
  B(0.4, 0.9, 3.0, 2.1, 2, 20, '#E5433D', '#F4F1E8'); B(3.1, 1.0, 4.1, 2.0, 2, 16, '#E5433D');
  P4(pt(3.3, 2.0, 9), pt(3.9, 2.0, 9), pt(3.9, 2.0, 14), pt(3.3, 2.0, 14), '#27304F');
  for (const x of [0.9, 2.5, 3.6]) { const q = pt(x, 2.1, 3); g.fillStyle = '#141A30'; g.fillRect(q[0] - 5, q[1] - 5, 10, 10); }
  line(pt(0.6, 1.5, 22), pt(2.8, 1.5, 22), '#CDD2DA', 4);
  { const c = pt(3.6, 1.5, 18); disc(c, 4, alarm ? ((act && !rm && Math.floor(tm * 4) & 1) ? '#FF8A7A' : '#E5433D') : '#7A2E2A'); }
  item('lockers');
  for (let k = 0; k < 3; k++) { const y = 3.6 + k * 0.4; B(0.1, y, 0.5, y + 0.36, 0, 26, '#AEB5C2', '#CDD2DA'); B(0.5, y + 0.08, 0.54, y + 0.28, 16, 21, '#FFC928'); }
  item('hose'); cyl(2.0, 3.9, 0.35, 0, 10, '#E5433D', '#FF8A7A'); disc(pt(2.0, 3.9, 10.5), 3, '#59627A');
  item('pole'); cyl(3.6, 3.0, 0.06, 0, 46, '#CDD2DA', '#FFFFFF');
  for (let k = 0; k < 3; k++) { item('cone' + k); const x = 3.4 + k * 0.4, q = pt(x, 4.5, 0), t = pt(x, 4.5, 9); g.fillStyle = '#FF8A2B'; g.beginPath(); g.moveTo(q[0] - 5, q[1]); g.lineTo(q[0] + 5, q[1]); g.lineTo(t[0], t[1]); g.closePath(); g.fill(); }
}

/**
 * Fire station, the repair log floor: a record board on the back wall with one red pip
 * (3×3 art pixels) per model request retried today, in rows of ten (at most sixty); the duty desk below it.
 */
function retry(): void {
  W(0.4, 3.9, 8, 44, '#FFFFFF'); W(0.4, 3.9, 41, 44, '#E5433D'); W(0.4, 3.9, 8, 9.5, '#AEB5C2');
  const m = Math.min(60, civic.n);
  for (let k = 0; k < m; k++) { const x = 0.6 + (k % 10) * 0.32 + (k % 10 >= 5 ? 0.06 : 0), z = 35 - Math.floor(k / 10) * 4.5; W(x, x + 0.19, z - 3, z + 3, '#E5433D'); }
  item('desk');
  B(1.0, 1.6, 3.4, 2.3, 0, 11, '#C9925A', '#F4F1E8'); flat(1.3, 1.75, 2.0, 2.15, 11.4, '#FFFFFF'); flat(2.3, 1.75, 2.6, 2.15, 11.4, '#E5433D');
  item('chair'); cyl(2.2, 2.9, 0.22, 0, 6, '#39415A', '#59627A'); B(1.98, 3.08, 2.42, 3.16, 6, 13, '#39415A');
  item('cabinet');
  for (let k = 0; k < 2; k++) { const y = 3.4 + k * 0.5; B(0.1, y, 0.6, y + 0.46, 0, 24, '#AEB5C2', '#CDD2DA'); B(0.6, y + 0.1, 0.64, y + 0.36, 14, 18, '#59627A'); }
  item('extinguishers'); for (let k = 0; k < 3; k++) cyl(3.3 + k * 0.32, 4.6, 0.12, 0, 12, '#E5433D', '#FF8A7A');
  plant(4.4, 4.4);
}

const SCENES: Record<string, () => void> = { tool, plat, gate, skill, expert, mem, turb, ctrl, bay, retry };
/** Whether a fixed scene has a civic version here. */
export const hasCivic = (scene: string): boolean => scene in SCENES;
/** Paints a civic scene (the shell is already drawn). */
export function paintCivic(scene: string): void { SCENES[scene](); }
