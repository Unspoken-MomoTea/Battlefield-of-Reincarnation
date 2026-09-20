import { SHARED_WORLDBOOK_NAME } from '../constants.js';
import { deepSubsetEqual } from '../compare.js';
import { buildArtifactPlan } from '../plan.js';
import { isProjectScriptTree, isProjectWorldbookEntry, regexPrefix } from '../ownership.js';
import { isOriginalConflictEntryDisabled } from '../original-conflicts.js';
import { findOriginalScriptTargets, isOriginalScriptDisabled } from '../original-scripts.js';
import { maybe } from '../utils.js';

function issue(type, extra = {}) {
  return { type, ...extra };
}

function entryUid(entry) {
  const value = entry?.uid;
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function entryName(entry) {
  return String(entry?.comment ?? entry?.name ?? '').trim();
}

function matchesIdentity(entry, identity) {
  if (identity?.uid) return entryUid(entry) === String(identity.uid);
  return entryName(entry) === String(identity?.name || '').trim();
}

function fingerprint(value) {
  try { return JSON.stringify(value); } catch { return ''; }
}

export async function inspectInstalledProject(adapter, installed) {
  if (!installed?.applied) {
    return { healthy: false, repairable: false, issues: [issue('not_applied')] };
  }

  const plan = buildArtifactPlan(installed);
  const targets = installed.installTargets ?? {};
  const characterScoped = Boolean(
    plan.worldbook.length ||
    plan.regexes.length ||
    plan.scripts?.character?.length ||
    targets.worldbook ||
    targets.regexIds?.length ||
    targets.scripts?.character?.length ||
    targets.originalWorldbookChanges?.length ||
    targets.originalScriptChanges?.some(item => item.scope === 'character'),
  );
  if (characterScoped && installed.targetCharacterName) {
    const current = await maybe(adapter.getCurrentCharacterName());
    if (current !== installed.targetCharacterName) {
      return {
        healthy: false,
        repairable: false,
        issues: [issue('character_mismatch', {
          expected: installed.targetCharacterName,
          actual: current || '',
        })],
      };
    }
  }

  const issues = [];
  if (Number(installed.appliedVersion || 0) !== Number(installed.version || 0)) {
    issues.push(issue('version_drift', {
      appliedVersion: Number(installed.appliedVersion || 0),
      cachedVersion: Number(installed.version || 0),
    }));
  }

  if (plan.worldbook.length || targets.worldbook) {
    const names = await maybe(adapter.getWorldbookNames());
    const entries = names.includes(SHARED_WORLDBOOK_NAME)
      ? await maybe(adapter.getWorldbook(SHARED_WORLDBOOK_NAME))
      : [];
    const ownEntries = entries.filter(entry => isProjectWorldbookEntry(entry, installed.id));
    const matched = new Set();

    for (const expected of plan.worldbook) {
      const actualIndex = ownEntries.findIndex((entry, index) =>
        !matched.has(index) &&
        entry.name === expected.name &&
        entry.extra?.reincarnationWorkshop?.artifactIndex === expected.extra?.reincarnationWorkshop?.artifactIndex,
      );
      if (actualIndex < 0) {
        issues.push(issue('worldbook_entry_missing', { name: expected.name }));
        continue;
      }
      matched.add(actualIndex);
      if (!deepSubsetEqual(expected, ownEntries[actualIndex])) {
        issues.push(issue('worldbook_entry_modified', { name: expected.name }));
      }
    }
    ownEntries.forEach((entry, index) => {
      if (!matched.has(index)) issues.push(issue('worldbook_entry_stale', { name: entry.name || '' }));
    });

    if (plan.worldbook.length) {
      const binding = await maybe(adapter.getCharWorldbookNames());
      if (!binding.additional.includes(SHARED_WORLDBOOK_NAME)) {
        issues.push(issue('worldbook_binding_missing'));
      }
    }
  }

  if (plan.regexes.length || targets.regexIds?.length) {
    const current = await maybe(adapter.getCharacterRegexes());
    const expectedById = new Map(plan.regexes.map(regex => [regex.id, regex]));
    const currentById = new Map(current.map(regex => [String(regex.id || ''), regex]));
    for (const [id, expected] of expectedById) {
      const actual = currentById.get(id);
      if (!actual) issues.push(issue('regex_missing', { id, name: expected.script_name }));
      else if (!deepSubsetEqual(expected, actual)) issues.push(issue('regex_modified', { id, name: expected.script_name }));
    }
    for (const regex of current) {
      const id = String(regex.id || '');
      if (id.startsWith(regexPrefix(installed.id)) && !expectedById.has(id)) {
        issues.push(issue('regex_stale', { id, name: regex.script_name || '' }));
      }
    }
  }

  for (const scope of ['character', 'preset', 'global']) {
    const expectedScripts = plan.scripts?.[scope] ?? [];
    const targetIds = targets.scripts?.[scope] ?? [];
    if (!expectedScripts.length && !targetIds.length) continue;

    const current = await maybe(adapter.getScriptTrees(scope));
    const currentById = new Map(current.map(tree => [String(tree.id || ''), tree]));
    const expectedById = new Map(expectedScripts.map(tree => [tree.id, tree]));

    for (const [id, expected] of expectedById) {
      const actual = currentById.get(id);
      if (!actual) issues.push(issue('script_missing', { scope, id, name: expected.name || '' }));
      else if (!deepSubsetEqual(expected, actual)) {
        issues.push(issue('script_modified', { scope, id, name: expected.name || '' }));
      }
    }
    for (const tree of current) {
      const id = String(tree.id || '');
      if (isProjectScriptTree(tree, installed.id) && !expectedById.has(id)) {
        issues.push(issue('script_stale', { scope, id, name: tree.name || '' }));
      }
    }
  }

  for (const change of targets.originalWorldbookChanges ?? []) {
    const names = await maybe(adapter.getWorldbookNames());
    if (!names.includes(change.worldbookName)) {
      issues.push(issue('original_worldbook_missing', {
        worldbookName: change.worldbookName,
        name: change.identity?.name || change.identity?.uid || '',
      }));
      continue;
    }

    const entries = await maybe(adapter.getWorldbook(change.worldbookName));
    const actual = entries.find(entry => matchesIdentity(entry, change.identity));
    if (!actual) {
      issues.push(issue('original_conflict_entry_missing', {
        worldbookName: change.worldbookName,
        name: change.identity?.name || change.identity?.uid || '',
      }));
      continue;
    }
    if (!isOriginalConflictEntryDisabled(actual)) {
      issues.push(issue('original_conflict_reenabled', {
        worldbookName: change.worldbookName,
        name: change.identity?.name || change.identity?.uid || '',
      }));
      continue;
    }
    if (change.afterFingerprint && fingerprint(actual) !== change.afterFingerprint) {
      issues.push(issue('original_conflict_modified', {
        worldbookName: change.worldbookName,
        name: change.identity?.name || change.identity?.uid || '',
      }));
    }
  }

  const originalScriptCache = new Map();
  for (const change of targets.originalScriptChanges ?? []) {
    if (!originalScriptCache.has(change.scope)) {
      originalScriptCache.set(change.scope, await maybe(adapter.getScriptTrees(change.scope)));
    }
    const trees = originalScriptCache.get(change.scope);
    const matches = findOriginalScriptTargets(trees, {
      scope: change.scope,
      ...(change.identity || {}),
    });
    const name = change.identity?.name || change.identity?.id || '';
    if (matches.length !== 1) {
      issues.push(issue('original_script_missing', { scope: change.scope, name }));
      continue;
    }
    const actual = matches[0].script;
    if (!isOriginalScriptDisabled(actual)) {
      issues.push(issue('original_script_reenabled', { scope: change.scope, name }));
      continue;
    }
    if (change.afterFingerprint && fingerprint(actual) !== change.afterFingerprint) {
      issues.push(issue('original_script_modified', { scope: change.scope, name }));
    }
  }

  if (plan.presets.length || targets.presets?.length) {
    const existing = new Set(await maybe(adapter.getPresetNames()));
    const expectedNames = new Set(plan.presets.map(item => item.name));
    for (const preset of plan.presets) {
      if (!existing.has(preset.name)) {
        issues.push(issue('preset_missing', { name: preset.name }));
        continue;
      }
      const actual = await maybe(adapter.getPreset(preset.name));
      if (!deepSubsetEqual(preset.content, actual)) issues.push(issue('preset_modified', { name: preset.name }));
    }
    for (const name of targets.presets ?? []) {
      if (existing.has(name) && !expectedNames.has(name)) issues.push(issue('preset_stale', { name }));
    }
  }

  return { healthy: issues.length === 0, repairable: true, issues };
}
