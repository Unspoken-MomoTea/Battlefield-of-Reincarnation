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
  listPendingProjects,
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

test('bundle validator rejects executable script artifacts', () => {
  assert.throws(
    () => validateBundle({ schema_version: 1, artifacts: [{ kind: 'script', name: 'evil', format: 'text', content: 'alert(1)' }] }, 'mixed'),
    error => error?.status === 400 && error?.code === 'invalid_artifact_kind',
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
