// The full-page panel (phase 1: the list view; the city drawing comes in phase 2). The top sentence, the today bar
// and the list all come from the same data at the same moment.
import { useMemo, useRef, useState } from 'react';
import { LAYER_OF_TODAY, buildingOf, historyWindow, nextIndex, rally, seenKey, idxAt, type LayerId, type Today } from '@dsh-universe/model';
import { CityPanel, TOUR_BUILDING, type CityTarget } from './CityPanel.tsx';
import { LIST_CSS, group, groupBtn, px } from './chrome.ts';
import { readPrefs, writePrefs, type Prefs } from './prefs.ts';
import { useFeed, useNow, useObservable } from './hooks.ts';
import { clock } from './format.ts';
import { unlockSound, useSquareSound, useTime } from './time.ts';
import './overlays.ts';
import { ListView, rowId } from './ListView.tsx';
import { S } from './styles.ts';
import { TodayBar } from './TodayBar.tsx';
import { Tour } from './Tour.tsx';
import { TOUR } from './tour.ts';
import type { Env } from './types.ts';
import { CITY, counts, headline, places, sections, todayAt, todayButtons, type Row } from './view.ts';
import type { Store } from '@dsh-universe/model';
import type { Translate } from './types.ts';

/** The top sentence when looking back: what was going on at that moment. */
function pastHead(store: Store, T: number, t: Translate, lang: string): string {
  const { r, w } = counts(store, T);
  return t('h.past', { t: clock(T, lang), r, w });
}

const NO_DRAFTS_VIEW = { has: () => false };
const NO_DRAFTS = { getSnapshot: () => NO_DRAFTS_VIEW, subscribe: () => () => {} };

const EMPTY_PLACEMENT = { version: 1 as const, growth: 0, growthLog: [], claims: [], lots: {}, workspaces: {} };

