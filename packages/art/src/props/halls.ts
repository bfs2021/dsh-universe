// The lobby and the town hall's service floors as full 12×12 rooms, built from
// the room kit: the carpet, the window wall on the skyline, the wall clock, desks, sofas, plants. Everything that
// changes is data: the reception screen is on only while an agent is in the lobby, one crate per deliverable, and
// the town hall's ticket racks hold today's approved, denied and open requests. No people: the town hall keeps
// records, its people are in the square; the lobby's agents are drawn by the renderer like everywhere else.
import { act, B, BOLD, cyl, disc, F, flat, g, grp, hr, hs, item, L, line, mark, nt, P4, pt, W } from './pen.ts';
import { CORNER_C } from './rooms-coarse.ts';
import { bush, mon, palm } from './units.ts';
import { setZone } from './pen.ts';
import { mix } from '../palette.ts';

/** What a hall shows (set by `paintRoom`). */
export const hall = { out: 0, present: 0, yes: 0, no: 0, open: 0, kind: 'approval' as string, c: '#E0A01C', tokens: 0, done: false, bays: [] as readonly { yes: number; no: number; open: number }[] };
/** The town hall's service counters, left to right (one per floor). */
export const BAYS = ['approval', 'question', 'plan'] as const;

const N = (c: string): string => (nt ? mix(c, '#131C40', 0.55) : c);

/** A hall's size and walkways, and the roof's solar panel places (interior.ts `hallPlan`). */
export interface HallGeometry { size: number; aisles: readonly (readonly [number, number, number, number])[]; slots: readonly number[] }
const FULL_HALL: HallGeometry = { size: 12, aisles: [[9.75, 0.3, 10.55, 11.7], [0.3, 6.7, 9.75, 7.3]], slots: [...Array(18).keys()] };

/** Three tall windows on the left wall, the skyline outside (as in every room). */
function windows(at: readonly number[] = [0.5, 3.9, 7.3]): void {
  for (const y0 of at) {
    L(y0, y0 + 2.8, 6, 42, '#FFFFFF'); L(y0 + 0.08, y0 + 2.72, 8, 40, nt ? '#27304F' : '#7FD0FF');
    for (let i = 0; i < 8; i++) {
      const yy = y0 + 0.12 + i * 0.32, hh = 5 + ((i * 7 + Math.round(y0 * 3)) % 6) * 3.6;
      L(yy, yy + 0.28, 8, 8 + hh, nt ? '#141A30' : BOLD[(i * 2 + Math.round(y0)) % 9]);
      for (let r = 2; r < hh - 2; r += 4) L(yy + 0.05, yy + 0.12, 9 + r, 10.6 + r, nt ? (hs(i, r, 3) > 0.4 ? '#FFC928' : '#27304F') : '#FFFFFF');
    }
    L(y0 + 1.38, y0 + 1.42, 8, 40, '#FFFFFF'); L(y0 + 0.08, y0 + 2.72, 23.5, 24.5, '#FFFFFF');
  }
}

/** The wall clock: the workspace's time (follows replay). */
function clock(x: number): void {
  const c0 = pt(x, 0.04, 32);
  disc(c0, 12, '#141A30'); disc(c0, 10, '#FFFFFF');
  line(c0, [c0[0] + 7 * Math.sin(hr * 6.283), c0[1] - 7 * Math.cos(hr * 6.283)], '#141A30', 2);
  line(c0, [c0[0] + 5 * Math.sin((hr / 12) * 6.283), c0[1] - 5 * Math.cos((hr / 12) * 6.283)], '#E5433D', 3);
}

/** Carpet: a checkerboard in the floor's tint, a border, the walkway from the door and the lift to the front. */
function carpet(t: string, a: string, a2: string, h: HallGeometry = FULL_HALL): void {
  for (let i = 0; i < h.size * 2; i++) for (let j = 0; j < h.size * 2; j++) if ((i + j) & 1) F(i * 0.5, j * 0.5, i * 0.5 + 0.5, j * 0.5 + 0.5, N(t));
  for (const r of h.aisles) {
    F(r[0], r[1], r[2], r[3], N(a)); F(r[0] + 0.06, r[1] + 0.06, r[2] - 0.06, r[3] - 0.06, N(a2)); F(r[0] + 0.12, r[1] + 0.12, r[2] - 0.12, r[3] - 0.12, N(a));
  }
}

