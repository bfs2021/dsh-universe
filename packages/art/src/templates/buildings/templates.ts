// The 60 session-building templates: 15 silhouettes × 4 facades, each with its own crown,
// window rhythm and shop front. A template is a design only: colour comes from the session, height from its work.
// Tags let the session theme (from its title) pick a template.

export interface TowerTemplate {
  id: string;
  /** Silhouette 0–14 (silhouettes.ts). */
  form: number;
  /** Facade: 0 sky glass, 1 tinted glass, 2 pale green glass, 3 stone ribs, 4 tiles, 5 white spandrels. */
  mat: number;
  /** Crown 0–11 (crowns.ts). */
  roof: number;
  /** Windows on masonry: 0 narrow, 1 wide bands, 2 tall. */
  win: number;
  /** Shop-front awning: 0 striped, 1 plain, 2 neon bar, 3 white valance. */
  aw: number;
  tags: readonly string[];
}

/** Crown per silhouette and facade. */
const CROWN = [[0, 5, 6, 9], [1, 3, 8, 10], [2, 2, 2, 4], [0, 1, 8, 5], [5, 0, 9, 6], [0, 7, 1, 9], [2, 2, 4, 2], [0, 9, 6, 5], [3, 8, 3, 8], [4, 4, 3, 11], [0, 6, 7, 9], [10, 3, 1, 5], [7, 0, 6, 9], [2, 8, 1, 0], [11, 3, 10, 4]];

/** Silhouette names, for ids and docs. */
export const SILHOUETTES = [
  'glass-box', 'deco-setback', 'tapering-supertall', 'corner-tower', 'twin-towers', 'l-plan', 'pencil', 'broad-slab',
  'round-tower', 'stepped-deco', 'stacked-boxes', 'narrowing-slab', 'u-court', 'three-cluster', 'wide-narrow',
] as const;

/**
 * Two tags per silhouette, so every theme has towers that suit it (glass for finance and data, workshops for code,
 * slabs for ops…). A matter of taste, kept in one table.
 */
const SIL_TAGS: readonly (readonly string[])[] = [
  ['finance', 'data'], ['legal', 'admin'], ['finance', 'product'], ['design', 'media'], ['sales', 'marketing'],
  ['ops', 'support'], ['code', 'research'], ['ops', 'data'], ['media', 'marketing'], ['legal', 'docs'],
  ['design', 'code'], ['hr', 'admin'], ['docs', 'research'], ['security', 'code'], ['support', 'sales'],
];
const MAT_TAGS: readonly (readonly string[])[] = [['data'], ['marketing'], ['research'], ['legal'], ['hr'], ['finance']];

export const TOWER_TEMPLATES: readonly TowerTemplate[] = (() => {
  const out: TowerTemplate[] = [];
  for (let f = 0; f < 15; f++) for (let m = 0; m < 4; m++) {
    // Facades per silhouette: glass tinted in the tower's own colour, two masonry fronts, one clear glass (sky or pale
    // green). Mostly colour and stone, so a block of finished towers is not a row of blue boxes.
    const mat = m === 0 ? 1 : m === 1 ? 3 + (f % 3) : m === 2 ? (f % 2 ? 2 : 0) : 3 + ((f + 1) % 3);
    out.push({ id: 'tower-' + f + '-' + m, form: f, mat, roof: CROWN[f][m], win: (f + m) % 3, aw: (f * 2 + m) % 4, tags: [...SIL_TAGS[f], ...MAT_TAGS[mat]] });
  }
  return out;
})();
