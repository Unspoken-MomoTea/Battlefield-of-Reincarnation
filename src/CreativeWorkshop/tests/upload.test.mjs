import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUploadBundle } from '../services/upload.js';

test('single-category project wraps an uploaded file into one artifact', () => {
  const bundle = buildUploadBundle(
    { category: 'worldbook' },
    'book.json',
    JSON.stringify({ entries: { 0: { comment: 'A', content: 'B' } } }),
  );
  assert.equal(bundle.schema_version, 1);
  assert.equal(bundle.artifacts.length, 1);
  assert.equal(bundle.artifacts[0].kind, 'worldbook');
  assert.equal(bundle.artifacts[0].format, 'json');
});

test('mixed project can upload a complete bundle manifest directly', () => {
  const source = {
    schema_version: 1,
    artifacts: [
      { kind: 'worldbook', name: 'book.json', format: 'json', content: { entries: {} } },
      { kind: 'regex', name: 'regex.json', format: 'json', content: [{ findRegex: 'x' }] },
    ],
  };
  const result = buildUploadBundle({ category: 'mixed' }, 'bundle.json', JSON.stringify(source), 'data');
  assert.deepEqual(result, source);
});

test('mixed project still supports wrapping a single artifact', () => {
  const result = buildUploadBundle({ category: 'mixed' }, 'notes.txt', 'hello', 'data');
  assert.equal(result.artifacts[0].kind, 'data');
  assert.equal(result.artifacts[0].format, 'text');
});

test('invalid json is rejected before upload', () => {
  assert.throws(
    () => buildUploadBundle({ category: 'preset' }, 'bad.json', '{'),
    /无法解析/u,
  );
});
