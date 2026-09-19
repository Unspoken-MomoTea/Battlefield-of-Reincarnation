import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeInstallConflicts } from '../services/installer/conflicts.js';
import { buildArtifactPlan } from '../services/installer/plan.js';
import { SHARED_WORLDBOOK_NAME } from '../services/installer/constants.js';
import { fakeAdapter, project } from './support/installer-fixture.mjs';

test('preflight reports preset collisions without treating namespaced own resources as fatal', async () => {
  const adapter = fakeAdapter();
  const installed = project([
    { kind: 'preset', name: '预设.json', format: 'json', content: { temperature: 1 } },
  ]);
  const plan = buildArtifactPlan(installed);
  adapter.state.presets.set(plan.presets[0].name, { user: true });

  const result = await analyzeInstallConflicts(adapter, installed, plan);
  assert.equal(result.blocking.length, 0);
  assert.deepEqual(result.warnings.map(item => item.type), ['preset_name_collision']);
});

test('preflight reports semantic worldbook name collisions from unrelated entries', async () => {
  const adapter = fakeAdapter();
  const installed = project([
    {
      kind: 'worldbook',
      name: '世界书.json',
      format: 'json',
      content: { entries: { 0: { comment: '同名条目', content: 'new', constant: true } } },
    },
  ]);
  adapter.state.worldbooks.set(SHARED_WORLDBOOK_NAME, [
    { name: '同名条目', content: 'manual' },
    { name: '其他条目', content: 'keep' },
  ]);

  const result = await analyzeInstallConflicts(adapter, installed, buildArtifactPlan(installed));
  assert.equal(result.warnings[0].type, 'worldbook_name_collision');
  assert.equal(result.warnings[0].name, '同名条目');
});

test('preflight blocks applying an already installed project from another character', async () => {
  const adapter = fakeAdapter();
  adapter.state.character = '角色B';
  const installed = project([], {
    applied: true,
    targetCharacterName: '角色A',
    installTargets: { worldbook: SHARED_WORLDBOOK_NAME, regexIds: [], presets: [] },
  });
  const result = await analyzeInstallConflicts(adapter, installed, { worldbook: [], regexes: [], presets: [], data: [] });
  assert.deepEqual(result.blocking.map(item => item.type), ['character_mismatch']);
});
