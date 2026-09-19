import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { getAdminProjectCover, uploadProjectCover, getPublicProjectCover } from '../src/projects/cover.js';
import {
  createProject,
  reviewProject,
  submitProjectForReview,
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
  async put(key, value, options = {}) {
    this.objects.set(key, { value, httpMetadata: options.httpMetadata || {} });
  }
  async get(key) {
    const item = this.objects.get(key);
    return item ? { body: item.value, httpMetadata: item.httpMetadata } : null;
  }
  async delete(key) { this.objects.delete(key); }
}

function request(path, method = 'GET', body, headers = {}) {
  return new Request(`https://workshop.example${path}`, { method, body, headers });
}

function jsonRequest(path, body) {
  return new Request(`https://workshop.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function worldbook(label) {
  return {
    schema_version: 1,
    artifacts: [{
      kind: 'worldbook',
      name: label,
      format: 'json',
      content: { entries: { 0: { comment: label, content: 'hello' } } },
    }],
  };
}

function png(seed) {
  return new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, seed, 1, 2, 3]);
}

async function bodyJson(response) {
  return JSON.parse(await response.text());
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
  const created = await createProject(
    new Request('https://workshop.example/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '封面测试', summary: '', category: 'worldbook' }),
    }),
    env,
    author,
  );
  const project = (await bodyJson(created)).project;
  return { env, author, admin, project };
}

async function publish(env, author, admin, projectId, label) {
  await uploadProjectVersion(
    jsonRequest(`/api/projects/${projectId}/versions`, { changelog: label, bundle: worldbook(label) }),
    env,
    author,
    projectId,
  );
  await submitProjectForReview(env, author, projectId);
  await reviewProject(
    jsonRequest(`/api/admin/projects/${projectId}/review`, { decision: 'approved', note: '' }),
    env,
    admin,
    projectId,
  );
}

test('published cover is frozen until a later version carrying the new cover is approved', async () => {
  const { env, author, admin, project } = await setup();

  const first = png(1);
  await uploadProjectCover(
    request(`/api/projects/${project.id}/cover`, 'PUT', first, { 'Content-Type': 'image/png' }),
    env,
    author,
    project.id,
  );
  await publish(env, author, admin, project.id, 'v1');

  let response = await getPublicProjectCover(env, project.id);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), first);

  const second = png(2);
  await uploadProjectCover(
    request(`/api/projects/${project.id}/cover`, 'PUT', second, { 'Content-Type': 'image/png' }),
    env,
    author,
    project.id,
  );

  response = await getPublicProjectCover(env, project.id);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), first);

  await publish(env, author, admin, project.id, 'v2');
  response = await getPublicProjectCover(env, project.id);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), second);
});

test('cover upload rejects files whose bytes do not match the declared image type', async () => {
  const { env, author, project } = await setup();
  await assert.rejects(
    () => uploadProjectCover(
      request(`/api/projects/${project.id}/cover`, 'PUT', new TextEncoder().encode('not png'), {
        'Content-Type': 'image/png',
      }),
      env,
      author,
      project.id,
    ),
    error => error?.status === 400 && error?.code === 'invalid_cover',
  );
});


test('admin can inspect the latest submitted cover while normal users cannot', async () => {
  const { env, author, admin, project } = await setup();
  const cover = png(9);
  await uploadProjectCover(
    request(`/api/projects/${project.id}/cover`, 'PUT', cover, { 'Content-Type': 'image/png' }),
    env,
    author,
    project.id,
  );
  await uploadProjectVersion(
    jsonRequest(`/api/projects/${project.id}/versions`, {
      changelog: 'pending',
      bundle: worldbook('pending'),
    }),
    env,
    author,
    project.id,
  );
  await submitProjectForReview(env, author, project.id);

  const response = await getAdminProjectCover(env, admin, project.id);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), cover);

  await assert.rejects(
    () => getAdminProjectCover(env, author, project.id),
    error => error?.status === 403 && error?.code === 'admin_required',
  );
});
