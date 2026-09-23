import assert from 'node:assert/strict';
import test from 'node:test';

import { workshopTemplate } from '../ui/template.js';
import {
  listOpeningAssetsByProject,
  replaceProjectOpeningAssets,
} from '../../opening/character-assets/registry.js';
import {
  listProjectStoreCatalogs,
  replaceProjectStoreCatalogs,
} from '../../opening/store/installed-catalogs.js';

test('publish shell uses one category selector plus character subtype and dynamic dedicated editor host', () => {
  const html = workshopTemplate('test');
  assert.match(html, /<option value="store_catalog">开局商店<\/option>/u);
  assert.match(html, /<option value="character">角色<\/option>/u);
  assert.match(html, /name="character_kind"/u);
  assert.match(html, /data-role="dedicated-editor-host"/u);
  assert.doesNotMatch(html, /name="extension_kind"/u);
  assert.doesNotMatch(html, /data-field="create-data"/u);
  assert.doesNotMatch(html, /opening_bloodline[^_]/u);
  assert.doesNotMatch(html, /store_equipments/u);
  assert.match(html, /data-role="publish-resource-section"/u);
});

test('installer snapshots remain usable in non-browser contract tests', async () => {
  assert.deepEqual(await listOpeningAssetsByProject('project:test'), []);
  assert.deepEqual(await listProjectStoreCatalogs('project:test'), []);
  assert.equal(await replaceProjectOpeningAssets({ id: 'project:test' }, []), 0);
  assert.equal(await replaceProjectStoreCatalogs({ id: 'project:test' }, []), 0);
});

test('browser-only opening payloads fail clearly when IndexedDB is unavailable', async () => {
  await assert.rejects(
    replaceProjectOpeningAssets(
      { id: 'project:test', name: 'Test', version: 1 },
      [{ content: { kind: 'opening_character', build: { 种族: '人类' } } }],
    ),
    /IndexedDB/,
  );
  await assert.rejects(
    replaceProjectStoreCatalogs(
      { id: 'project:test', name: 'Test', version: 1 },
      [{ content: { kind: 'store_catalog', catalog: { equipments: [] } } }],
    ),
    /IndexedDB/,
  );
});


test('specialized editor source is form-driven and contains no JSON code textarea contract', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = fs.readFileSync(fileURLToPath(new URL('../views/author/dedicated-editor.js', import.meta.url)), 'utf8');
  assert.match(source, /\+ 添加商品/u);
  assert.match(source, /删除/u);
  assert.match(source, /最多 2 项/u);
  assert.match(source, /OPENING_RANKS = \['Ⅰ', 'Ⅱ', 'Ⅲ'\]/u);
  assert.match(source, /STORE_QUALITIES = \['F', 'E', 'D'\]/u);
  assert.match(source, /budget = partner \? 16 : 8/u);
  assert.match(source, /\+ 添加效果/u);
  assert.match(source, /if \(state\.length >= max\) return/u);
  assert.match(source, /\+ 添加装备/u);
  assert.doesNotMatch(source, /JSON\.parse/u);
  assert.doesNotMatch(source, /rw-code-input/u);
});


test('creator styles hide the character subtype outside character category and keep compact grids inside bounds', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = fs.readFileSync(fileURLToPath(new URL('../ui/styles.js', import.meta.url)), 'utf8');
  assert.match(source, /\.rw-field\[hidden\]\{display:none!important\}/u);
  assert.match(source, /\.rw-field>\.rw-input,[\s\S]*max-width:100%/u);
  assert.match(source, /\.rw-point-grid\{[\s\S]*repeat\(auto-fit,minmax\(82px,1fr\)\)/u);
  assert.match(source, /\.rw-store-attr-grid,[\s\S]*repeat\(auto-fit,minmax\(78px,1fr\)\)/u);
});
