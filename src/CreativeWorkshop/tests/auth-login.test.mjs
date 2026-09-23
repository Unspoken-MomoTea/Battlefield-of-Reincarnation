import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDiscordLoginRequest,
  httpOpenerOrigin,
} from '../services/api/auth.js';

test('HTTP browser origin is included for popup postMessage login', () => {
  const host = { location: { origin: 'https://tavern.example' } };
  assert.equal(httpOpenerOrigin(host), 'https://tavern.example');

  const pending = createDiscordLoginRequest({
    base: 'https://workshop-test.6661816.xyz',
    host,
    loginId: 'a'.repeat(64),
  });
  const url = new URL(pending.url);
  assert.equal(url.searchParams.get('opener_origin'), 'https://tavern.example');
  assert.equal(pending.openerOrigin, 'https://tavern.example');
});

test('TT-style native origins omit opener_origin and rely on exchange polling', () => {
  for (const origin of ['null', 'file://', 'capacitor://localhost', 'app://tavern']) {
    const host = { location: { origin } };
    assert.equal(httpOpenerOrigin(host), '');

    const pending = createDiscordLoginRequest({
      base: 'https://workshop-test.6661816.xyz',
      host,
      loginId: 'b'.repeat(64),
    });
    const url = new URL(pending.url);
    assert.equal(url.searchParams.has('opener_origin'), false);
    assert.equal(pending.openerOrigin, '');
    assert.equal(pending.expectedOrigin, 'https://workshop-test.6661816.xyz');
  }
});
