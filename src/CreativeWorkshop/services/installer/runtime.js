import { getInstalledProject, putInstalledProject } from '../storage.js';
import { createTavernAdapter } from '../tavern-adapter.js';
import { applyProject } from './apply.js';
import { uninstallProject } from './uninstall.js';

export function createWorkshopInstaller({
  adapter = createTavernAdapter(),
  storage = { getInstalledProject, putInstalledProject },
} = {}) {
  const context = { adapter, storage };
  return {
    apply: projectId => applyProject(context, projectId),
    uninstall: projectId => uninstallProject(context, projectId),
  };
}

export const workshopInstaller = createWorkshopInstaller();
