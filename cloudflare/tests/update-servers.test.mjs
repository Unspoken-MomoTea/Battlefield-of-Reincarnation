import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.match(
    result.stdout,
    /测试服: (?:refs\/(?:remotes\/origin|heads)\/main|本地引用待同步)/u,
  );
  assert.match(result.stdout, /预演结束：没有联网、检出、迁移或部署/u);
});

test('server updater dry-run accepts shared production data configuration without deploying', () => {
  const result = run('production', '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /正式服/u);
  assert.match(result.stdout, /当前本地配置检查通过/u);
  assert.match(result.stdout, /测试服与正式服共用 D1\/KV\/R2/u);
  assert.match(result.stdout, /预演结束：没有联网、检出、迁移或部署/u);
});

test('server updater rejects an unknown environment before any deployment work', () => {
  const result = run('unknown', '--dry-run');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /请选择 staging、production 或 both/u);
});


test('server updater does not perform a GitHub fetch before deployment', () => {
  const source = fs.readFileSync(script, 'utf8');
  assert.doesNotMatch(source, /run\(git, \['fetch'/u);
  assert.match(source, /不会主动连接 GitHub 做 fetch/u);
});
