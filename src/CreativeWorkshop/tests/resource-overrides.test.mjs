import assert from 'node:assert/strict';
import test from 'node:test';

import {
  artifactsWithoutLegacyConflicts,
  resourceOverridesFromBundle,
  resourceOverrideKey,
} from '../services/resource-overrides.js';

test('resource overrides preserve explicit enabled and disabled author choices', () => {
  const bundle = {
    schema_version: 1,
    artifacts: [{ kind: 'data', name: 'note.txt', format: 'text', content: 'x' }],
    resource_overrides: [
      {
        kind: 'worldbook',
        state: 'enabled',
        target: { worldbook: '原世界书', uid: '1', name: '条目' },
      },
      {
        kind: 'regex',
        state: 'disabled',
        target: { scope: 'character', id: 'regex-1', name: '旧正则' },
      },
      {
        kind: 'script',
        state: 'enabled',
        target: { scope: 'global', id: 'script-1', name: '旧脚本' },
      },
    ],
  };

  const rules = resourceOverridesFromBundle(bundle);
  assert.equal(rules.length, 3);
  assert.deepEqual(rules.map(item => [item.kind, item.state]), [
    ['worldbook', 'enabled'],
    ['regex', 'disabled'],
    ['script', 'enabled'],
  ]);
  assert.equal(new Set(rules.map(resourceOverrideKey)).size, 3);
});

test('opening an older project promotes original conflicts into unified disabled-state rules', () => {
  const bundle = {
    schema_version: 1,
    artifacts: [
      {
        kind: 'worldbook',
        name: 'book.json',
        format: 'json',
        original_conflicts: [{
          action: 'replace',
          target: { worldbook: '原世界书', uid: '7', name: '原规则' },
        }],
        content: { entries: { 0: { comment: '新规则', content: 'x' } } },
      },
      {
        kind: 'script',
        name: 'helper.js',
        format: 'text',
        scope: 'character',
        original_conflicts: [{
          action: 'disable',
          target: { scope: 'character', id: 'old-script', name: '旧脚本' },
        }],
        content: 'console.log(1)',
      },
    ],
  };

  assert.deepEqual(resourceOverridesFromBundle(bundle), [
    {
      kind: 'worldbook',
      state: 'disabled',
      target: { worldbook: '原世界书', uid: '7', name: '原规则' },
    },
    {
      kind: 'script',
      state: 'disabled',
      target: { scope: 'character', id: 'old-script', name: '旧脚本' },
    },
  ]);

  const artifacts = artifactsWithoutLegacyConflicts(bundle.artifacts);
  assert.equal('original_conflicts' in artifacts[0], false);
  assert.equal('original_conflicts' in artifacts[1], false);
  assert.ok('original_conflicts' in bundle.artifacts[0]);
});
