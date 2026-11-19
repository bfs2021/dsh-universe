// Builds everything that ships: the plugin (its own build script bundles the packages it uses).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const plugin = fileURLToPath(new URL('../plugin/scripts/build.mjs', import.meta.url));
if (!existsSync(plugin)) { console.log('build: no plugin build script yet'); process.exit(0); }
const r = spawnSync(process.execPath, [plugin], { stdio: 'inherit' });
process.exit(r.status ?? 1);
