import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProject,
  downloadPublicProject,
  getPublicProject,
  getPublicProjectVersion,
  getPendingProjectReview,
  listAdminAuditLogs,
  listAdminProjects,
  listOwnProjects,
  listPublicProjects,
  reviewProject,
  setAdminProjectState,
  submitProjectForReview,
  uploadProjectVersion,
  validateBundle,
} from '../../src/projects.js';

import {
  bundle,
  createWorldbookProject,
  publishVersion,
  request,
  responseJson,
  setup,
} from '../support/project-fixture.mjs';

test('bundle validator accepts Tavern Helper script artifacts and validates scope', () => {
  const textScript = validateBundle({
    schema_version: 1,
    artifacts: [{
      kind: 'script',
      name: '状态栏.js',
      format: 'text',
      scope: 'character',
      content: "console.log('ok')",
    }],
  }, 'mixed');
  assert.equal(textScript.artifacts[0].scope, 'character');

  const exportedScript = validateBundle({
    schema_version: 1,
    artifacts: [{
      kind: 'script',
      name: '脚本.json',
      format: 'json',
      scope: 'global',
      content: {
        type: 'script',
        id: 'source-id',
        name: '脚本',
        enabled: true,
        content: "console.log('ok')",
      },
    }],
  }, 'mixed');
  assert.equal(exportedScript.artifacts[0].scope, 'global');

  assert.throws(
    () => validateBundle({
      schema_version: 1,
      artifacts: [{ kind: 'script', name: 'bad.js', format: 'text', scope: 'unknown', content: 'x' }],
    }, 'mixed'),
    error => error?.status === 400 && error?.code === 'invalid_script_scope',
  );
  assert.throws(
    () => validateBundle({
      schema_version: 1,
      artifacts: [{ kind: 'script', name: 'bad.json', format: 'json', content: { type: 'script', name: 'bad' } }],
    }),
    error => error?.status === 400 && error?.code === 'invalid_script',
  );

  assert.throws(
    () => validateBundle({
      schema_version: 1,
      artifacts: [{
        kind: 'script',
        name: 'nested.json',
        format: 'json',
        content: {
          type: 'folder',
          name: 'outer',
          scripts: [{
            type: 'folder',
            name: 'inner',
            scripts: [],
          }],
        },
      }],
    }),
    error => error?.status === 400 && error?.code === 'invalid_script',
  );
});

test('bundle validator rejects malformed worldbook, regex, and preset artifacts', () => {
  assert.throws(
    () => validateBundle({ schema_version: 1, artifacts: [{ kind: 'worldbook', name: 'bad-worldbook', format: 'json', content: { entries: {} } }] }, 'worldbook'),
    error => error?.status === 400 && error?.code === 'invalid_worldbook',
  );
  assert.throws(
    () => validateBundle({ schema_version: 1, artifacts: [{ kind: 'regex', name: 'bad-regex', format: 'json', content: [{ scriptName: 'missing find' }] }] }, 'regex'),
    error => error?.status === 400 && error?.code === 'invalid_regex',
  );
  assert.throws(
    () => validateBundle({ schema_version: 1, artifacts: [{ kind: 'preset', name: 'bad-preset', format: 'text', content: 'not json' }] }, 'preset'),
    error => error?.status === 400 && error?.code === 'invalid_artifact_content',
  );
});

test('structured text artifacts are accepted when they contain valid JSON', () => {
  const result = validateBundle({
    schema_version: 1,
    artifacts: [{
      kind: 'regex',
      name: 'regex.txt',
      format: 'text',
      content: JSON.stringify([{ scriptName: 'ok', findRegex: 'foo', replaceString: 'bar' }]),
    }],
  }, 'regex');
  assert.equal(result.artifacts[0].format, 'text');
});
