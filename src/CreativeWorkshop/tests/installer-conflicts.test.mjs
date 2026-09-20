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


test('preflight blocks missing and ambiguous original worldbook conflict targets before install', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set('原世界书A', [
    { uid: 1, name: '重复条目', enabled: true, content: 'A' },
  ]);
  adapter.state.worldbooks.set('原世界书B', [
    { uid: 2, name: '重复条目', enabled: true, content: 'B' },
  ]);
  adapter.state.binding.primary = '原世界书A';
  adapter.state.binding.additional = ['原世界书B'];

  const ambiguous = project([
    {
      kind: 'worldbook',
      name: '扩展世界书.json',
      format: 'json',
      original_conflicts: [{
        action: 'disable',
        target: { name: '重复条目' },
      }],
      content: { entries: { 0: { comment: '扩展规则', content: 'x', constant: true } } },
    },
  ]);
  const ambiguousResult = await analyzeInstallConflicts(
    adapter,
    ambiguous,
    buildArtifactPlan(ambiguous),
  );
  assert.deepEqual(
    ambiguousResult.blocking.map(item => item.type),
    ['original_conflict_target_ambiguous'],
  );

  const missing = project([
    {
      kind: 'worldbook',
      name: '扩展世界书.json',
      format: 'json',
      original_conflicts: [{
        action: 'disable',
        target: { worldbook: '原世界书A', uid: '999' },
      }],
      content: { entries: { 0: { comment: '扩展规则', content: 'x', constant: true } } },
    },
  ]);
  const missingResult = await analyzeInstallConflicts(
    adapter,
    missing,
    buildArtifactPlan(missing),
  );
  assert.deepEqual(
    missingResult.blocking.map(item => item.type),
    ['original_conflict_target_missing'],
  );
});


test('preflight validates original Tavern Helper script replacement targets', async () => {
  const adapter = fakeAdapter();

  const valid = project([
    {
      kind: 'script',
      name: '替代脚本.js',
      format: 'text',
      scope: 'character',
      original_conflicts: [{
        action: 'replace',
        target: { scope: 'character', id: 'manual-script' },
      }],
      content: "console.log('replacement')",
    },
  ]);
  const validResult = await analyzeInstallConflicts(adapter, valid, buildArtifactPlan(valid));
  assert.equal(validResult.blocking.length, 0);

  const missing = project([
    {
      kind: 'script',
      name: '替代脚本.js',
      format: 'text',
      scope: 'character',
      original_conflicts: [{
        action: 'disable',
        target: { scope: 'character', id: 'missing-script' },
      }],
      content: "console.log('replacement')",
    },
  ]);
  const missingResult = await analyzeInstallConflicts(adapter, missing, buildArtifactPlan(missing));
  assert.deepEqual(missingResult.blocking.map(item => item.type), ['original_script_target_missing']);

  adapter.state.scripts.character.push({
    type: 'script',
    id: 'another-script',
    name: '玩家脚本',
    enabled: true,
    content: 'another',
  });
  const ambiguous = project([
    {
      kind: 'script',
      name: '替代脚本.js',
      format: 'text',
      scope: 'character',
      original_conflicts: [{
        action: 'disable',
        target: { scope: 'character', name: '玩家脚本' },
      }],
      content: "console.log('replacement')",
    },
  ]);
  const ambiguousResult = await analyzeInstallConflicts(adapter, ambiguous, buildArtifactPlan(ambiguous));
  assert.deepEqual(ambiguousResult.blocking.map(item => item.type), ['original_script_target_ambiguous']);
});
