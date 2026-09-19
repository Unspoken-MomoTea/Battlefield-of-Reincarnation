import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDependencyText, parseDependencyText } from '../services/projects/dependency-input.js';

test('dependency text parser normalizes duplicates to highest required version', () => {
  assert.deepEqual(parseDependencyText('abc@1, abc@3, def'), [
    { project_id: 'abc', min_version: 3 },
    { project_id: 'def', min_version: 1 },
  ]);
});

test('dependency text formatter emits project@version syntax', () => {
  assert.equal(
    formatDependencyText([{ project_id: 'abc', min_version: 2 }]),
    'abc@2',
  );
});

test('dependency text parser rejects invalid versions', () => {
  assert.throws(() => parseDependencyText('abc@0'), /最低版本无效/u);
});
