import { clone, maybe } from './utils.js';

function fingerprint(value) {
  try { return JSON.stringify(value); } catch { return ''; }
}

function regexName(regex) {
  return String(regex?.script_name ?? regex?.scriptName ?? regex?.name ?? '').trim();
}

function regexId(regex) {
  return String(regex?.id || '').trim();
}

function regexFind(regex) {
  return String(regex?.find_regex ?? regex?.findRegex ?? '').trim();
}

function regexEnabled(regex) {
  if (typeof regex?.enabled === 'boolean') return regex.enabled;
  if (typeof regex?.disabled === 'boolean') return !regex.disabled;
  return true;
}

function setRegexEnabled(regex, enabled) {
  const next = { ...clone(regex), enabled: Boolean(enabled) };
  if ('disabled' in next) next.disabled = !enabled;
  return next;
}

function restoreEnabledState(regex, beforeRegex) {
  return setRegexEnabled(regex, regexEnabled(beforeRegex));
}

function desiredState(value) {
  if (value?.desiredState === 'enabled' || value?.state === 'enabled' || value?.action === 'enable') return 'enabled';
  return 'disabled';
}

function regexIdentity(regex) {
  const id = regexId(regex);
  return {
    ...(id ? { id } : {}),
    name: regexName(regex),
    ...(!id && regexFind(regex) ? { find_regex: regexFind(regex) } : {}),
  };
}

function identityKey(identity) {
  return identity?.id
    ? `id:${identity.id}`
    : `name:${String(identity?.name || '').trim()}\u0000find:${String(identity?.find_regex || '').trim()}`;
}

function matchesIdentity(regex, identity) {
  if (identity?.id) return regexId(regex) === String(identity.id);
  if (regexName(regex) !== String(identity?.name || '').trim()) return false;
  if (identity?.find_regex && regexFind(regex) !== String(identity.find_regex).trim()) return false;
  return true;
}

export function findOriginalRegexTargets(regexes, target) {
  const requestedId = String(target?.id || '').trim();
  const requestedName = String(target?.name || '').trim();
  const requestedFind = String(target?.find_regex ?? target?.findRegex ?? '').trim();
  return (regexes || [])
    .map((regex, index) => ({ regex, index }))
    .filter(({ regex }) => {
      if (requestedId) return regexId(regex) === requestedId;
      if (!requestedName || regexName(regex) !== requestedName) return false;
      if (requestedFind && regexFind(regex) !== requestedFind) return false;
      return true;
    });
}

function locateRegex(regexes, target) {
  const matches = findOriginalRegexTargets(regexes, target);
  const label = target?.name || target?.id || '未知正则';
  if (!matches.length) throw new Error(`找不到需要控制状态的原正则“${label}”`);
  if (matches.length > 1) throw new Error(`原正则“${label}”存在多个匹配项，请由作者指定正则 ID 或匹配表达式`);
  return matches[0];
}

function otherClaims(projects, projectId, characterName) {
  const claims = new Map();
  for (const project of projects || []) {
    if (!project?.applied || project.id === projectId) continue;
    if (project.targetCharacterName && project.targetCharacterName !== characterName) continue;
    for (const change of project.installTargets?.originalRegexChanges || []) {
      if (!change?.identity) continue;
      const key = identityKey(change.identity);
      if (!claims.has(key)) claims.set(key, []);
      claims.get(key).push(change);
    }
  }
  return claims;
}

async function installedProjects(storage) {
  if (typeof storage.getInstalledProjects !== 'function') return [];
  return maybe(storage.getInstalledProjects());
}

function inheritedClaim(claims, key, ownState) {
  const values = claims.get(key) || [];
  const opposite = values.find(change => desiredState(change) !== ownState);
  if (opposite) {
    throw new Error('另一个已安装工坊作品对同一原正则要求了相反的启用状态，请先停用其中一个作品');
  }
  return values[0] || null;
}

