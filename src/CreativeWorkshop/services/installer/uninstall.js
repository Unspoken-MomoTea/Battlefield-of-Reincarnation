import { removeOpeningAssetsByProject } from '../../../opening/character-assets/registry.js';
import { SHARED_WORLDBOOK_NAME } from './constants.js';
import { isProjectScriptTree, isProjectWorldbookEntry, provenance, regexPrefix } from './ownership.js';
import { restoreOriginalWorldbookConflicts } from './original-conflicts.js';
import { restoreOriginalScriptConflicts } from './original-scripts.js';
import { restoreOriginalRegexConflicts } from './original-regexes.js';
import { createInstallSnapshot, restoreInstallSnapshot } from './snapshot.js';
import { maybe, record } from './utils.js';

export async function uninstallProject({ adapter, storage }, projectId) {
  const installed = await storage.getInstalledProject(projectId);
  if (!installed) return null;
  if (!installed.applied) return installed;
  const projects = typeof storage.getInstalledProjects === 'function' ? await storage.getInstalledProjects() : [];
  const dependents = projects.filter(project => project.applied && project.id !== projectId &&
    (project.appliedDependencies ?? project.dependencies ?? []).some(dependency => dependency.project_id === projectId));
  if (dependents.length) {
    throw new Error(`请先卸载依赖此作品的 Mod：${dependents.map(project => project.name || project.id).join('、')}`);
  }
  const targets = installed.installTargets ?? {};
  const characterNeeded = Boolean(
    targets.worldbook ||
    targets.regexIds?.length ||
    targets.originalRegexChanges?.length ||
    targets.scripts?.character?.length ||
    targets.originalWorldbookChanges?.length ||
    targets.originalScriptChanges?.some(item => item.scope === 'character')
  );
  const currentCharacter = characterNeeded ? await maybe(adapter.getCurrentCharacterName()) : null;
  if (installed.targetCharacterName && installed.targetCharacterName !== currentCharacter) {
    throw new Error(`该作品安装在角色“${installed.targetCharacterName}”，请切回该角色后再卸载`);
  }

  const state = await createInstallSnapshot(
    adapter,
    installed,
    {
      worldbook: [],
      regexes: [],
      presets: [],
      scripts: { character: [], preset: [], global: [] },
      data: [],
      originalConflicts: [],
      originalRegexConflicts: [],
      originalScriptConflicts: [],
    },
    characterNeeded,
  );
  try {
    if (targets.worldbook && state.worldbook) {
      const remaining = state.worldbook.entries.filter(entry => !isProjectWorldbookEntry(entry, installed.id));
      const otherWorkshopEntries = remaining.some(entry => record(provenance(entry))?.sourceId);
      if (remaining.length || !targets.worldbookCreated) await maybe(adapter.createOrReplaceWorldbook(SHARED_WORLDBOOK_NAME, remaining));
      else await maybe(adapter.deleteWorldbook(SHARED_WORLDBOOK_NAME));

      if (targets.worldbookBound && !otherWorkshopEntries) {
        const binding = await maybe(adapter.getCharWorldbookNames());
        await maybe(adapter.rebindCharWorldbooks({
          primary: binding.primary,
          additional: binding.additional.filter(name => name !== SHARED_WORLDBOOK_NAME),
        }));
      }
    }

    if (targets.regexIds?.length && state.regexes) {
      await maybe(adapter.replaceCharacterRegexes(
        state.regexes.filter(regex => !String(regex.id || '').startsWith(regexPrefix(installed.id))),
      ));
    }

    const regexRestoreResult = await restoreOriginalRegexConflicts(
      { adapter, storage },
      installed,
    );

    for (const [scope, trees] of state.scripts.entries()) {
      await maybe(adapter.replaceScriptTrees(
        trees.filter(tree => !isProjectScriptTree(tree, installed.id)),
        scope,
      ));
    }

    const scriptRestoreResult = await restoreOriginalScriptConflicts(
      { adapter, storage },
      installed,
      state,
    );

    for (const presetName of targets.presets ?? []) {
      const backup = targets.presetBackups?.[presetName];
      if (backup?.existed) await maybe(adapter.createOrReplacePreset(presetName, backup.content));
      else await maybe(adapter.deletePreset(presetName));
    }

    const restoreResult = await restoreOriginalWorldbookConflicts(
      { adapter, storage },
      installed,
      state,
    );

    await removeOpeningAssetsByProject(installed.id);

    const next = {
      ...installed,
      applied: false,
      appliedVersion: null,
      appliedDependencies: null,
      appliedAt: null,
      targetCharacterName: null,
      installTargets: null,
      restoreWarnings: [
        ...restoreResult.warnings,
        ...regexRestoreResult.warnings,
        ...scriptRestoreResult.warnings,
      ],
      unrestoredOriginals: [
        ...restoreResult.unrestored,
        ...regexRestoreResult.unrestored,
        ...scriptRestoreResult.unrestored,
      ],
      applyError: '',
      openingAssetCount: 0,
      updatedAt: Date.now(),
    };
    await storage.putInstalledProject(next);
    return next;
  } catch (error) {
    await restoreInstallSnapshot(adapter, state);
    throw error;
  }
}