/** The lobby: reception, the waiting area, the deliverables on their pallet. */
export function paintLobby(h: HallGeometry = FULL_HALL): void {
  carpet('#F3E7D3', '#8E5BE8', '#E9DDF5', h);
  windows([0.5, 3.9, 7.3].filter((y) => y + 2.8 <= h.size - 0.3));
  clock(3.2);
  // A notice board and the building's sign colours on the back wall.
  W(4.4, 7.6, 14, 34, '#C9925A'); W(4.5, 7.5, 15, 33, '#FFF6CF');
  for (let k = 0; k < 6; k++) W(4.7 + (k % 3) * 0.95, 5.4 + (k % 3) * 0.95, 26 - (k >> 1 & 1) * 8, 31 - (k >> 1 & 1) * 8, BOLD[(k * 2) % 9]);
  // Reception desk with its screen (on only while an agent is in the lobby).
  item('receptionc');
  grp('reception');
  B(3.6, 2.0, 8.2, 2.7, 0, 12, '#8E5BE8', '#E9DDF5'); B(3.6, 2.6, 8.2, 2.75, 0, 12, '#B565D9');
  B(3.6, 2.0, 4.2, 4.0, 0, 12, '#8E5BE8', '#E9DDF5');
  mon(5.0, 2.1, 0.6, 9, 3); mon(6.6, 2.1, 0.6, 9, 4);
  B(7.4, 2.15, 7.7, 2.4, 12, 13.5, '#FFFFFF'); disc(pt(7.55, 2.3, 16), 3, '#4CC552');
  // The waiting area: the kit's break corner, moved to the front left.
  item('loungec'); if (grp('lounge')) { setZone([-7.9, -0.6, 0], 'lounge'); CORNER_C.lounge(); setZone(null); }
  // Deliverables: one crate each on a pallet by the desk (at most twelve shown).
  item('palletc');
  grp('pallet');
  B(4.6, 4.6, 7.0, 6.0, 0, 2, '#C9925A', '#A8743F');
  for (let k = 0; k < Math.min(12, hall.out); k++) {
    const x = 4.7 + (k % 4) * 0.58, y = 4.7 + (Math.floor(k / 4) % 2) * 0.62, z = 2 + Math.floor(k / 8) * 9;
    B(x, y, x + 0.5, y + 0.54, z, z + 9, '#C9925A', '#FFC928'); flat(x + 0.05, y + 0.22, x + 0.45, y + 0.3, z + 9.2, '#8D6B52');
  }
  item('plants'); if (grp('palm1')) palm(8.6, 0.6); if (grp('bush1')) bush(0.5, 5.0); if (grp('bush2')) bush(8.6, 9.6); if (grp('palm2')) palm(0.6, 0.6);
  // A second seating group by the front window: two armchairs and a side table.
  item('seatsc');
  if (grp('seats')) for (const x of [5.4, 7.2]) { B(x, 9.3, x + 0.9, 10.0, 0, 6, '#FF8A2B', '#FFC928'); B(x, 9.85, x + 0.9, 10.0, 6, 12, '#FF8A2B'); B(x, 9.3, x + 0.12, 10.0, 6, 9, '#FF8A2B'); B(x + 0.78, 9.3, x + 0.9, 10.0, 6, 9, '#FF8A2B'); }
  if (grp('seats')) { B(6.5, 9.4, 7.0, 9.9, 0, 7, '#C9925A', '#FFF6CF'); B(6.65, 9.55, 6.8, 9.7, 7, 10, '#FFFFFF'); }
  grp('room');
}

/**
 * The town hall: one hall, a counter with a bay per service floor. The floor shown is its bay:
 * outlined in amber with its lamp lit. Each bay holds that floor's tickets today, one per request (at most twelve):
 * still waiting amber, approved green, denied red. Benches and rope lines face the counter; no people.
 */
