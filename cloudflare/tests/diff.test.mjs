import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { getAdminProjectDiff } from '../src/projects/diff.js';
import { seedTestCover } from './support/project-fixture.mjs';
import {
  createProject,
  reviewProject,
  submitProjectForReview,
  updateProject,
  uploadProjectVersion,
} from '../src/projects.js';

class D1Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new D1Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
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
  async put(key, value, options = {}) { this.objects.set(key, { value, httpMetadata: options.httpMetadata || {} }); }
  async get(key) {
    const item = this.objects.get(key);
    return item ? { body: item.value, httpMetadata: item.httpMetadata } : null;
  }
  async delete(key) { this.objects.delete(key); }
}

function post(path, body) {
  return new Request(`https://workshop.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patch(path, body) {
  return new Request(`https://workshop.example${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function worldbook(name, content) {
  return {
    schema_version: 1,
    artifacts: [{
      kind: 'worldbook',
      name,
      format: 'json',
      content: { entries: { 0: { comment: name, content } } },
    }],
  };
}

async function setup() {
  const DB = new D1Database();
  const PROJECTS = new MemoryR2();
  DB.db.prepare(
    'INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('100', 'author', 'Author', 0, 1, 1);
  DB.db.prepare(
    'INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('200', 'admin', 'Admin', 1, 1, 1);
  const author = DB.db.prepare('SELECT * FROM users WHERE discord_id = ?').get('100');
  const admin = DB.db.prepare('SELECT * FROM users WHERE discord_id = ?').get('200');
  const env = { DB, PROJECTS };
  const response = await createProject(
    post('/api/projects', {
      name: '名称 v1',
      summary: '简介 v1',
      category: 'extension',
      tags: ['old'],
    }),
    env,
    author,
  );
  const project = (await response.json()).project;
  return { env, author, admin, project };
}

async function approve(env, author, admin, projectId, bundle) {
  await uploadProjectVersion(
    post(`/api/projects/${projectId}/versions`, { changelog: '', bundle }),
    env,
    author,
    projectId,
  );
  await seedTestCover(env, projectId);
  await submitProjectForReview(env, author, projectId);
  await reviewProject(
    post(`/api/admin/projects/${projectId}/review`, { decision: 'approved', note: '' }),
    env,
    admin,
    projectId,
  );
}

test('admin diff compares author-published update against the previous public version', async () => {
  const { env, author, admin, project } = await setup();
  await approve(env, author, admin, project.id, worldbook('主世界书', 'old'));

  await updateProject(
    patch(`/api/projects/${project.id}`, {
      name: '名称 v2',
      summary: '简介 v2',
      tags: ['new'],
    }),
    env,
    author,
    project.id,
  );
  await uploadProjectVersion(
    post(`/api/projects/${project.id}/versions`, {
      changelog: '修改内容',
      bundle: worldbook('主世界书', 'new'),
    }),
    env,
    author,
    project.id,
  );
  const diff = await getAdminProjectDiff(env, admin, project.id);
  assert.equal(diff.base_version, 1);
  assert.equal(diff.target_version, 2);
  assert.equal(diff.target_review_status, 'approved');
  assert.deepEqual(diff.metadata.name, { before: '名称 v1', after: '名称 v2' });
  assert.deepEqual(diff.metadata.tags, { before: ['old'], after: ['new'] });
  assert.equal(diff.artifacts.changed.length, 1);
  assert.equal(diff.artifacts.changed[0].name, '主世界书');
  assert.equal(diff.artifacts.added.length, 0);
  assert.equal(diff.artifacts.removed.length, 0);
});

test('admin diff for a first release treats every artifact as added', async () => {
  const { env, author, admin, project } = await setup();
  await uploadProjectVersion(
    post(`/api/projects/${project.id}/versions`, {
      changelog: 'first',
      bundle: worldbook('主世界书', 'first'),
    }),
    env,
    author,
    project.id,
  );
  await submitProjectForReview(env, author, project.id);

  const diff = await getAdminProjectDiff(env, admin, project.id);
  assert.equal(diff.base_version, 0);
  assert.equal(diff.target_version, 1);
  assert.equal(diff.artifacts.added.length, 1);
  assert.equal(diff.artifacts.changed.length, 0);
});

test('non-admin cannot inspect review diffs', async () => {
  const { env, author, project } = await setup();
  await assert.rejects(
    () => getAdminProjectDiff(env, author, project.id),
    error => error?.status === 403 && error?.code === 'moderator_required',
  );
});
