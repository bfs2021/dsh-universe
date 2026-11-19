// The theme of a session: picked once from the session title when a
// real title first exists, then frozen as an id. The title is never stored. `themeOf` turns the id (plus any tags a
// platform declares) into weights; it reads its input field by field, never a conversation or tool content.
import { THEME_WORDS } from './theme-keywords.ts';
import type { Category } from './types.ts';

export const TAGS = [
  'finance', 'sales', 'code', 'docs', 'research', 'design', 'data', 'legal',
  'ops', 'media', 'support', 'hr', 'marketing', 'product', 'security', 'admin',
] as const;
export type Tag = (typeof TAGS)[number];
export type Theme = Partial<Record<Tag, number>>;

/** A frozen session theme: one tag, or neutral when the title matched nothing. */
export type ThemeId = Tag | 'neutral';
export const NEUTRAL: ThemeId = 'neutral';

export interface ThemeInput {
  /** The session's frozen theme id (from its title, see `themeFromTitle`), weight 3. */
  themeId?: string;
  /** Tags declared for the workspace (weight 3; DSH has none today). */
  workspaceTags?: readonly string[];
  /** Tags declared by the expert preset (weight 3; DSH has none today). */
  presetTags?: readonly string[];
  /** Tags of each connector used (weight 2). */
  connectorTags?: readonly (readonly string[])[];
  /** Tags of the skills used (weight 2). */
  skillTags?: readonly string[];
  /** Calls per category (weight 1–2 by mix). */
  mix?: Partial<Record<Category, number>>;
}

const isTag = (x: unknown): x is Tag => typeof x === 'string' && (TAGS as readonly string[]).includes(x);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const WORD_START = /[a-z0-9]/;

/**
 * The theme of a session title: the tag whose zh / en words occur most often in the title; ties
 * go to the earlier tag in `TAGS`; nothing → neutral. Deterministic and local: no model call, nothing leaves the
 * device. The result is an id, so the title itself never needs to be kept.
 */
export function themeFromTitle(title: unknown): ThemeId {
  if (typeof title !== 'string') return NEUTRAL;
  const text = title.normalize('NFKC').toLowerCase().trim();
  if (!text) return NEUTRAL;
  let best: ThemeId = NEUTRAL, bn = 0;
  for (const tag of TAGS) {
    const w = THEME_WORDS[tag];
    let n = 0;
    for (const z of w.zh) if (text.includes(z)) n++;
    for (const e of w.en) {
      for (let i = text.indexOf(e); i >= 0; i = text.indexOf(e, i + 1)) {
        if (i === 0 || !WORD_START.test(text[i - 1])) { n++; break; }
      }
    }
    if (n > bn) { bn = n; best = tag; }
  }
  return best;
}

/** Reads a stored theme id back; anything unknown is neutral. */
export const readThemeId = (v: unknown): ThemeId => (isTag(v) ? v : NEUTRAL);

/** Tag weights for choosing rooms and building templates. Only these fields are read. */
export function themeOf(input: ThemeInput): Theme {
  const th: Theme = {};
  const add = (tags: readonly unknown[], w: number) => { for (const t of tags) if (isTag(t)) th[t] = (th[t] ?? 0) + w; };
  if (isTag(input.themeId)) add([input.themeId], 3);
  add(strings(input.workspaceTags), 3);
  add(strings(input.presetTags), 3);
  if (Array.isArray(input.connectorTags)) for (const c of input.connectorTags) add(strings(c), 2);
  add(strings(input.skillTags), 2);
  const m = input.mix && typeof input.mix === 'object' ? input.mix : {};
  const n = (k: Category) => { const v = (m as Record<string, unknown>)[k]; return typeof v === 'number' && v > 0 ? v : 0; };
  const tot = (['read', 'search', 'edit', 'exec', 'web', 'connector', 'delegate', 'skill', 'memory', 'plan', 'deliver', 'other'] as const)
    .reduce((a, k) => a + n(k), 0);
  if (tot > 0) {
    if ((n('edit') + n('exec')) / tot > 0.5) add(['code'], 2);
    if ((n('web') + n('search')) / tot > 0.3) add(['research'], 2);
    if (n('read') / tot > 0.5) add(['docs'], 1);
    if (n('connector') / tot > 0.3) add(['data'], 1);
  }
  return th;
}
