import test from 'node:test';
import assert from 'node:assert/strict';
import { themeFromTitle, themeOf, type ThemeInput } from '../src/theme.ts';
import { emptyPlacement, freezeTheme, readPlacement, themeIdOf } from '../src/placement.ts';
import { chooseRoom, chooseRooms, type RoomInfo } from '../src/rooms.ts';
import { seedOf } from '../src/hash.ts';

const CATALOG: RoomInfo[] = [
  { id: 'ledger', tags: ['finance'], floors: ['library'] },
  { id: 'archive', tags: ['docs', 'legal'], floors: ['library'] },
  { id: 'lab', tags: ['research'], floors: ['library'] },
  { id: 'sheets', tags: ['finance', 'data'], floors: ['workshop'] },
  { id: 'codeshop', tags: ['code'], floors: ['workshop'] },
  { id: 'servers', tags: ['code', 'ops'], floors: ['machine'] },
  { id: 'counting', tags: ['finance'], floors: ['machine'] },
  { id: 'boardroom', tags: ['finance', 'legal'], floors: ['meeting'] },
  { id: 'standup', tags: ['code'], floors: ['meeting'] },
  { id: 'twofloor', tags: ['finance'], floors: ['library', 'workshop'] },
];

const META: ThemeInput = { themeId: 'finance', connectorTags: [['finance', 'ops']], mix: { read: 3, connector: 5, edit: 1 } };

test('theme from title: deterministic, zh and en, neutral when nothing matches', () => {
  assert.equal(themeFromTitle('3 月应收账款对账'), 'finance');
  assert.equal(themeFromTitle('March receivables reconciliation'), 'finance');
  assert.equal(themeFromTitle('修复导出脚本的编码问题'), 'code');
  assert.equal(themeFromTitle('市政管网项目响应矩阵 投标'), 'legal');
  assert.equal(themeFromTitle('Hello there'), 'neutral');
  assert.equal(themeFromTitle(''), 'neutral');
  assert.equal(themeFromTitle(undefined), 'neutral');
  assert.equal(themeFromTitle('Fix the export script'), themeFromTitle('Fix the export script'));
  assert.equal(themeFromTitle('Contested'), 'neutral', 'English words match at word starts only ("test" inside "contested")');
});

test('theme: the stored placement record holds the theme id, never the title', () => {
  const title = '供应商发票三单匹配 confidential-zebra';
  let st = emptyPlacement();
  st = freezeTheme(st, 's1', themeFromTitle(title));
  const raw = JSON.stringify(st);
  assert.ok(!raw.includes('供应商') && !raw.includes('zebra') && !raw.includes('发票'), raw);
  assert.equal(themeIdOf(readPlacement(JSON.parse(raw)), 's1'), 'finance');
});

test('theme: frozen at the first real title; a rename later changes nothing', () => {
  let st = emptyPlacement();
  st = freezeTheme(st, 's1', themeFromTitle('Quarterly invoice check'));
  const again = freezeTheme(st, 's1', themeFromTitle('Rename: hiring plan'));
  assert.equal(again, st);
  assert.equal(themeIdOf(again, 's1'), 'finance');
  assert.equal(themeIdOf(again, 'other'), 'neutral', 'no title yet → neutral');
});

test('theme: chat content on the input object changes nothing', () => {
  const withChat = {
    ...META,
    title: 'write the code for the security audit',
    messages: [{ role: 'user', content: 'please write the code for the security audit of our specs' }],
    prompt: 'write code, research, design, security',
    toolArguments: { command: 'rm -rf /', path: '/secret/legal/contract.pdf' },
    toolResults: ['marketing sales code docs'],
  };
  assert.deepEqual(themeOf(withChat as ThemeInput), themeOf(META));
});

test('theme: weights by source', () => {
  const th = themeOf(META);
  assert.equal(th.finance, 5, 'theme id 3 + connector 2');
  assert.equal(th.ops, 2);
  assert.equal(th.data, 1, 'connector calls over 30% → data 1');
  assert.deepEqual(themeOf({ themeId: 'neutral' }), {});
  assert.deepEqual(themeOf({ mix: { edit: 5, exec: 3, read: 1 } }), { code: 2 });
  assert.deepEqual(themeOf({ workspaceTags: ['not-a-tag'] }), {}, 'unknown tags are ignored');
  assert.deepEqual(themeOf({}), {});
});

test('rooms: best tag match per floor, no template twice, deterministic', () => {
  const th = themeOf(META);
  const seed = seedOf('s1');
  const a = chooseRooms(seed, th, CATALOG);
  assert.deepEqual(a, chooseRooms(seed, th, CATALOG));
  assert.ok(['ledger', 'twofloor'].includes(a.library!), 'a finance room on the library floor');
  assert.equal(new Set(Object.values(a)).size, Object.values(a).length);
  assert.equal(a.machine, 'counting');
  assert.equal(a.meeting, 'boardroom');
});

test('rooms: a floor keeps its room when the theme changes later', () => {
  const seed = seedOf('s2');
  const first = chooseRoom({}, 'library', seed, { finance: 5 }, CATALOG);
  const again = chooseRoom(first, 'library', seed, { research: 50 }, CATALOG);
  assert.equal(again, first);
  const more = chooseRoom(first, 'workshop', seed, { research: 50 }, CATALOG);
  assert.equal(more.library, first.library);
  assert.notEqual(more.workshop, more.library);
});

test('rooms: the seeded tie-break spreads equal themes over the templates', () => {
  const picks = new Set<string>();
  for (let i = 0; i < 40; i++) picks.add(chooseRooms(seedOf('x' + i), {}, CATALOG).library!);
  assert.ok(picks.size >= 3);
});

test('building template: best tag match for the theme, seeded among equals, deterministic', async () => {
  const { chooseTemplate } = await import('../src/rooms.ts');
  const tags = [['finance'], ['code'], ['finance', 'data'], ['legal'], []];
  assert.equal(chooseTemplate(seedOf('a'), { code: 3 }, tags), 1);
  assert.ok([0, 2].includes(chooseTemplate(seedOf('b'), { finance: 3 }, tags)));
  assert.equal(chooseTemplate(seedOf('c'), { finance: 3 }, tags), chooseTemplate(seedOf('c'), { finance: 3 }, tags));
  const spread = new Set(Array.from({ length: 40 }, (_, i) => chooseTemplate(seedOf('n' + i), {}, tags)));
  assert.ok(spread.size >= 4, 'a neutral theme spreads over the templates');
});

test('roomsOfSession: from the frozen theme id only, one per floor kind, none twice, stable', async () => {
  const { roomsOfSession } = await import('../src/rooms.ts');
  const { emptyPlacement, freezeTheme } = await import('../src/placement.ts');
  for (let i = 0; i < 30; i++) {
    const p = freezeTheme(emptyPlacement(), 's' + i, (['finance', 'code', 'docs', 'neutral'] as const)[i % 4] as never);
    const a = roomsOfSession(p, 's' + i, CATALOG);
    assert.deepEqual(a, roomsOfSession(p, 's' + i, CATALOG));
    const ids = Object.values(a);
    assert.equal(new Set(ids).size, ids.length);
  }
});
