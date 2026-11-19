import test from 'node:test';
import assert from 'node:assert/strict';
import { conformanceProblems, sanitize, MAX_STRING } from '../src/index.ts';

test('sanitize keeps model fields only, with the right types', () => {
  const e = sanitize({ type: 'activity', data: { t: 1, agentId: 'a', category: 'exec', tool: 'bash', arguments: '{"command":"cat secrets"}', result: 'x', ok: 'yes' } });
  assert.deepEqual(e, { type: 'activity', data: { t: 1, agentId: 'a', category: 'exec', tool: 'bash' } });
  assert.equal(sanitize({ type: 'message', data: { text: 'hi' } }), undefined);
  assert.equal((sanitize({ type: 'agent', data: { id: 'x'.repeat(1000) } })!.data as { id: string }).id.length, MAX_STRING);
});

test('conformance: fields outside the model and leaked content are reported', () => {
  assert.deepEqual(conformanceProblems([{ type: 'deliverable', data: { t: 1, agentId: 'a', count: 2 } }], ['report.pdf']), []);
  const bad = conformanceProblems([{ type: 'deliverable', data: { t: 1, agentId: 'a', count: 2, files: ['report.pdf'] } }], ['report.pdf']);
  assert.equal(bad.length, 2);
});