export function paintCounter(): void {
  const c = hall.c, sel = (BAYS as readonly string[]).indexOf(hall.kind);
  carpet('#FFF6CF', '#E0A01C', '#FFE9A8');
  windows([0.5, 3.9]);
  clock(1.6);
  // A notice board where the third window was.
  L(7.4, 10.1, 12, 38, '#C9925A'); L(7.5, 10.0, 13, 37, '#FFF6CF');
  for (let k = 0; k < 6; k++) { const y = 7.7 + (k % 3) * 0.75, z = 27 - Math.floor(k / 3) * 10; L(y, y + 0.55, z, z + 7, BOLD[(k * 3) % 9]); }
  // The bays' windows: the shown floor's outlined, its lamp lit.
  for (let k = 0; k < 3; k++) {
    const x = 3 + k * 2.2;
    if (k === sel) W(x - 0.13, x + 1.93, 12, 46, '#F0A020');
    W(x, x + 1.8, 14, 44, '#FFFFFF'); W(x, x + 1.8, 40, 43, c); W(x + 0.12, x + 1.68, 18, 38, nt ? '#27304F' : '#DDF0F8');
    { const q = pt(x + 0.9, 0.04, 35); disc(q, 6, '#39415A'); disc(q, 4, k === sel ? '#FFD37E' : '#8A93A3'); if (k === sel) { g.fillStyle = 'rgba(255,211,126,.45)'; g.beginPath(); g.moveTo(q[0] - 4, q[1] + 3); g.lineTo(q[0] + 4, q[1] + 3); g.lineTo(q[0] + 14, q[1] + 26); g.lineTo(q[0] - 14, q[1] + 26); g.closePath(); g.fill(); } }
  }
  item('counterc');
  B(2.6, 0.7, 9.4, 1.6, 0, 14, '#F4F1E8', '#C9925A');
  for (let k = 0; k < 2; k++) B(5.0 + k * 2.2, 0.7, 5.08 + k * 2.2, 1.6, 14, 24, '#C9925A');
  // Tickets: 4×5 art pixels each, two rows of six on the counter's front edge.
  hall.bays.forEach((t, k) => {
    const x0 = 3.1 + k * 2.2;
    const cols = [...Array(Math.min(12, t.open)).fill('#F0A020'), ...Array(Math.min(12, t.yes)).fill('#35B37A'), ...Array(Math.min(12, t.no)).fill('#E5433D')].slice(0, 12) as string[];
    cols.forEach((col, i) => { const tx = x0 + (i % 6) * 0.28, tz = 15 + Math.floor(i / 6) * 11; P4(pt(tx, 1.5, tz), pt(tx + 0.25, 1.5, tz), pt(tx + 0.25, 1.5, tz + 10), pt(tx, 1.5, tz + 10), col); });
    if (k === sel && t.open > 0 && act) disc(pt(x0 + 1.75, 1.2, 28), 3, '#F0A020');
  });
  // Two rope lines in front of the counter.
  item('queuec');
  for (const y of [3.2, 4.6]) for (let k = 0; k < 4; k++) { const x = 3.2 + k * 1.6; B(x, y, x + 0.12, y + 0.12, 0, 12, '#8A93A3'); if (k < 3) line(pt(x + 0.06, y + 0.06, 11), pt(x + 1.66, y + 0.06, 11), '#E5433D', 2); }
  // Three benches facing the counter.
  item('benchc');
  for (const [x0, y0] of [[1.0, 8.6], [5.6, 5.6], [1.0, 5.6]] as const) { B(x0, y0, x0 + 3.2, y0 + 0.5, 0, 6, '#8D6B52', '#C9925A'); B(x0, y0 + 0.4, x0 + 3.2, y0 + 0.55, 6, 12, '#8D6B52'); }
  item('plants'); palm(0.6, 0.6); bush(8.8, 8.6); bush(0.6, 4.8);
  item('deskc');
  B(5.6, 8.4, 8.4, 9.2, 0, 10, '#C9925A', '#FFF6CF'); flat(5.9, 8.6, 6.6, 9.0, 10.4, '#FFFFFF'); flat(6.8, 8.6, 7.5, 9.0, 10.4, '#FFFFFF');
  void g;
}

/** Floors drawn as halls, and the spots their agents stand on. */
export const HALLS: Record<string, readonly (readonly [number, number])[]> = {
  lobby: [[4.4, 3.4], [5.6, 3.4], [6.8, 3.4], [2.2, 7.9], [3.4, 7.9], [5.85, 8.9], [7.65, 8.9], [8.6, 4.2]],
  approval: [], question: [], plan: [],
  roof: [[3.0, 6.6], [5.2, 6.6], [7.6, 6.2]],
};

/**
 * The roof of a session building as a full 12×12 roof: the solar array grows with the building's tokens (one row of
 * panels per doubling, at most eighteen panels); a finished session's roof is a garden, as in the city. The
 * antenna's light blinks only while an agent works in the building.
 */
