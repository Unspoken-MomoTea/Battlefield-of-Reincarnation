import { SHARED_WORLDBOOK_NAME } from './constants.js';
import { isProjectScriptTree, isProjectWorldbookEntry, provenance, regexPrefix } from './ownership.js';
import { buildArtifactPlan } from './plan.js';
import { syncOriginalWorldbookConflicts } from './original-conflicts.js';
import { syncOriginalScriptConflicts } from './original-scripts.js';
import { syncOriginalRegexConflicts } from './original-regexes.js';
import { createInstallSnapshot, restoreInstallSnapshot } from './snapshot.js';
import { clone, maybe, record } from './utils.js';

export async function applyProject({ adapter, storage }, projectId) {
  const installed = await storage.getInstalledProject(projectId);
  if (!installed) throw new Error('本地没有这个作品，请先下载');
  const plan = buildArtifactPlan(installed);
  const oldTargets = installed.installTargets ?? {};
  const scriptCount = Object.values(plan.scripts ?? {}).reduce((sum, trees) => sum + trees.length, 0);
  const stateOverrideCount =
    (plan.originalConflicts?.length ?? 0) +
    (plan.originalRegexConflicts?.length ?? 0) +
    (plan.originalScriptConflicts?.length ?? 0);
  const oldManagedCount =
    (oldTargets.worldbook ? 1 : 0) +
    (oldTargets.regexIds?.length ?? 0) +
    Object.values(oldTargets.scripts ?? {}).reduce((sum, ids) => sum + (ids?.length ?? 0), 0) +
    (oldTargets.presets?.length ?? 0) +
    (oldTargets.originalWorldbookChanges?.length ?? 0) +
    (oldTargets.originalRegexChanges?.length ?? 0) +
    (oldTargets.originalScriptChanges?.length ?? 0);
  if (
    !plan.worldbook.length &&
    !plan.regexes.length &&
    !plan.presets.length &&
    !scriptCount &&
    !stateOverrideCount &&
    !oldManagedCount
  ) {
    throw new Error('这个作品目前只有 data artifact，没有可直接安装到酒馆的内容');
  }

  const characterNeeded = Boolean(
    plan.worldbook.length ||
    plan.regexes.length ||
    plan.scripts?.character?.length ||
    oldTargets.worldbook ||
    oldTargets.regexIds?.length ||
    plan.originalRegexConflicts?.length ||
    oldTargets.originalRegexChanges?.length ||
    oldTargets.scripts?.character?.length ||
    plan.originalConflicts?.length ||
    oldTargets.originalWorldbookChanges?.length ||
    plan.originalScriptConflicts?.some(item => item.target?.scope === 'character') ||
    oldTargets.originalScriptChanges?.some(item => item.scope === 'character')
  );
  const currentCharacter = characterNeeded ? await maybe(adapter.getCurrentCharacterName()) : null;
  if (characterNeeded && !currentCharacter) throw new Error('请先在酒馆中打开一个角色卡，再安装世界书或正则');
  if (installed.applied && installed.targetCharacterName && installed.targetCharacterName !== currentCharacter) {
    throw new Error(`该作品当前安装在角色“${installed.targetCharacterName}”，请切回该角色后再更新或卸载`);
  }

  const state = await createInstallSnapshot(adapter, installed, plan, characterNeeded);
  try {
    if (state.worldbook) {
      const previous = state.worldbook.entries.filter(entry => !isProjectWorldbookEntry(entry, installed.id));
      const nextEntries = [...previous, ...plan.worldbook];
      if (nextEntries.length) {
        await maybe(adapter.createOrReplaceWorldbook(SHARED_WORLDBOOK_NAME, nextEntries));
        if (plan.worldbook.length) {
          const binding = await maybe(adapter.getCharWorldbookNames());
          if (!binding.additional.includes(SHARED_WORLDBOOK_NAME)) {
            await maybe(adapter.rebindCharWorldbooks({
              primary: binding.primary,
              additional: [...new Set([...binding.additional, SHARED_WORLDBOOK_NAME])],
            }));
          }
        } else if (oldTargets.worldbookBound && !previous.some(entry => record(provenance(entry))?.sourceId)) {
          const binding = await maybe(adapter.getCharWorldbookNames());
          await maybe(adapter.rebindCharWorldbooks({
            primary: binding.primary,
            additional: binding.additional.filter(name => name !== SHARED_WORLDBOOK_NAME),
          }));
        }
      } else {
        await maybe(adapter.deleteWorldbook(SHARED_WORLDBOOK_NAME));
        const binding = await maybe(adapter.getCharWorldbookNames());
        await maybe(adapter.rebindCharWorldbooks({
          primary: binding.primary,
          additional: binding.additional.filter(name => name !== SHARED_WORLDBOOK_NAME),
        }));
      }
    }

    if (state.regexes) {
      const previous = state.regexes.filter(regex => !String(regex.id || '').startsWith(regexPrefix(installed.id)));
      await maybe(adapter.replaceCharacterRegexes([...previous, ...plan.regexes]));
    }

    const originalRegexResult = await syncOriginalRegexConflicts(
      { adapter, storage },
      installed,
      plan,
    );

    for (const [scope, currentTrees] of state.scripts.entries()) {
      const previous = currentTrees.filter(tree => !isProjectScriptTree(tree, installed.id));
      await maybe(adapter.replaceScriptTrees([...previous, ...(plan.scripts?.[scope] ?? [])], scope));
    }

    const originalScriptResult = await syncOriginalScriptConflicts(
      { adapter, storage },
      installed,
      plan,
      state,
    );

    const newPresetNames = new Set(plan.presets.map(item => item.name));
    const previousPresetBackups = oldTargets.presetBackups ?? {};
    for (const oldName of oldTargets.presets ?? []) {
      if (newPresetNames.has(oldName)) continue;
      const backup = previousPresetBackups[oldName];
      if (backup?.existed) await maybe(adapter.createOrReplacePreset(oldName, backup.content));
      else await maybe(adapter.deletePreset(oldName));
    }
    for (const preset of plan.presets) await maybe(adapter.createOrReplacePreset(preset.name, preset.content));

    const originalConflictResult = await syncOriginalWorldbookConflicts(
      { adapter, storage },
      installed,
      plan,
      state,
    );

    const presetBackups = {};
    for (const preset of plan.presets) {
      presetBackups[preset.name] = previousPresetBackups[preset.name] ?? (() => {
        const previous = state.presets.get(preset.name);
        return previous ? { existed: previous.existed, content: clone(previous.content) } : { existed: false, content: null };
      })();
    }
    const worldbookWasBound = Boolean(state.binding?.additional?.includes(SHARED_WORLDBOOK_NAME));
    const next = {
      ...installed,
      applied: true, appliedVersion: installed.version, appliedAt: Date.now(),
      targetCharacterName: characterNeeded ? currentCharacter : null,
      installTargets: {
        worldbook: plan.worldbook.length ? SHARED_WORLDBOOK_NAME : null,
        worldbookCreated: plan.worldbook.length > 0 ? Boolean(oldTargets.worldbookCreated || !state.worldbook?.existed) : false,
        worldbookBound: plan.worldbook.length > 0 ? Boolean(oldTargets.worldbookBound || !worldbookWasBound) : false,
        regexIds: plan.regexes.map(regex => regex.id),
        scripts: Object.fromEntries(
          ['character', 'preset', 'global'].map(scope => [
            scope,
            (plan.scripts?.[scope] ?? []).map(tree => tree.id),
          ]),
        ),
        presets: plan.presets.map(item => item.name),
        presetBackups,
        originalWorldbookChanges: originalConflictResult.changes,
        originalRegexChanges: originalRegexResult.changes,
        originalScriptChanges: originalScriptResult.changes,
      },
      restoreWarnings: [
        ...originalConflictResult.warnings,
        ...originalRegexResult.warnings,
        ...originalScriptResult.warnings,
      ],
      unrestoredOriginals: [
        ...originalConflictResult.unrestored,
        ...originalRegexResult.unrestored,
        ...originalScriptResult.unrestored,
      ],
      applyError: '',
    };
    await storage.putInstalledProject(next);
    return next;
  } catch (error) {
    const rollbackErrors = await restoreInstallSnapshot(adapter, state);
    const baseMessage = error instanceof Error ? error.message : String(error);
    const rollbackMessage = rollbackErrors.length ? `；另有 ${rollbackErrors.length} 个回滚步骤失败，请检查酒馆资源` : '';
    await storage.putInstalledProject({
      ...installed, applyError: `${baseMessage}${rollbackMessage}`, updatedAt: Date.now(),
    });
    throw error;
  }
}
