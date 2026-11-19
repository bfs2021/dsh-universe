import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain .mjs script without declarations
import { scanSource } from '../check-no-inline-text.mjs';
// @ts-expect-error plain .mjs script without declarations
import { compareTables } from '../check-locales.mjs';

type Problem = { line: number; text: string; why: string };
const scan = (name: string, src: string) => scanSource(name, src) as Problem[];

test('no-inline-text: CJK in strings, templates and JSX is reported; comments are not', () => {
  assert.equal(scan('a.ts', "const a = '你好';").length, 1);
  assert.equal(scan('a.ts', 'const a = `等你 ${n}`;').length, 1);
  assert.equal(scan('a.tsx', 'const a = <b>等你</b>;').length, 1);
  assert.equal(scan('a.ts', '// 这是注释\nconst a = 1;').length, 0);
  assert.equal(scan('a.ts', "const a = 'ok';").length, 0);
});

test('no-inline-text: English JSX text and literal text attributes are reported in .tsx', () => {
  assert.equal(scan('a.tsx', 'const a = <b>Waiting</b>;').length, 1);
  assert.equal(scan('a.tsx', 'const a = <b aria-label="Close" />;').length, 1);
  assert.equal(scan('a.tsx', "const a = <b title={'Close'} />;").length, 1);
  assert.equal(scan('a.tsx', 'const a = <b aria-label={t("close")}>{t("x")} · {n}</b>;').length, 0);
  assert.equal(scan('a.tsx', 'const a = <b className="row">{n}</b>;').length, 0);
});

test('check-locales: missing keys, placeholders, untranslated token rule and CJK in English are reported', () => {
  const ok = compareTables('t', { zh: { a: '{n} token' }, en: { a: '{n} tokens' } }) as string[];
  assert.deepEqual(ok, []);
  const bad = compareTables('t', { zh: { a: '{n} 令牌', b: 'x' }, en: { a: '{m} tokens', c: '中文' } }) as string[];
  assert.ok(bad.some((p) => p.includes('missing b')));
  assert.ok(bad.some((p) => p.includes('extra c')));
  assert.ok(bad.some((p) => p.includes('placeholders')));
  assert.ok(bad.some((p) => p.includes('translates "token"')));
  assert.ok(bad.some((p) => p.includes('contains CJK')));
});
