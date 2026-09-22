import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RELEASE_TARGETS,
  releasePlan,
  validateReleaseConfig,
  validateWorkshopRelease,
  workshopReleaseTag,
} from '../scripts/release-policy.mjs';

function configFixture() {
  return {
    env: {
      staging: {
        name: 'reincarnation-workshop-staging',
        vars: {
          PUBLIC_BASE_URL: 'https://workshop-test.6661816.xyz',
          DISCORD_CLIENT_ID: 'staging-discord',
          CLIENT_UPDATE_CHANNEL: 'testing',
          CLIENT_UPDATE_REF: 'main',
        },
        d1_databases: [{ binding: 'DB', database_id: 'staging-db' }],
        kv_namespaces: [{ binding: 'SESSION_KV', id: 'staging-kv' }],
        r2_buckets: [{ binding: 'PROJECTS', bucket_name: 'staging-r2' }],
      },
      production: {
        name: 'reincarnation-workshop-production',
        vars: {
          PUBLIC_BASE_URL: 'https://workshop.6661816.xyz',
          DISCORD_CLIENT_ID: 'production-discord',
          CLIENT_UPDATE_CHANNEL: 'stable',
          CLIENT_UPDATE_REF: 'workshop-stable',
        },
        d1_databases: [{ binding: 'DB', database_id: 'production-db' }],
        kv_namespaces: [{ binding: 'SESSION_KV', id: 'production-kv' }],
        r2_buckets: [{ binding: 'PROJECTS', bucket_name: 'production-r2' }],
      },
    },
  };
}

test('release plan keeps testing and production on separate refs', () => {
  assert.deepEqual(RELEASE_TARGETS.staging, {
    ref: 'main',
    channel: 'testing',
    label: '测试服',
  });
  assert.deepEqual(RELEASE_TARGETS.production, {
    ref: 'workshop-stable',
    channel: 'stable',
    label: '正式服',
  });
  assert.deepEqual(releasePlan('staging'), ['staging']);
  assert.deepEqual(releasePlan('production'), ['production']);
  assert.deepEqual(releasePlan('both'), ['staging', 'production']);
});

test('release config accepts isolated resources and rejects cross-environment sharing', () => {
  const config = configFixture();
  assert.equal(validateReleaseConfig(config, 'staging').name, 'reincarnation-workshop-staging');
  assert.equal(validateReleaseConfig(config, 'production').name, 'reincarnation-workshop-production');

  config.env.production.kv_namespaces[0].id = 'staging-kv';
  assert.throws(
    () => validateReleaseConfig(config, 'production'),
    /SESSION_KV 被测试服和正式服共用/u,
  );
});

test('release config rejects the wrong production update channel', () => {
  const config = configFixture();
  config.env.production.vars.CLIENT_UPDATE_REF = 'main';
  assert.throws(
    () => validateReleaseConfig(config, 'production'),
    /stable \/ workshop-stable/u,
  );
});

test('release config rejects production placeholders before deployment', () => {
  const config = configFixture();
  config.env.production.vars.DISCORD_CLIENT_ID = 'REPLACE_ME';
  assert.throws(
    () => validateReleaseConfig(config, 'production'),
    /仍有占位配置/u,
  );
});

test('stable release version must exactly match WORKSHOP_VERSION and produces an immutable tag name', () => {
  const source = "export const WORKSHOP_VERSION = '1.12.1';\n";
  assert.deepEqual(validateWorkshopRelease(source, '1.12.1'), {
    version: '1.12.1',
    tag: 'workshop-v1.12.1',
  });
  assert.equal(workshopReleaseTag('1.12.1'), 'workshop-v1.12.1');

  assert.throws(
    () => validateWorkshopRelease(source, '1.12.0'),
    /与 WORKSHOP_VERSION 1\.12\.1 不一致/u,
  );
  assert.throws(
    () => workshopReleaseTag('v1.12.1'),
    /版本号必须是 X\.Y\.Z/u,
  );
});
