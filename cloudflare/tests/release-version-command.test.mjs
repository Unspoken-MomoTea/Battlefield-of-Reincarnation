import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/validate-release-version.mjs', import.meta.url));

test('release version command writes the validated version and immutable tag for GitHub Actions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-release-version-'));
  const output = path.join(dir, 'github-output.txt');

  try {
    const result = spawnSync(process.execPath, [script, '1.12.1'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1\.12\.1 → workshop-v1\.12\.1/u);

    const values = fs.readFileSync(output, 'utf8');
    assert.match(values, /^version=1\.12\.1$/mu);
    assert.match(values, /^tag=workshop-v1\.12\.1$/mu);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release version command rejects a version that differs from WORKSHOP_VERSION', () => {
  const result = spawnSync(process.execPath, [script, '9.9.9'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /与 WORKSHOP_VERSION 1\.12\.1 不一致/u);
});
