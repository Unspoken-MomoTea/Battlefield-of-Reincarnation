import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { getPublicProjectVersionsBatch } from '../src/projects/versions.js';

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(r.changes) } }; }
}
class DB {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) { return new Statement(this.db, sql); }
}
function request(body) {
  return new Request('https://workshop.example/api/projects/versions/batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
function setup() {
  const db = new DB();
  db.db.prepare("INSERT INTO users (discord_id, username, display_name, is_admin, created_at, updated_at) VALUES ('1','u','U',0,1,1)").run();
  const owner = db.db.prepare("SELECT id FROM users WHERE discord_id='1'").get();
  for (const [id, status, published, latest] of [['a','published',2,2],['b','archived',1,1],['c','draft',0,1]]) {
    db.db.prepare(`INSERT INTO projects (id, owner_user_id, slug, name, summary, category, status, latest_version, published_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', 'worldbook', ?, ?, ?, 1, ?)`).run(id, owner.id, id, id, status, latest, published, 100 + published);
    if (published > 0) {
      db.db.prepare(`INSERT INTO project_versions
        (project_id, version, manifest_key, content_key, name, summary, tags, category, changelog, review_status, created_at, reviewed_at)
        VALUES (?, ?, 'm', 'c', ?, '', '[]', 'worldbook', '', 'approved', 1, ?)`).run(id, published, id, 200 + published);
    }
  }
  return { DB: db };
}

test('batch versions returns visible published versions and reports unavailable ids', async () => {
  const env = setup();
  const response = await getPublicProjectVersionsBatch(request({ ids: ['a', 'b', 'missing', 'a'] }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [{ id: 'a', version: 2, updated_at: 202 }],
    unavailable: ['b', 'missing'],
  });
});

test('batch versions rejects oversized or malformed id lists', async () => {
  const env = setup();
  await assert.rejects(
    () => getPublicProjectVersionsBatch(request({ ids: [] }), env),
    error => error?.status === 400 && error?.code === 'invalid_project_ids',
  );
  await assert.rejects(
    () => getPublicProjectVersionsBatch(request({ ids: Array.from({ length: 101 }, (_, i) => String(i)) }), env),
    error => error?.status === 400 && error?.code === 'invalid_project_ids',
  );
});
