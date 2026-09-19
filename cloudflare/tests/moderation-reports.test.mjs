import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProjectReport,
  listAdminReports,
  resolveProjectReport,
} from '../src/moderation/reports.js';
import {
  bundle, createWorldbookProject, publishVersion, request, responseJson, setup,
} from './support/project-fixture.mjs';

test('logged-in user can report a published project once while report is open', async () => {
  const { env, author, admin, other } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));

  const first = await createProjectReport(
    request(`/api/projects/${project.id}/report`, 'POST', { reason: 'malicious', details: '包含恶意内容' }),
    env,
    other,
    project.id,
  );
  assert.equal(first.status, 201);

  await assert.rejects(
    () => createProjectReport(
      request(`/api/projects/${project.id}/report`, 'POST', { reason: 'malicious', details: '重复' }),
      env,
      other,
      project.id,
    ),
    error => error?.status === 409 && error?.code === 'report_exists',
  );
});

test('admin can list and resolve reports without automatically changing project status', async () => {
  const { env, author, admin, other } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));

  const created = await responseJson(await createProjectReport(
    request(`/api/projects/${project.id}/report`, 'POST', { reason: 'other', details: '请检查' }),
    env,
    other,
    project.id,
  ));

  const pending = await responseJson(await listAdminReports(
    new Request('https://workshop.example/api/admin/reports?status=open'),
    env,
    admin,
  ));
  assert.equal(pending.items.length, 1);
  assert.equal(pending.items[0].project_id, project.id);

  const resolved = await responseJson(await resolveProjectReport(
    request(`/api/admin/reports/${created.report.id}`, 'POST', { status: 'resolved', note: '已人工确认' }),
    env,
    admin,
    created.report.id,
  ));
  assert.equal(resolved.report.status, 'resolved');

  const row = env.DB.db.prepare('SELECT status FROM projects WHERE id = ?').get(project.id);
  assert.equal(row.status, 'published');
});

test('reporting an unavailable or archived project is rejected', async () => {
  const { env, author, admin, other } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));
  env.DB.db.prepare("UPDATE projects SET status = 'archived' WHERE id = ?").run(project.id);

  await assert.rejects(
    () => createProjectReport(
      request(`/api/projects/${project.id}/report`, 'POST', { reason: 'other', details: '' }),
      env,
      other,
      project.id,
    ),
    error => error?.status === 404 && error?.code === 'project_not_found',
  );
});
