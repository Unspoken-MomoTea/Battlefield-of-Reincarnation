import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { listAdminUsers, setUserBan } from '../src/moderation/users.js';

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}
class TestDB {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) { return new Statement(this.db, sql); }
}
function request(body) {
  return new Request('https://workshop.example/api/admin/users/1/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
function setup() {
  const DB = new TestDB();
  DB.db.prepare("INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES ('100','author','Author',0,1,1)").run();
  DB.db.prepare("INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES ('200','admin','Admin',1,1,1)").run();
  return {
    env: { DB },
    author: DB.db.prepare("SELECT * FROM users WHERE discord_id='100'").get(),
    admin: DB.db.prepare("SELECT * FROM users WHERE discord_id='200'").get(),
  };
}

test('admin can ban and unban a user while preserving their account', async () => {
  const { env, author, admin } = setup();
  const banned = await setUserBan(request({ banned: true, reason: '恶意上传' }), env, admin, author.id);
  assert.equal((await banned.json()).user.is_banned, 1);

  let row = env.DB.db.prepare('SELECT is_banned, ban_reason FROM users WHERE id = ?').get(author.id);
  assert.equal(Number(row.is_banned), 1);
  assert.equal(row.ban_reason, '恶意上传');

  const restored = await setUserBan(request({ banned: false }), env, admin, author.id);
  assert.equal((await restored.json()).user.is_banned, 0);
  row = env.DB.db.prepare('SELECT is_banned, ban_reason FROM users WHERE id = ?').get(author.id);
  assert.equal(Number(row.is_banned), 0);
  assert.equal(row.ban_reason, '');
});

test('admin user list exposes ban status and supports filtering', async () => {
  const { env, author, admin } = setup();
  await setUserBan(request({ banned: true, reason: 'test' }), env, admin, author.id);

  const response = await listAdminUsers(new Request('https://workshop.example/api/admin/users?banned=1'), env, admin);
  const body = await response.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].discord_id, '100');
  assert.equal(body.items[0].is_banned, 1);
});

test('admin cannot ban themselves', async () => {
  const { env, admin } = setup();
  await assert.rejects(
    () => setUserBan(request({ banned: true, reason: 'x' }), env, admin, admin.id),
    error => error?.status === 409 && error?.code === 'cannot_ban_self',
  );
});