export function UniversePanel({ env }: { env: Env }) {
  const feed = useFeed(env.feed);
  const titles = useObservable(env.titles);
  const drafts = useObservable(env.drafts ?? NO_DRAFTS);
  const live = useNow(env.now);
  // The moment shown: live, looked back to on the timeline, or replayed (model/timeline).
  const time = useTime(live, feed.phase === 'ready' ? feed.store : undefined);
  const T = time.T;
  const [layer, setLayer] = useState<LayerId>('all');
  const [focus, setFocus] = useState<string | undefined>();
  const [cursor, setCursor] = useState<Record<string, number>>({});
  const [, setSeenTick] = useState(0);
  const [prefs, setPrefsState] = useState<Prefs>(() => readPrefs());
  const setPrefs = (p: Prefs) => { setPrefsState(p); writePrefs(p); };
  const [target, setTarget] = useState<CityTarget | undefined>();
  // The first-run tour: once per device (prefs `toured`), in the city view.
  const rootRef = useRef<HTMLDivElement>(null);
  const [tourAt, setTourAt] = useState(0);
  const [nIdx, setNIdx] = useState(-1);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const { t } = env;
  const lang = env.lang();

  const view = useMemo(() => {
    if (feed.phase !== 'ready' || !feed.platform) return undefined;
    const store = feed.store;
    const today = todayAt(store, T, CITY, env.seen, drafts);
    return {
      head: time.mode === 'live' ? headline(store, T, t) : pastHead(store, T, t, lang),
      today,
      buttons: todayButtons(today, T, t, lang, feed.platform.caps),
      sections: sections(store, T, t, lang, titles, env.seen, drafts),
      places: places(store, T, t, lang, feed.platform.caps),
      schedules: feed.platform.caps.schedules ? store.schedules().slice().sort((a, b) => (a.nextAt ?? Infinity) - (b.nextAt ?? Infinity)) : null,
      plugins: store.inventory().plugins,
      empty: !store.agents().some((s) => s.agent.startedAt <= T),
    };
    // feed.version changes whenever the store does.
  }, [feed.version, feed.phase, T, titles, lang, drafts, time.mode]);
  useSquareSound(prefs.sound && prefs.view === 'city', view?.today.need ?? 0, time.mode === 'live');

  if (feed.phase !== 'ready' || !view) {
    const err = feed.phase === 'error';
    // Loading and errors: one calm card in the middle, the same chrome as the city.
    return (
      <div style={{ ...S.page, display: 'grid', placeItems: 'center' }}>
        <div role={err ? 'alert' : 'status'} style={{ ...px, maxWidth: 420, padding: '16px 18px' }}>
          <p style={{ ...S.head, margin: '0 0 6px' }}>{err ? t('h.error') : t('h.loading')}</p>
          <p style={{ ...S.note, margin: 0 }}>{err ? t('e.error') : t('e.backfill')}</p>
          {err && <button type="button" style={{ ...S.btn, marginTop: 12 }} onClick={() => env.feed.retry()}>{t('e.retry')}</button>}
        </div>
      </div>
    );
  }

  const press = (cat: keyof Today['items']) => {
    const items = view.today.items[cat];
    const i = nextIndex(cursor[cat] ?? -1, items.length);
    if (i < 0) return;
    setCursor({ ...cursor, [cat]: i });
    const id = cat === 'sched' ? 'sch:' + items[i] : items[i];
    setFocus(id);
    if (prefs.view === 'city') {
      // In the city: the button switches to its layer, and the camera goes to the thing (an agent in the square, a
      // building, a place).
      setLayer(LAYER_OF_TODAY[cat]);
      const s = feed.store.agent(items[i]);
      const where = cat === 'need' ? 'agent:' + items[i] : cat === 'sched' ? 'station' : s ? buildingOf(feed.store, s) : items[i];
      setTarget({ id: where, nonce: Date.now() });
    } else globalThis.document?.getElementById(rowId(id))?.scrollIntoView?.({ block: 'center' });
  };
  const markSeen = (row: Row) => {
    const s = feed.store.agent(row.id);
    if (s && env.seen.mark(seenKey(CITY, row.sessionId, idxAt(s, T)))) setSeenTick((x) => x + 1);
  };
  const rowFor = (sid: string) => view.sections.flatMap((x) => x.rows).find((r) => r.sessionId === sid);
  const open = env.openSession && feed.platform?.caps.actions.openSession
    ? (row: Row) => { if (row.review) markSeen(row); env.openSession!(row.sessionId); }
    : undefined;

  const city = prefs.view === 'city';
  // Calm notes over the city (the list shows them in its own place): first run, partial history, storage, services.
  const notes = [
    view.empty && feed.backfill !== 'pending' ? 'e.empty' : '',
    feed.backfill === 'pending' ? 'e.backfill' : feed.backfill === 'partial' ? 'e.partial' : '',
    feed.full ? 'e.full' : '',
    feed.memoryOnly ? 'e.memory' : '',
    feed.platform && !feed.platform.caps.schedules ? 'e.noSched' : '',
  ].filter((k) => k && !dismissed.has(k));
  const toggle = (
    <div role="group" aria-label={t('view.label')} data-dshu-ctl="" style={group}>
      {(['city', 'list'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={prefs.view === v}
          style={groupBtn(prefs.view === v)}
          onClick={() => setPrefs({ ...prefs, view: v })}>{t('view.' + v)}</button>
      ))}
    </div>
  );
  const activeCat = layer === 'all' ? undefined : (Object.keys(LAYER_OF_TODAY) as (keyof typeof LAYER_OF_TODAY)[]).find((c) => LAYER_OF_TODAY[c] === layer);
  if (city) {
    return (
      <div ref={rootRef} style={{ ...S.page, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', position: 'relative' }}
        // A sound left on from an earlier visit starts with the member's first click (browsers need a gesture).
        onPointerDownCapture={() => { if (prefs.sound) unlockSound(); }}
        onKeyDown={(e) => {
          if ((e.key !== 'n' && e.key !== 'N') || /INPUT|TEXTAREA|SELECT/.test((e.target as Element).tagName)) return;
          const r = rally(feed.store, T);
          if (!r.length) return;
          const i = nextIndex(nIdx, r.length, e.key === 'n' ? 1 : -1);
          setNIdx(i);
          setTarget({ id: 'agent:' + r[i].agent.id, nonce: Date.now() });
        }}>
        <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 8, alignItems: 'flex-end', padding: '10px 12px 4px' }}>
          <p style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} aria-live="polite">{view.empty ? t('h.empty') : view.head}</p>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}><TodayBar buttons={view.buttons} t={t} onPress={press} oneRow active={activeCat} /></div>
          <div style={{ marginLeft: 'auto', paddingBottom: 6 }}>{toggle}</div>
        </div>
        {notes.length > 0 && (
          <div role="status" aria-label={t('e.notes')} style={{ position: 'absolute', zIndex: 9, top: 58, left: 12, right: 12, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 10px', ...px, boxShadow: 'none', fontSize: 12.5, maxWidth: 640 }}>
            <div style={{ flex: 1 }}>{notes.map((k) => <div key={k}>{t(k)}</div>)}</div>
            <button type="button" style={{ ...S.btn, minHeight: 26, padding: '0 8px' }} onClick={() => setDismissed(new Set([...dismissed, ...notes]))}>{t('e.dismiss')}</button>
          </div>
        )}
        <CityPanel t={t} lang={lang} T={T} store={feed.store} placement={feed.placement ?? EMPTY_PLACEMENT} titles={titles} version={feed.version}
          prefs={prefs} setPrefs={setPrefs} target={target} layer={layer} setLayer={setLayer} seen={env.seen} drafts={drafts}
          live={live} mode={time.mode} onScrub={time.scrub} onReplay={time.replay} onFollow={(id) => setTarget({ id: 'agent:' + id, nonce: Date.now() })} onOpen={open ? (sid) => { const r = rowFor(sid); if (r) open(r); else env.openSession?.(sid); } : undefined} caps={feed.platform?.caps} />
        {!prefs.toured && <Tour t={t} root={rootRef} step={Math.min(tourAt, TOUR.length - 1)} onStep={(n) => {
          if (n === null) { setPrefs({ ...prefs, toured: true }); setTourAt(0); return; }
          setTourAt(n);
          // The square is in the city: the camera goes there.
          const id = TOUR[n].id;
          if (id === 'square') setTarget({ id: 'town', nonce: Date.now() });
          // A building: the running one nearest the square already on screen; the camera stays.
          if (id === 'building') setTarget({ id: TOUR_BUILDING, nonce: Date.now() });
        }} />}
      </div>
    );
  }
  return (
    // The list at most 960 px wide, centred (on a wide panel the action sat 600 px from its title).
    <div style={{ ...S.page, paddingInline: 'max(clamp(12px, 3vw, 32px), calc((100% - 960px) / 2))' }}>
      <style>{LIST_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{toggle}</div>
      <p style={S.head} aria-live="polite">{view.empty ? t('h.empty') : view.head}</p>
      {view.empty && <p style={S.note}>{t('e.empty')}</p>}
      {feed.backfill === 'partial' && <p style={S.note}>{t('e.partial')}</p>}
      {feed.full && <p style={S.note}>{t('e.full')}</p>}
      <TodayBar buttons={view.buttons} t={t} onPress={press} chrome />
      <ListView t={t} lang={lang} T={T} sections={view.sections} places={view.places} schedules={view.schedules}
        plugins={view.plugins} days={historyWindow(feed.history, feed.store, T)} focus={focus} onOpen={open} onSeen={markSeen} />
    </div>
  );
}
