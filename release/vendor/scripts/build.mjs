// "Build" for the vendored DSH Universe package: copies the prebuilt, minified bundle into dist/ after checking it
// against bundle/SHA256SUMS. The source is source-available (see LICENSE) and lives in khglobal/dsh-universe (commit in SOURCE.json);
// this directory only holds its build. Do not edit bundle/ by hand: run `npm run release` in dsh-universe.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('..', import.meta.url));
const sums = readFileSync(join(dir, 'bundle/SHA256SUMS'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/u));
const out = join(dir, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const [sum, file] of sums) {
  const bytes = readFileSync(join(dir, 'bundle', file));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sum) throw Error(`bundle/${file}: sha256 ${actual} != SHA256SUMS ${sum}`);
  writeFileSync(join(out, file), bytes);
}
console.log(`[build] dist: ${sums.map(([, f]) => f).join(', ')}`);
