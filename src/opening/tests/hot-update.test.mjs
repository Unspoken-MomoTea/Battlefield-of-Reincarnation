import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OPENING_COMPONENT,
  getOpeningUpdateChannel,
  getOpeningUpdateRef,
  openingCdnUrl,
} from '../hot-update/component.js';
import { OPENING_VERSION } from '../version.js';

test('opening hot-update metadata is isolated from workshop/world-engine versions', () => {
  assert.equal(OPENING_VERSION, '1.0.0');
  assert.equal(OPENING_COMPONENT.id, 'opening');
  assert.equal(OPENING_COMPONENT.entryPath, '/Regular/开局.html');
  assert.equal(OPENING_COMPONENT.sourcePath, 'Regular/开局.html');
  assert.deepEqual(OPENING_COMPONENT.tagPrefixes, ['opening-v']);
});

test('opening preview defaults to main until a formal channel is explicitly selected', () => {
  assert.equal(getOpeningUpdateChannel({}), 'testing');
  assert.equal(getOpeningUpdateRef({}), 'main');

  const stable = {
    OPENING_UPDATE_CHANNEL: 'stable',
    OPENING_UPDATE_REF: 'opening-v1.0.0',
  };
  assert.equal(getOpeningUpdateChannel(stable), 'stable');
  assert.equal(getOpeningUpdateRef(stable), 'opening-v1.0.0');
});

test('opening CDN URL uses an immutable sha and encoded Chinese path', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(
    openingCdnUrl({
      repository: 'Unspoken-MomoTea/Battlefield-of-Reincarnation',
      sha,
    }),
    'https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@0123456789abcdef0123456789abcdef01234567/Regular/%E5%BC%80%E5%B1%80.html?v=0123456789ab',
  );
});
