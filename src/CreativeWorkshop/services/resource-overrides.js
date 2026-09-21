const STATES = new Set(['enabled', 'disabled']);
const KINDS = new Set(['worldbook', 'regex', 'script']);

function text(value) {
  return String(value ?? '').trim();
}

function normalizeTarget(kind, target = {}) {
  if (kind === 'worldbook') {
    const worldbook = text(target.worldbook);
    const uid = text(target.uid);
    const name = text(target.name);
    return {
      ...(worldbook ? { worldbook } : {}),
      ...(uid ? { uid } : {}),
      ...(name ? { name } : {}),
    };
  }

  if (kind === 'regex') {
    const scope = text(target.scope) || 'character';
    const id = text(target.id);
    const name = text(target.name);
    const findRegex = text(target.find_regex ?? target.findRegex);
    return {
      scope,
      ...(id ? { id } : {}),
      ...(name ? { name } : {}),
      ...(findRegex ? { find_regex: findRegex } : {}),
    };
  }

  const scope = text(target.scope) || 'character';
  const id = text(target.id);
  const name = text(target.name);
  const folder = text(target.folder);
  return {
    scope,
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
    ...(folder ? { folder } : {}),
  };
}

export function resourceOverrideKey(value) {
  const kind = text(value?.kind);
  const target = value?.target || {};
  if (kind === 'worldbook') {
    return `worldbook\u0000${text(target.worldbook)}\u0000${
      text(target.uid) ? `uid:${text(target.uid)}` : `name:${text(target.name)}`
    }`;
  }
  if (kind === 'regex') {
    return `regex\u0000${text(target.scope) || 'character'}\u0000${
      text(target.id)
        ? `id:${text(target.id)}`
        : `name:${text(target.name)}\u0000find:${text(target.find_regex ?? target.findRegex)}`
    }`;
  }
  if (kind === 'script') {
    return `script\u0000${text(target.scope) || 'character'}\u0000${
      text(target.id)
        ? `id:${text(target.id)}`
        : `folder:${text(target.folder)}\u0000name:${text(target.name)}`
    }`;
  }
  return '';
}

export function normalizeResourceOverride(value) {
  const kind = text(value?.kind);
  const state = text(value?.state);
  if (!KINDS.has(kind) || !STATES.has(state)) return null;
  const target = normalizeTarget(kind, value.target);

  if (kind === 'worldbook' && (!target.worldbook || (!target.uid && !target.name))) return null;
  if (kind === 'regex' && (!['character'].includes(target.scope) || (!target.id && !target.name))) return null;
  if (kind === 'script' && (!['character', 'preset', 'global'].includes(target.scope) || (!target.id && !target.name))) return null;

  return { kind, state, target };
}

export function normalizeResourceOverrides(values) {
  const byKey = new Map();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeResourceOverride(value);
    if (!normalized) continue;
    const key = resourceOverrideKey(normalized);
    if (key) byKey.set(key, normalized);
  }
  return [...byKey.values()];
}

export function resourceOverridesFromBundle(bundle) {
  const explicit = normalizeResourceOverrides(bundle?.resource_overrides);
  const byKey = new Map(explicit.map(item => [resourceOverrideKey(item), item]));

  // 当前线上已有版本曾把世界书/脚本的“停用原版”挂在 artifact 上。
  // 打开作者编辑器时一次性提升为统一的资源状态规则；新版本只写 resource_overrides。
  for (const artifact of bundle?.artifacts || []) {
    if (!['worldbook', 'script'].includes(artifact?.kind)) continue;
    for (const conflict of artifact.original_conflicts || []) {
      const target = normalizeTarget(artifact.kind, conflict?.target || {});
      let rule = null;
      if (artifact.kind === 'worldbook') {
        if (!target.uid && !target.name) continue;
        // 旧版声明允许省略 worldbook，由安装预检在当前绑定世界书中做唯一匹配。
        rule = { kind: 'worldbook', state: 'disabled', target };
      } else {
        rule = normalizeResourceOverride({
          kind: 'script',
          state: 'disabled',
          target,
        });
      }
      if (!rule) continue;
      const key = resourceOverrideKey(rule);
      if (!byKey.has(key)) byKey.set(key, rule);
    }
  }

  return [...byKey.values()];
}

export function artifactsWithoutLegacyConflicts(artifacts) {
  return (Array.isArray(artifacts) ? artifacts : []).map(artifact => {
    const next = structuredClone(artifact);
    delete next.original_conflicts;
    return next;
  });
}

export function bundleWithResourceOverrides(artifacts, resourceOverrides = []) {
  const bundle = {
    schema_version: 1,
    artifacts: structuredClone(Array.isArray(artifacts) ? artifacts : []),
  };
  const rules = normalizeResourceOverrides(resourceOverrides);
  if (rules.length) bundle.resource_overrides = structuredClone(rules);
  return bundle;
}
