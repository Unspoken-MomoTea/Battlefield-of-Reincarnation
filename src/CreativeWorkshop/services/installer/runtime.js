import { getInstalledProject, getInstalledProjects, putInstalledProject } from '../storage.js';
import { createTavernAdapter } from '../tavern-adapter.js';
import { applyProject } from './apply.js';
import { analyzeInstallConflicts } from './conflicts.js';
import { analyzeProjectDependencies } from './dependencies.js';
import { buildArtifactPlan } from './plan.js';
import { inspectProjectInstallation, repairInstalledProject } from './repair.js';
import { uninstallProject } from './uninstall.js';
import { withWorkshopMutation } from './mutation-lock.js';
import { validateOriginalStates } from './state-preflight.js';

export function createWorkshopInstaller({
  adapter = createTavernAdapter(),
  storage = { getInstalledProject, getInstalledProjects, putInstalledProject },
} = {}) {
  const context = { adapter, storage };

  async function preflight(projectId) {
    const installed = await storage.getInstalledProject(projectId);
    if (!installed) throw new Error('本地没有这个作品，请先下载');
    const plan = buildArtifactPlan(installed);

    const [resourceConflicts, dependencyConflicts] = await Promise.all([
      analyzeInstallConflicts(adapter, installed, plan),
      analyzeProjectDependencies(
        installed,
        typeof storage.getInstalledProjects === 'function'
          ? () => storage.getInstalledProjects()
          : async () => [],
        installed.dependencies?.length ? await adapter.getCurrentCharacterName() : undefined,
      ),
    ]);

    if (!resourceConflicts.blocking.length && !dependencyConflicts.blocking.length) {
      try { await validateOriginalStates(context, installed, plan); }
      catch (error) { resourceConflicts.blocking.push({ type: 'original_state_conflict', message: error.message }); }
    }
    return {
      blocking: [...dependencyConflicts.blocking, ...resourceConflicts.blocking],
      warnings: [...dependencyConflicts.warnings, ...resourceConflicts.warnings],
    };
  }

  return {
    apply: (projectId, mutationToken) => withWorkshopMutation(async () => {
      const result = await preflight(projectId);
      if (result.blocking.length) {
        throw new Error(`当前无法安装：${result.blocking.map(item => item.message || item.type).join(', ')}`);
      }
      return applyProject(context, projectId);
    }, mutationToken),
    uninstall: projectId => withWorkshopMutation(() => uninstallProject(context, projectId)),
    preflight,
    inspect: projectId => withWorkshopMutation(() => inspectProjectInstallation(context, projectId)),
    repair: projectId => withWorkshopMutation(async () => {
      const result = await preflight(projectId);
      if (result.blocking.length) throw new Error(`当前无法修复：${result.blocking.map(item => item.type).join(', ')}`);
      return repairInstalledProject(context, projectId);
    }),
  };
}

export const workshopInstaller = createWorkshopInstaller();
