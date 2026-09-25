import {
  finiteNumber, parseJsonLike, positiveOrNull, record, strings,
} from '../utils.js';

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
    'before_character_definition', 'after_character_definition',
    'before_example_messages', 'after_example_messages',
    'before_author_note', 'after_author_note', 'at_depth', 'outlet',
  ]);
  if (supported.has(value)) return value;
  return ({
    0: 'before_character_definition', 1: 'after_character_definition',
    2: 'before_author_note', 3: 'after_author_note', 4: 'at_depth',
    5: 'before_example_messages', 6: 'after_example_messages',
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
    const positionType = normalizePositionType(position?.type ?? entry.position);
    const normalizedPosition = {
      type: positionType,
      role: normalizeRole(position?.role ?? entry.role),
      order: finiteNumber(position?.order ?? entry.order, index),
      ...(positionType === 'at_depth' ? {
        depth: Math.max(0, finiteNumber(position?.depth ?? entry.depth, 4)),
      } : {}),
    };

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
          strategy?.scan_depth === 'same_as_global' || (strategy?.scan_depth === undefined && entry.scanDepth == null)
            ? 'same_as_global'
            : Math.max(1, finiteNumber(strategy?.scan_depth ?? entry.scanDepth, 1)),
      },
      position: normalizedPosition,
      content: typeof entry.content === 'string' ? entry.content : String(entry.content ?? ''),
      probability: Math.max(0, Math.min(100, probability)),
      recursion: {
        prevent_incoming: Boolean(recursion?.prevent_incoming ?? entry.excludeRecursion),
        prevent_outgoing: Boolean(recursion?.prevent_outgoing ?? entry.preventRecursion),
        delay_until: (recursion?.delay_until ?? entry.delayUntilRecursion) === true
          ? 1 : positiveOrNull(recursion?.delay_until ?? entry.delayUntilRecursion),
      },
      effect: {
        sticky: positiveOrNull(effect?.sticky ?? entry.sticky),
        cooldown: positiveOrNull(effect?.cooldown ?? entry.cooldown),
        delay: positiveOrNull(effect?.delay ?? entry.delay),
      },
      ...(group ? {
        group,
        groupOverride: Boolean(entry.groupOverride),
        groupWeight: finiteNumber(entry.groupWeight, 100),
        useGroupScoring: typeof entry.useGroupScoring === 'boolean' ? entry.useGroupScoring : null,
      } : {}),
      ...(record(entry.extra) ? { extra: structuredClone(entry.extra) } : {}),
    };
  });
}
