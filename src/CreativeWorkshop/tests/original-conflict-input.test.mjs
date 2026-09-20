import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatOriginalConflictText,
  parseOriginalConflictText,
} from '../services/projects/original-conflict-input.js';

test('original conflict input parses worldbook uid and name rows safely', () => {
  assert.deepEqual(
    parseOriginalConflictText([
      '角色原世界书 | 77 | 原版规则',
      '附加世界书 | | 另一个条目',
    ].join('\n')),
    [
      {
        action: 'disable',
        target: { worldbook: '角色原世界书', uid: '77', name: '原版规则' },
      },
      {
        action: 'disable',
        target: { worldbook: '附加世界书', name: '另一个条目' },
      },
    ],
  );
});

test('original conflict input rejects ambiguous author declarations', () => {
  assert.throws(
    () => parseOriginalConflictText('角色原世界书 | |'),
    /至少需要 UID 或条目名/u,
  );
  assert.throws(
    () => parseOriginalConflictText([
      '角色原世界书 | 77 | 原版规则',
      '角色原世界书 | 77 | 重复名称',
    ].join('\n')),
    /重复/u,
  );
});

test('original conflict formatter emits editable three-column rows', () => {
  assert.equal(
    formatOriginalConflictText([
      { action: 'disable', target: { worldbook: '角色原世界书', uid: '77', name: '原版规则' } },
    ]),
    '角色原世界书 | 77 | 原版规则',
  );
});
