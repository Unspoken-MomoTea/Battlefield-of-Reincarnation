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
    extensions: { display_index: 17 },
    constant: true,
  });

  assert.equal(entry.position_type, 'at_depth');
  assert.equal(entry.depth, 0);
  assert.equal(entry.order, -1);
  assert.equal(entry.display_index, 17);
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


test('worldbook display order falls back like SillyTavern when custom index is missing', () => {
  const withUid = previewOf({
    uid: 23,
    comment: 'UID fallback',
    content: '正文',
    position: 4,
    depth: 2,
    order: 80,
  });
  assert.equal(withUid.display_index, 23);

  const withoutUid = previewOf({
    comment: 'array fallback',
    content: '正文',
    position: 4,
    depth: 2,
    order: 80,
  });
  assert.equal(withoutUid.display_index, 0);
});


test('common SillyTavern export fields preserve depth order role and display order', () => {
  const entry = previewOf({
    uid: 41,
    comment: '酒馆原始格式',
    content: '正文',
    insertion_order: 4,
    extensions: {
      position: 4,
      depth: 4,
      role: 0,
      display_index: 9,
    },
  });

  assert.equal(entry.position_type, 'at_depth');
  assert.equal(entry.depth, 4);
  assert.equal(entry.order, 4);
  assert.equal(entry.role, 'system');
  assert.equal(entry.display_index, 9);
});
