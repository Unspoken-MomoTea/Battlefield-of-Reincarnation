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

test('publish shell uses dedicated opening and store editors instead of one generic opening-data upload', () => {
  const html = workshopTemplate('test');
  assert.match(html, /data-publish-panel="opening_character"/u);
  assert.match(html, /data-publish-panel="store_catalog"/u);
  assert.match(html, /name="extension_kind"/u);
  assert.doesNotMatch(html, /data-field="create-data"/u);
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
