import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RELEASE_TARGETS,
  releasePlan,
  validateReleaseConfig,
  validateWorkshopRelease,
  validateWorldEngineRelease,
  validateStatusBarRelease,
  workshopReleaseTag,
  worldEngineReleaseTag,
  statusBarReleaseTag,
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
        d1_databases: [{ binding: 'DB', database_id: 'shared-db' }],
        kv_namespaces: [{ binding: 'SESSION_KV', id: 'shared-kv' }],
        r2_buckets: [{ binding: 'PROJECTS', bucket_name: 'shared-r2' }],
      },
      production: {
        name: 'reincarnation-workshop-production',
        vars: {
          PUBLIC_BASE_URL: 'https://workshop.6661816.xyz',
          DISCORD_CLIENT_ID: 'production-discord',
          CLIENT_UPDATE_CHANNEL: 'stable',
          CLIENT_UPDATE_REF: 'workshop-stable',
        },
        d1_databases: [{ binding: 'DB', database_id: 'shared-db' }],
        kv_namespaces: [{ binding: 'SESSION_KV', id: 'shared-kv' }],
        r2_buckets: [{ binding: 'PROJECTS', bucket_name: 'shared-r2' }],
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

test('release config requires one shared data set across staging and production', () => {
  const config = configFixture();
  assert.equal(validateReleaseConfig(config, 'staging').name, 'reincarnation-workshop-staging');
  assert.equal(validateReleaseConfig(config, 'production').name, 'reincarnation-workshop-production');

  config.env.production.kv_namespaces[0].id = 'separate-kv';
  assert.throws(
    () => validateReleaseConfig(config, 'production'),
    /SESSION_KV 必须由测试服和正式服共用同一资源/u,
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

test('workshop, world engine and status bar releases use independent immutable tag namespaces', () => {
  const workshopSource = "export const WORKSHOP_VERSION = '1.12.1';\n";
  const worldSource = "const WORLD_ENGINE_VERSION='2.3.4';\n";
  const statusBarSource = "var STATUS_BAR_VERSION = '1.0.0';\n";

  assert.deepEqual(validateWorkshopRelease(workshopSource, '1.12.1'), {
    component: 'workshop',
    version: '1.12.1',
    tag: 'workshop-v1.12.1',
  });
  assert.deepEqual(validateWorldEngineRelease(worldSource, '2.3.4'), {
    component: 'world-engine',
    version: '2.3.4',
    tag: 'world-engine-v2.3.4',
  });
  assert.deepEqual(validateStatusBarRelease(statusBarSource, '1.0.0'), {
    component: 'status-bar',
    version: '1.0.0',
    tag: 'status-bar-v1.0.0',
  });
  assert.equal(workshopReleaseTag('1.12.1'), 'workshop-v1.12.1');
  assert.equal(worldEngineReleaseTag('2.3.4'), 'world-engine-v2.3.4');
  assert.equal(statusBarReleaseTag('1.0.0'), 'status-bar-v1.0.0');

  assert.throws(
    () => validateWorkshopRelease(workshopSource, '1.12.0'),
    /与 WORKSHOP_VERSION 1\.12\.1 不一致/u,
  );
  assert.throws(
    () => validateWorldEngineRelease(worldSource, '2.3.3'),
    /与 WORLD_ENGINE_VERSION 2\.3\.4 不一致/u,
  );
  assert.throws(
    () => workshopReleaseTag('v1.12.1'),
    /版本号必须是 X\.Y\.Z/u,
  );
});
