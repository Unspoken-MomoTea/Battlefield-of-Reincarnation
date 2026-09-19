import { SHARED_WORLDBOOK_NAME } from '../constants.js';
import { normalizedName } from '../compare.js';
import { isProjectWorldbookEntry } from '../ownership.js';
import { maybe } from '../utils.js';

function issue(type, extra = {}) {
  return { type, ...extra };
}

export async function analyzeInstallConflicts(adapter, installed, plan) {
  const blocking = [];
  const warnings = [];
  const oldTargets = installed.installTargets ?? {};
  const characterScoped = Boolean(
    plan.worldbook.length ||
    plan.regexes.length ||
    oldTargets.worldbook ||
    oldTargets.regexIds?.length,
  );

  if (installed.applied && installed.targetCharacterName && characterScoped) {
    const current = await maybe(adapter.getCurrentCharacterName());
    if (current !== installed.targetCharacterName) {
      blocking.push(issue('character_mismatch', {
        expected: installed.targetCharacterName,
        actual: current || '',
      }));
      return { blocking, warnings };
    }
  }

  if (plan.worldbook.length) {
    const names = await maybe(adapter.getWorldbookNames());
    if (names.includes(SHARED_WORLDBOOK_NAME)) {
      const entries = await maybe(adapter.getWorldbook(SHARED_WORLDBOOK_NAME));
      const unrelated = entries.filter(entry => !isProjectWorldbookEntry(entry, installed.id));
      const occupied = new Set(unrelated.map(entry => normalizedName(entry.name ?? entry.comment)).filter(Boolean));
      const emitted = new Set();
      for (const entry of plan.worldbook) {
        const key = normalizedName(entry.name);
        if (key && occupied.has(key) && !emitted.has(key)) {
          emitted.add(key);
          warnings.push(issue('worldbook_name_collision', { name: entry.name }));
        }
      }
    }
  }

  if (plan.regexes.length) {
    const current = await maybe(adapter.getCharacterRegexes());
    const existingIds = new Set(current.map(regex => String(regex.id || '')).filter(Boolean));
    const knownOwnIds = new Set(oldTargets.regexIds ?? []);
    for (const regex of plan.regexes) {
      if (existingIds.has(regex.id) && !knownOwnIds.has(regex.id)) {
        warnings.push(issue('regex_id_collision', { id: regex.id, name: regex.script_name }));
      }
    }
  }

  if (plan.presets.length) {
    const existingNames = new Set(await maybe(adapter.getPresetNames()));
    const knownOwnNames = new Set(oldTargets.presets ?? []);
    for (const preset of plan.presets) {
      if (existingNames.has(preset.name) && !knownOwnNames.has(preset.name)) {
        warnings.push(issue('preset_name_collision', { name: preset.name }));
      }
    }
  }

  return { blocking, warnings };
}
