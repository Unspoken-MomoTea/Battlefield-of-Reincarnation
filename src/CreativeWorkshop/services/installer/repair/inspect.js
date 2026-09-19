import { SHARED_WORLDBOOK_NAME } from '../constants.js';
import { deepSubsetEqual } from '../compare.js';
import { buildArtifactPlan } from '../plan.js';
import { isProjectWorldbookEntry, regexPrefix } from '../ownership.js';
import { maybe } from '../utils.js';

function issue(type, extra = {}) {
  return { type, ...extra };
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
    targets.worldbook ||
    targets.regexIds?.length,
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
