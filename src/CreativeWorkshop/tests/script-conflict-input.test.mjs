import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatOriginalScriptConflictText,
  parseOriginalScriptConflictText,
} from '../services/projects/script-conflict-input.js';

test('script conflict input supports id, name, scope, and optional folder', () => {
  const result = parseOriginalScriptConflictText([
    'character | old-id | 旧状态栏 |',
    'global | | 公共脚本 | 工具',
  ].join('\n'));

  assert.deepEqual(result, [
    {
      action: 'disable',
      target: { scope: 'character', id: 'old-id', name: '旧状态栏' },
    },
    {
      action: 'disable',
      target: { scope: 'global', name: '公共脚本', folder: '工具' },
    },
  ]);
  assert.match(formatOriginalScriptConflictText(result), /character \| old-id \| 旧状态栏/u);
});

test('script conflict input rejects unknown scopes and duplicate targets', () => {
  assert.throws(
    () => parseOriginalScriptConflictText('unknown | id | 脚本'),
    /作用域/u,
  );
  assert.throws(
    () => parseOriginalScriptConflictText('character | same | A\ncharacter | same | B'),
    /重复/u,
  );
});
