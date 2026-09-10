const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'script', 'world-engine-src');
const delivery = path.join(root, 'script', '世界推进系统.js');
const parts = [
  '00-foundation-prompt.part.js',
  '10-world-state.part.js',
  '20-world-result.part.js',
  '30-context-protocol.part.js',
  '40-engine-runtime.part.js',
  '50-engine-ui.part.js',
  '55-policy-compat.part.js',
  '60-bootstrap.part.js',
];

for (const name of parts) assert.ok(fs.existsSync(path.join(srcDir, name)), `missing source part ${name}`);
const texts = Object.fromEntries(parts.map(name => [name, fs.readFileSync(path.join(srcDir, name), 'utf8')]));
const assembled = parts.map(name => texts[name]).join('');
const output = fs.readFileSync(delivery, 'utf8');
assert.equal(assembled, output, 'source parts must reproduce the checked-in single-file delivery byte-for-byte');

assert.ok(texts['00-foundation-prompt.part.js'].startsWith('/* 轮回战场 · 世界引擎\n'), 'foundation part must own the delivery header');
assert.ok(texts['00-foundation-prompt.part.js'].includes('(function (root) {'), 'foundation part must open the shared IIFE');
assert.match(texts['00-foundation-prompt.part.js'], /const DEFAULT_PRESET = `/);
assert.match(texts['10-world-state.part.js'], /^    const RECORDS = \{/);
assert.match(texts['10-world-state.part.js'], /function compactWorldLifecycle\(/);
assert.match(texts['20-world-result.part.js'], /^    const CURRENCY_FIELDS=/);
assert.match(texts['20-world-result.part.js'], /const WORLD_RESULT_SCHEMA=\{/);
assert.match(texts['20-world-result.part.js'], /function compileWorldResult\(/);
assert.match(texts['30-context-protocol.part.js'], /^    function activation\(/);
assert.match(texts['30-context-protocol.part.js'], /function projectWorldContext\(/);
assert.match(texts['30-context-protocol.part.js'], /function protocol\(\)/);
assert.match(texts['40-engine-runtime.part.js'], /^    class SamsaraWorldEngine \{/);
assert.match(texts['40-engine-runtime.part.js'], /async requestDedicatedApi\(/);
assert.match(texts['40-engine-runtime.part.js'], /async run\(/);
assert.doesNotMatch(texts['40-engine-runtime.part.js'], /        createPanel\(\) \{/);
assert.match(texts['50-engine-ui.part.js'], /^        createPanel\(\) \{/);
assert.match(texts['50-engine-ui.part.js'], /        render\(force\) \{/);
assert.match(texts['50-engine-ui.part.js'], /        dispose\(\) \{/);
assert.match(texts['55-policy-compat.part.js'], /^    \/\/ 可选策略层/);
assert.match(texts['55-policy-compat.part.js'], /npcBuildAuditEnabled/);
assert.match(texts['55-policy-compat.part.js'], /事件前因不存在/);
assert.match(texts['60-bootstrap.part.js'], /^    \/\/ CommonJS 入口仅供离线测试/);
assert.match(texts['60-bootstrap.part.js'], /module\.exports/);
assert.match(texts['60-bootstrap.part.js'], /\}\)\(typeof window !== 'undefined' \? window : globalThis\);\s*$/);

for (const name of parts) {
  assert.doesNotMatch(texts[name], /^\s*(?:import|export)\s/m, `${name} must not introduce runtime ES modules`);
}

execFileSync('python', [path.join(root, 'tools', 'build-world-engine.py'), '--check'], {cwd: root, stdio: 'pipe'});
console.log(`world-engine module contract passed: ${parts.length} parts, delivery=${output.length} chars`);
