import { SHARED_WORLDBOOK_NAME } from './constants.js';
import { clone, maybe, record } from './utils.js';

function entryUid(entry) {
  const value = entry?.uid;
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function entryName(entry) {
  return String(entry?.comment ?? entry?.name ?? '').trim();
}

function fingerprint(entry) {
  try {
    return JSON.stringify(entry);
  } catch {
    return '';
  }
}

function conflictKey(worldbookName, identity) {
  return `${worldbookName}\u0000${identity.uid ? `uid:${identity.uid}` : `name:${identity.name}`}`;
}

function identityForEntry(entry) {
  const uid = entryUid(entry);
  return uid ? { uid, name: entryName(entry) } : { name: entryName(entry) };
}

function matchesIdentity(entry, identity) {
  if (identity?.uid) return entryUid(entry) === String(identity.uid);
  return entryName(entry) === String(identity?.name || '').trim();
}

function desiredState(value) {
  if (value?.desiredState === 'enabled' || value?.state === 'enabled' || value?.action === 'enable') return 'enabled';
  return 'disabled';
}

function otherClaims(projects, projectId) {
  const claims = new Map();
  for (const project of projects || []) {
    if (!project?.applied || project.id === projectId) continue;
    for (const change of project.installTargets?.originalWorldbookChanges || []) {
      if (!change?.worldbookName || !change?.identity) continue;
      const key = conflictKey(change.worldbookName, change.identity);
      if (!claims.has(key)) claims.set(key, []);
      claims.get(key).push(change);
    }
  }
  return claims;
}

function locateInBooks(books, target) {
  const requestedName = String(target?.worldbook || '').trim();
  const candidates = requestedName
    ? [...books.entries()].filter(([name]) => name === requestedName)
    : [...books.entries()];

  const matches = [];
  for (const [worldbookName, entries] of candidates) {
    entries.forEach((entry, index) => {
      const matched = target?.uid
        ? entryUid(entry) === String(target.uid)
        : entryName(entry) === String(target?.name || '').trim();
      if (matched) matches.push({ worldbookName, index, entry });
    });
  }

  if (!matches.length) {
    const label = target?.name || target?.uid || '未知条目';
    throw new Error(`找不到需要控制状态的原版世界书条目“${label}”`);
  }
  if (matches.length > 1) {
    const label = target?.name || target?.uid || '未知条目';
    throw new Error(`原版世界书条目“${label}”存在多个匹配项，请由作者指定世界书或 UID`);
  }
  return matches[0];
}

function entryEnabled(entry) {
  if (typeof entry?.enabled === 'boolean') return entry.enabled;
  if (typeof entry?.disable === 'boolean') return !entry.disable;
  if (typeof entry?.disabled === 'boolean') return !entry.disabled;
  return true;
}

function setEntryEnabled(entry, enabled) {
  const next = { ...clone(entry), enabled: Boolean(enabled) };
  if ('disable' in next) next.disable = !enabled;
  if ('disabled' in next) next.disabled = !enabled;
  return next;
}

function restoreEnabledState(entry, beforeEntry) {
  return setEntryEnabled(entry, entryEnabled(beforeEntry));
}

function findRecordedEntry(entries, change) {
  const index = entries.findIndex(entry => matchesIdentity(entry, change.identity));
  return index < 0 ? null : { index, entry: entries[index] };
}

async function installedProjects(storage) {
  if (typeof storage.getInstalledProjects !== 'function') return [];
  return maybe(storage.getInstalledProjects());
}

function inheritedClaim(claims, key, ownState) {
  const values = claims.get(key) || [];
  const opposite = values.find(change => desiredState(change) !== ownState);
  if (opposite) {
    throw new Error('另一个已安装工坊作品对同一原世界书条目要求了相反的启用状态，请先停用其中一个作品');
  }
  return values[0] || null;
}

export async function syncOriginalWorldbookConflicts({ adapter, storage }, installed, plan, state) {
  const desired = plan.originalConflicts || [];
  const previous = installed.installTargets?.originalWorldbookChanges || [];
  if (!desired.length && !previous.length) {
    return { changes: [], warnings: [], unrestored: [] };
  }

  const working = new Map(
    [...state.originalWorldbooks.entries()].map(([name, entries]) => [name, clone(entries)]),
  );
  const previousByKey = new Map(previous.map(change => [conflictKey(change.worldbookName, change.identity), change]));
  const claims = otherClaims(await installedProjects(storage), installed.id);
  const nextChanges = [];
  const desiredKeys = new Set();
  const warnings = [];
  const unrestored = [];

  for (const directive of desired) {
    const located = locateInBooks(working, directive.target || {});
    if (located.worldbookName === SHARED_WORLDBOOK_NAME) {
      throw new Error('原版资源状态规则不能指向创意工坊共享世界书');
    }

    const identity = identityForEntry(located.entry);
    const key = conflictKey(located.worldbookName, identity);
    desiredKeys.add(key);

    const targetState = desiredState(directive);
    const previousChange = previousByKey.get(key);
    const inherited = inheritedClaim(claims, key, targetState);
    const currentFingerprint = fingerprint(located.entry);
    const wasModified =
      Boolean(previousChange?.userModified) ||
      Boolean(previousChange?.afterFingerprint && previousChange.afterFingerprint !== currentFingerprint) ||
      Boolean(!previousChange && inherited?.afterFingerprint && inherited.afterFingerprint !== currentFingerprint);

    const beforeEntry = clone(
      previousChange?.beforeEntry ??
      inherited?.beforeEntry ??
      located.entry
    );
    const after = setEntryEnabled(located.entry, targetState === 'enabled');
    working.get(located.worldbookName)[located.index] = after;

    nextChanges.push({
      action: targetState === 'enabled' ? 'enable' : 'disable',
      desiredState: targetState,
      worldbookName: located.worldbookName,
      identity,
      beforeEntry,
      afterFingerprint: fingerprint(after),
      userModified: wasModified,
      artifactIndex: directive.artifactIndex,
      artifactName: directive.artifactName,
    });
  }

  for (const change of previous) {
    const key = conflictKey(change.worldbookName, change.identity);
    if (desiredKeys.has(key)) continue;

    const entries = working.get(change.worldbookName);
    if (!entries) {
      warnings.push(`原世界书“${change.worldbookName}”已不存在，无法自动恢复“${change.identity?.name || change.identity?.uid || ''}”`);
      unrestored.push(change);
      continue;
    }
    const located = findRecordedEntry(entries, change);
    if (!located) {
      warnings.push(`原版条目“${change.identity?.name || change.identity?.uid || ''}”已不存在，跳过恢复`);
      unrestored.push(change);
      continue;
    }

    const inherited = (claims.get(key) || [])[0] || null;
    if (inherited) {
      entries[located.index] = setEntryEnabled(located.entry, desiredState(inherited) === 'enabled');
      continue;
    }

    if (change.userModified || fingerprint(located.entry) !== change.afterFingerprint) {
      warnings.push(`原版条目“${change.identity?.name || change.identity?.uid || ''}”安装后被用户修改，已保留修改并仅恢复原启用状态`);
      entries[located.index] = restoreEnabledState(located.entry, change.beforeEntry);
      continue;
    }
    entries[located.index] = clone(change.beforeEntry);
  }

  for (const [worldbookName, entries] of working) {
    const original = state.originalWorldbooks.get(worldbookName);
    if (fingerprint(original) !== fingerprint(entries)) {
      await maybe(adapter.createOrReplaceWorldbook(worldbookName, entries));
    }
  }

  return { changes: nextChanges, warnings, unrestored };
}

export async function restoreOriginalWorldbookConflicts({ adapter, storage }, installed, state) {
  const previous = installed.installTargets?.originalWorldbookChanges || [];
  if (!previous.length) return { warnings: [], unrestored: [] };

  const claims = otherClaims(await installedProjects(storage), installed.id);
  const working = new Map(
    [...state.originalWorldbooks.entries()].map(([name, entries]) => [name, clone(entries)]),
  );
  const warnings = [];
  const unrestored = [];

  for (const change of previous) {
    const key = conflictKey(change.worldbookName, change.identity);

    const entries = working.get(change.worldbookName);
    if (!entries) {
      warnings.push(`原世界书“${change.worldbookName}”已不存在，无法自动恢复`);
      unrestored.push(change);
      continue;
    }
    const located = findRecordedEntry(entries, change);
    if (!located) {
      warnings.push(`原版条目“${change.identity?.name || change.identity?.uid || ''}”已不存在，无法自动恢复`);
      unrestored.push(change);
      continue;
    }

    const inherited = (claims.get(key) || [])[0] || null;
    if (inherited) {
      entries[located.index] = setEntryEnabled(located.entry, desiredState(inherited) === 'enabled');
      continue;
    }

    if (change.userModified || fingerprint(located.entry) !== change.afterFingerprint) {
      warnings.push(`原版条目“${change.identity?.name || change.identity?.uid || ''}”安装后被用户修改，已保留修改并仅恢复原启用状态`);
      entries[located.index] = restoreEnabledState(located.entry, change.beforeEntry);
      continue;
    }
    entries[located.index] = clone(change.beforeEntry);
  }

  for (const [worldbookName, entries] of working) {
    const original = state.originalWorldbooks.get(worldbookName);
    if (fingerprint(original) !== fingerprint(entries)) {
      await maybe(adapter.createOrReplaceWorldbook(worldbookName, entries));
    }
  }

  return { warnings, unrestored };
}

export function originalConflictTargetKey(worldbookName, identity) {
  return conflictKey(worldbookName, identity);
}

export function isOriginalConflictEntryDisabled(entry) {
  const raw = record(entry);
  if (!raw) return false;
  return !entryEnabled(raw);
}

export function isOriginalConflictEntryInState(entry, state) {
  return entryEnabled(entry) === (state === 'enabled');
}
