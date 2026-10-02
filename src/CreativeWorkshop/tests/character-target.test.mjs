import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canMigrateCharacterTarget,
  characterTargetRelation,
  hasCharacterLocalTargets,
} from '../services/installer/character-target.js';

test('character target relation recognizes explicit card version upgrades only', () => {
  assert.equal(
    characterTargetRelation('轮回战场 重构版 V3.6.11', '轮回战场 重构版 V3.7'),
    'version_migration',
  );
  assert.equal(
    characterTargetRelation('轮回战场 重构版 V3.7', '轮回战场 重构版 V3.7'),
    'exact',
  );
  assert.equal(
    characterTargetRelation('角色A V1.0', '角色B V2.0'),
    'mismatch',
  );
  assert.equal(
    characterTargetRelation('角色A 1.0', '角色A 2.0'),
    'mismatch',
  );
});

test('same-card version upgrades stay migratable even with old character-local targets', () => {
  const portable = {
    applied: true,
    targetCharacterName: '轮回战场 重构版 V3.6.11',
    installTargets: {
      worldbook: '轮回战场·创意工坊',
      regexIds: [],
      scripts: { character: [], preset: [], global: [] },
      originalWorldbookChanges: [{ worldbookName: '轮回战场 3.6.11' }],
    },
  };
  assert.equal(
    canMigrateCharacterTarget(portable, '轮回战场 重构版 V3.7'),
    true,
  );

  const withRegex = structuredClone(portable);
  withRegex.installTargets.regexIds = ['rw:project:0:0'];
  assert.equal(hasCharacterLocalTargets(withRegex.installTargets), true);
  assert.equal(
    canMigrateCharacterTarget(withRegex, '轮回战场 重构版 V3.7'),
    true,
  );

  const withCharacterScript = structuredClone(portable);
  withCharacterScript.installTargets.scripts.character = ['rw:script'];
  assert.equal(
    canMigrateCharacterTarget(withCharacterScript, '轮回战场 重构版 V3.7'),
    true,
  );
});


test('different character families remain blocked even when versions differ', () => {
  const installed = {
    applied: true,
    targetCharacterName: '轮回战场 重构版 V3.7',
    installTargets: {
      regexIds: ['rw:project:0:0'],
      scripts: { character: ['rw:script'], preset: [], global: [] },
    },
  };
  assert.equal(
    canMigrateCharacterTarget(installed, '其他角色 V3.8'),
    false,
  );
});
