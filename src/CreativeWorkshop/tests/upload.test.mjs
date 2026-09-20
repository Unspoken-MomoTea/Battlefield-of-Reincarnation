import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUploadBundle } from '../services/upload.js';

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
