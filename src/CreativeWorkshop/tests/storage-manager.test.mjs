import assert from 'node:assert/strict';
import test from 'node:test';

import { createStorageManager, summarizeProjectStorage } from '../services/storage/manager.js';

test('storage summary counts logical bytes and separates applied from cache-only projects', () => {
  const projects = [
    { id: 'a', name: 'A', applied: true, bundle: { artifacts: [{ content: 'hello' }] } },
    { id: 'b', name: 'B', applied: false, bundle: { artifacts: [{ content: 'world' }] } },
  ];
  const summary = summarizeProjectStorage(projects);
  assert.equal(summary.projectCount, 2);
  assert.equal(summary.appliedCount, 1);
  assert.equal(summary.cacheOnlyCount, 1);
  assert.ok(summary.logicalBytes > 0);
  assert.ok(summary.cacheOnlyBytes > 0);
  assert.ok(summary.logicalBytes > summary.cacheOnlyBytes);
});

test('cleanup only removes cache-only projects and leaves applied installs intact', async () => {
  const projects = [
    { id: 'a', applied: true, bundle: { value: 'keep' } },
    { id: 'b', applied: false, bundle: { value: 'delete' } },
    { id: 'c', applied: false, bundle: { value: 'delete too' } },
  ];
  const deleted = [];
  const metaDeleted = [];
  const manager = createStorageManager({
    listProjects: async () => projects,
    deleteProject: async id => deleted.push(id),
    deleteMeta: async key => metaDeleted.push(key),
    storageEstimate: async () => ({ usage: 1234, quota: 9999 }),
  });

  const result = await manager.cleanupCacheOnly();
  assert.deepEqual(deleted.sort(), ['b', 'c']);
  assert.deepEqual(metaDeleted, ['project-update-check']);
  assert.equal(result.removedCount, 2);
  assert.equal(result.remainingAppliedCount, 1);
});

test('storage manager includes browser origin quota when available', async () => {
  const manager = createStorageManager({
    listProjects: async () => [{ id: 'a', applied: false, bundle: { value: 'x' } }],
    deleteProject: async () => {},
    deleteMeta: async () => {},
    storageEstimate: async () => ({ usage: 2048, quota: 8192 }),
  });

  const result = await manager.estimate();
  assert.equal(result.originUsage, 2048);
  assert.equal(result.originQuota, 8192);
  assert.equal(result.originUsageRatio, 0.25);
});
