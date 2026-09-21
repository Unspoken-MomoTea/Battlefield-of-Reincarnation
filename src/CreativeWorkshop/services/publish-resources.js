import { createTavernAdapter } from './tavern-adapter.js';
import { SHARED_WORLDBOOK_NAME } from './installer/constants.js';

function clone(value) {
  return structuredClone(value);
}

function entryName(entry) {
  return String(entry?.comment ?? entry?.name ?? '').trim();
}

function entryEnabled(entry) {
  if (typeof entry?.enabled === 'boolean') return entry.enabled;
  if (typeof entry?.disable === 'boolean') return !entry.disable;
  if (typeof entry?.disabled === 'boolean') return !entry.disabled;
  return true;
}

function entryStrategy(entry) {
  const type = String(
    entry?.strategy?.type ??
    (entry?.constant === true ? 'constant' : entry?.vectorized === true ? 'vectorized' : 'selective'),
  );
  if (type === 'constant') return { type, symbol: '🔵', label: '常驻' };
  if (type === 'vectorized') return { type, symbol: '🔗', label: '向量化' };
  return { type: 'selective', symbol: '🟢', label: '关键词' };
}

function entryKeys(entry) {
  const keys = entry?.strategy?.keys ?? entry?.keys ?? entry?.key ?? [];
  if (Array.isArray(keys)) return keys.map(value => String(value)).filter(Boolean);
  if (keys === null || keys === undefined || keys === '') return [];
  return String(keys).split(',').map(value => value.trim()).filter(Boolean);
}

function regexName(regex, index) {
  return String(regex?.script_name ?? regex?.scriptName ?? regex?.name ?? regex?.id ?? '').trim() || `正则 ${index + 1}`;
}

function regexEnabled(regex) {
  if (typeof regex?.enabled === 'boolean') return regex.enabled;
  if (typeof regex?.disabled === 'boolean') return !regex.disabled;
  return true;
}

function normalizeRegexes(values) {
  const regexes = [];
  const nameCounts = new Map();

  for (const [index, raw] of (values || []).entries()) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').trim();
    if (id.startsWith('rw:')) continue;
    const name = regexName(raw, index);
    const findRegex = String(raw.find_regex ?? raw.findRegex ?? '');
    const item = {
      scope: 'character',
      id,
      name,
      enabled: regexEnabled(raw),
      find_regex: findRegex,
      replace_string: String(raw.replace_string ?? raw.replaceString ?? ''),
      run_on_edit: Boolean(raw.run_on_edit ?? raw.runOnEdit),
    };
    regexes.push(item);
    if (!id) {
      const key = `${name}\u0000${findRegex}`;
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }
  }

  return regexes.map(item => ({
    ...item,
    selectable: Boolean(item.id) || (nameCounts.get(`${item.name}\u0000${item.find_regex}`) || 0) === 1,
  }));
}

function flattenScripts(trees, scope) {
  const scripts = [];
  for (const tree of trees || []) {
    if (!tree || typeof tree !== 'object') continue;
    if (tree.type === 'folder') {
      const folder = String(tree.name || '').trim();
      for (const script of tree.scripts || []) {
        if (!script || typeof script !== 'object' || script.type === 'folder') continue;
        const id = String(script.id || '').trim();
        if (id.startsWith('rw:')) continue;
        scripts.push({
          scope,
          folder,
          id,
          name: String(script.name || '').trim() || id || '未命名脚本',
          enabled: script.enabled !== false,
          content: String(script.content || ''),
        });
      }
      continue;
    }
    const id = String(tree.id || '').trim();
    if (id.startsWith('rw:')) continue;
    scripts.push({
      scope,
      folder: '',
      id,
      name: String(tree.name || '').trim() || id || '未命名脚本',
      enabled: tree.enabled !== false,
      content: String(tree.content || ''),
    });
  }
  return scripts;
}

export async function scanPublishResources(adapter = createTavernAdapter()) {
  const sources = new Map();
  const addSource = (book, label) => {
    const name = String(book || '').trim();
    if (!name || name === SHARED_WORLDBOOK_NAME) return;
    if (!sources.has(name)) sources.set(name, new Set());
    sources.get(name).add(label);
  };

  try {
    const binding = await Promise.resolve(adapter.getCharWorldbookNames());
    addSource(binding?.primary, '角色主书');
    for (const book of binding?.additional || []) addSource(book, '角色附加');
  } catch {}

  try {
    addSource(await Promise.resolve(adapter.getChatWorldbookName()), '聊天绑定');
  } catch {}

  try {
    for (const book of await Promise.resolve(adapter.getGlobalWorldbookNames()) || []) {
      addSource(book, '全局启用');
    }
  } catch {}

  const worldbooks = [];
  for (const [name, sourceLabels] of sources) {
    try {
      const rawEntries = clone(await adapter.getWorldbook(name));
      const normalized = (rawEntries || []).map((entry, index) => {
        const strategy = entryStrategy(entry);
        return {
          uid: entry?.uid === undefined || entry?.uid === null ? '' : String(entry.uid),
          name: entryName(entry) || `条目 ${index + 1}`,
          enabled: entryEnabled(entry),
          strategy_type: strategy.type,
          strategy_symbol: strategy.symbol,
          strategy_label: strategy.label,
          keys: entryKeys(entry),
          content: String(entry?.content || ''),
        };
      });

      if (!normalized.length) continue;

      const nameCounts = new Map();
      for (const entry of normalized) {
        if (!entry.uid) nameCounts.set(entry.name, (nameCounts.get(entry.name) || 0) + 1);
      }

      const labels = [...sourceLabels];
      worldbooks.push({
        name,
        bound: labels.some(label => label.startsWith('角色')),
        sources: labels,
        entries: normalized.map(entry => ({
          ...entry,
          selectable: Boolean(entry.uid) || (nameCounts.get(entry.name) || 0) === 1,
        })),
      });
    } catch {}
  }

  let regexes = [];
  try {
    regexes = normalizeRegexes(await Promise.resolve(adapter.getCharacterRegexes()));
  } catch {}

  const scripts = [];
  for (const scope of ['character', 'preset', 'global']) {
    try {
      scripts.push(...flattenScripts(await adapter.getScriptTrees(scope), scope));
    } catch {}
  }
  const scriptNameCounts = new Map();
  for (const script of scripts) {
    if (script.id) continue;
    const key = `${script.scope}\u0000${script.folder}\u0000${script.name}`;
    scriptNameCounts.set(key, (scriptNameCounts.get(key) || 0) + 1);
  }
  for (const script of scripts) {
    const key = `${script.scope}\u0000${script.folder}\u0000${script.name}`;
    script.selectable = Boolean(script.id) || (scriptNameCounts.get(key) || 0) === 1;
  }

  return {
    characterName: await Promise.resolve()
      .then(() => adapter.getCurrentCharacterName())
      .catch(() => ''),
    worldbooks,
    regexes,
    scripts,
  };
}
