import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileAppliedOpeningData } from '../services/projects/opening-reconcile.js';

function partnerProject() {
  return {
    id: 'remote-partner',
    name: '正式伙伴',
    category: 'character',
    version: 1,
    applied: true,
    appliedVersion: 1,
    bundle: {
      schema_version: 1,
      artifacts: [{
        kind: 'data',
        name: '正式伙伴.opening.json',
        format: 'json',
        content: {
          schema_version: 1,
          kind: 'opening_partner',
          name: '正式伙伴',
          build: { 种族: '人类', 层级: 'Ⅰ', 血统: { 人类: { 品质: 'F' } } },
        },
      }],
    },
  };
}

test('reconcile rebuilds missing opening registries for already-applied remote projects', async () => {
  const project = partnerProject();
  const writes = [];
  const assetCalls = [];
  const storeCalls = [];

  const result = await reconcileAppliedOpeningData({
    listInstalled: async () => [structuredClone(project)],
    putInstalled: async value => writes.push(structuredClone(value)),
    replaceAssets: async (installed, data) => {
      assetCalls.push({ installed: structuredClone(installed), data: structuredClone(data) });
      return 1;
    },
    replaceStoreCatalogs: async (installed, data) => {
      storeCalls.push({ installed: structuredClone(installed), data: structuredClone(data) });
      return 0;
    },
  });

  assert.equal(assetCalls.length, 1);
  assert.equal(assetCalls[0].data[0].content.kind, 'opening_partner');
  assert.equal(storeCalls.length, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].openingAssetCount, 1);
  assert.equal(writes[0].openingStoreCatalogCount, 0);
  assert.equal(result.reconciled, 1);
  assert.equal(result.failed, 0);
});

test('reconcile ignores cached projects that are not applied', async () => {
  const project = { ...partnerProject(), applied: false, appliedVersion: null };
  let writes = 0;
  const result = await reconcileAppliedOpeningData({
    listInstalled: async () => [project],
    putInstalled: async () => { writes += 1; },
    replaceAssets: async () => { throw new Error('must not run'); },
    replaceStoreCatalogs: async () => { throw new Error('must not run'); },
  });
  assert.equal(result.reconciled, 0);
  assert.equal(writes, 0);
});
