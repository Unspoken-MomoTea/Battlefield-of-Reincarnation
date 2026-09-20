import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUploadBundle, combineUploadBundles } from '../services/upload.js';

test('project type is independent from the selected artifact kind', () => {
  const bundle = buildUploadBundle(
    { category: 'extension' },
    'book.json',
    JSON.stringify({ entries: { 0: { comment: 'A', content: 'B' } } }),
    'worldbook',
  );
  assert.equal(bundle.schema_version, 1);
  assert.equal(bundle.artifacts.length, 1);
  assert.equal(bundle.artifacts[0].kind, 'worldbook');
  assert.equal(bundle.artifacts[0].format, 'json');
});

test('any project type can upload a complete bundle manifest directly', () => {
  const source = {
    schema_version: 1,
    artifacts: [
      { kind: 'worldbook', name: 'book.json', format: 'json', content: { entries: {} } },
      { kind: 'regex', name: 'regex.json', format: 'json', content: [{ findRegex: 'x' }] },
    ],
  };
  const result = buildUploadBundle({ category: 'character' }, 'bundle.json', JSON.stringify(source), 'data');
  assert.deepEqual(result, source);
});

test('extension project can still wrap a single data artifact', () => {
  const result = buildUploadBundle({ category: 'extension' }, 'notes.txt', 'hello', 'data');
  assert.equal(result.artifacts[0].kind, 'data');
  assert.equal(result.artifacts[0].format, 'text');
});

test('invalid json is rejected before upload', () => {
  assert.throws(
    () => buildUploadBundle({ category: 'extension' }, 'bad.json', '{', 'preset'),
    /无法解析/u,
  );
});


test('script uploads preserve the selected Tavern Helper scope', () => {
  const result = buildUploadBundle(
    { category: 'extension' },
    'helper.js',
    "console.log('scope')",
    'script',
    { scriptScope: 'global' },
  );
  assert.equal(result.artifacts[0].kind, 'script');
  assert.equal(result.artifacts[0].scope, 'global');

  assert.throws(
    () => buildUploadBundle(
      { category: 'extension' },
      'helper.js',
      "console.log('bad')",
      'script',
      { scriptScope: 'unknown' },
    ),
    /脚本作用域/u,
  );
});


test('worldbook uploads can carry author-declared original conflicts', () => {
  const conflicts = [{
    action: 'disable',
    target: { worldbook: '角色原世界书', uid: '77', name: '原版规则' },
  }];
  const result = buildUploadBundle(
    { category: 'extension' },
    'book.json',
    JSON.stringify({ entries: { 0: { comment: 'DLC规则', content: 'new' } } }),
    'worldbook',
    { originalConflicts: conflicts },
  );
  assert.deepEqual(result.artifacts[0].original_conflicts, conflicts);
  assert.notEqual(result.artifacts[0].original_conflicts, conflicts);

  assert.throws(
    () => buildUploadBundle(
      { category: 'extension' },
      'helper.js',
      "console.log('x')",
      'script',
      { originalConflicts: conflicts },
    ),
    /只有世界书 artifact/u,
  );
});


test('staged artifact bundles combine into one version without mutating inputs', () => {
  const first = buildUploadBundle(
    { category: 'extension' },
    'book.json',
    JSON.stringify({ entries: { 0: { comment: 'A', content: 'B' } } }),
    'worldbook',
  );
  const second = buildUploadBundle(
    { category: 'extension' },
    'helper.js',
    "console.log('x')",
    'script',
    { scriptScope: 'character' },
  );
  const combined = combineUploadBundles([first, second]);

  assert.equal(combined.artifacts.length, 2);
  assert.deepEqual(combined.artifacts.map(item => item.kind), ['worldbook', 'script']);
  combined.artifacts[0].name = 'changed';
  assert.equal(first.artifacts[0].name, 'book.json');
});

test('staged artifact bundle enforces the 32 artifact version limit', () => {
  const bundle = {
    schema_version: 1,
    artifacts: Array.from({ length: 33 }, (_, index) => ({
      kind: 'data',
      name: `data-${index}.txt`,
      format: 'text',
      content: 'x',
    })),
  };
  assert.throws(() => combineUploadBundles([bundle]), /32/u);
});
