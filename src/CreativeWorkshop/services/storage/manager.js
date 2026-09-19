import {
  deleteInstalledProject,
  deleteMetaRecord,
  getInstalledProjects,
} from '../storage.js';

const UPDATE_CHECK_META_KEY = 'project-update-check';

function jsonBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return 0;
  }
}

export function summarizeProjectStorage(projects) {
  let logicalBytes = 0;
  let cacheOnlyBytes = 0;
  let appliedCount = 0;
  let cacheOnlyCount = 0;

  for (const project of projects) {
    const bytes = jsonBytes(project);
    logicalBytes += bytes;
    if (project?.applied) {
      appliedCount += 1;
    } else {
      cacheOnlyCount += 1;
      cacheOnlyBytes += bytes;
    }
  }

  return {
    projectCount: projects.length,
    appliedCount,
    cacheOnlyCount,
    logicalBytes,
    cacheOnlyBytes,
  };
}

async function defaultStorageEstimate() {
  try {
    const estimate = await globalThis.navigator?.storage?.estimate?.();
    return estimate ?? {};
  } catch {
    return {};
  }
}

export function createStorageManager({
  listProjects,
  deleteProject,
  deleteMeta,
  storageEstimate = defaultStorageEstimate,
}) {
  return {
    async estimate() {
      const projects = await listProjects();
      const summary = summarizeProjectStorage(projects);
      const origin = await storageEstimate();
      const originUsage = Number(origin?.usage || 0);
      const originQuota = Number(origin?.quota || 0);
      return {
        ...summary,
        originUsage,
        originQuota,
        originUsageRatio: originQuota > 0 ? originUsage / originQuota : 0,
      };
    },

    async cleanupCacheOnly() {
      const projects = await listProjects();
      const removable = projects.filter(project => !project?.applied);
      for (const project of removable) {
        await deleteProject(project.id);
      }
      await deleteMeta(UPDATE_CHECK_META_KEY);
      return {
        removedCount: removable.length,
        removedIds: removable.map(project => project.id),
        remainingAppliedCount: projects.length - removable.length,
      };
    },
  };
}

export const storageManager = createStorageManager({
  listProjects: getInstalledProjects,
  deleteProject: deleteInstalledProject,
  deleteMeta: deleteMetaRecord,
});
