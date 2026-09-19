import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDownloadedBundle } from '../services/project-service.js';

test('bundle validator accepts data-only worldbook artifacts', () => {
  const bundle = {
    schema_version: 1,
    artifacts: [
      {
        kind: 'worldbook',
        name: '测试世界书',
        format: 'json',
        content: { entries: { 0: { comment: '测试', content: 'hello' } } },
      },
    ],
  };

  assert.equal(validateDownloadedBundle(bundle), bundle);
});

test('bundle validator rejects executable script artifacts', () => {
  assert.throws(
    () =>
      validateDownloadedBundle({
        schema_version: 1,
        artifacts: [{ kind: 'script', name: '危险脚本', format: 'text', content: 'alert(1)' }],
      }),
    /类型不受支持/u,
  );
});

test('bundle validator rejects malformed bundles', () => {
  assert.throws(() => validateDownloadedBundle({ schema_version: 2, artifacts: [] }), /结构无效/u);
  assert.throws(() => validateDownloadedBundle({ schema_version: 1, artifacts: [] }), /数量无效/u);
});
