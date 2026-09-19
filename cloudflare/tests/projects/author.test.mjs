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

test('only owner or admin can upload project versions', async () => {
  const { env, author, other } = setup();
  const project = await createWorldbookProject(env, author);
  await assert.rejects(
    () => uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('x') }), env, other, project.id),
    error => error?.status === 403 && error?.code === 'forbidden',
  );
});

test('author sees the latest rejection note on their project', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'v1', bundle: bundle('rejected') }),
    env,
    author,
    project.id,
  );
  await submitProjectForReview(env, author, project.id);
  await reviewProject(
    request(`/api/admin/projects/${project.id}/review`, 'POST', { decision: 'rejected', note: '请补充说明' }),
    env,
    admin,
    project.id,
  );

  const own = await responseJson(await listOwnProjects(env, author));
  assert.equal(own.items[0].status, 'rejected');
  assert.equal(own.items[0].review_note, '请补充说明');
});

test('concurrent version uploads never delete the winning R2 objects', async () => {
  const { env, author } = setup();
  const project = await createWorldbookProject(env, author);

  const first = uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'A', bundle: bundle('A') }),
    env,
    author,
    project.id,
  );
  const second = uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'B', bundle: bundle('B') }),
    env,
    author,
    project.id,
  );

  const results = await Promise.allSettled([first, second]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);

  const row = env.DB.db.prepare(
    'SELECT manifest_key, content_key FROM project_versions WHERE project_id = ? AND version = 1',
  ).get(project.id);
  assert.ok(row);
  assert.ok(env.PROJECTS.objects.has(row.manifest_key));
  assert.ok(env.PROJECTS.objects.has(row.content_key));
});
