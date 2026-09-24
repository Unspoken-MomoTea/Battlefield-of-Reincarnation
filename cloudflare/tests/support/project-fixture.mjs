import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  createProject,
  reviewProject,
  submitProjectForReview,
  uploadProjectVersion,
} from '../../src/projects.js';

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
    this.db.exec(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
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

export function request(path, method = 'GET', body) {
  return new Request(`https://workshop.example${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function bundle(label) {
  return {
    schema_version: 1,
    artifacts: [{ kind: 'worldbook', name: label, format: 'json', content: { entries: { 0: { comment: label, content: 'hello' } } } }],
  };
}

export async function responseJson(response) {
  return JSON.parse(await response.text());
}

export function setup() {
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

export async function createWorldbookProject(env, author) {
  const response = await createProject(request('/api/projects', 'POST', { name: '测试世界书', summary: '说明', category: 'extension' }), env, author);
  return (await responseJson(response)).project;
}

export async function seedTestCover(env, projectId) {
  const project = env.DB.db.prepare(
    'SELECT latest_version FROM projects WHERE id = ?',
  ).get(projectId);
  const version = env.DB.db.prepare(
    'SELECT manifest_key FROM project_versions WHERE project_id = ? AND version = ?',
  ).get(projectId, Number(project?.latest_version || 0));
  if (!version?.manifest_key) throw new Error('seedTestCover requires an uploaded version');
  env.DB.db.prepare('UPDATE projects SET cover_key = ? WHERE id = ?')
    .run(version.manifest_key, projectId);
  env.DB.db.prepare('UPDATE project_versions SET cover_key = ? WHERE project_id = ? AND version = ?')
    .run(version.manifest_key, projectId, Number(project.latest_version));
}

export async function publishVersion(env, author, admin, projectId, versionBundle, note = '') {
  await uploadProjectVersion(request(`/api/projects/${projectId}/versions`, 'POST', { changelog: 'first', bundle: versionBundle }), env, author, projectId);
  await seedTestCover(env, projectId);
  await submitProjectForReview(env, author, projectId);
  await reviewProject(request(`/api/admin/projects/${projectId}/review`, 'POST', { decision: 'approved', note }), env, admin, projectId);
}
