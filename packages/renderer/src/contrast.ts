// Text on a coloured label must meet WCAG AA (4.5:1). A label keeps its chosen ink when that passes; otherwise it gets
// the first of white, the outline navy or black that does on its background (the background colour, which carries the
// meaning, never changes).
const lum = (hex: string): number => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** WCAG contrast ratio of two `#rrggbb` colours. */
export const contrast = (a: string, b: string): number => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** In order of preference: white, the outline navy, then black for mid-tone reds and purples neither reaches. */
const INKS = ['#FFFFFF', '#141A30', '#000000'];
const HEX = /^#[0-9a-f]{6}$/i;
/** The ink to draw on `bg`: `fg` when it reaches 4.5:1, else the first of white, #141A30 and black that does. */
export function inkOn(bg: string, fg: string): string {
  if (!HEX.test(bg) || !HEX.test(fg) || contrast(bg, fg) >= 4.5) return fg;
  return INKS.find((x) => contrast(bg, x) >= 4.5) ?? INKS.reduce((a, b) => (contrast(bg, b) > contrast(bg, a) ? b : a));
}
