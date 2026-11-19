import { test } from 'node:test';
import assert from 'node:assert/strict';
test('every label colour in the renderer reads at WCAG AA (4.5:1) with the ink it is drawn in', async () => {
  const { contrast, inkOn } = await import('../src/contrast.ts');
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../src/', import.meta.url);
  const hex = /'(#[0-9A-Fa-f]{6})'/g;
  let n = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    for (const line of readFileSync(new URL(f, dir), 'utf8').split('\n')) {
      // Each label (a sign, plate or tag) and each colour list labels are drawn on.
      const sign = line.match(/bg: ([^,]*?), fg: '(#[0-9A-Fa-f]{6})'/), list = line.match(/^const (WS|SHOP|POWER)_COLOURS = (\[.*\])/);
      const pairs: [string, string][] = [];
      if (sign) for (const [, bg] of sign[1].matchAll(hex)) pairs.push([bg, sign[2]]);
      if (list) for (const [, bg] of list[2].matchAll(hex)) pairs.push([bg, list[1] === 'POWER' ? '#FFFFFF' : '#141A30']);
      for (const [bg, fg] of pairs) {
        n++;
        const ink = inkOn(bg, fg);
        assert.ok(contrast(bg, ink) >= 4.5, `${f}: ${ink} on ${bg} is ${contrast(bg, ink).toFixed(2)}:1`);
      }
    }
  }
  assert.ok(n > 20, 'found the label colours');
});
