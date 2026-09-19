import { getInstalledProject, getInstalledProjects, putInstalledProject } from '../storage.js';
import { createTavernAdapter } from '../tavern-adapter.js';
import { applyProject } from './apply.js';
import { analyzeInstallConflicts } from './conflicts.js';
import { analyzeProjectDependencies } from './dependencies.js';
import { buildArtifactPlan } from './plan.js';
import { inspectProjectInstallation, repairInstalledProject } from './repair.js';
import { uninstallProject } from './uninstall.js';

export function createWorkshopInstaller({
  adapter = createTavernAdapter(),
  storage = { getInstalledProject, getInstalledProjects, putInstalledProject },
} = {}) {
  const context = { adapter, storage };

  async function preflight(projectId) {
    const installed = await storage.getInstalledProject(projectId);
    if (!installed) throw new Error('本地没有这个作品，请先下载');

    const [resourceConflicts, dependencyConflicts] = await Promise.all([
      analyzeInstallConflicts(adapter, installed, buildArtifactPlan(installed)),
      analyzeProjectDependencies(
        installed,
        typeof storage.getInstalledProjects === 'function'
          ? () => storage.getInstalledProjects()
          : async () => [],
      ),
    ]);

    return {
      blocking: [...dependencyConflicts.blocking, ...resourceConflicts.blocking],
      warnings: [...dependencyConflicts.warnings, ...resourceConflicts.warnings],
    };
  }

  return {
    async apply(projectId) {
      const result = await preflight(projectId);
      if (result.blocking.length) {
        throw new Error(`当前无法安装：${result.blocking.map(item => item.type).join(', ')}`);
      }
      return applyProject(context, projectId);
    },
    uninstall: projectId => uninstallProject(context, projectId),
    preflight,
    inspect: projectId => inspectProjectInstallation(context, projectId),
    repair: projectId => repairInstalledProject(context, projectId),
  };
}

export const workshopInstaller = createWorkshopInstaller();
