// Numbers, times and durations for the interface; words come from the locale tables.
import type { Translate } from './types.ts';

export function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  // `{n:call|calls}`: the first form when n is 1, else the second (English counts; Chinese does not use it).
  return text
    .replace(/\{(\w+):([^|{}]*)\|([^{}]*)\}/g, (m, k: string, one: string, other: string) => (k in params ? (String(params[k]) === '1' ? one : other) : m))
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** `t` that always fills {placeholders} itself (whether or not the host's bound translator does). */
export const translator = (t: (key: string) => string): Translate => (key, params) => fill(t(key), params);

export const tokens = (n: number, lang: string) => new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const clock = (t: number, lang: string) => new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t));

export function duration(ms: number, t: Translate): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return t('dur.s', { n: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t('dur.m', { n: m });
  // Whole hours drop the zero part ("1 h", not "1 h 0 min").
  return m % 60 ? t('dur.h', { h: Math.floor(m / 60), m: m % 60 }) : t('dur.hh', { h: m / 60 });
}
