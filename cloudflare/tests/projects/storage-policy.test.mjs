import assert from 'node:assert/strict';
import test from 'node:test';

import {
  publishVersion,
  request,
  responseJson,
  seedTestCover,
  setup,
  bundle,
  createWorldbookProject,
} from '../support/project-fixture.mjs';
import {
  reviewProject,
  submitProjectForReview,
  uploadProjectVersion,
} from '../../src/projects.js';
import { getPublicCatalog } from '../../src/projects/catalog.js';

test('published updates keep only the current server version and delete old R2 version objects', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));

  const before = env.DB.db.prepare(
    'SELECT manifest_key, content_key FROM project_versions WHERE project_id = ?',
  ).all(project.id);
  assert.equal(before.length, 1);

  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'v2', bundle: bundle('v2') }),
    env,
    author,
    project.id,
  );

  const rows = env.DB.db.prepare(
    'SELECT version, manifest_key, content_key FROM project_versions WHERE project_id = ? ORDER BY version',
  ).all(project.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].version, 2);
  assert.equal(env.PROJECTS.objects.has(before[0].manifest_key), false);
  assert.equal(env.PROJECTS.objects.has(before[0].content_key), false);
});

test('first-review rejection deletes server draft when the client confirmed a local backup', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('draft') }),
    env,
    author,
    project.id,
  );
  await seedTestCover(env, project.id);
  await submitProjectForReview(env, author, project.id, { localBackupConfirmed: true });

  const rejected = await responseJson(await reviewProject(
    request(`/api/admin/projects/${project.id}/review`, 'POST', { decision: 'rejected', note: '请修改' }),
    env,
    admin,
    project.id,
  ));

  assert.equal(rejected.deleted, true);
  assert.equal(env.DB.db.prepare('SELECT id FROM projects WHERE id = ?').get(project.id), undefined);
  assert.equal(env.PROJECTS.objects.size, 0);
});

test('legacy pending drafts are not deleted when no local backup was confirmed', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('legacy') }),
    env,
    author,
    project.id,
  );
  await seedTestCover(env, project.id);
  await submitProjectForReview(env, author, project.id);

  const rejected = await responseJson(await reviewProject(
    request(`/api/admin/projects/${project.id}/review`, 'POST', { decision: 'rejected', note: '旧版保护' }),
    env,
    admin,
    project.id,
  ));

  assert.equal(rejected.deleted, false);
  assert.equal(env.DB.db.prepare('SELECT status FROM projects WHERE id = ?').get(project.id).status, 'rejected');
});

test('public catalog snapshot contains all published metadata without per-search D1 queries', async () => {
  const { env, author, admin } = setup();
  const one = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, one.id, bundle('one'));

  const response = await getPublicCatalog(env);
  const body = await responseJson(response);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, one.id);
  assert.equal(body.items[0].name, '测试世界书');
  assert.ok(Number(body.generated_at) > 0);
});
