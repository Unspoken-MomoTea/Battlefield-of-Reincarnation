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

function flattenScripts(trees, scope) {
  const scripts = [];
  for (const tree of trees || []) {
    if (!tree || typeof tree !== 'object') continue;
    if (tree.type === 'folder') {
      const folder = String(tree.name || '').trim();
      for (const script of tree.scripts || []) {
        if (!script || typeof script !== 'object' || script.type === 'folder') continue;
        const id = String(script.id || '').trim();
        if (id.startsWith('rw:') || script.enabled === false) continue;
        scripts.push({
          scope,
          folder,
          id,
          name: String(script.name || '').trim() || id || '未命名脚本',
          enabled: true,
        });
      }
      continue;
    }
    const id = String(tree.id || '').trim();
    if (id.startsWith('rw:') || tree.enabled === false) continue;
    scripts.push({
      scope,
      folder: '',
      id,
      name: String(tree.name || '').trim() || id || '未命名脚本',
      enabled: true,
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
      const normalized = (rawEntries || [])
        .filter(entryEnabled)
        .map((entry, index) => {
          const strategy = entryStrategy(entry);
          return {
            uid: entry?.uid === undefined || entry?.uid === null ? '' : String(entry.uid),
            name: entryName(entry) || `条目 ${index + 1}`,
            enabled: true,
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
    scripts,
  };
}
