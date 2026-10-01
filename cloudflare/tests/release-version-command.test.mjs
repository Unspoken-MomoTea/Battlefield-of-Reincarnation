import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/validate-release-version.mjs', import.meta.url));

function workshopVersion() {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../../src/CreativeWorkshop/app/workshop-app.js', import.meta.url)),
    'utf8',
  );
  const match = source.match(/WORKSHOP_VERSION\s*=\s*'([^']+)'/u);
  assert.ok(match);
  return match[1];
}

function worldEngineVersion() {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../../src/WorldEngine/core/WorldEngineFoundation.part.js', import.meta.url)),
    'utf8',
  );
  const match = source.match(/WORLD_ENGINE_VERSION\s*=\s*'([^']+)'/u);
  assert.ok(match);
  return match[1];
}

function calculatorVersion() {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../../src/Calculator/core/CalculatorFoundation.part.js', import.meta.url)),
    'utf8',
  );
  const match = source.match(/CALCULATOR_VERSION\s*=\s*'([^']+)'/u);
  assert.ok(match);
  return match[1];
}

function run(component, version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-release-version-'));
  const output = path.join(dir, 'github-output.txt');
  const result = spawnSync(process.execPath, [script, component, version], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: output },
  });
  const values = fs.existsSync(output)
    ? fs.readFileSync(output, 'utf8').split(/\r?\n/u)
    : [];
  fs.rmSync(dir, { recursive: true, force: true });
  return { result, values };
}

test('release version command writes independent workshop release metadata', () => {
  const version = workshopVersion();
  const tag = 'workshop-v' + version;
  const { result, values } = run('workshop', version);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(version + ' → ' + tag));
  assert.ok(values.includes('component=workshop'));
  assert.ok(values.includes('version=' + version));
  assert.ok(values.includes('tag=' + tag));
});

test('release version command writes independent world engine release metadata', () => {
  const version = worldEngineVersion();
  const tag = 'world-engine-v' + version;
  const { result, values } = run('world-engine', version);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(version + ' → ' + tag));
  assert.ok(values.includes('component=world-engine'));
  assert.ok(values.includes('version=' + version));
  assert.ok(values.includes('tag=' + tag));
});

test('release version command writes independent calculator release metadata', () => {
  const version = calculatorVersion();
  const tag = 'calculator-v' + version;
  const { result, values } = run('calculator', version);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(version + ' → ' + tag));
  assert.ok(values.includes('component=calculator'));
  assert.ok(values.includes('version=' + version));
  assert.ok(values.includes('tag=' + tag));
});

test('release version command rejects versions that differ from each component source', () => {
  const invalidVersion = '9999.9999.9999';
  const workshop = spawnSync(process.execPath, [script, 'workshop', invalidVersion], { encoding: 'utf8' });
  assert.notEqual(workshop.status, 0);
  assert.match(workshop.stderr, /与 WORKSHOP_VERSION/u);

  const world = spawnSync(process.execPath, [script, 'world-engine', invalidVersion], { encoding: 'utf8' });
  assert.notEqual(world.status, 0);
  assert.match(world.stderr, /与 WORLD_ENGINE_VERSION/u);

  const calculator = spawnSync(process.execPath, [script, 'calculator', invalidVersion], { encoding: 'utf8' });
  assert.notEqual(calculator.status, 0);
  assert.match(calculator.stderr, /与 CALCULATOR_VERSION/u);
});
