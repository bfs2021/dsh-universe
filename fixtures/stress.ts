// Stress days for dev mode and screenshots (`?stress=…`): the shapes real workspaces have that the sample day does
// not: one session, hundreds, many workspaces, a day full of errors, very long names. Seeded, so every run is the
// same. Titles and names here are sample data, not interface text.
import type { Fixture } from '@dsh-universe/adapter-kit';
import { cityTemplate, emptyPlacement, freezeTheme, place, rng, themeFromTitle, type Category, type UEvent } from '@dsh-universe/model';

export type StressKind = 'one' | 'many' | 'ws8' | 'errors' | 'long' | 'idle';

const CATS: Category[] = ['read', 'search', 'edit', 'exec', 'connector', 'web', 'delegate', 'skill'];
const TOOLS: Record<string, string[]> = {
  read: ['read'], search: ['grep', 'glob'], edit: ['edit', 'write'], exec: ['bash'], web: ['web_fetch'], delegate: ['subagent'], skill: ['skill'],
  connector: ['mcp__erp__execute_read', 'mcp__crm__search_customers'],
};
const LONG_TOOLS = ['mcp__enterprise_resource_planning__execute_read_only_reporting_query_with_pagination', 'mcp__crm__search_customers_by_region_segment_and_last_contact_date'];
const TITLES_ZH = ['对账', '报价单更新', '投标文件整理', '修复导出脚本', '周报草稿', '库存预警', '客户回访纪要', '合同条款比对', '发票三单匹配', '数据清洗'];
const TITLES_EN = ['Reconcile ledger', 'Update quotation', 'Tender pack', 'Fix export script', 'Weekly report draft', 'Stock alert rules', 'Customer call notes', 'Contract clause diff', 'Invoice matching', 'Data cleaning'];
const LONG_WS = '华东区域销售与渠道合作伙伴关系管理（2026 年第四季度专项）';
const LONG_WS_EN = 'Eastern Region Sales and Channel Partner Relationship Management, Q4 2026 Programme';

export function stressDay(midnight: number, kind: StressKind, lang: 'zh' | 'en' = 'zh'): Fixture {
  const r = rng(kind.length * 977 + (lang === 'en' ? 1 : 0));
  const HM = (h: number, m = 0) => midnight + (h * 60 + m) * 60_000;
  const now = HM(15, 44);
  const nSessions = kind === 'one' ? 1 : kind === 'many' ? 300 : kind === 'ws8' ? 40 : kind === 'errors' ? 24 : kind === 'idle' ? 18 : 16;
  const nWs = kind === 'ws8' ? 8 : kind === 'many' ? 6 : kind === 'one' ? 1 : 4;
  const ev: UEvent[] = [];
  const ws = Array.from({ length: nWs }, (_, i) => ({
    id: 'w' + i,
    title: kind === 'long' ? (lang === 'en' ? LONG_WS_EN : LONG_WS) + (i ? ' ' + (i + 1) : '') : (lang === 'en' ? ['Finance', 'Sales', 'Bids', 'Ops', 'Legal', 'Design', 'Data', 'Support'] : ['财务', '销售', '投标', '运营', '法务', '设计', '数据', '客服'])[i],
  }));
  for (const w of ws) ev.push({ type: 'workspace', data: { id: w.id, title: w.title, displayPath: w.id } });
  ev.push({ type: 'connector', data: { id: 'erp', title: kind === 'long' ? (lang === 'en' ? 'Enterprise Resource Planning (read only)' : '企业资源计划系统（只读报表）') : 'ERP', state: 'connected' } });
  ev.push({ type: 'connector', data: { id: 'crm', title: 'CRM', state: 'connected' } });
  const roots: { sessionId: string; workspaceId: string; startedAt: number; title: string }[] = [];
  let errorsLeft = kind === 'errors' ? 50 : 0;
  for (let i = 0; i < nSessions; i++) {
    const id = 'z' + i;
    const start = kind === 'one' ? HM(15, 2) : HM(8) + Math.floor((i / nSessions) * 7.5 * 3600_000) + Math.floor(r() * 600_000);
    const titles = lang === 'en' ? TITLES_EN : TITLES_ZH;
    const title = kind === 'long'
      ? (lang === 'en' ? 'A very long session title about reconciling every supplier invoice against purchase orders and goods received notes for the whole quarter ' : '把整个季度所有供应商发票与采购订单和入库单逐张核对并标出差异的超长会话标题 ') + i
      : titles[i % titles.length] + (i >= titles.length ? ' ' + (i + 1) : '');
    const w = ws[i % nWs];
    const last = kind === 'idle' ? 0.97 : 0.85;
    const end = kind === 'one' ? undefined : start + 6 * 60_000 + Math.floor(r() * 40 * 60_000);
    const running = kind === 'one' || (i > nSessions * last);
    ev.push({ type: 'agent', data: { id, sessionId: id, workspaceId: w.id, label: title, kind: 'main', state: 'running', startedAt: start, model: i % 3 ? 'deepseek-v4' : 'deepseek-v4-pro' } });
    ev.push({ type: 'turn', data: { t: start, agentId: id, phase: 'start' } });
    roots.push({ sessionId: id, workspaceId: w.id, startedAt: start, title });
    const until = running ? now : Math.min(end!, now);
    let t = start, n = 0;
    while (true) {
      t += 4000 + Math.floor(r() * r() * 50_000);
      if (t >= until) break;
      const c = CATS[Math.floor(r() * CATS.length)];
      const pool = kind === 'long' && c === 'connector' ? LONG_TOOLS : TOOLS[c];
      const tool = pool[Math.floor(r() * pool.length)];
      const err = errorsLeft > 0 && r() < 0.25 ? (errorsLeft--, true) : r() < 0.01;
      const cid = id + ':' + n++;
      ev.push({ type: 'activity', data: { id: cid, t, agentId: id, category: c, tool, ok: !err, durationMs: 300, ...(c === 'connector' ? { connectorId: tool.includes('crm') ? 'crm' : 'erp' } : {}) } });
      ev.push({ type: 'usage', data: { id: cid, t, agentId: id, model: i % 3 ? 'deepseek-v4' : 'deepseek-v4-pro', input: 800, output: 200 } });
    }
    if (!running) ev.push({ type: 'turn', data: { t: end!, agentId: id, phase: 'end', reason: kind === 'errors' && i % 3 === 0 ? 'error' : i % 9 === 4 ? 'cancelled' : 'completed' } });
    if (running && i % 7 === 3) ev.push({ type: 'approval', data: { id: 'ap' + i, agentId: id, kind: 'approval', askedAt: now - 300_000, tool: kind === 'long' ? LONG_TOOLS[0] : 'mcp__erp__execute_write' } });
  }
  let pl = place(cityTemplate(), emptyPlacement(), roots).state;
  for (const x of roots) pl = freezeTheme(pl, x.sessionId, themeFromTitle(x.title));
  const d = new Date(midnight), p2 = (v: number) => String(v).padStart(2, '0');
  return {
    platform: { id: 'dsh', title: 'DSH', adapterVersion: 'stress', caps: { approvals: true, schedules: true, subagents: true, jobs: true, deliverables: true, skills: true, memory: false, tokens: true, cost: false, latency: true, sessionTitles: true, actions: { openSession: false, draftFollowUp: false } } },
    day: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, now, events: ev, placement: pl,
  };
}
