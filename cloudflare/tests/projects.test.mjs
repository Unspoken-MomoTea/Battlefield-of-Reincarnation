import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
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
  updateProject,
  uploadProjectVersion,
  validateBundle,
} from '../src/projects.js';

class D1Statement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) { return new D1Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) } };
  }
}

class D1Database {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
}

class MemoryR2 {
  constructor() { this.objects = new Map(); }
  async put(key, value, options = {}) { this.objects.set(key, { value: String(value), httpMetadata: options.httpMetadata }); }
  async get(key) {
    const item = this.objects.get(key);
    return item ? { body: item.value, httpMetadata: item.httpMetadata } : null;
  }
  async delete(key) { this.objects.delete(key); }
}

function request(path, method = 'GET', body) {
  return new Request(`https://workshop.example${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function bundle(label) {
  return {
    schema_version: 1,
    artifacts: [{ kind: 'worldbook', name: label, format: 'json', content: { entries: { 0: { comment: label, content: 'hello' } } } }],
  };
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

function setup() {
  const DB = new D1Database();
  const PROJECTS = new MemoryR2();
  const now = 1;
  DB.db.prepare(`INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run('100', 'author', 'Author', 0, now, now);
  DB.db.prepare(`INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run('200', 'admin', 'Admin', 1, now, now);
  DB.db.prepare(`INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run('300', 'other', 'Other', 0, now, now);
  return {
    env: { DB, PROJECTS },
    author: DB.db.prepare('SELECT * FROM users WHERE discord_id = ?').get('100'),
    admin: DB.db.prepare('SELECT * FROM users WHERE discord_id = ?').get('200'),
    other: DB.db.prepare('SELECT * FROM users WHERE discord_id = ?').get('300'),
  };
}

async function createWorldbookProject(env, author) {
  const response = await createProject(request('/api/projects', 'POST', { name: '测试世界书', summary: '说明', category: 'worldbook' }), env, author);
  return (await responseJson(response)).project;
}

async function publishVersion(env, author, admin, projectId, versionBundle, note = '') {
  await uploadProjectVersion(request(`/api/projects/${projectId}/versions`, 'POST', { changelog: 'first', bundle: versionBundle }), env, author, projectId);
  await submitProjectForReview(env, author, projectId);
  await reviewProject(request(`/api/admin/projects/${projectId}/review`, 'POST', { decision: 'approved', note }), env, admin, projectId);
}

test('published project appears in public catalog and can be downloaded', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));

  const list = await responseJson(await listPublicProjects(request('/api/projects'), env));
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, project.id);
  assert.equal(list.items[0].version, 1);

  const detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.version, 1);
  assert.equal(detail.manifest.artifacts[0].name, 'v1');

  const download = await responseJson(await downloadPublicProject(project.id, env));
  assert.equal(download.artifacts[0].content.entries['0'].comment, 'v1');
});

test('new draft version does not replace the last approved public version', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));
  await uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'v2', bundle: bundle('v2') }), env, author, project.id);

  const version = await responseJson(await getPublicProjectVersion(project.id, env));
  assert.equal(version.version, 1);
  const download = await responseJson(await downloadPublicProject(project.id, env));
  assert.equal(download.artifacts[0].name, 'v1');
});

test('rejected update keeps the previously approved version public', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));
  await uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'v2', bundle: bundle('v2') }), env, author, project.id);
  await submitProjectForReview(env, author, project.id);
  await reviewProject(request(`/api/admin/projects/${project.id}/review`, 'POST', { decision: 'rejected', note: '格式需要修改' }), env, admin, project.id);

  const version = await responseJson(await getPublicProjectVersion(project.id, env));
  assert.equal(version.version, 1);
  const projectRow = env.DB.db.prepare('SELECT status, latest_version, published_version FROM projects WHERE id = ?').get(project.id);
  assert.equal(projectRow.status, 'rejected');
  assert.equal(Number(projectRow.latest_version), 2);
  assert.equal(Number(projectRow.published_version), 1);
});

test('only owner or admin can upload project versions', async () => {
  const { env, author, other } = setup();
  const project = await createWorldbookProject(env, author);
  await assert.rejects(
    () => uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: '', bundle: bundle('x') }), env, other, project.id),
    error => error?.status === 403 && error?.code === 'forbidden',
  );
});

test('bundle validator rejects executable script artifacts', () => {
  assert.throws(
    () => validateBundle({ schema_version: 1, artifacts: [{ kind: 'script', name: 'evil', format: 'text', content: 'alert(1)' }] }, 'mixed'),
    error => error?.status === 400 && error?.code === 'invalid_artifact_kind',
  );
});

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


test('admin management lists uploaded projects across approved and rejected states', async () => {
  const { env, author, admin } = setup();

  const approved = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, approved.id, bundle('approved'), '可以发布');

  const rejectedResponse = await createProject(
    request('/api/projects', 'POST', { name: '被拒绝作品', summary: '说明', category: 'worldbook' }),
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


test('author can assign normalized tags and public catalog can filter by tag', async () => {
  const { env, author, admin } = setup();
  const created = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: '标签测试',
        summary: '测试标签筛选',
        category: 'worldbook',
        tags: [' 剧情 ', 'BOSS', '剧情'],
      }),
      env,
      author,
    ),
  );
  assert.deepEqual(created.project.tags, ['剧情', 'boss']);

  await publishVersion(env, author, admin, created.project.id, bundle('tagged'));

  const matching = await responseJson(
    await listPublicProjects(request('/api/projects?tag=boss'), env),
  );
  assert.equal(matching.items.length, 1);
  assert.deepEqual(matching.items[0].tags, ['剧情', 'boss']);

  const missing = await responseJson(
    await listPublicProjects(request('/api/projects?tag=不存在'), env),
  );
  assert.equal(missing.items.length, 0);
});


test('published metadata remains frozen until a new version is approved', async () => {
  const { env, author, admin } = setup();
  const created = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: '公开名称 v1',
        summary: '公开简介 v1',
        category: 'worldbook',
        tags: ['v1'],
      }),
      env,
      author,
    ),
  );
  const project = created.project;
  await publishVersion(env, author, admin, project.id, bundle('v1'));

  await updateProject(
    request(`/api/projects/${project.id}`, 'PATCH', {
      name: '草稿名称 v2',
      summary: '草稿简介 v2',
      tags: ['v2'],
    }),
    env,
    author,
    project.id,
  );

  let detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.name, '公开名称 v1');
  assert.equal(detail.project.summary, '公开简介 v1');
  assert.deepEqual(detail.project.tags, ['v1']);

  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', {
      changelog: 'metadata v2',
      bundle: bundle('v2'),
    }),
    env,
    author,
    project.id,
  );
  await submitProjectForReview(env, author, project.id);

  detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.name, '公开名称 v1');
  assert.deepEqual(detail.project.tags, ['v1']);

  await reviewProject(
    request(`/api/admin/projects/${project.id}/review`, 'POST', {
      decision: 'approved',
      note: '元数据与内容一起通过',
    }),
    env,
    admin,
    project.id,
  );

  detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.name, '草稿名称 v2');
  assert.equal(detail.project.summary, '草稿简介 v2');
  assert.deepEqual(detail.project.tags, ['v2']);
});
