import {
  getInstalledProjects,
  putInstalledProject,
} from '../storage.js';
import { buildArtifactPlan } from '../installer/plan.js';
import {
  replaceProjectOpeningAssets,
} from '../../../opening/character-assets/registry.js';
import {
  replaceProjectStoreCatalogs,
} from '../../../opening/store/installed-catalogs.js';

function dataKinds(data = []) {
  const kinds = new Set();
  for (const artifact of data) {
    const values = Array.isArray(artifact?.content) ? artifact.content : [artifact?.content];
    for (const value of values) {
      const kind = String(value?.kind || '').trim();
      if (kind) kinds.add(kind);
    }
  }
  return kinds;
}

export async function reconcileAppliedOpeningData({
  listInstalled = getInstalledProjects,
  putInstalled = putInstalledProject,
  buildPlan = buildArtifactPlan,
  replaceAssets = replaceProjectOpeningAssets,
  replaceStoreCatalogs = replaceProjectStoreCatalogs,
} = {}) {
  const projects = await listInstalled();
  const items = [];
  let reconciled = 0;
  let failed = 0;

  for (const installed of Array.isArray(projects) ? projects : []) {
    if (!installed?.applied) continue;

    try {
      const plan = buildPlan(installed);
      const kinds = dataKinds(plan.data);
      const relevant = (
        kinds.has('opening_character')
        || kinds.has('opening_partner')
        || kinds.has('store_catalog')
        || Number(installed.openingAssetCount || 0) > 0
        || Number(installed.openingStoreCatalogCount || 0) > 0
      );
      if (!relevant) continue;

      const openingAssetCount = await replaceAssets(installed, plan.data);
      const openingStoreCatalogCount = await replaceStoreCatalogs(installed, plan.data);
      const countsChanged = (
        Number(installed.openingAssetCount ?? -1) !== Number(openingAssetCount)
        || Number(installed.openingStoreCatalogCount ?? -1) !== Number(openingStoreCatalogCount)
      );

      if (countsChanged) {
        await putInstalled({
          ...installed,
          openingAssetCount,
          openingStoreCatalogCount,
        });
      }

      reconciled += 1;
      items.push({
        id: installed.id,
        name: installed.name || '',
        openingAssetCount,
        openingStoreCatalogCount,
        repaired: countsChanged,
      });
    } catch (error) {
      failed += 1;
      items.push({
        id: installed?.id || '',
        name: installed?.name || '',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { reconciled, failed, items };
}
