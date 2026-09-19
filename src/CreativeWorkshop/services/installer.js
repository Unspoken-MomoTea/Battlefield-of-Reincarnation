import { createTavernAdapter } from './tavern-adapter.js';
import { getInstalledProject, putInstalledProject } from './storage.js';

export const SHARED_WORLDBOOK_NAME = '轮回战场·创意工坊';

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function strings(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseJsonLike(value, label) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} 不是有效 JSON`);
  }
}

function normalizeStrategyType(entry, strategy) {
  if (['constant', 'selective', 'vectorized'].includes(strategy?.type)) return strategy.type;
  if (entry.constant === true) return 'constant';
  if (entry.vectorized === true) return 'vectorized';
  return 'selective';
}

function normalizeSecondaryLogic(value) {
  if (['and_any', 'and_all', 'not_all', 'not_any'].includes(value)) return value;
  return ({ 0: 'and_any', 1: 'not_all', 2: 'not_any', 3: 'and_all' })[finiteNumber(value, 0)] || 'and_any';
}

function normalizePositionType(value) {
  const supported = new Set([
    'before_character_definition',
    'after_character_definition',
    'before_example_messages',
    'after_example_messages',
    'before_author_note',
    'after_author_note',
    'at_depth',
    'outlet',
  ]);
  if (supported.has(value)) return value;
  return ({
    0: 'before_character_definition',
    1: 'after_character_definition',
    2: 'before_author_note',
    3: 'after_author_note',
    4: 'at_depth',
    5: 'before_example_messages',
    6: 'after_example_messages',
  })[finiteNumber(value, 0)] || 'before_character_definition';
}

function normalizeRole(value) {
  if (['system', 'assistant', 'user'].includes(value)) return value;
  return ({ 0: 'system', 1: 'user', 2: 'assistant' })[finiteNumber(value, 0)] || 'system';
}

function worldbookEntries(content) {
  const parsed = parseJsonLike(content, '世界书');
  if (Array.isArray(parsed)) return parsed;
  const root = record(parsed);
  if (!root) throw new Error('世界书根结构无效');
  const entries = root.entries;
  if (Array.isArray(entries)) return entries;
  if (record(entries)) return Object.values(entries);
  throw new Error('世界书不包含 entries');
}

export function normalizeWorldbookArtifact(content) {
  const values = worldbookEntries(content);
  if (!values.length) throw new Error('世界书没有任何条目');
  if (values.length > 500) throw new Error('单个世界书 artifact 最多允许 500 个条目');

  return values.map((value, index) => {
    const entry = record(value);
    if (!entry) throw new Error(`第 ${index + 1} 个世界书条目结构无效`);
    const name = String(entry.name ?? entry.comment ?? '').trim();
    if (!name) throw new Error(`第 ${index + 1} 个世界书条目缺少名称`);

    const strategy = record(entry.strategy);
    const secondary = record(strategy?.keys_secondary);
    const position = record(entry.position);
    const recursion = record(entry.recursion);
    const effect = record(entry.effect);
    const probability = entry.useProbability === false ? 100 : finiteNumber(entry.probability, 100);
    const group = typeof entry.group === 'string' ? entry.group : strings(record(entry.group)?.labels).join(',');

    return {
      name,
      enabled: typeof entry.enabled === 'boolean' ? entry.enabled : entry.disable !== true,
      strategy: {
        type: normalizeStrategyType(entry, strategy),
        keys: strings(strategy?.keys ?? entry.key),
        keys_secondary: {
          logic: normalizeSecondaryLogic(secondary?.logic ?? entry.selectiveLogic),
          keys: strings(secondary?.keys ?? entry.keysecondary),
        },
        scan_depth:
          strategy?.scan_depth === 'same_as_global' ||
          (strategy?.scan_depth === undefined && entry.scanDepth == null)
            ? 'same_as_global'
            : Math.max(1, finiteNumber(strategy?.scan_depth ?? entry.scanDepth, 1)),
      },
      position: {
        type: normalizePositionType(position?.type ?? entry.position),
        role: normalizeRole(position?.role ?? entry.role),
        depth: Math.max(0, finiteNumber(position?.depth ?? entry.depth, 4)),
        order: finiteNumber(position?.order ?? entry.order, index),
      },
      content: typeof entry.content === 'string' ? entry.content : String(entry.content ?? ''),
      probability: Math.max(0, Math.min(100, probability)),
      recursion: {
        prevent_incoming: Boolean(recursion?.prevent_incoming ?? entry.excludeRecursion),
        prevent_outgoing: Boolean(recursion?.prevent_outgoing ?? entry.preventRecursion),
        delay_until:
          (recursion?.delay_until ?? entry.delayUntilRecursion) === true
            ? 1
            : positiveOrNull(recursion?.delay_until ?? entry.delayUntilRecursion),
      },
      effect: {
        sticky: positiveOrNull(effect?.sticky ?? entry.sticky),
        cooldown: positiveOrNull(effect?.cooldown ?? entry.cooldown),
        delay: positiveOrNull(effect?.delay ?? entry.delay),
      },
      ...(group
        ? {
            group,
            groupOverride: Boolean(entry.groupOverride),
            groupWeight: finiteNumber(entry.groupWeight, 100),
            useGroupScoring: typeof entry.useGroupScoring === 'boolean' ? entry.useGroupScoring : null,
          }
        : {}),
      ...(record(entry.extra) ? { extra: structuredClone(entry.extra) } : {}),
    };
  });
}

function regexValues(content) {
  const parsed = parseJsonLike(content, '正则');
  if (Array.isArray(parsed)) return parsed;
  const root = record(parsed);
  if (!root) throw new Error('正则 artifact 结构无效');
  if (Array.isArray(root.regexes)) return root.regexes;
  if (Array.isArray(root.extensions?.regex_scripts)) return root.extensions.regex_scripts;
  if (root.find_regex !== undefined || root.findRegex !== undefined) return [root];
  throw new Error('正则 artifact 中没有可识别的正则列表');
}

function sourceFromLegacy(value) {
  if (record(value.source)) {
    return {
      user_input: Boolean(value.source.user_input),
      ai_output: Boolean(value.source.ai_output),
      slash_command: Boolean(value.source.slash_command),
      world_info: Boolean(value.source.world_info),
      reasoning: Boolean(value.source.reasoning),
    };
  }
  const placement = Array.isArray(value.placement) ? value.placement.map(Number) : [];
  if (!placement.length) {
    return { user_input: true, ai_output: true, slash_command: true, world_info: true, reasoning: true };
  }
  return {
    user_input: placement.includes(1),
    ai_output: placement.includes(2),
    slash_command: placement.includes(3),
    world_info: placement.includes(5),
    reasoning: placement.includes(6),
  };
}

function destinationFromLegacy(value) {
  if (record(value.destination)) {
    return {
      display: Boolean(value.destination.display),
      prompt: Boolean(value.destination.prompt),
    };
  }
  if (value.markdownOnly === true) return { display: true, prompt: false };
  if (value.promptOnly === true) return { display: false, prompt: true };
  return { display: true, prompt: true };
}

export function normalizeRegexArtifact(content, project, artifactIndex, artifactName) {
  return regexValues(content).map((value, index) => {
    const regex = record(value);
    if (!regex) throw new Error(`第 ${index + 1} 个正则结构无效`);
    const find = regex.find_regex ?? regex.findRegex;
    if (typeof find !== 'string') throw new Error(`第 ${index + 1} 个正则缺少 findRegex`);
    const originalName = String(regex.script_name ?? regex.scriptName ?? artifactName ?? `正则 ${index + 1}`).trim();
    return {
      id: `rw:${project.id}:${artifactIndex}:${index}`,
      script_name: `[工坊] ${project.name} · ${originalName}`,
      enabled: typeof regex.enabled === 'boolean' ? regex.enabled : regex.disabled !== true,
      find_regex: find,
      replace_string: String(regex.replace_string ?? regex.replaceString ?? ''),
      trim_strings: strings(regex.trim_strings ?? regex.trimStrings),
      source: sourceFromLegacy(regex),
      destination: destinationFromLegacy(regex),
      run_on_edit: Boolean(regex.run_on_edit ?? regex.runOnEdit),
      min_depth: regex.min_depth == null && regex.minDepth == null ? null : finiteNumber(regex.min_depth ?? regex.minDepth, 0),
      max_depth: regex.max_depth == null && regex.maxDepth == null ? null : finiteNumber(regex.max_depth ?? regex.maxDepth, 0),
    };
  });
}

function presetContent(content) {
  const parsed = parseJsonLike(content, '预设');
  if (!record(parsed)) throw new Error('预设 artifact 必须是 JSON 对象');
  return structuredClone(parsed);
}

export function safePresetName(project, artifactName, artifactIndex = 0) {
  const suffix = `${String(project.id).slice(0, 8)}-${artifactIndex + 1}`;
  const prefix = `[创意工坊] ${project.name} · `;
  const room = Math.max(1, 120 - prefix.length - suffix.length - 3);
  return `${prefix}${String(artifactName).slice(0, room)} · ${suffix}`;
}

function provenance(entry) {
  return record(entry?.extra)?.reincarnationWorkshop;
}

function isProjectWorldbookEntry(entry, projectId) {
  return record(provenance(entry))?.sourceId === projectId;
}

function regexPrefix(projectId) {
  return `rw:${projectId}:`;
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function artifactPlan(installed) {
  const bundle = installed.bundle;
  if (!bundle || bundle.schema_version !== 1 || !Array.isArray(bundle.artifacts)) {
    throw new Error('本地作品包无效，请重新下载');
  }
  const plan = { worldbook: [], regexes: [], presets: [], data: [] };
  bundle.artifacts.forEach((artifact, index) => {
    if (artifact.kind === 'worldbook') {
      const entries = normalizeWorldbookArtifact(artifact.content).map(entry => ({
        ...entry,
        extra: {
          ...(entry.extra ?? {}),
          reincarnationWorkshop: {
            sourceId: installed.id,
            sourceType: 'project_artifact',
            sourceTitle: installed.name,
            sourceVersion: installed.version,
            artifactIndex: index,
            artifactName: artifact.name,
          },
        },
      }));
      plan.worldbook.push(...entries);
      return;
    }
    if (artifact.kind === 'regex') {
      plan.regexes.push(...normalizeRegexArtifact(artifact.content, installed, index, artifact.name));
      return;
    }
    if (artifact.kind === 'preset') {
      plan.presets.push({ name: safePresetName(installed, artifact.name, index), content: presetContent(artifact.content) });
      return;
    }
    if (artifact.kind === 'data') {
      plan.data.push({ name: artifact.name, content: clone(artifact.content) });
      return;
    }
    throw new Error(`不支持的 artifact 类型：${artifact.kind}`);
  });
  return plan;
}

async function maybe(value) {
  return Promise.resolve(value);
}

export function createWorkshopInstaller({ adapter = createTavernAdapter(), storage = { getInstalledProject, putInstalledProject } } = {}) {
  async function snapshot(installed, plan, characterNeeded) {
    const oldTargets = installed.installTargets ?? {};
    const worldbookAffected = Boolean(oldTargets.worldbook || plan.worldbook.length);
    const regexAffected = Boolean((oldTargets.regexIds?.length ?? 0) || plan.regexes.length);
    const presetNames = [...new Set([...(oldTargets.presets ?? []), ...plan.presets.map(item => item.name)])];

    const state = {
      characterName: characterNeeded ? await maybe(adapter.getCurrentCharacterName()) : null,
      worldbook: null,
      binding: null,
      regexes: null,
      presets: new Map(),
    };

    if (worldbookAffected) {
      const names = await maybe(adapter.getWorldbookNames());
      const existed = names.includes(SHARED_WORLDBOOK_NAME);
      state.worldbook = { existed, entries: existed ? clone(await maybe(adapter.getWorldbook(SHARED_WORLDBOOK_NAME))) : [] };
      state.binding = clone(await maybe(adapter.getCharWorldbookNames()));
    }
    if (regexAffected) state.regexes = clone(await maybe(adapter.getCharacterRegexes()));

    const presetNamesExisting = new Set(await maybe(adapter.getPresetNames()));
    for (const name of presetNames) {
      state.presets.set(name, {
        existed: presetNamesExisting.has(name),
        content: presetNamesExisting.has(name) ? clone(await maybe(adapter.getPreset(name))) : null,
      });
    }
    return state;
  }

  async function restore(state) {
    const errors = [];
    const attempt = async operation => {
      try {
        await operation();
      } catch (error) {
        errors.push(error);
      }
    };

    for (const [name, previous] of [...state.presets.entries()].reverse()) {
      await attempt(async () => {
        if (previous.existed) await maybe(adapter.createOrReplacePreset(name, previous.content));
        else await maybe(adapter.deletePreset(name));
      });
    }
    if (state.regexes) {
      await attempt(() => maybe(adapter.replaceCharacterRegexes(state.regexes)));
    }
    if (state.worldbook) {
      await attempt(async () => {
        if (state.worldbook.existed) {
          await maybe(adapter.createOrReplaceWorldbook(SHARED_WORLDBOOK_NAME, state.worldbook.entries));
        } else {
          await maybe(adapter.deleteWorldbook(SHARED_WORLDBOOK_NAME));
        }
      });
      if (state.binding) {
        await attempt(() => maybe(adapter.rebindCharWorldbooks(state.binding)));
      }
    }
    return errors;
  }

  async function apply(projectId) {
    const installed = await storage.getInstalledProject(projectId);
    if (!installed) throw new Error('本地没有这个作品，请先下载');
    const plan = artifactPlan(installed);
    if (!plan.worldbook.length && !plan.regexes.length && !plan.presets.length) {
      throw new Error('这个作品目前只有 data artifact，没有可直接安装到酒馆的内容');
    }

    const oldTargets = installed.installTargets ?? {};
    const characterNeeded = Boolean(plan.worldbook.length || plan.regexes.length || oldTargets.worldbook || oldTargets.regexIds?.length);
    const currentCharacter = characterNeeded ? await maybe(adapter.getCurrentCharacterName()) : null;
    if (characterNeeded && !currentCharacter) throw new Error('请先在酒馆中打开一个角色卡，再安装世界书或正则');
    if (installed.applied && installed.targetCharacterName && installed.targetCharacterName !== currentCharacter) {
      throw new Error(`该作品当前安装在角色“${installed.targetCharacterName}”，请切回该角色后再更新或卸载`);
    }

    const state = await snapshot(installed, plan, characterNeeded);
    try {
      if (state.worldbook) {
        const previous = state.worldbook.entries.filter(entry => !isProjectWorldbookEntry(entry, installed.id));
        const next = [...previous, ...plan.worldbook];
        if (next.length) {
          await maybe(adapter.createOrReplaceWorldbook(SHARED_WORLDBOOK_NAME, next));
          if (plan.worldbook.length) {
            const binding = await maybe(adapter.getCharWorldbookNames());
            if (!binding.additional.includes(SHARED_WORLDBOOK_NAME)) {
              await maybe(
                adapter.rebindCharWorldbooks({
                  primary: binding.primary,
                  additional: [...new Set([...binding.additional, SHARED_WORLDBOOK_NAME])],
                }),
              );
            }
          } else if (oldTargets.worldbookBound && !previous.some(entry => record(provenance(entry))?.sourceId)) {
            const binding = await maybe(adapter.getCharWorldbookNames());
            await maybe(
              adapter.rebindCharWorldbooks({
                primary: binding.primary,
                additional: binding.additional.filter(name => name !== SHARED_WORLDBOOK_NAME),
              }),
            );
          }
        } else {
          await maybe(adapter.deleteWorldbook(SHARED_WORLDBOOK_NAME));
          const binding = await maybe(adapter.getCharWorldbookNames());
          await maybe(
            adapter.rebindCharWorldbooks({
              primary: binding.primary,
              additional: binding.additional.filter(name => name !== SHARED_WORLDBOOK_NAME),
            }),
          );
        }
      }

      if (state.regexes) {
        const prefix = regexPrefix(installed.id);
        const previous = state.regexes.filter(regex => !String(regex.id || '').startsWith(prefix));
        await maybe(adapter.replaceCharacterRegexes([...previous, ...plan.regexes]));
      }

      const newPresetNames = new Set(plan.presets.map(item => item.name));
      const previousPresetBackups = oldTargets.presetBackups ?? {};
      for (const oldName of oldTargets.presets ?? []) {
        if (newPresetNames.has(oldName)) continue;
        const backup = previousPresetBackups[oldName];
        if (backup?.existed) await maybe(adapter.createOrReplacePreset(oldName, backup.content));
        else await maybe(adapter.deletePreset(oldName));
      }
      for (const preset of plan.presets) {
        await maybe(adapter.createOrReplacePreset(preset.name, preset.content));
      }

      const presetBackups = {};
      for (const preset of plan.presets) {
        presetBackups[preset.name] =
          previousPresetBackups[preset.name] ??
          (() => {
            const previous = state.presets.get(preset.name);
            return previous ? { existed: previous.existed, content: clone(previous.content) } : { existed: false, content: null };
          })();
      }
      const worldbookWasBound = Boolean(state.binding?.additional?.includes(SHARED_WORLDBOOK_NAME));
      const next = {
        ...installed,
        applied: true,
        appliedVersion: installed.version,
        appliedAt: Date.now(),
        targetCharacterName: characterNeeded ? currentCharacter : null,
        installTargets: {
          worldbook: plan.worldbook.length ? SHARED_WORLDBOOK_NAME : null,
          worldbookCreated:
            plan.worldbook.length > 0
              ? Boolean(oldTargets.worldbookCreated || !state.worldbook?.existed)
              : false,
          worldbookBound:
            plan.worldbook.length > 0
              ? Boolean(oldTargets.worldbookBound || !worldbookWasBound)
              : false,
          regexIds: plan.regexes.map(regex => regex.id),
          presets: plan.presets.map(item => item.name),
          presetBackups,
        },
        applyError: '',
      };
      await storage.putInstalledProject(next);
      return next;
    } catch (error) {
      const rollbackErrors = await restore(state);
      const baseMessage = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackErrors.length
        ? `；另有 ${rollbackErrors.length} 个回滚步骤失败，请检查酒馆资源`
        : '';
      const failed = {
        ...installed,
        applyError: `${baseMessage}${rollbackMessage}`,
        updatedAt: Date.now(),
      };
      await storage.putInstalledProject(failed);
      throw error;
    }
  }

  async function uninstall(projectId) {
    const installed = await storage.getInstalledProject(projectId);
    if (!installed) return null;
    if (!installed.applied) return installed;
    const targets = installed.installTargets ?? {};
    const characterNeeded = Boolean(targets.worldbook || targets.regexIds?.length);
    const currentCharacter = characterNeeded ? await maybe(adapter.getCurrentCharacterName()) : null;
    if (installed.targetCharacterName && installed.targetCharacterName !== currentCharacter) {
      throw new Error(`该作品安装在角色“${installed.targetCharacterName}”，请切回该角色后再卸载`);
    }

    const emptyPlan = { worldbook: [], regexes: [], presets: [], data: [] };
    const state = await snapshot(installed, emptyPlan, characterNeeded);
    try {
      if (targets.worldbook && state.worldbook) {
        const remaining = state.worldbook.entries.filter(entry => !isProjectWorldbookEntry(entry, installed.id));
        const otherWorkshopEntries = remaining.some(entry => record(provenance(entry))?.sourceId);

        if (remaining.length || !targets.worldbookCreated) {
          await maybe(adapter.createOrReplaceWorldbook(SHARED_WORLDBOOK_NAME, remaining));
        } else {
          await maybe(adapter.deleteWorldbook(SHARED_WORLDBOOK_NAME));
        }

        if (targets.worldbookBound && !otherWorkshopEntries) {
          const binding = await maybe(adapter.getCharWorldbookNames());
          await maybe(
            adapter.rebindCharWorldbooks({
              primary: binding.primary,
              additional: binding.additional.filter(name => name !== SHARED_WORLDBOOK_NAME),
            }),
          );
        }
      }

      if (targets.regexIds?.length && state.regexes) {
        const prefix = regexPrefix(installed.id);
        await maybe(adapter.replaceCharacterRegexes(state.regexes.filter(regex => !String(regex.id || '').startsWith(prefix))));
      }
      for (const presetName of targets.presets ?? []) {
        const backup = targets.presetBackups?.[presetName];
        if (backup?.existed) await maybe(adapter.createOrReplacePreset(presetName, backup.content));
        else await maybe(adapter.deletePreset(presetName));
      }

      const next = {
        ...installed,
        applied: false,
        appliedVersion: null,
        appliedAt: null,
        targetCharacterName: null,
        installTargets: null,
        applyError: '',
        updatedAt: Date.now(),
      };
      await storage.putInstalledProject(next);
      return next;
    } catch (error) {
      await restore(state);
      throw error;
    }
  }

  return { apply, uninstall };
}

export const workshopInstaller = createWorkshopInstaller();
