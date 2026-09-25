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

test('world-character bundles install between the character start and end markers', () => {
  const installed = project([
    {
      kind: 'worldbook',
      name: '角色.json',
      format: 'json',
      content: {
        entries: [{
          name: '[角色] 测试人物',
          content: '人物设定',
          strategy: { type: 'selective', keys: ['测试人物'] },
          position: { type: 'at_depth', depth: 4, role: 'system', order: 100 },
        }],
      },
    },
    {
      kind: 'data',
      name: '角色.character.json',
      format: 'json',
      content: { schema_version: 1, kind: 'world_character', name: '测试人物' },
    },
  ]);
  const plan = buildArtifactPlan(installed);
  assert.equal(plan.worldbook.length, 1);
  assert.deepEqual(plan.worldbook[0].position, {
    type: 'after_character_definition',
    role: 'system',
    order: 600,
  });
  assert.equal(plan.worldbook[0].extra.reincarnationWorkshop.characterSlot, true);
});

test('opening-partner worldbook bundles are marked for the same dynamic character slots', () => {
  const installed = project([
    {
      kind: 'worldbook',
      name: '伙伴.worldbook.json',
      format: 'json',
      content: {
        entries: [{
          name: '[角色] 伙伴',
          content: '伙伴设定',
          strategy: { type: 'selective', keys: ['伙伴'] },
          position: { type: 'after_character_definition', role: 'system', order: 600 },
        }],
      },
    },
    {
      kind: 'data',
      name: '伙伴.opening.json',
      format: 'json',
      content: {
        schema_version: 1,
        kind: 'opening_partner',
        name: '伙伴',
        build: { 层级: 'Ⅰ', 血统: {}, 技能: {}, 装备: {} },
      },
    },
  ]);
  const plan = buildArtifactPlan(installed);
  assert.equal(plan.worldbook[0].extra.reincarnationWorkshop.characterSlot, true);
  assert.deepEqual(plan.worldbook[0].position, {
    type: 'after_character_definition',
    role: 'system',
    order: 600,
  });
});

test('non-depth worldbook positions do not keep a synthetic D4 depth', () => {
  const installed = project([
    {
      kind: 'worldbook',
      name: '伙伴角色.json',
      format: 'json',
      content: {
        entries: [{
          name: '[角色] 伙伴',
          content: '伙伴设定',
          strategy: { type: 'selective', keys: ['伙伴'] },
          position: { type: 'after_character_definition', depth: 4, role: 'system', order: 600 },
        }],
      },
    },
  ]);
  const plan = buildArtifactPlan(installed);
  assert.deepEqual(plan.worldbook[0].position, {
    type: 'after_character_definition',
    role: 'system',
    order: 600,
  });
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


test('preflight warns but does not block missing or ambiguous original worldbook targets', async () => {
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
  assert.equal(ambiguousResult.blocking.length, 0);
  assert.deepEqual(
    ambiguousResult.warnings.map(item => item.type),
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
  assert.equal(missingResult.blocking.length, 0);
  assert.deepEqual(
    missingResult.warnings.map(item => item.type),
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
