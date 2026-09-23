import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/validate-release-version.mjs', import.meta.url));
const appSource = fs.readFileSync(
  fileURLToPath(new URL('../../src/CreativeWorkshop/app/workshop-app.js', import.meta.url)),
  'utf8',
);
const versionMatch = appSource.match(/WORKSHOP_VERSION\s*=\s*'([^']+)'/u);
assert.ok(versionMatch, 'test fixture must be able to read WORKSHOP_VERSION');
const currentVersion = versionMatch[1];
const currentTag = 'workshop-v' + currentVersion;

test('release version command writes the validated version and immutable tag for GitHub Actions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-release-version-'));
  const output = path.join(dir, 'github-output.txt');

  try {
    const result = spawnSync(process.execPath, [script, currentVersion], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(currentVersion + ' → ' + currentTag));

    const values = fs.readFileSync(output, 'utf8').split(/\r?\n/u);
    assert.ok(values.includes('version=' + currentVersion));
    assert.ok(values.includes('tag=' + currentTag));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release version command rejects a version that differs from WORKSHOP_VERSION', () => {
  const invalidVersion = currentVersion === '9999.9999.9999' ? '9999.9999.9998' : '9999.9999.9999';
  const result = spawnSync(process.execPath, [script, invalidVersion], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /与 WORKSHOP_VERSION/u);
});
