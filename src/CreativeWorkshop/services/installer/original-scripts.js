import { clone, maybe, record } from './utils.js';

function fingerprint(value) {
  try { return JSON.stringify(value); } catch { return ''; }
}

function scriptEnabled(script) {
  return script?.enabled !== false;
}

function disabledScript(script) {
  return { ...clone(script), enabled: false };
}

function restoreEnabledState(script, beforeScript) {
  const next = clone(script);
  next.enabled = scriptEnabled(beforeScript);
  return next;
}

function scriptIdentity(script, folderName = '') {
  const id = String(script?.id || '').trim();
  return {
    ...(id ? { id } : {}),
    name: String(script?.name || '').trim(),
    ...(folderName ? { folder: folderName } : {}),
  };
}

function identityKey(scope, identity) {
  const discriminator = identity?.id
    ? `id:${identity.id}`
    : `name:${String(identity?.name || '').trim()}\u0000folder:${String(identity?.folder || '').trim()}`;
  return `${scope}\u0000${discriminator}`;
}

function matchesIdentity(script, folderName, identity) {
  if (identity?.id) return String(script?.id || '') === String(identity.id);
  if (String(script?.name || '').trim() !== String(identity?.name || '').trim()) return false;
  if (identity?.folder && String(folderName || '').trim() !== String(identity.folder).trim()) return false;
  return true;
}

function scriptLocations(trees) {
  const locations = [];
  (trees || []).forEach((tree, treeIndex) => {
    if (!tree || typeof tree !== 'object') return;
    if (tree.type === 'folder') {
      const folderName = String(tree.name || '').trim();
      (tree.scripts || []).forEach((script, scriptIndex) => {
        if (!script || typeof script !== 'object' || script.type === 'folder') return;
        locations.push({
          treeIndex,
          scriptIndex,
          folderName,
          script,
          set(next) {
            trees[treeIndex].scripts[scriptIndex] = next;
          },
        });
      });
      return;
    }
    if (tree.type === 'script' || typeof tree.content === 'string') {
      locations.push({
        treeIndex,
        scriptIndex: null,
        folderName: '',
        script: tree,
        set(next) {
          trees[treeIndex] = next;
        },
      });
    }
  });
  return locations;
}

export function findOriginalScriptTargets(trees, target) {
  const requestedId = String(target?.id || '').trim();
  const requestedName = String(target?.name || '').trim();
  const requestedFolder = String(target?.folder || '').trim();
  return scriptLocations(trees).filter(location => {
    if (requestedId) return String(location.script?.id || '') === requestedId;
    if (!requestedName) return false;
    if (String(location.script?.name || '').trim() !== requestedName) return false;
    if (requestedFolder && location.folderName !== requestedFolder) return false;
    return true;
  });
}

function locateScript(working, target) {
  const scope = String(target?.scope || '').trim();
  const trees = working.get(scope);
  if (!trees) throw new Error(`找不到需要关闭的原脚本作用域“${scope || '未知'}”`);
  const matches = findOriginalScriptTargets(trees, target);
  const label = target?.name || target?.id || '未知脚本';
  if (!matches.length) throw new Error(`找不到需要关闭的原脚本“${label}”`);
  if (matches.length > 1) throw new Error(`原脚本“${label}”存在多个匹配项，请由作者指定脚本 ID 或文件夹名`);
  return { scope, ...matches[0] };
}

function otherClaims(projects, projectId) {
  const claims = new Map();
  for (const project of projects || []) {
    if (!project?.applied || project.id === projectId) continue;
    for (const change of project.installTargets?.originalScriptChanges || []) {
      if (!change?.scope || !change?.identity) continue;
      claims.set(identityKey(change.scope, change.identity), change);
    }
  }
  return claims;
}

async function installedProjects(storage) {
  if (typeof storage.getInstalledProjects !== 'function') return [];
  return maybe(storage.getInstalledProjects());
}

function findRecordedScript(trees, change) {
  const matches = scriptLocations(trees).filter(location =>
    matchesIdentity(location.script, location.folderName, change.identity),
  );
  return matches.length === 1 ? matches[0] : null;
}

