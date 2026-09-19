import { SHARED_WORLDBOOK_NAME } from './constants.js';
import { isProjectWorldbookEntry, provenance, regexPrefix } from './ownership.js';
import { createInstallSnapshot, restoreInstallSnapshot } from './snapshot.js';
import { maybe, record } from './utils.js';

export async function uninstallProject({ adapter, storage }, projectId) {
  const installed = await storage.getInstalledProject(projectId);
  if (!installed) return null;
  if (!installed.applied) return installed;
  const targets = installed.installTargets ?? {};
  const characterNeeded = Boolean(targets.worldbook || targets.regexIds?.length);
  const currentCharacter = characterNeeded ? await maybe(adapter.getCurrentCharacterName()) : null;
  if (installed.targetCharacterName && installed.targetCharacterName !== currentCharacter) {
    throw new Error(`该作品安装在角色“${installed.targetCharacterName}”，请切回该角色后再卸载`);
  }

  const state = await createInstallSnapshot(adapter, installed, { worldbook: [], regexes: [], presets: [], data: [] }, characterNeeded);
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
    for (const presetName of targets.presets ?? []) {
      const backup = targets.presetBackups?.[presetName];
      if (backup?.existed) await maybe(adapter.createOrReplacePreset(presetName, backup.content));
      else await maybe(adapter.deletePreset(presetName));
    }

    const next = {
      ...installed, applied: false, appliedVersion: null, appliedAt: null,
      targetCharacterName: null, installTargets: null, applyError: '', updatedAt: Date.now(),
    };
    await storage.putInstalledProject(next);
    return next;
  } catch (error) {
    await restoreInstallSnapshot(adapter, state);
    throw error;
  }
}
