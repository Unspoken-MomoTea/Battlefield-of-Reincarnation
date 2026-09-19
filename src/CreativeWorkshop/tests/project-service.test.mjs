import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOfflinePackage,
  parseOfflinePackageText,
  validateDownloadedBundle,
  verifyBundleAgainstManifest,
} from '../services/project-service.js';

function sample() {
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
  return bundle;
}

async function manifestFor(bundle) {
  const text = JSON.stringify(bundle.artifacts[0].content);
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return {
    schema_version: 1,
    project: { id: 'p1', version: 2 },
    artifact_count: 1,
    total_bytes: bytes.byteLength,
    artifacts: [
      {
        kind: 'worldbook',
        name: '测试世界书',
        format: 'json',
        byte_size: bytes.byteLength,
        sha256,
      },
    ],
  };
}

test('bundle validator accepts data-only worldbook artifacts', () => {
  const bundle = sample();
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

test('downloaded bundle must match manifest byte size and sha256', async () => {
  const bundle = sample();
  const manifest = await manifestFor(bundle);
  await verifyBundleAgainstManifest(bundle, manifest, { id: 'p1', version: 2 });

  const tampered = structuredClone(bundle);
  tampered.artifacts[0].content.entries[0].content = 'changed';
  await assert.rejects(
    () => verifyBundleAgainstManifest(tampered, manifest, { id: 'p1', version: 2 }),
    /(大小|SHA-256)校验失败/u,
  );
});

test('offline package round trip preserves verified bundle and project identity', async () => {
  const bundle = sample();
  const manifest = await manifestFor(bundle);
  const exported = await createOfflinePackage({
    id: 'p1',
    name: '离线测试',
    category: 'worldbook',
    version: 2,
    manifest,
    bundle,
  });
  assert.match(exported.filename, /\.rwpack$/u);
  const parsed = await parseOfflinePackageText(await exported.blob.text());
  assert.equal(parsed.project.id, 'p1');
  assert.equal(parsed.project.version, 2);
  assert.deepEqual(parsed.bundle, bundle);
});

test('offline package rejects modified artifact content', async () => {
  const bundle = sample();
  const manifest = await manifestFor(bundle);
  const payload = {
    format: 'reincarnation-workshop-project',
    version: 1,
    exported_at: Date.now(),
    project: { id: 'p1', name: '离线测试', category: 'worldbook', version: 2 },
    manifest,
    bundle: structuredClone(bundle),
  };
  payload.bundle.artifacts[0].content.entries[0].content = 'tampered';
  await assert.rejects(() => parseOfflinePackageText(JSON.stringify(payload)), /(大小|SHA-256)校验失败/u);
});
