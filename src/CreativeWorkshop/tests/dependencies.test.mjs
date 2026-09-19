import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeProjectDependencies } from '../services/installer/dependencies.js';

test('dependency preflight blocks missing, unapplied and too-old projects', async () => {
  const installed = {
    id: 'main',
    dependencies: [
      { project_id: 'missing', min_version: 1 },
      { project_id: 'cached', min_version: 1 },
      { project_id: 'old', min_version: 3 },
      { project_id: 'ok', min_version: 2 },
    ],
  };
  const local = [
    { id: 'cached', version: 5, applied: false, appliedVersion: null, name: '缓存包' },
    { id: 'old', version: 4, applied: true, appliedVersion: 2, name: '旧依赖' },
    { id: 'ok', version: 2, applied: true, appliedVersion: 2, name: '正常依赖' },
  ];

  const result = await analyzeProjectDependencies(installed, async () => local);
  assert.deepEqual(
    result.blocking.map(item => item.type),
    ['dependency_missing', 'dependency_not_applied', 'dependency_version_too_low'],
  );
});

test('dependency preflight accepts satisfied applied dependencies', async () => {
  const installed = {
    id: 'main',
    dependencies: [{ project_id: 'base', min_version: 2 }],
  };
  const result = await analyzeProjectDependencies(
    installed,
    async () => [{ id: 'base', version: 3, applied: true, appliedVersion: 3, name: '基础包' }],
  );
  assert.deepEqual(result, { blocking: [], warnings: [] });
});
