import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPublicContentPreview } from '../src/projects/public-preview.js';

function previewOf(entry) {
  return buildPublicContentPreview({
    schema_version: 1,
    artifacts: [{
      kind: 'worldbook',
      name: '测试世界书.json',
      format: 'json',
      content: { entries: [entry] },
    }],
  }).worldbook_entries[0];
}

test('legacy worldbook at-depth position becomes D-layer metadata', () => {
  const entry = previewOf({
    uid: 0,
    comment: 'D0 测试',
    content: '正文',
    position: 4,
    depth: 0,
    order: -1,
    role: 2,
    constant: true,
  });

  assert.equal(entry.position_type, 'at_depth');
  assert.equal(entry.depth, 0);
  assert.equal(entry.order, -1);
  assert.equal(entry.role, 'assistant');
});

test('legacy numeric worldbook positions are normalized instead of exposed raw', () => {
  const entry = previewOf({
    comment: '位置测试',
    content: '正文',
    position: 0,
    order: 12,
  });

  assert.equal(entry.position_type, 'before_character_definition');
  assert.equal(entry.order, 12);
  assert.equal(entry.role, 'system');
});
