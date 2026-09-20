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

test('admin pending queue contains submitted versions', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('pending') }), env, author, project.id);
  await submitProjectForReview(env, author, project.id);

  const pending = await responseJson(await listPendingProjects(env, admin));
  assert.equal(pending.items.length, 1);
  assert.equal(pending.items[0].id, project.id);
  assert.equal(Number(pending.items[0].latest_version), 1);
});

test('admin can inspect the exact pending manifest and bundle before approval', async () => {
  const { env, author, admin, other } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '待审版本', bundle: bundle('review-me') }),
    env,
    author,
    project.id,
  );
  await submitProjectForReview(env, author, project.id);

  const detail = await responseJson(await getPendingProjectReview(env, admin, project.id));
  assert.equal(detail.project.id, project.id);
  assert.equal(detail.project.changelog, '待审版本');
  assert.equal(detail.manifest.artifacts[0].name, 'review-me');
  assert.equal(detail.bundle.artifacts[0].content.entries['0'].comment, 'review-me');

  await assert.rejects(
    () => getPendingProjectReview(env, other, project.id),
    error => error?.status === 403 && error?.code === 'admin_required',
  );
});

test('admin management lists uploaded projects across approved and rejected states', async () => {
  const { env, author, admin } = setup();

  const approved = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, approved.id, bundle('approved'), '可以发布');

  const rejectedResponse = await createProject(
    request('/api/projects', 'POST', { name: '被拒绝作品', summary: '说明', category: 'extension' }),
    env,
    author,
  );
  const rejected = (await responseJson(rejectedResponse)).project;
  await uploadProjectVersion(
    request(`/api/projects/${rejected.id}/versions`, 'POST', { changelog: 'bad', bundle: bundle('rejected') }),
    env,
    author,
    rejected.id,
  );
  await submitProjectForReview(env, author, rejected.id);
  await reviewProject(
    request(`/api/admin/projects/${rejected.id}/review`, 'POST', { decision: 'rejected', note: '需要修改' }),
    env,
    admin,
    rejected.id,
  );

  const all = await responseJson(await listAdminProjects(request('/api/admin/projects'), env, admin));
  assert.equal(all.items.length, 2);
  assert.ok(all.items.some(item => item.id === approved.id && item.review_status === 'approved'));
  assert.ok(all.items.some(item => item.id === rejected.id && item.review_status === 'rejected' && item.review_note === '需要修改'));

  const rejectedOnly = await responseJson(
    await listAdminProjects(request('/api/admin/projects?review_status=rejected'), env, admin),
  );
  assert.equal(rejectedOnly.items.length, 1);
  assert.equal(rejectedOnly.items[0].id, rejected.id);
});

test('admin can inspect approved or rejected uploads and their review history', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'), '首版通过');

  const detail = await responseJson(await getPendingProjectReview(env, admin, project.id));
  assert.equal(detail.project.review_status, 'approved');
  assert.equal(detail.project.published_version, 1);
  assert.equal(detail.versions[0].review_status, 'approved');
  assert.equal(detail.reviews[0].decision, 'approved');
  assert.equal(detail.reviews[0].note, '首版通过');
  assert.equal(detail.reviews[0].reviewer_name, 'Admin');
  assert.equal(detail.bundle.artifacts[0].name, 'v1');
});

test('non-admin cannot use management listing', async () => {
  const { env, other } = setup();
  await assert.rejects(
    () => listAdminProjects(request('/api/admin/projects'), env, other),
    error => error?.status === 403 && error?.code === 'admin_required',
  );
});

test('admin can archive and restore an approved project without losing its published version', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'), '通过');

  const archived = await responseJson(
    await setAdminProjectState(
      request(`/api/admin/projects/${project.id}/state`, 'POST', { action: 'archive', note: '临时下架' }),
      env,
      admin,
      project.id,
    ),
  );
  assert.equal(archived.status, 'archived');

  const publicList = await responseJson(await listPublicProjects(request('/api/projects'), env));
  assert.equal(publicList.items.length, 0);

  const restored = await responseJson(
    await setAdminProjectState(
      request(`/api/admin/projects/${project.id}/state`, 'POST', { action: 'restore', note: '恢复展示' }),
      env,
      admin,
      project.id,
    ),
  );
  assert.equal(restored.status, 'published');

  const row = env.DB.db.prepare('SELECT status, published_version FROM projects WHERE id = ?').get(project.id);
  assert.equal(row.status, 'published');
  assert.equal(Number(row.published_version), 1);
});

test('admin audit log records review and archive lifecycle actions', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'), '首版通过');
  await setAdminProjectState(
    request(`/api/admin/projects/${project.id}/state`, 'POST', { action: 'archive', note: '维护' }),
    env,
    admin,
    project.id,
  );

  const logs = await responseJson(
    await listAdminAuditLogs(request(`/api/admin/logs?project_id=${project.id}`), env, admin),
  );
  assert.equal(logs.items[0].action, 'project_archived');
  assert.equal(logs.items[0].note, '维护');
  assert.ok(logs.items.some(item => item.action === 'review_approved'));
});

test('rejection requires an explicit reason', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('v1') }),
    env,
    author,
    project.id,
  );
  await submitProjectForReview(env, author, project.id);
  await assert.rejects(
    () =>
      reviewProject(
        request(`/api/admin/projects/${project.id}/review`, 'POST', { decision: 'rejected', note: '' }),
        env,
        admin,
        project.id,
      ),
    error => error?.status === 400 && error?.code === 'rejection_note_required',
  );
});
