import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { getProjectEngagement, recordProjectDownload, setProjectEngagement } from '../src/engagement.js';

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

function setup() {
  const DB = new D1Database();
  DB.db.prepare(
    'INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('100', 'tester', 'Tester', 0, 1, 1);
  const user = DB.db.prepare('SELECT * FROM users WHERE discord_id = ?').get('100');
  DB.db.prepare(
    `INSERT INTO projects
      (id, owner_user_id, slug, name, summary, project_type, status, latest_version, published_version, created_at, updated_at)
     VALUES ('p1', ?, 'p1', '测试作品', '', 'extension', 'published', 1, 1, 1, 1)`,
  ).run(user.id);
  return { env: { DB }, user };
}

test('like and favorite toggles are idempotent and update public counters', async () => {
  const { env, user } = setup();

  await setProjectEngagement(env, user, 'p1', 'like', true);
  await setProjectEngagement(env, user, 'p1', 'like', true);
  await setProjectEngagement(env, user, 'p1', 'favorite', true);

  let state = await getProjectEngagement(env, user, 'p1');
  assert.deepEqual(state, {
    likes_count: 1,
    favorites_count: 1,
    downloads_count: 0,
    user_liked: true,
    user_favorited: true,
  });

  await setProjectEngagement(env, user, 'p1', 'like', false);
  await setProjectEngagement(env, user, 'p1', 'like', false);

  state = await getProjectEngagement(env, user, 'p1');
  assert.equal(state.likes_count, 0);
  assert.equal(state.favorites_count, 1);
  assert.equal(state.user_liked, false);
  assert.equal(state.user_favorited, true);
});

test('download recording increments only published visible projects', async () => {
  const { env } = setup();

  await recordProjectDownload(env, 'p1');
  await recordProjectDownload(env, 'p1');
  let row = env.DB.db.prepare('SELECT downloads_count FROM projects WHERE id = ?').get('p1');
  assert.equal(Number(row.downloads_count), 2);

  env.DB.db.prepare("UPDATE projects SET status = 'archived' WHERE id = 'p1'").run();
  await assert.rejects(
    () => recordProjectDownload(env, 'p1'),
    error => error?.status === 404 && error?.code === 'project_not_found',
  );
});
