import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectApi } from '../services/api/projects.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('submit retries after a lost response instead of hanging', async () => {
  let calls = 0;
  const api = createProjectApi(
    async () => {
      calls += 1;
      if (calls === 1) return new Promise(() => {});
      return { ok: true, version: 1 };
    },
    async () => { throw new Error('unused'); },
    { submitTimeoutMs: 10 },
  );
  const result = await Promise.race([
    api.submitProject('project-1'),
    delay(100).then(() => ({ hung: true })),
  ]);
  assert.equal(result?.hung, undefined);
  assert.equal(result?.ok, true);
  assert.equal(calls, 2);
});
