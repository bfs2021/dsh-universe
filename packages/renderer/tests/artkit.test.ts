import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRooms, seedOf } from '@dsh-universe/model';
import { artKitProblems, createStubKit } from '../src/index.ts';
import { fakeSurface } from './fake-canvas.ts';

test('the stub kit is a complete kit and draws flat boxes', () => {
  const kit = createStubKit(fakeSurface);
  assert.deepEqual(artKitProblems(kit), []);
  const a = kit.ground({ growth: 0, claimed: new Map(), used: new Set(), models: 1, connectors: 0, rail: true });
  assert.equal(kit.ground({ growth: 0, claimed: new Map(), used: new Set(), models: 1, connectors: 0, rail: true }), a, 'cached');
});

test('room choice works on the stub catalog (no art package needed)', () => {
  const rooms = chooseRooms(seedOf('s1'), { finance: 3 }, createStubKit(fakeSurface).rooms);
  assert.deepEqual(rooms, { library: 'stub-library', workshop: 'stub-workshop', machine: 'stub-machine', meeting: 'stub-meeting' });
});

test('a kit with gaps is reported', () => {
  assert.ok(artKitProblems({ ...createStubKit(fakeSurface), rooms: [] }).length > 0);
  assert.ok(artKitProblems({ ...createStubKit(fakeSurface), buildingTags: [] }).length > 0);
});
