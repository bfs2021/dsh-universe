// Cars: an honest aggregate. The number of cars is the number of calls in the last five minutes ÷ 2
// (at most 64); with no calls the roads are empty. Where a car drives carries no meaning, so it is seeded random;
// under reduced motion cars stand still.
import { ROAD_LINES, isRoad, rng } from '@dsh-universe/model';

export interface Car { i: number; j: number; dx: number; dy: number; u: number; c: number; m: number; sp: number }

export class Traffic {
  readonly cars: Car[] = [];
  private r: () => number;
  constructor(seed = 7) { this.r = rng(seed); }

  /** Adds or removes cars to match `want`, then moves them by dt seconds (not when `move` is false). */
  step(want: number, growth: number, dt: number, move: boolean): void {
    const r = this.r, RD = ROAD_LINES, road = (i: number, j: number) => isRoad(i, j, growth);
    for (let tries = 0; this.cars.length < want && tries < 400; tries++) {
      const v = r() < 0.5, line = RD[1 + Math.floor(r() * (RD.length - 2))], o = -11 + Math.floor(r() * 51), d = r() < 0.5 ? 1 : -1;
      const i = v ? line : o, j = v ? o : line, m = r();
      if (!road(i, j) || !road(i + (v ? 0 : d), j + (v ? d : 0))) continue;
      this.cars.push({ i, j, dx: v ? 0 : d, dy: v ? d : 0, u: r(), c: Math.floor(r() * 8), m: m < 0.45 ? 0 : m < 0.6 ? 4 : m < 0.75 ? 1 : m < 0.9 ? 2 : 3, sp: 2.6 + r() * 1.6 });
    }
    while (this.cars.length > want) this.cars.pop();
    for (let k = this.cars.length - 1; k >= 0; k--) if (!road(this.cars[k].i, this.cars[k].j)) this.cars.splice(k, 1);
    if (!move) return;
    for (const c of this.cars) {
      c.u += dt * c.sp * (c.m === 3 ? 0.75 : 1);
      while (c.u >= 1) {
        c.u -= 1; c.i += c.dx; c.j += c.dy;
        if (RD.includes(c.i) && RD.includes(c.j)) {
          const op = [[c.dx, c.dy, 3], [c.dy, c.dx, 1], [-c.dy, -c.dx, 1]].filter((q) => road(c.i + q[0], c.j + q[1]));
          if (!op.length) { c.dx = -c.dx; c.dy = -c.dy; }
          else { let v = r() * op.reduce((a, q) => a + q[2], 0), pick = op[0]; for (const q of op) { v -= q[2]; if (v <= 0) { pick = q; break; } } c.dx = pick[0]; c.dy = pick[1]; }
        } else if (!road(c.i + c.dx, c.j + c.dy)) { c.dx = -c.dx; c.dy = -c.dy; }
      }
    }
  }
}

/** Where a car is drawn (tiles): in its lane, keeping right. */
export const carXY = (c: Car): [number, number] => [c.i + 0.5 + c.dx * c.u - c.dy * 0.22, c.j + 0.5 + c.dy * c.u + c.dx * 0.22];
