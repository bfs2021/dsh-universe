// Performance bench page (scripts/city-check.mjs --perf): 100 buildings, 30 sessions running, 10 events a second,
// the real art kit. Reports frame times and sprite memory through window.__bench.
import { cityTemplate, createStore, emptyPlacement, place, type UEvent } from '@dsh-universe/model';
import { CityView } from '@dsh-universe/renderer';
import { createArtKit } from '@dsh-universe/art';

const q = new URLSearchParams(location.search);
const DAY = new Date(2026, 10, 18).getTime();
const at = (min: number) => DAY + min * 60_000;
const store = createStore();
const ev: UEvent[] = [];
const N = Number(q.get('buildings') ?? 100), RUN = Number(q.get('running') ?? 30);
const ws = ['fin', 'sal', 'bid', 'def', 'ops', 'hr'];
for (const w of ws) ev.push({ type: 'workspace', data: { id: w, title: w, displayPath: w } });
ev.push({ type: 'connector', data: { id: 'erp', title: 'ERP', state: 'connected' } });
const cats = ['read', 'search', 'edit', 'exec', 'delegate', 'connector'] as const;
for (let i = 0; i < N; i++) {
  const id = 's' + i, start = at(480 + i * 4);
  ev.push({ type: 'agent', data: { id, sessionId: id, workspaceId: ws[i % ws.length], label: '', kind: 'main', state: 'running', startedAt: start, model: i % 2 ? 'm1' : 'm2' } });
  ev.push({ type: 'turn', data: { t: start, agentId: id, phase: 'start' } });
  for (let k = 0; k < 20 + (i % 9) * 15; k++) {
    const c = cats[(i + k) % cats.length];
    ev.push({ type: 'activity', data: { id: id + ':' + k, t: start + k * 2000, agentId: id, category: c, tool: c, ...(c === 'connector' ? { connectorId: 'erp' } : {}) } });
  }
  ev.push({ type: 'usage', data: { t: start + 1000, agentId: id, model: i % 2 ? 'm1' : 'm2', input: 20000 + i * 3000, output: 2000 } });
  if (i >= RUN) ev.push({ type: 'turn', data: { t: start + 600_000, agentId: id, phase: 'end', reason: i % 7 ? 'completed' : 'error' } });
  else if (i % 10 === 3) ev.push({ type: 'approval', data: { id: 'w' + i, agentId: id, kind: 'approval', askedAt: at(960) } });
}
store.applyAll(ev);
const placement = place(cityTemplate(), emptyPlacement(), ev.flatMap((e) => (e.type === 'agent' ? [{ sessionId: e.data.sessionId, workspaceId: e.data.workspaceId, startedAt: e.data.startedAt }] : []))).state;
const kit = createArtKit();
const cv = document.getElementById('cv') as HTMLCanvasElement;
const acc = { n: 0, scene: 0, art: 0, blit: 0, text: 0 };
const view = new CityView({ kit, canvas: cv, reducedMotion: () => false, onFrame: (v) => { acc.n++; acc.scene += v.parts.scene; acc.art += v.parts.art; acc.blit += v.parts.blit; acc.text += v.parts.text; } });
view.resize(innerWidth, innerHeight, devicePixelRatio);
view.setDark(q.get('theme') === 'dark');
let T = at(970), n = 0;
const names = { town: 'Town', station: 'Station', fire: 'Fire', school: 'School', library: 'Library' };
view.setInput({ store, placement, T, templateTags: kit.buildingTags, names });
if (q.get('whole') === '1') view.whole();
view.start();
// 10 events a second on the running sessions.
setInterval(() => {
  T += 100;
  const id = 's' + (n % RUN);
  store.apply({ type: 'activity', data: { id: 'live' + n, t: T, agentId: id, category: cats[n % 4], tool: 'read' } });
  n++;
  view.setInput({ store, placement, T, templateTags: kit.buildingTags, names });
}, 100);
(window as unknown as { __bench: unknown }).__bench = {
  view, kit, reset: () => { view.resetStats(); acc.n = 0; acc.scene = acc.art = acc.blit = acc.text = 0; },
  report: () => ({ ...view.stats(), parts: { scene: acc.scene / acc.n, art: acc.art / acc.n, blit: acc.blit / acc.n, text: acc.text / acc.n }, memory: kit.memory(), buildings: view.scene?.places.filter((p) => p.tier === 'building').length, running: RUN, events: n, cars: view.scene?.cars }),
};
