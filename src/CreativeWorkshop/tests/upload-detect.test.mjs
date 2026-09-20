import assert from 'node:assert/strict';
import test from 'node:test';

import { detectUploadKind, buildDetectedUploadBundle } from '../services/upload-detect.js';

test('upload detection recognizes worldbooks regexes scripts and presets', () => {
  assert.equal(
    detectUploadKind('world.json', JSON.stringify({
      entries: { 0: { comment: '规则', content: '内容' } },
    })).kind,
    'worldbook',
  );

  assert.equal(
    detectUploadKind('regex.json', JSON.stringify([
      { scriptName: '替换', findRegex: 'a', replaceString: 'b' },
    ])).kind,
    'regex',
  );

  assert.equal(
    detectUploadKind('helper.js', "console.log('ok')").kind,
    'script',
  );

  assert.equal(
    detectUploadKind('script-tree.json', JSON.stringify({
      type: 'script',
      name: '助手脚本',
      content: "console.log('ok')",
    })).kind,
    'script',
  );

  assert.equal(
    detectUploadKind('preset.json', JSON.stringify({ temperature: 0.8, top_p: 0.9 })).kind,
    'preset',
  );
});

test('unknown json stays editable as data instead of being guessed dangerously', () => {
  const detected = detectUploadKind('unknown.json', JSON.stringify({ hello: 'world' }));
  assert.equal(detected.kind, 'data');
  assert.equal(detected.confidence, 'unknown');
});

test('detected script uploads keep a safe character scope by default', () => {
  const result = buildDetectedUploadBundle(
    { category: 'extension' },
    'helper.js',
    "console.log('ok')",
  );
  assert.equal(result.bundle.artifacts[0].kind, 'script');
  assert.equal(result.bundle.artifacts[0].scope, 'character');
});

test('complete workshop bundles pass through without manual type selection', () => {
  const source = {
    schema_version: 1,
    artifacts: [{
      kind: 'data',
      name: 'notes.txt',
      format: 'text',
      content: 'hello',
    }],
  };
  const result = buildDetectedUploadBundle(
    { category: 'extension' },
    'bundle.json',
    JSON.stringify(source),
  );
  assert.equal(result.detected.kind, 'bundle');
  assert.deepEqual(result.bundle, source);
});
