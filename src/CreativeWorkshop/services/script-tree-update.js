export const SCRIPT_TREE_SCOPES = ['character', 'preset', 'global'];

export function cloneScriptTree(value) {
  return structuredClone(value);
}

export function scriptsInTrees(trees) {
  const values = [];
  (trees || []).forEach((tree, treeIndex) => {
    if (!tree || typeof tree !== 'object') return;
    if (tree.type === 'folder') {
      (tree.scripts || []).forEach((script, scriptIndex) => {
        if (!script || typeof script !== 'object' || typeof script.content !== 'string') return;
        values.push({ treeIndex, scriptIndex, folder: tree.name || '', script });
      });
      return;
    }
    if (typeof tree.content === 'string') values.push({ treeIndex, scriptIndex: null, folder: '', script: tree });
  });
  return values;
}

export async function scanScriptTrees(adapter, classify) {
  const matches = [];
  const treesByScope = new Map();
  for (const scope of SCRIPT_TREE_SCOPES) {
    let trees;
    try {
      trees = cloneScriptTree(await adapter.getScriptTrees(scope));
    } catch (error) {
      console.warn(`[轮回战场维护] 无法读取 ${scope} 脚本树，继续扫描其它作用域`, error);
      continue;
    }
    treesByScope.set(scope, trees);
    for (const location of scriptsInTrees(trees)) {
      const classification = classify(location.script);
      if (!classification) continue;
      matches.push({
        scope,
        treeIndex: location.treeIndex,
        scriptIndex: location.scriptIndex,
        folder: location.folder,
        id: String(location.script.id || ''),
        name: String(location.script.name || ''),
        ...classification,
      });
    }
  }
  return { matches, treesByScope };
}

export function scriptFromScan(scan, item) {
  const trees = scan.treesByScope.get(item.scope);
  const tree = trees?.[item.treeIndex];
  return item.scriptIndex === null ? tree : tree?.scripts?.[item.scriptIndex];
}

export async function persistScriptTreeMutation(adapter, scan, changedScopes, verify) {
  const scopes = [...changedScopes];
  if (!scopes.length) return;
  const originals = new Map();
  const written = [];
  try {
    for (const scope of scopes) {
      originals.set(scope, cloneScriptTree(await adapter.getScriptTrees(scope)));
      await adapter.replaceScriptTrees(scan.treesByScope.get(scope), scope);
      written.push(scope);
    }
    if (typeof verify === 'function' && !(await verify())) throw new Error('Tavern Helper 写入后校验失败');
  } catch (error) {
    for (const scope of written.reverse()) {
      try { await adapter.replaceScriptTrees(originals.get(scope), scope); } catch {}
    }
    throw error;
  }
}
