import { getInstalledProject, putInstalledProject } from '../storage.js';
import { createTavernAdapter } from '../tavern-adapter.js';
import { applyProject } from './apply.js';
import { analyzeInstallConflicts } from './conflicts.js';
import { buildArtifactPlan } from './plan.js';
import { inspectProjectInstallation, repairInstalledProject } from './repair.js';
import { uninstallProject } from './uninstall.js';

export function createWorkshopInstaller({
  adapter = createTavernAdapter(),
  storage = { getInstalledProject, putInstalledProject },
} = {}) {
  const context = { adapter, storage };
  return {
    apply: projectId => applyProject(context, projectId),
    uninstall: projectId => uninstallProject(context, projectId),
    async preflight(projectId) {
      const installed = await storage.getInstalledProject(projectId);
      if (!installed) throw new Error('本地没有这个作品，请先下载');
      return analyzeInstallConflicts(adapter, installed, buildArtifactPlan(installed));
    },
    inspect: projectId => inspectProjectInstallation(context, projectId),
    repair: projectId => repairInstalledProject(context, projectId),
  };
}

export const workshopInstaller = createWorkshopInstaller();
