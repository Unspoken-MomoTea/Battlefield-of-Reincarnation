import assert from 'node:assert/strict';
import test from 'node:test';

import { collectWorkshopNodes } from '../ui/nodes.js';
import {
  listOpeningAssetsByProject,
  replaceProjectOpeningAssets,
} from '../../opening/character-assets/registry.js';
import {
  listProjectStoreCatalogs,
  replaceProjectStoreCatalogs,
} from '../../opening/store/installed-catalogs.js';

test('publish shell collects the opening data upload input', () => {
  const overlay = {
    querySelector: selector => selector,
    querySelectorAll: () => [],
  };
  const nodes = collectWorkshopNodes(overlay);
  assert.equal(nodes.createData, '[data-field="create-data"]');
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
