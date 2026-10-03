import { SHARED_WORLDBOOK_NAME } from './constants.js';
import { clone, maybe } from './utils.js';

export async function createInstallSnapshot(adapter, installed, plan, characterNeeded) {
  const oldTargets = installed.installTargets ?? {};
  const worldbookAffected = Boolean(oldTargets.worldbook || plan.worldbook.length);
  const regexAffected = Boolean(
    (oldTargets.regexIds?.length ?? 0) ||
    plan.regexes.length ||
    (oldTargets.originalRegexChanges?.length ?? 0) ||
    (plan.originalRegexConflicts?.length ?? 0)
  );
  const conflictAffected = Boolean(
    (oldTargets.originalWorldbookChanges?.length ?? 0) || (plan.originalConflicts?.length ?? 0),
  );
  const presetNames = [...new Set([...(oldTargets.presets ?? []), ...plan.presets.map(item => item.name)])];
  const originalScriptScopes = new Set([
    ...(oldTargets.originalScriptChanges ?? []).map(item => item.scope),
    ...(plan.originalScriptConflicts ?? []).map(item => item.target?.scope),
  ].filter(Boolean));
  const scriptScopes = ['character', 'preset', 'global'].filter(scope =>
    Boolean(
      (oldTargets.scripts?.[scope]?.length ?? 0) ||
      (plan.scripts?.[scope]?.length ?? 0) ||
      originalScriptScopes.has(scope)
    ),
  );

  const state = {
    characterName: characterNeeded ? await maybe(adapter.getCurrentCharacterName()) : null,
    worldbook: null,
    binding: null,
    regexes: null,
    presets: new Map(),
    scripts: new Map(),
    originalWorldbooks: new Map(),
  };
  if (worldbookAffected || conflictAffected) {
    const binding = await maybe(adapter.getCharWorldbookNames());
    state.binding = {
      primary: binding?.primary ?? null,
      additional: Array.isArray(binding?.additional) ? clone(binding.additional) : [],
    };
  }
  if (worldbookAffected) {
    const worldbookNames = await maybe(adapter.getWorldbookNames());
    const names = Array.isArray(worldbookNames) ? worldbookNames : [];
    const existed = names.includes(SHARED_WORLDBOOK_NAME);
    const currentEntries = existed ? await maybe(adapter.getWorldbook(SHARED_WORLDBOOK_NAME)) : [];
    state.worldbook = {
      existed,
      entries: Array.isArray(currentEntries) ? clone(currentEntries) : [],
    };
  }
  if (conflictAffected) {
    const names = await maybe(adapter.getWorldbookNames());
    const existingNames = new Set(Array.isArray(names) ? names : []);
    for (const name of existingNames) {
      if (!name || name === SHARED_WORLDBOOK_NAME) continue;
      state.originalWorldbooks.set(name, clone(await maybe(adapter.getWorldbook(name))));
    }
  }
  if (regexAffected) {
    const regexes = await maybe(adapter.getCharacterRegexes());
    state.regexes = Array.isArray(regexes) ? clone(regexes) : [];
  }
  for (const scope of scriptScopes) {
    const trees = await maybe(adapter.getScriptTrees(scope));
    state.scripts.set(scope, Array.isArray(trees) ? clone(trees) : []);
  }

  const availablePresetNames = await maybe(adapter.getPresetNames());
  const existing = new Set(Array.isArray(availablePresetNames) ? availablePresetNames : []);
  for (const name of presetNames) {
    state.presets.set(name, {
      existed: existing.has(name),
      content: existing.has(name) ? clone(await maybe(adapter.getPreset(name))) : null,
    });
  }
  return state;
}

export async function restoreInstallSnapshot(adapter, state) {
  const errors = [];
  const attempt = async operation => {
    try { await operation(); } catch (error) { errors.push(error); }
  };

  for (const [name, previous] of [...state.presets.entries()].reverse()) {
    await attempt(async () => {
      if (previous.existed) await maybe(adapter.createOrReplacePreset(name, previous.content));
      else await maybe(adapter.deletePreset(name));
    });
  }
  for (const [scope, trees] of [...state.scripts.entries()].reverse()) {
    await attempt(() => maybe(adapter.replaceScriptTrees(trees, scope)));
  }
  if (state.regexes) await attempt(() => maybe(adapter.replaceCharacterRegexes(state.regexes)));
  for (const [name, entries] of state.originalWorldbooks.entries()) {
    await attempt(() => maybe(adapter.createOrReplaceWorldbook(name, entries)));
  }
  if (state.worldbook) {
    await attempt(async () => {
      if (state.worldbook.existed) await maybe(adapter.createOrReplaceWorldbook(SHARED_WORLDBOOK_NAME, state.worldbook.entries));
      else await maybe(adapter.deleteWorldbook(SHARED_WORLDBOOK_NAME));
    });
    if (state.binding) await attempt(() => maybe(adapter.rebindCharWorldbooks(state.binding)));
  }
  return errors;
}
