// Checks the vendored bundle loads the way official DSH loads it: the Host module exports name/inject/apply and
// activates with no optional services; the Client file is a __ModuleLoader__ factory with the same name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('host: exports name, inject, apply and activates with nothing injected', async () => {
  const host = await import(new URL('../dist/index.js', import.meta.url).href);
  assert.equal(host.name, pkg.name);
  assert.ok(Array.isArray(host.inject));
  await host.apply({ effect: () => {}, get: () => { throw new Error('not injected'); } });
});

test('client: a module-loader factory exporting name, inject and apply', () => {
  let loaded;
  vm.runInNewContext(readFileSync(new URL('../dist/client.browser.js', import.meta.url), 'utf8'),
    { window: { __ModuleLoader__: { load: (m) => { loaded = m; } } } });
  assert.equal(loaded?.id, pkg.name);
  const stub = new Proxy(() => stub, { get: (_, k) => (k === Symbol.toPrimitive ? () => '' : stub) });
  const mod = loaded.factory(() => stub);
  assert.equal(mod.name, pkg.name);
  assert.equal(typeof mod.apply, 'function');
});

test('patch: one insert whose id and name are the package name', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.match(patch, new RegExp(`id: '${pkg.name}'\\n\\s+name: '${pkg.name}'`, 'u'));
});
