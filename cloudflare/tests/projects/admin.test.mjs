import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProject,
  deleteAdminProject,
  downloadPublicProject,
  getPublicProject,
  getPublicProjectVersion,
  getPendingProjectReview,
  listAdminAuditLogs,
  listAdminProjectUpdates,
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

test('reviewer can inspect and review submitted projects', async () => {
  const { env, author, other } = setup();
  env.DB.db.prepare('UPDATE users SET is_moderator = 1 WHERE id = ?').run(other.id);
  const reviewer = env.DB.db.prepare('SELECT * FROM users WHERE id = ?').get(other.id);
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('reviewer') }), env, author, project.id);
  await submitProjectForReview(env, author, project.id);

  const pending = await responseJson(await listAdminProjects(request('/api/admin/projects?review_status=pending'), env, reviewer));
  assert.equal(pending.items.length, 1);
  const detail = await responseJson(await getPendingProjectReview(env, reviewer, project.id));
  assert.equal(detail.project.id, project.id);
  const reviewed = await responseJson(await reviewProject(
    request(`/api/admin/projects/${project.id}/review`, 'POST', { decision: 'approved', note: '' }),
    env,
    reviewer,
    project.id,
  ));
  assert.equal(reviewed.decision, 'approved');
});

test('admin pending queue contains submitted versions', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('pending') }), env, author, project.id);
  await submitProjectForReview(env, author, project.id);

  const pending = await responseJson(
    await listAdminProjects(request('/api/admin/projects?review_status=pending'), env, admin),
  );
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
  assert.equal(detail.content_preview.worldbook_entries.length, 1);
  assert.equal(detail.content_preview.worldbook_entries[0].name, 'review-me');
  assert.equal(detail.content_preview.worldbook_entries[0].content, 'hello');
  assert.equal(detail.change_preview, null);

  await assert.rejects(
    () => getPendingProjectReview(env, other, project.id),
    error => error?.status === 403 && error?.code === 'moderator_required',
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
    error => error?.status === 403 && error?.code === 'moderator_required',
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


test('admin can permanently delete a project and all R2 version objects', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'), '通过');

  const stored = env.DB.db.prepare(
    'SELECT manifest_key, content_key FROM project_versions WHERE project_id = ? AND version = 1',
  ).get(project.id);
  assert.ok(env.PROJECTS.objects.has(stored.manifest_key));
  assert.ok(env.PROJECTS.objects.has(stored.content_key));

  const deleted = await responseJson(await deleteAdminProject(env, admin, project.id));
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deleted_project_id, project.id);
  assert.equal(deleted.deleted_objects, 2);
  assert.equal(env.DB.db.prepare('SELECT id FROM projects WHERE id = ?').get(project.id), undefined);
  assert.equal(env.DB.db.prepare('SELECT id FROM project_versions WHERE project_id = ?').get(project.id), undefined);
  assert.equal(env.PROJECTS.objects.has(stored.manifest_key), false);
  assert.equal(env.PROJECTS.objects.has(stored.content_key), false);
});

test('non-admin cannot permanently delete projects', async () => {
  const { env, author, other } = setup();
  const project = await createWorldbookProject(env, author);
  await assert.rejects(
    () => deleteAdminProject(env, other, project.id),
    error => error?.status === 403 && error?.code === 'moderator_required',
  );
});


test('admin detail compares an author-published update with the previous approved release', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'), '首版');

  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', {
      changelog: '修改内容',
      bundle: {
        schema_version: 1,
        artifacts: [{
          kind: 'worldbook',
          name: 'v2',
          format: 'json',
          content: {
            entries: {
              0: { comment: 'v1', content: 'changed', constant: true },
              1: { comment: '新增', content: 'new' },
            },
          },
        }],
      },
    }),
    env,
    author,
    project.id,
  );

  const detail = await responseJson(await getPendingProjectReview(env, admin, project.id));
  assert.equal(detail.project.review_status, 'approved');
  assert.equal(detail.project.reviewed_at, 0);
  assert.equal(detail.content_preview.worldbook_entries.length, 2);
  assert.equal(detail.content_preview.worldbook_entries[0].strategy_type, 'constant');
  assert.equal(detail.change_preview.from_version, 1);
  assert.equal(detail.change_preview.to_version, 2);
  assert.ok(detail.change_preview.summary.added >= 1);
  assert.ok(detail.change_preview.summary.modified >= 1);
});


test('admin update feed shows author-published updates after the first approval', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'), '首版通过');

  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', {
      changelog: '作者直接更新',
      bundle: bundle('v2'),
    }),
    env,
    author,
    project.id,
  );

  const updates = await responseJson(
    await listAdminProjectUpdates(request('/api/admin/updates'), env, admin),
  );
  assert.equal(updates.items.length, 1);
  assert.equal(updates.items[0].id, project.id);
  assert.equal(updates.items[0].version, 2);
  assert.equal(updates.items[0].changelog, '作者直接更新');
  assert.equal(updates.items[0].owner_name, 'Author');
});
