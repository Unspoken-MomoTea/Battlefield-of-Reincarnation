import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProject,
  deleteProject,
  downloadPublicProject,
  getOwnedProjectEditor,
  getPublicProject,
  getPublicProjectVersion,
  getPendingProjectReview,
  listAdminAuditLogs,
  listAdminProjects,
  listOwnProjects,
  listPublicProjects,
  reviewProject,
  setAdminProjectState,
  setOwnerProjectVisibility,
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


test('author can delete an unpublished project and its R2 objects', async () => {
  const { env, author } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'temp', bundle: bundle('temp') }),
    env,
    author,
    project.id,
  );

  const before = env.DB.db.prepare(
    'SELECT manifest_key, content_key FROM project_versions WHERE project_id = ? AND version = 1',
  ).get(project.id);
  assert.ok(env.PROJECTS.objects.has(before.manifest_key));
  assert.ok(env.PROJECTS.objects.has(before.content_key));

  const response = await deleteProject(env, author, project.id);
  assert.equal(response.status, 200);
  assert.equal(env.DB.db.prepare('SELECT id FROM projects WHERE id = ?').get(project.id), undefined);
  assert.equal(env.PROJECTS.objects.has(before.manifest_key), false);
  assert.equal(env.PROJECTS.objects.has(before.content_key), false);
});

test('published projects cannot be permanently deleted by the author', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('published'));

  await assert.rejects(
    () => deleteProject(env, author, project.id),
    error => error?.status === 409 && error?.code === 'published_project_delete_forbidden',
  );
});


test('author sees archive reason and can permanently delete an archived published project', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('published'));

  const stored = env.DB.db.prepare(
    'SELECT manifest_key, content_key FROM project_versions WHERE project_id = ? AND version = 1',
  ).get(project.id);
  assert.ok(env.PROJECTS.objects.has(stored.manifest_key));
  assert.ok(env.PROJECTS.objects.has(stored.content_key));

  await setAdminProjectState(
    request(`/api/admin/projects/${project.id}/state`, 'POST', { action: 'archive', note: '内容已过期' }),
    env,
    admin,
    project.id,
  );

  const own = await responseJson(await listOwnProjects(env, author));
  assert.equal(own.items[0].status, 'archived');
  assert.equal(own.items[0].archive_note, '内容已过期');
  assert.ok(own.items[0].archived_at > 0);

  const deleted = await responseJson(await deleteProject(env, author, project.id));
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deleted_objects, 2);
  assert.equal(env.DB.db.prepare('SELECT id FROM projects WHERE id = ?').get(project.id), undefined);
  assert.equal(env.PROJECTS.objects.has(stored.manifest_key), false);
  assert.equal(env.PROJECTS.objects.has(stored.content_key), false);
});


test('author can unpublish and republish an approved project without changing review status', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('published'));

  const hidden = await responseJson(
    await setOwnerProjectVisibility(
      request(`/api/projects/${project.id}/visibility`, 'POST', { hidden: true }),
      env,
      author,
      project.id,
    ),
  );
  assert.equal(hidden.owner_hidden, true);

  let publicList = await responseJson(await listPublicProjects(request('/api/projects'), env));
  assert.equal(publicList.items.length, 0);

  let own = await responseJson(await listOwnProjects(env, author));
  assert.equal(own.items[0].owner_hidden, true);
  assert.equal(own.items[0].status, 'published');

  const shown = await responseJson(
    await setOwnerProjectVisibility(
      request(`/api/projects/${project.id}/visibility`, 'POST', { hidden: false }),
      env,
      author,
      project.id,
    ),
  );
  assert.equal(shown.owner_hidden, false);

  publicList = await responseJson(await listPublicProjects(request('/api/projects'), env));
  assert.equal(publicList.items.length, 1);
});

test('admin takedown still prevents an author from republishing', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('published'));

  await setOwnerProjectVisibility(
    request(`/api/projects/${project.id}/visibility`, 'POST', { hidden: true }),
    env,
    author,
    project.id,
  );
  await setAdminProjectState(
    request(`/api/admin/projects/${project.id}/state`, 'POST', { action: 'archive', note: '违规内容' }),
    env,
    admin,
    project.id,
  );

  await assert.rejects(
    () => setOwnerProjectVisibility(
      request(`/api/projects/${project.id}/visibility`, 'POST', { hidden: false }),
      env,
      author,
      project.id,
    ),
    error => error?.status === 409 && error?.code === 'admin_archived',
  );
});

test('author editor returns current metadata and latest bundle as the update baseline', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('baseline'));

  const detail = await responseJson(await getOwnedProjectEditor(env, author, project.id));
  assert.equal(detail.project.name, '测试世界书');
  assert.equal(detail.project.latest_version, 1);
  assert.equal(detail.latest.version, 1);
  assert.equal(detail.latest.review_status, 'approved');
  assert.equal(detail.latest.bundle.artifacts[0].name, 'baseline');
  assert.equal(detail.latest.bundle.artifacts[0].content.entries['0'].content, 'hello');
});

test('author can permanently delete a self-unpublished published project', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('published'));

  await setOwnerProjectVisibility(
    request(`/api/projects/${project.id}/visibility`, 'POST', { hidden: true }),
    env,
    author,
    project.id,
  );

  const deleted = await responseJson(await deleteProject(env, author, project.id));
  assert.equal(deleted.ok, true);
  assert.equal(env.DB.db.prepare('SELECT id FROM projects WHERE id = ?').get(project.id), undefined);
});


test('approved project updates publish immediately without another admin review', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'), '首版通过');

  const uploaded = await responseJson(
    await uploadProjectVersion(
      request(`/api/projects/${project.id}/versions`, 'POST', {
        changelog: '直接发布 v2',
        bundle: bundle('v2'),
      }),
      env,
      author,
      project.id,
    ),
  );
  assert.equal(uploaded.auto_published, true);

  const row = env.DB.db.prepare(
    'SELECT status, latest_version, published_version FROM projects WHERE id = ?',
  ).get(project.id);
  assert.equal(row.status, 'published');
  assert.equal(Number(row.latest_version), 2);
  assert.equal(Number(row.published_version), 2);

  const version = env.DB.db.prepare(
    'SELECT review_status, submitted_at, reviewed_at FROM project_versions WHERE project_id = ? AND version = 2',
  ).get(project.id);
  assert.equal(version.review_status, 'approved');
  assert.equal(version.submitted_at, null);
  assert.equal(version.reviewed_at, null);

  const legacySubmit = await responseJson(await submitProjectForReview(env, author, project.id));
  assert.equal(legacySubmit.auto_published, true);
  assert.equal(legacySubmit.version, 2);

  const reviews = env.DB.db.prepare(
    'SELECT COUNT(*) AS count FROM review_records WHERE project_id = ?',
  ).get(project.id);
  assert.equal(Number(reviews.count), 1);
});