export async function syncOriginalRegexConflicts({ adapter, storage }, installed, plan) {
  const desired = plan.originalRegexConflicts || [];
  const previous = installed.installTargets?.originalRegexChanges || [];
  if (!desired.length && !previous.length) {
    return { changes: [], warnings: [], unrestored: [] };
  }

  const working = clone(await maybe(adapter.getCharacterRegexes()));
  const baseline = clone(working);
  const previousByKey = new Map(previous.map(change => [identityKey(change.identity), change]));
  const claims = otherClaims(await installedProjects(storage), installed.id, await maybe(adapter.getCurrentCharacterName()));
  const desiredKeys = new Set();
  const changes = [];
  const warnings = [];
  const unrestored = [];

  for (const directive of desired) {
    const located = locateRegex(working, directive.target || {});
    const identity = regexIdentity(located.regex);
    const key = identityKey(identity);
    desiredKeys.add(key);

    const targetState = desiredState(directive);
    const previousChange = previousByKey.get(key);
    const inherited = inheritedClaim(claims, key, targetState);
    const currentFingerprint = fingerprint(located.regex);
    const wasModified =
      Boolean(previousChange?.userModified) ||
      Boolean(previousChange?.afterFingerprint && previousChange.afterFingerprint !== currentFingerprint) ||
      Boolean(!previousChange && inherited?.afterFingerprint && inherited.afterFingerprint !== currentFingerprint);

    const beforeRegex = clone(
      previousChange?.beforeRegex ??
      inherited?.beforeRegex ??
      located.regex,
    );
    const after = setRegexEnabled(located.regex, targetState === 'enabled');
    working[located.index] = after;

    changes.push({
      action: targetState === 'enabled' ? 'enable' : 'disable',
      desiredState: targetState,
      scope: 'character',
      identity,
      beforeRegex,
      afterFingerprint: fingerprint(after),
      userModified: wasModified,
    });
  }

  for (const change of previous) {
    const key = identityKey(change.identity);
    if (desiredKeys.has(key)) continue;

    const matches = findOriginalRegexTargets(working, change.identity || {});
    if (matches.length !== 1) {
      warnings.push(`原正则“${change.identity?.name || change.identity?.id || ''}”已不存在或无法唯一匹配，跳过恢复`);
      unrestored.push(change);
      continue;
    }
    const located = matches[0];

    const inherited = (claims.get(key) || [])[0] || null;
    if (inherited) {
      working[located.index] = setRegexEnabled(located.regex, desiredState(inherited) === 'enabled');
      continue;
    }

    if (change.userModified || fingerprint(located.regex) !== change.afterFingerprint) {
      warnings.push(`原正则“${change.identity?.name || change.identity?.id || ''}”安装后被用户修改，已保留修改并仅恢复原启用状态`);
      working[located.index] = restoreEnabledState(located.regex, change.beforeRegex);
      continue;
    }
    working[located.index] = clone(change.beforeRegex);
  }

  if (fingerprint(baseline) !== fingerprint(working)) {
    await maybe(adapter.replaceCharacterRegexes(working));
  }

  return { changes, warnings, unrestored };
}

export async function restoreOriginalRegexConflicts({ adapter, storage }, installed) {
  const previous = installed.installTargets?.originalRegexChanges || [];
  if (!previous.length) return { warnings: [], unrestored: [] };

  const claims = otherClaims(await installedProjects(storage), installed.id, await maybe(adapter.getCurrentCharacterName()));
  const working = clone(await maybe(adapter.getCharacterRegexes()));
  const baseline = clone(working);
  const warnings = [];
  const unrestored = [];

  for (const change of previous) {
    const key = identityKey(change.identity);
    const matches = findOriginalRegexTargets(working, change.identity || {});
    if (matches.length !== 1) {
      warnings.push(`原正则“${change.identity?.name || change.identity?.id || ''}”已不存在或无法唯一匹配，无法自动恢复`);
      unrestored.push(change);
      continue;
    }
    const located = matches[0];

    const inherited = (claims.get(key) || [])[0] || null;
    if (inherited) {
      working[located.index] = setRegexEnabled(located.regex, desiredState(inherited) === 'enabled');
      continue;
    }

    if (change.userModified || fingerprint(located.regex) !== change.afterFingerprint) {
      warnings.push(`原正则“${change.identity?.name || change.identity?.id || ''}”安装后被用户修改，已保留修改并仅恢复原启用状态`);
      working[located.index] = restoreEnabledState(located.regex, change.beforeRegex);
      continue;
    }
    working[located.index] = clone(change.beforeRegex);
  }

  if (fingerprint(baseline) !== fingerprint(working)) {
    await maybe(adapter.replaceCharacterRegexes(working));
  }

  return { warnings, unrestored };
}

export function isOriginalRegexInState(regex, state) {
  return regexEnabled(regex) === (state === 'enabled');
}

export function originalRegexTargetKey(identity) {
  return identityKey(identity);
}
