import assert from 'node:assert/strict';
import test from 'node:test';

import { guardRequest } from '../src/middleware/request-guard.js';
import { readJson } from '../src/http.js';

test('request guard rejects declared bodies larger than workshop limit', () => {
  const request = new Request('https://workshop.example/api/projects/x/versions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(7 * 1024 * 1024) },
    body: '{}',
  });
  assert.throws(
    () => guardRequest(request),
    error => error?.status === 413 && error?.code === 'request_too_large',
  );
});

test('readJson enforces actual utf8 body size when content length is absent', async () => {
  const request = new Request('https://workshop.example/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: '好'.repeat(100) }),
  });
  await assert.rejects(
    () => readJson(request, { maxBytes: 100 }),
    error => error?.status === 413 && error?.code === 'request_too_large',
  );
});
