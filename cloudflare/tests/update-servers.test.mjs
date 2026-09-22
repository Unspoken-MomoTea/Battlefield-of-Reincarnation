import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/update-servers.mjs', import.meta.url));

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

test('server updater dry-run is non-destructive and identifies the staging ref', () => {
  const result = run('staging', '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /测试服: origin\/main/u);
  assert.match(result.stdout, /预演结束：没有联网、检出、迁移或部署/u);
});

test('server updater dry-run reports incomplete production configuration without deploying', () => {
  const result = run('production', '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /正式服: origin\/workshop-stable/u);
  assert.match(result.stdout, /配置待处理/u);
  assert.match(result.stdout, /预演结束：没有联网、检出、迁移或部署/u);
});

test('server updater rejects an unknown environment before any deployment work', () => {
  const result = run('unknown', '--dry-run');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /请选择 staging、production 或 both/u);
});
