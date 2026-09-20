import { SHARED_WORLDBOOK_NAME } from '../constants.js';
import { normalizedName } from '../compare.js';
import { isProjectWorldbookEntry, scriptPrefix } from '../ownership.js';
import { findOriginalScriptTargets } from '../original-scripts.js';
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
    plan.scripts?.character?.length ||
    oldTargets.worldbook ||
    oldTargets.regexIds?.length ||
    oldTargets.scripts?.character?.length ||
    plan.originalConflicts?.length ||
    oldTargets.originalWorldbookChanges?.length ||
    plan.originalScriptConflicts?.some(item => item.target?.scope === 'character') ||
    oldTargets.originalScriptChanges?.some(item => item.scope === 'character'),
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

  if (plan.originalConflicts?.length) {
    const names = new Set(await maybe(adapter.getWorldbookNames()));
    const binding = await maybe(adapter.getCharWorldbookNames());
    const cache = new Map();

    const readBook = async name => {
      if (!name || name === SHARED_WORLDBOOK_NAME || !names.has(name)) return [];
      if (!cache.has(name)) cache.set(name, await maybe(adapter.getWorldbook(name)));
      return cache.get(name);
    };

    for (const directive of plan.originalConflicts) {
      const target = directive.target || {};
      if (target.worldbook === SHARED_WORLDBOOK_NAME) {
        blocking.push(issue('original_conflict_target_invalid', {
          name: target.name || target.uid || '',
          worldbookName: target.worldbook,
        }));
        continue;
      }

      const bookNames = target.worldbook
        ? [target.worldbook]
        : [binding.primary, ...(binding.additional ?? [])]
          .filter(name => name && name !== SHARED_WORLDBOOK_NAME);

      const matches = [];
      for (const worldbookName of [...new Set(bookNames)]) {
        const entries = await readBook(worldbookName);
        for (const entry of entries) {
          const matched = target.uid
            ? String(entry?.uid ?? '') === String(target.uid)
            : String(entry?.comment ?? entry?.name ?? '').trim() === String(target.name || '').trim();
          if (matched) matches.push({ worldbookName, entry });
        }
      }

      if (!matches.length) {
        blocking.push(issue('original_conflict_target_missing', {
          name: target.name || target.uid || '',
          worldbookName: target.worldbook || '',
        }));
      } else if (matches.length > 1) {
        blocking.push(issue('original_conflict_target_ambiguous', {
          name: target.name || target.uid || '',
          count: matches.length,
        }));
      }
    }
  }

  if (plan.originalScriptConflicts?.length) {
    const cache = new Map();
    const readScripts = async scope => {
      if (!cache.has(scope)) cache.set(scope, await maybe(adapter.getScriptTrees(scope)));
      return cache.get(scope);
    };

    for (const directive of plan.originalScriptConflicts) {
      const target = directive.target || {};
      const scope = String(target.scope || '');
      const trees = await readScripts(scope);
      const matches = findOriginalScriptTargets(trees, target);

      if (!matches.length) {
        blocking.push(issue('original_script_target_missing', {
          scope,
          name: target.name || target.id || '',
        }));
        continue;
      }
      if (matches.length > 1) {
        blocking.push(issue('original_script_target_ambiguous', {
          scope,
          name: target.name || target.id || '',
          count: matches.length,
        }));
        continue;
      }
      if (String(matches[0].script?.id || '').startsWith(scriptPrefix(installed.id))) {
        blocking.push(issue('original_script_target_invalid', {
          scope,
          name: target.name || target.id || '',
        }));
      }
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

  for (const scope of ['character', 'preset', 'global']) {
    const scripts = plan.scripts?.[scope] ?? [];
    if (!scripts.length) continue;
    const current = await maybe(adapter.getScriptTrees(scope));
    const existingIds = new Set(current.map(tree => String(tree.id || '')).filter(Boolean));
    const knownOwnIds = new Set(oldTargets.scripts?.[scope] ?? []);
    for (const tree of scripts) {
      if (existingIds.has(tree.id) && !knownOwnIds.has(tree.id)) {
        warnings.push(issue('script_id_collision', { scope, id: tree.id, name: tree.name || '' }));
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