export async function syncOriginalScriptConflicts({ adapter, storage }, installed, plan, state) {
  const desired = plan.originalScriptConflicts || [];
  const previous = installed.installTargets?.originalScriptChanges || [];
  if (!desired.length && !previous.length) {
    return { changes: [], warnings: [], unrestored: [] };
  }

  const working = new Map(
    [...state.scripts.entries()].map(([scope, trees]) => [scope, clone(trees)]),
  );
  const previousByKey = new Map(previous.map(change => [identityKey(change.scope, change.identity), change]));
  const claims = otherClaims(await installedProjects(storage), installed.id);
  const desiredKeys = new Set();
  const nextChanges = [];
  const warnings = [];
  const unrestored = [];

  for (const directive of desired) {
    const located = locateScript(working, directive.target || {});
    const identity = scriptIdentity(located.script, located.folderName);
    const key = identityKey(located.scope, identity);
    desiredKeys.add(key);

    const previousChange = previousByKey.get(key);
    const inherited = claims.get(key);
    const currentFingerprint = fingerprint(located.script);
    const wasModified =
      Boolean(previousChange?.userModified) ||
      Boolean(previousChange?.afterFingerprint && previousChange.afterFingerprint !== currentFingerprint) ||
      Boolean(!previousChange && inherited?.afterFingerprint && inherited.afterFingerprint !== currentFingerprint);

    const beforeScript = clone(
      previousChange?.beforeScript ??
      inherited?.beforeScript ??
      located.script,
    );
    const after = disabledScript(located.script);
    located.set(after);

    nextChanges.push({
      action: directive.action,
      scope: located.scope,
      identity,
      beforeScript,
      afterFingerprint: fingerprint(after),
      userModified: wasModified,
      artifactIndex: directive.artifactIndex,
      artifactName: directive.artifactName,
    });
  }

  for (const change of previous) {
    const key = identityKey(change.scope, change.identity);
    if (desiredKeys.has(key) || claims.has(key)) continue;

    const trees = working.get(change.scope);
    if (!trees) {
      warnings.push(`原脚本作用域“${change.scope}”不可用，无法自动恢复“${change.identity?.name || change.identity?.id || ''}”`);
      unrestored.push(change);
      continue;
    }
    const located = findRecordedScript(trees, change);
    if (!located) {
      warnings.push(`原脚本“${change.identity?.name || change.identity?.id || ''}”已不存在，跳过恢复`);
      unrestored.push(change);
      continue;
    }
    if (change.userModified || fingerprint(located.script) !== change.afterFingerprint) {
      warnings.push(`原脚本“${change.identity?.name || change.identity?.id || ''}”安装后被用户修改，已保留修改并仅恢复原启用状态`);
      located.set(restoreEnabledState(located.script, change.beforeScript));
      continue;
    }
    located.set(clone(change.beforeScript));
  }

  for (const [scope, trees] of working) {
    const original = state.scripts.get(scope);
    if (fingerprint(original) !== fingerprint(trees)) {
      await maybe(adapter.replaceScriptTrees(trees, scope));
    }
  }

  return { changes: nextChanges, warnings, unrestored };
}

export async function restoreOriginalScriptConflicts({ adapter, storage }, installed, state) {
  const previous = installed.installTargets?.originalScriptChanges || [];
  if (!previous.length) return { warnings: [], unrestored: [] };

  const claims = otherClaims(await installedProjects(storage), installed.id);
  const working = new Map(
    [...state.scripts.entries()].map(([scope, trees]) => [scope, clone(trees)]),
  );
  const warnings = [];
  const unrestored = [];

  for (const change of previous) {
    const key = identityKey(change.scope, change.identity);
    if (claims.has(key)) continue;

    const trees = working.get(change.scope);
    if (!trees) {
      warnings.push(`原脚本作用域“${change.scope}”不可用，无法自动恢复`);
      unrestored.push(change);
      continue;
    }
    const located = findRecordedScript(trees, change);
    if (!located) {
      warnings.push(`原脚本“${change.identity?.name || change.identity?.id || ''}”已不存在，无法自动恢复`);
      unrestored.push(change);
      continue;
    }
    if (change.userModified || fingerprint(located.script) !== change.afterFingerprint) {
      warnings.push(`原脚本“${change.identity?.name || change.identity?.id || ''}”安装后被用户修改，已保留修改并仅恢复原启用状态`);
      located.set(restoreEnabledState(located.script, change.beforeScript));
      continue;
    }
    located.set(clone(change.beforeScript));
  }

  for (const [scope, trees] of working) {
    const original = state.scripts.get(scope);
    if (fingerprint(original) !== fingerprint(trees)) {
      await maybe(adapter.replaceScriptTrees(trees, scope));
    }
  }

  return { warnings, unrestored };
}

export function isOriginalScriptDisabled(script) {
  const raw = record(script);
  return Boolean(raw) && raw.enabled === false;
}

export function originalScriptTargetKey(scope, identity) {
  return identityKey(scope, identity);
}
