// Everything that never moves: the land the city stands on (it ends at the border),
// park patterns (flat ground art, no walls), blocks and lots, the river and quay, roads with lane marks, crossings,
// stop lines and manholes, bridges, the civic precinct and the square, the railway, power lines and lamp posts.
// Painted once per border, claims and light.
import type { GroundSpec } from '@dsh-universe/renderer';
import { GROWTH, ROAD_LINES, cityTemplate, hs, isRoad } from '@dsh-universe/model';
import { P4, box, flat, g, iso, line } from '../iso.ts';
import { P, env, tone } from '../light.ts';
import { BOLD, WORKSPACE_WALL, mix } from '../palette.ts';
import { cityLayout } from './layout.ts';

const RD = ROAD_LINES;

function deco(bx: number, by: number, v: number): void {
  const f = (x0: number, y0: number, x1: number, y1: number, c: string) => flat(bx + x0, by + y0, bx + x1, by + y1, 0, tone(c, 0));
  if (v === 0) {   // a sports court
    f(0.4, 0.4, 4.6, 4.6, '#FF8A2B'); g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath();
    for (const [a, b, c, d] of [[0.7, 0.7, 4.3, 0.7], [4.3, 0.7, 4.3, 4.3], [4.3, 4.3, 0.7, 4.3], [0.7, 4.3, 0.7, 0.7], [0.7, 2.5, 4.3, 2.5]]) { const p0 = iso(bx + a, by + b), p1 = iso(bx + c, by + d); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
    g.stroke(); const c0 = iso(bx + 2.5, by + 2.5); g.beginPath(); g.ellipse(c0[0], c0[1], 26, 13, 0, 0, 6.3); g.stroke();
  } else if (v === 1) { f(0.3, 0.3, 4.7, 4.7, '#F4F1E8'); f(0.8, 0.8, 4.2, 4.2, '#2FA8F0'); for (let k = 1; k < 4; k++) f(0.8 + k * 0.85, 0.8, 0.86 + k * 0.85, 4.2, '#7FD0FF'); for (let k = 0; k < 3; k++) f(0.4, 1 + k * 1.2, 0.7, 1.5 + k * 1.2, ['#E5433D', '#FFC928', '#FF4FA3'][k]); }   // a pool
  else if (v === 2) { f(0.3, 0.3, 4.7, 4.7, '#4CC552'); f(2.3, 0.3, 2.7, 4.7, '#FFF6CF'); f(0.3, 2.3, 4.7, 2.7, '#FFF6CF'); for (let k = 0; k < 4; k++) for (let m = 0; m < 2; m++) f(0.6 + (k & 1) * 2.6 + m * 0.7, 0.6 + (k >> 1) * 2.6, 1.1 + (k & 1) * 2.6 + m * 0.7, 1.9 + (k >> 1) * 2.6, ['#FF4FA3', '#FFC928', '#E5433D', '#8E5BE8', '#FF8A2B', '#22C3E6', '#FFFFFF', '#FF4FA3'][k * 2 + m]); }   // flower beds
  else if (v === 3) { for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if ((i + j) & 1) f(i * 0.5, j * 0.5, i * 0.5 + 0.5, j * 0.5 + 0.5, '#FFE9F3'); f(2, 2, 3, 3, '#2FA8F0'); f(2.2, 2.2, 2.6, 2.4, '#7FD0FF'); for (const [x, y] of [[0.6, 0.6], [3.9, 0.6], [0.6, 3.9], [3.9, 3.9]]) f(x, y, x + 0.5, y + 0.5, '#4CC552'); }   // a paved square
  else if (v === 4) { f(0.2, 0.2, 4.8, 4.8, '#FFE9F3'); for (let i = 0; i < 6; i++) f(0.5 + i * 0.7, 4.1, 0.9 + i * 0.7, 4.5, BOLD[i]); }   // the fairground (the wheel is a sprite)
  else { f(0.3, 0.3, 4.7, 4.7, '#4CC552'); f(1.2, 1.4, 3.8, 3.6, '#2FA8F0'); f(1.5, 1.7, 2.6, 1.9, '#7FD0FF'); f(0.3, 2.3, 1.2, 2.7, '#FFF6CF'); f(3.8, 2.3, 4.7, 2.7, '#FFF6CF'); }   // a pond park
}

/** Canvas for the whole ground (art pixels) and where tile (0, 0) sits in it. */
export const GROUND_BOX: [number, number, number, number] = [2400, 960, 1200, 220];

export function paintGround(spec: GroundSpec): void {
  const G = GROWTH[Math.max(0, Math.min(GROWTH.length - 1, spec.growth))];
  const B0 = G[0], B2 = G[1], B1 = G[2], B3 = G[3];
  const inC = (x: number, y: number) => x >= B0 && x < B1 && y >= B2 && y < B3;
  const road = (i: number, j: number) => isRoad(i, j, spec.growth);
  const T = cityTemplate(), L = cityLayout();
  {   // the land: it ends at the border
    const th = 46, gr = '#E3E0D6', f = (a: number, b: number, c: number, d: number, col: string) => P4(iso(a, b), iso(c, d), iso(c, d, -th), iso(a, b, -th), col);
    f(B0, B3, B1, B3, tone('#B48C69', -0.2)); f(B1, B3, B1, B2, tone('#B48C69', -0.04));
    P4(iso(B0, B3, -th * 0.55), iso(B1, B3, -th * 0.55), iso(B1, B3, -th), iso(B0, B3, -th), tone('#8D6B52', -0.2)); P4(iso(B1, B3, -th * 0.55), iso(B1, B2, -th * 0.55), iso(B1, B2, -th), iso(B1, B3, -th), tone('#8D6B52', -0.04));
    P4(iso(B0, B3), iso(B1, B3), iso(B1, B3, -8), iso(B0, B3, -8), tone(gr, -0.3)); P4(iso(B1, B3), iso(B1, B2), iso(B1, B2, -8), iso(B1, B3, -8), tone(gr, -0.15)); flat(B0, B2, B1, B3, 0, tone(gr, 0));
  }
  for (const d of L.deco) if (inC(d.bx, d.by)) deco(d.bx, d.by, d.v);
  for (const [x0, y0, x1, y1] of [[13, -11, 16, -1], [13, 1, 16, 12], [13, 23, 16, 28], [13, 29, 16, 40], [-11, 13, -1, 16], [1, 13, 12, 16]]) {   // the green civic axis
    const a = Math.max(x0, B0 + 1), b = Math.max(y0, B2 + 1), c = Math.min(x1, B1 - 1), d = Math.min(y1, B3 - 1);
    if (a >= c || b >= d) continue;
    flat(a, b, c, d, 0, tone('#E6F7D6', 0)); if (x1 - x0 === 3) flat(x0 + 1.3, b, x0 + 1.7, d, 0, tone('#FFF6CF', 0));
  }
  for (const bl of T.blocks) {
    const bx = bl.bx, by = bl.by;
    if (!inC(bx, by) || !inC(bx + 5, by + 5)) continue;
    if (bl.zone === 'build') {
      const ws = spec.claimed.get(bl.key), cl = ws !== undefined, tint = cl ? mix('#FFFFFF', WORKSPACE_WALL[ws % WORKSPACE_WALL.length], 0.3) : '#E3E0D6';
      flat(bx, by, bx + 5, by + 5, 0, tone(cl ? tint : '#EFEDE6', 0)); flat(bx + 0.06, by + 0.06, bx + 4.94, by + 4.94, 0, tone('#F4F1E8', 0));   // pavement
      flat(bx + 2.1, by + 0.06, bx + 2.9, by + 4.94, 0, tone(tint, 0)); flat(bx + 0.06, by + 2.1, bx + 4.94, by + 2.9, 0, tone(tint, 0));   // the cross lanes
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) & 1) flat(bx + 2.1 + i * 0.2, by + 2.1 + j * 0.2, bx + 2.3 + i * 0.2, by + 2.3 + j * 0.2, 0, tone('#FFE9F3', 0));   // the little plaza
      for (const Lt of bl.lots) {
        const v = spec.used.has(Lt.key) ? 3 : (L.lotVariant.get(Lt.key) ?? 3);
        if (v < 2 && cl) { flat(Lt.x + 0.1, Lt.y + 0.1, Lt.x + 1.9, Lt.y + 1.9, 0, tone('#C9925A', 0)); flat(Lt.x + 0.5, Lt.y + 0.4, Lt.x + 1.5, Lt.y + 1.2, 0, tone('#A8743F', 0)); flat(Lt.x + 0.3, Lt.y + 1.4, Lt.x + 0.9, Lt.y + 1.7, 0, tone('#8D6B52', 0)); }   // a site being levelled
        else if (v === 2) { flat(Lt.x + 0.1, Lt.y + 0.1, Lt.x + 1.9, Lt.y + 1.9, 0, tone('#AEB5C2', 0)); for (let k = 0; k < 5; k++) { flat(Lt.x + 0.2 + k * 0.36, Lt.y + 0.15, Lt.x + 0.24 + k * 0.36, Lt.y + 0.75, 0, '#FFFFFF'); flat(Lt.x + 0.2 + k * 0.36, Lt.y + 1.25, Lt.x + 0.24 + k * 0.36, Lt.y + 1.85, 0, '#FFFFFF'); } }   // a car park
        else { flat(Lt.x + 0.15, Lt.y + 0.15, Lt.x + 1.85, Lt.y + 1.85, 0, tone('#4CC552', 0)); for (let k = 0; k < 4; k++) flat(Lt.x + 0.35 + (k & 1) * 0.8, Lt.y + 0.35 + (k >> 1) * 0.8, Lt.x + 0.85 + (k & 1) * 0.8, Lt.y + 0.85 + (k >> 1) * 0.8, 0, tone(BOLD[(k + Lt.x + Lt.y + 64) % 8], 0)); }   // a community garden
      }
    } else if (bl.zone === 'shops') flat(bx, by, bx + 5, by + 5, 0, tone('#FFE9F3', 0));
    else if (bl.zone === 'power') {
      const k = T.powerBlocks.findIndex(([x, y]) => x === bx && y === by);
      flat(bx, by, bx + 5, by + 5, 0, tone('#E9DDF5', 0));
      if (k >= Math.max(1, spec.models)) {   // a power block kept for a future model: a gravel yard behind a fence, transformers waiting
        flat(bx + 0.3, by + 0.3, bx + 4.7, by + 4.7, 0, tone('#D6D2CA', 0));
        for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3) % 5 === 0) flat(bx + 0.4 + i * 0.48, by + 0.4 + j * 0.48, bx + 0.5 + i * 0.48, by + 0.46 + j * 0.48, 0, tone('#AEB5C2', 0));
        g.strokeStyle = tone('#8A93A3', 0); g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath();
        const c = [iso(bx + 0.3, by + 0.3), iso(bx + 4.7, by + 0.3), iso(bx + 4.7, by + 4.7), iso(bx + 0.3, by + 4.7)];
        c.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.stroke(); g.setLineDash([]);
        for (const [x, y] of [[1.3, 1.3], [3.2, 1.3], [1.3, 3.2], [3.2, 3.2]]) box(bx + x, by + y, bx + x + 0.5, by + y + 0.5, 0, 9, '#AEB5C2', '#CDD2DA');
      }
    }
    else if (bl.zone === 'library') { flat(bx, by, bx + 5, by + 5, 0, tone('#E6F7D6', 0)); flat(bx + 0.6, by + 0.8, bx + 4.4, by + 4.6, 0, P.plaza); }
  }
  for (const [x, y] of [[14.5, 26.8], [14.5, 9.8], [14.5, 31.5]].slice(0, spec.connectors)) if (inC(x, y)) flat(x - 1.3, y - 1.2, x + 1.3, y + 1.3, 0, P.plaza);
  for (const [x, y] of [[14.5, 23.8], [14.5, 4.5]]) if (inC(x, y)) flat(x - 1.3, y - 1.2, x + 1.3, y + 1.3, 0, P.plaza);
  flat(7, 13, 12, 14.1, 0, P.plaza);
  flat(17, 13, B1, 16, 0, P.wood); g.strokeStyle = P.wood2; g.lineWidth = 2; g.beginPath();
  for (let x = 17.5; x < B1; x += 0.5) { const a = iso(x, 13), b = iso(x, 16); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  g.stroke();
  flat(20, 13.3, B1, 15.7, 0, P.water); flat(21, 14.6, 23.2, 15.7, 0, P.wood);
  for (let k = 0; k < 14 && 20.9 + k * 1.45 < B1; k++) flat(20.4 + k * 1.45, 13.6 + (k % 3) * 0.5, 20.9 + k * 1.45, 13.68 + (k % 3) * 0.5, 0, P.water2);
  P4(iso(B1, 15.7), iso(B1, 13.3), iso(B1, 13.3, -46), iso(B1, 15.7, -46), P.water2);
  for (const r of RD) { if (r >= B0 && r < B1) flat(r, B2, r + 1, B3, 0, P.road); if (r >= B2 && r < B3) flat(B0, r, B1, r + 1, 0, P.road); }
  g.strokeStyle = P.dash; g.lineWidth = 2; g.setLineDash([8, 8]); g.beginPath();
  for (const r of RD) {
    if (r >= B0 && r < B1) { const a = iso(r + 0.5, B2), b = iso(r + 0.5, B3); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    if (r >= B2 && r < B3) { const a = iso(B0, r + 0.5), b = iso(B1, r + 0.5); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  }
  g.stroke(); g.setLineDash([]);
  for (const a of RD) for (const b of RD) for (let k = 0; k < 3; k++) {   // zebra crossings (grey at night, so they do not glare)
    const c = env.night > 0.5 ? '#AEB5C2' : '#FFFFFF';
    if (road(a + 1, b)) flat(a + 1.1, b + 0.14 + k * 0.27, a + 1.4, b + 0.26 + k * 0.27, 0, c);
    if (road(a - 1, b)) flat(a - 0.4, b + 0.14 + k * 0.27, a - 0.1, b + 0.26 + k * 0.27, 0, c);
    if (road(a, b + 1)) flat(a + 0.14 + k * 0.27, b + 1.1, a + 0.26 + k * 0.27, b + 1.4, 0, c);
    if (road(a, b - 1)) flat(a + 0.14 + k * 0.27, b - 0.4, a + 0.26 + k * 0.27, b - 0.1, 0, c);
  }
  for (let i = B0; i < B1; i++) for (let j = B2; j < B3; j++) if (road(i, j) && hs(i, j, 77) < 0.05) { const q = iso(i + 0.5, j + 0.5); g.fillStyle = tone('#39415A', 0); g.beginPath(); g.ellipse(q[0], q[1], 7, 3.5, 0, 0, 6.3); g.fill(); }   // manholes
  for (const r of RD) if (r >= 22 && r < B1) {   // bridge parapets and piers over the river
    box(r - 0.02, 13.25, r + 0.06, 15.75, 0, 6, '#CDD2DA', '#F4F1E8'); box(r + 0.94, 13.25, r + 1.02, 15.75, 0, 6, '#CDD2DA', '#F4F1E8');
    for (const y of [13.9, 14.5, 15.1]) box(r + 0.96, y, r + 1.04, y + 0.12, -30, 0, '#8A93A3');
  }
  g.strokeStyle = tone('#F4F1E8', 0); g.lineWidth = 2; g.beginPath();   // quay railing
  for (const y of [13.3, 15.7]) for (let x = 20; x < B1 - 0.3; x += 0.5) { if (RD.some((r) => x >= r - 0.1 && x <= r + 1.1)) continue; const a = iso(x, y, 0), b = iso(x, y, 6), c = iso(x + 0.5, y, 6); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); }
  g.stroke();
  for (const a2 of RD) for (const b2 of RD) {   // stop lines
    if (!road(a2, b2)) continue;
    if (road(a2 - 1, b2)) flat(a2 - 0.5, b2 + 0.5, a2 - 0.44, b2 + 0.95, 0, '#FFFFFF');
    if (road(a2 + 1, b2)) flat(a2 + 1.44, b2 + 0.05, a2 + 1.5, b2 + 0.5, 0, '#FFFFFF');
    if (road(a2, b2 - 1)) flat(a2 + 0.05, b2 - 0.5, a2 + 0.5, b2 - 0.44, 0, '#FFFFFF');
    if (road(a2, b2 + 1)) flat(a2 + 0.5, b2 + 1.44, a2 + 0.95, b2 + 1.5, 0, '#FFFFFF');
  }
  for (const x of [25, 31, 37]) if (x + 1 < B1) { flat(x, 14.6, x + 0.45, 15.7, 0, P.wood); for (const dx of [0, 0.37]) box(x + dx, 14.6, x + dx + 0.08, 14.68, 0, 5, '#8D6B52'); box(x + 0.1, 14.3, x + 0.35, 14.55, -2, 3, '#F4F1E8', BOLD[x % 8]); }   // wooden piers, a dinghy tied up
  // the civic precinct: a lawn ring, the hall's forecourt, the big square. No traffic comes in here.
  flat(12, 13, 17, 22, 0, tone('#4CC552', 0)); flat(12.4, 13.35, 16.6, 16.75, 0, tone('#F4F1E8', 0)); flat(12.55, 16.75, 16.45, 21.6, 0, tone('#FFF6CF', 0));
  for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++) if ((i + j) & 1) flat(12.55 + i * 0.4875, 16.75 + j * 0.485, 12.55 + (i + 1) * 0.4875, 16.75 + (j + 1) * 0.485, 0, tone('#FFE9F3', 0));
  for (const [x, y] of [[12.1, 13.1], [16.5, 13.1], [12.1, 21.5], [16.5, 21.5]]) for (let k = 0; k < 4; k++) flat(x + (k & 1) * 0.2, y + (k >> 1) * 0.2, x + 0.2 + (k & 1) * 0.2, y + 0.2 + (k >> 1) * 0.2, 0, tone(BOLD[(k * 2 + 1) % 8], 0));
  if (spec.rail) {   // the elevated railway into the station, from beyond the border
    flat(B0 - 11, 14.2, B0, 14.8, 0, tone('#CDD2DA', 0)); P4(iso(B0 - 11, 14.8), iso(B0, 14.8), iso(B0, 14.8, -8), iso(B0 - 11, 14.8, -8), tone('#CDD2DA', -0.25));
    for (let x = B0 - 10; x < B0; x += 3) line(iso(x, 14.8, -8), iso(x, 14.8, -42), tone('#AEB5C2', -0.2), 4);
    g.strokeStyle = P.sleeper; g.lineWidth = 2; g.beginPath(); for (let x = B0 - 10.8; x < 11.4; x += 0.5) { const a = iso(x, 14.3), b = iso(x, 14.7); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke();
    line(iso(B0 - 11, 14.38), iso(11.5, 14.38), P.rail, 2); line(iso(B0 - 11, 14.62), iso(11.5, 14.62), P.rail, 2);
  }
  T.powerBlocks.slice(0, Math.max(1, spec.models)).forEach(([bx, by]) => {   // power lines along the avenues into town
    const at: [number, number] = [bx + 2.5, by + 2.5], feed = bx < 13 ? 12.5 : 16.5, pts = [[at[0], at[1]], [feed, at[1]], [feed, 12.4]];
    for (let y = at[1]; y <= 12.4; y += 3) { const b = iso(feed, y); line(b, [b[0], b[1] - 24], tone('#59627A', 0), 2); line([b[0] - 5, b[1] - 22], [b[0] + 5, b[1] - 22], tone('#59627A', 0), 2); }
    g.strokeStyle = tone('#39415A', 0); g.lineWidth = 2; g.beginPath(); pts.forEach((q, i) => { const v = iso(q[0], q[1], 22); if (i) g.lineTo(v[0], v[1]); else g.moveTo(v[0], v[1]); }); g.stroke();
  });
  for (const a of RD) for (const b of RD) {   // lamp posts at the crossings (not lit: lights mean work)
    if (!road(a, b)) continue;
    const q = iso(a + 0.08, b + 0.92); line(q, [q[0], q[1] - 12], tone('#39415A', 0), 2); g.fillStyle = tone('#CDD2DA', 0); g.fillRect(q[0] - 2, q[1] - 16, 4, 4);
  }
  for (let y = 1.2; y < 28; y += 0.6) { const q = iso(28.98, y, 16 - Math.abs(((y * 1.6667) % 6) - 3) * 1.4); g.fillStyle = BOLD[Math.floor(y * 1.6667) % 8]; g.beginPath(); g.moveTo(q[0] - 3, q[1]); g.lineTo(q[0] + 3, q[1]); g.lineTo(q[0], q[1] + 6); g.closePath(); g.fill(); }   // bunting along plugin street
  void env;
}