export function paintRoof(h: HallGeometry = FULL_HALL): void {
  for (let i = 0; i < h.size * 2; i++) for (let j = 0; j < h.size * 2; j++) if ((i + j) & 1) F(i * 0.5, j * 0.5, i * 0.5 + 0.5, j * 0.5 + 0.5, N('#C3C9D4'));
  { const w = h.aisles[0]; F(w[0], w[1], w[2], w[3], N('#F4F1E8')); F(w[0] + 0.1, w[1], w[2] - 0.1, w[3], N('#E3E0D6')); }
  // The access door's little housing at the back right, where the lift arrives.
  item('housingc');
  grp('housing');
  B(10.9, 0.15, 11.85, 0.9, 0, 30, '#AEB5C2', '#8A93A3'); P4(pt(11.0, 0.9, 0), pt(11.7, 0.9, 0), pt(11.7, 0.9, 24), pt(11.0, 0.9, 24), '#59627A');
  item('antenna');
  if (grp('antenna')) {
  B(0.5, 0.5, 0.9, 0.9, 0, 4, '#59627A'); line(pt(0.7, 0.7, 4), pt(0.7, 0.7, 70), '#8A93A3', 3);
  for (const z of [30, 46, 60]) line(pt(0.5, 0.7, z), pt(0.9, 0.7, z), '#8A93A3', 2);
  disc(pt(0.7, 0.7, 72), 4, '#E5433D');   // an aviation light: still (no blinking that is not data)
  }
  // Solar array: panels from the tokens (as many as the roof has places for).
  const panels = Math.min(h.slots.length, Math.max(0, Math.round(Math.log2(hall.tokens / 2000 + 1) * 2)));
  for (let k = 0; k < panels; k++) {
    item('panel' + k);
    const s = h.slots[k];
    grp('panel' + s);
    const x = 1.2 + (s % 6) * 1.3, y = 1.6 + Math.floor(s / 6) * 1.5;
    mark(x, y + 0.1, x + 1.1, y + 0.9);
    B(x + 0.05, y + 0.7, x + 0.12, y + 0.78, 0, 6, '#59627A'); B(x + 0.98, y + 0.7, x + 1.05, y + 0.78, 0, 6, '#59627A');
    P4(pt(x, y + 0.9, 3), pt(x + 1.1, y + 0.9, 3), pt(x + 1.1, y + 0.1, 14), pt(x, y + 0.1, 14), '#1F4FB0');
    for (let c = 1; c < 3; c++) line(pt(x + c * 0.37, y + 0.88, 3.2), pt(x + c * 0.37, y + 0.12, 13.8), '#7FA8F5', 1);
    line(pt(x, y + 0.5, 8.5), pt(x + 1.1, y + 0.5, 8.5), '#7FA8F5', 1);
  }
  // Air handling: two units with their fans.
  for (const y of [6.4, 7.8]) {
    item('hvacc' + y);
    if (!grp('hvac' + y)) continue;
    B(9.0, y, 9.5, y + 1.0, 0, 12, '#CDD2DA', '#AEB5C2');
    const c0 = pt(9.25, y + 0.5, 12.2); disc(c0, 8, '#59627A'); disc(c0, 6, '#8A93A3'); disc(c0, 2, '#39415A');
  }
  item('tankc');
  if (grp('tank')) for (const [dx, dy] of [[0, 0], [0.8, 0], [0, 0.8], [0.8, 0.8]]) B(0.8 + dx, 8.4 + dy, 0.9 + dx, 8.5 + dy, 0, 14, '#8D6B52');
  if (grp('tank')) cyl(1.25, 8.85, 0.55, 14, 36, '#A8743F', '#C9925A');
  if (hall.done) {   // a finished session's roof is a garden
    for (let k = 0; k < 4; k++) {
      item('bedc' + k);
      if (!grp('bed' + k)) continue;
      const x = 3.0 + (k % 2) * 2.6, y = 7.0 + Math.floor(k / 2) * 2.2;
      B(x, y, x + 2.0, y + 1.4, 0, 5, '#A8743F', '#5A4636');
      for (let c = 0; c < 4; c++) { const q = pt(x + 0.35 + (c % 2) * 1.0, y + 0.4 + Math.floor(c / 2) * 0.6, 5); line(q, [q[0], q[1] - 8 - (c * 5) % 7], '#2E9E48', 3); disc([q[0], q[1] - 10 - (c * 5) % 7], 5, c & 1 ? '#4CC552' : '#8BD93E'); }
    }
    item('benchc'); if (grp('bench')) B(3.0, 5.6, 5.4, 6.0, 0, 5, '#C9925A', '#FFF6CF');
  } else {
    item('vents');
    if (grp('vents')) for (const x of [3.4, 5.0, 6.6]) { B(x, 8.0, x + 0.5, 8.5, 0, 8, '#AEB5C2', '#CDD2DA'); B(x + 0.1, 8.1, x + 0.4, 8.4, 8, 11, '#8A93A3'); }
  }
}
