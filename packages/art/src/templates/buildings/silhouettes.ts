// The footprint of segment k of a tower for each of the 15 silhouettes. Segment 0 is the
// retail podium every tower stands on. A part is [x0, y0, x1, y1] in tiles.
export type Part = [number, number, number, number];

export function partsOf(form: number, k: number, cx: number, cy: number, hw: number): Part[] {
  const r = (wx: number, wy: number, ox = 0, oy = 0): Part => [cx + ox - wx, cy + oy - wy, cx + ox + wx, cy + oy + wy];
  const pod = hw + 0.04;
  if (!k) {
    return form === 5
      ? [r(pod * 0.55, pod, -pod * 0.45, 0), r(pod * 0.45, pod * 0.5, pod * 0.55, pod * 0.5)]
      : [r(form === 6 ? hw * 0.7 : form === 7 ? Math.min(0.95, hw * 1.2) : pod, form === 7 ? hw * 0.72 : pod)];
  }
  switch (form) {
    case 1: { const w = Math.max(0.3, hw - k * 0.1); return [r(w, w)]; }                                        // art-deco setbacks
    case 2: { const w = Math.max(0.26, hw * 0.9 - k * 0.09); return [r(w, w)]; }                                 // tapering supertall
    case 3: return [r(hw * 0.6, hw * 0.6, -hw * 0.24, -hw * 0.24)];                                              // slender tower on a corner
    case 4: return [r(hw * 0.4, hw * 0.86, -hw * 0.56, 0), r(hw * 0.4, hw * 0.86, hw * 0.56, 0)];               // twin towers
    case 5: return k < 2 ? [r(hw * 0.5, hw * 0.92, -hw * 0.46, 0), r(hw * 0.44, hw * 0.48, hw * 0.52, hw * 0.46)] : [r(hw * 0.5, hw * 0.92, -hw * 0.46, 0)]; // L-plan, low wing
    case 6: return [r(hw * 0.5, hw * 0.5)];                                                                      // pencil
    case 7: return [r(Math.min(0.92, hw * 1.15), hw * 0.5)];                                                     // broad slab
    case 9: { const w = Math.max(0.28, hw * 0.95 - Math.floor((k + 1) / 2) * 0.16); return [r(w, w)]; }         // stepped deco
    case 10: return [r(hw * 0.76, hw * 0.76, k & 1 ? hw * 0.14 : -hw * 0.14, k & 1 ? -hw * 0.14 : hw * 0.14)];   // stacked boxes
    case 11: { const w = Math.max(0.34, hw * 0.98 - k * 0.08); return [r(w, hw * 0.46)]; }                       // narrowing slab
    case 12: return k < 3
      ? [r(hw * 0.9, hw * 0.3, 0, -hw * 0.62), r(hw * 0.3, hw * 0.58, -hw * 0.6, hw * 0.3), r(hw * 0.3, hw * 0.58, hw * 0.6, hw * 0.3)]
      : [r(hw * 0.9, hw * 0.3, 0, -hw * 0.62)];                                                                  // U-plan court
    case 13: {
      const a = [r(hw * 0.42, hw * 0.42, -hw * 0.45, -hw * 0.4), r(hw * 0.42, hw * 0.42, hw * 0.45, -hw * 0.1), r(hw * 0.42, hw * 0.42, -hw * 0.45, hw * 0.5)];
      return k < 2 ? a : k < 4 ? a.slice(0, 2) : a.slice(0, 1);                                                 // three towers
    }
    case 14: return [r(k & 1 ? hw * 0.58 : hw * 0.9, k & 1 ? hw * 0.58 : hw * 0.9)];                             // wide and narrow in turn
    default: return [r(hw * 0.9, hw * 0.9)];                                                                     // 0 glass box; 8 round (a cylinder)
  }
}
