import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('opening delivery is built from modular sources without Markdown fences', () => {
  const template = read('src/opening/page/template.html');
  const delivery = read('dist/opening/entry.html');
  const legacy = read('Regular/开局.html');
  assert.match(template, /^<!DOCTYPE html>/u);
  assert.doesNotMatch(template, /^```/u);
  assert.equal(delivery, legacy);
  assert.match(delivery, /^<!DOCTYPE html>/u);
  assert.doesNotMatch(delivery, /^```/u);
  assert.doesNotMatch(delivery, /```\s*$/u);
  assert.match(delivery, /class="wizard-layout"/u);
  assert.match(delivery, /async function executeJourney\(\)/u);
});

test('builder keeps the ordered opening runtime seams', () => {
  const builder = read('tools/build-opening.py');
  for (const part of ['00-database.js','10-core-assets.js','20-variable-init.js','30-character.js','40-store.js','50-partner-plot.js','60-navigation-presets.js','70-journey.js']) {
    assert.ok(builder.includes(part), `builder includes ${part}`);
  }
});
