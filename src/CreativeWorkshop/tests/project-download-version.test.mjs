import assert from 'node:assert/strict';
import test from 'node:test';

import { createProjectApi } from '../services/api/projects.js';
import { fetchVerifiedRemoteProject } from '../services/projects/cache.js';
import { sha256Hex } from '../services/projects/sha256.js';

function bundleWithContent(content) {
  return {
    schema_version: 1,
    artifacts: [{
      kind: 'worldbook',
      name: '选择世界_融合版.json',
      format: 'json',
      content,
    }],
  };
}

async function manifestFor(projectId, version, bundle) {
  const text = JSON.stringify(bundle.artifacts[0].content);
  const byteSize = new TextEncoder().encode(text).byteLength;
  return {
    schema_version: 1,
    project: { id: projectId, version, dependencies: [] },
    artifact_count: 1,
    total_bytes: byteSize,
    artifacts: [{
      kind: 'worldbook',
      name: '选择世界_融合版.json',
      format: 'json',
      byte_size: byteSize,
      sha256: await sha256Hex(text),
    }],
    resource_overrides: [],
  };
}

test('project API pins download URL to the requested release version', async () => {
  const paths = [];
  const api = createProjectApi(path => {
    paths.push(path);
    return Promise.resolve({});
  }, async () => { throw new Error('unused'); });

  await api.downloadProject('project:1', 7);
  assert.equal(paths[0], '/api/projects/project%3A1/download?version=7');

  await api.downloadProject('project:1', 7, { cacheBust: true });
  assert.match(paths[1], /^\/api\/projects\/project%3A1\/download\?version=7&_=\d+$/u);
});

test('verified remote download retries once when a cached old bundle fails integrity', async () => {
  const projectId = 'project:cache';
  const version = 2;
  const freshBundle = bundleWithContent({ entries: { 0: { content: 'new-version-content' } } });
  const staleBundle = bundleWithContent({ entries: { 0: { content: 'old' } } });
  const manifest = await manifestFor(projectId, version, freshBundle);
  const calls = [];

  const api = {
    async getProject(id) {
      assert.equal(id, projectId);
      return {
        project: { id: projectId, version, name: '缓存测试', category: 'extension' },
        manifest,
      };
    },
    async downloadProject(id, requestedVersion, options) {
      calls.push({ id, requestedVersion, options });
      return calls.length === 1 ? staleBundle : freshBundle;
    },
  };

  const result = await fetchVerifiedRemoteProject(api, projectId);
  assert.deepEqual(result.bundle, freshBundle);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].requestedVersion, version);
  assert.deepEqual(calls[1].options, { cacheBust: true });
});
