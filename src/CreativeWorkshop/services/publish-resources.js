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
  return true;
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
    });
  }
  return scripts;
}

export async function scanPublishResources(adapter = createTavernAdapter()) {
  const [names, binding] = await Promise.all([
    adapter.getWorldbookNames(),
    adapter.getCharWorldbookNames().catch(() => ({ primary: null, additional: [] })),
  ]);
  const bound = new Set([
    binding?.primary,
    ...(binding?.additional || []),
  ].filter(Boolean));

  const worldbooks = [];
  for (const name of names || []) {
    if (!name || name === SHARED_WORLDBOOK_NAME) continue;
    try {
      const entries = clone(await adapter.getWorldbook(name));
      worldbooks.push({
        name,
        bound: bound.has(name),
        entries: (entries || []).map((entry, index) => ({
          uid: entry?.uid === undefined || entry?.uid === null ? '' : String(entry.uid),
          name: entryName(entry) || `条目 ${index + 1}`,
          enabled: entryEnabled(entry),
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

  return {
    characterName: await adapter.getCurrentCharacterName().catch(() => ''),
    worldbooks,
    scripts,
  };
}
