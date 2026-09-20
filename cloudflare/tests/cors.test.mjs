import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRequest } from '../src/index.js';

test('CORS preflight allows PUT for cover uploads', async () => {
  const request = new Request('https://workshop.example/api/projects/project-1/cover', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:38081',
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });

  const response = await handleRequest(request, {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:38081');

  const methods = response.headers.get('Access-Control-Allow-Methods') || '';
  assert.match(methods, /\bPUT\b/u);
  assert.match(methods, /\bPOST\b/u);
  assert.match(methods, /\bPATCH\b/u);

  const headers = response.headers.get('Access-Control-Allow-Headers') || '';
  assert.match(headers.toLowerCase(), /authorization/u);
  assert.match(headers.toLowerCase(), /content-type/u);
});
