function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function parseArtifactContent(artifact) {
  if (artifact?.format === 'json') return artifact.content;
  const text = String(artifact?.content ?? '');
  try { return JSON.parse(text); }
  catch { return text; }
}

function arrayValues(value) {
  if (Array.isArray(value)) return value;
  const source = objectValue(value);
  return source ? Object.values(source) : [];
}

function normalizeWorldbookPositionType(entry) {
  const position = objectValue(entry?.position);
  const raw = position?.type
    ?? entry?.positionType
    ?? (typeof entry?.position === 'number' ? entry.position : 'before_character_definition');
  const aliases = {
    before_char: 'before_character_definition',
    after_char: 'after_character_definition',
  };
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^-?\d+$/u.test(trimmed)) {
      const numeric = Number(trimmed);
      const legacy = [
        'before_character_definition',
        'after_character_definition',
        'before_author_note',
        'after_author_note',
        'at_depth',
        'before_example_messages',
        'after_example_messages',
        'outlet',
      ];
      return Number.isInteger(numeric) && numeric >= 0 && numeric < legacy.length
        ? legacy[numeric]
        : `unknown:${trimmed}`;
    }
    return aliases[trimmed] || trimmed || 'before_character_definition';
  }
  const legacy = [
    'before_character_definition',
    'after_character_definition',
    'before_author_note',
    'after_author_note',
    'at_depth',
    'before_example_messages',
    'after_example_messages',
    'outlet',
  ];
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < legacy.length
    ? legacy[raw]
    : `unknown:${String(raw)}`;
}

function normalizeWorldbookRole(entry) {
  const position = objectValue(entry?.position);
  const raw = position?.role ?? entry?.role;
  if (raw === 1 || raw === 'user') return 'user';
  if (raw === 2 || raw === 'assistant') return 'assistant';
  return 'system';
}

function worldbookEntriesFromArtifact(artifact) {
  const parsed = parseArtifactContent(artifact);
  const root = Array.isArray(parsed) ? parsed : objectValue(parsed)?.entries;
  return arrayValues(root).map((raw, index) => {
    const entry = objectValue(raw) || {};
    const strategy = objectValue(entry.strategy) || {};
    const secondary = objectValue(strategy.keys_secondary) || {};
    const position = objectValue(entry.position) || {};
    const uid = entry.uid === undefined || entry.uid === null ? '' : String(entry.uid);
    const name = String(entry.comment ?? entry.name ?? '').trim() || `条目 ${index + 1}`;
    const enabled = typeof entry.enabled === 'boolean'
      ? entry.enabled
      : typeof entry.disable === 'boolean'
        ? !entry.disable
        : true;
    return {
      key: uid ? `uid:${uid}` : `name:${name}:${index}`,
      uid,
      name,
      enabled,
      content: String(entry.content ?? ''),
      primary_keys: Array.isArray(strategy.keys) ? strategy.keys : Array.isArray(entry.key) ? entry.key : [],
      secondary_keys: Array.isArray(secondary.keys) ? secondary.keys : Array.isArray(entry.keysecondary) ? entry.keysecondary : [],
      strategy_type: String(
        strategy.type ??
        (entry.constant === true ? 'constant' : entry.vectorized === true ? 'vectorized' : 'selective'),
      ),
      position_type: normalizeWorldbookPositionType(entry),
      depth: Number.isFinite(Number(position.depth ?? entry.depth))
        ? Number(position.depth ?? entry.depth)
        : 4,
      order: Number.isFinite(Number(position.order ?? entry.order))
        ? Number(position.order ?? entry.order)
        : index,
      role: normalizeWorldbookRole(entry),
      probability: Number.isFinite(Number(entry.probability)) ? Number(entry.probability) : null,
    };
  });
}

function regexValues(parsed) {
  if (Array.isArray(parsed)) return parsed;
  const source = objectValue(parsed);
  if (!source) return [];
  if (Array.isArray(source.regexes)) return source.regexes;
  if (Array.isArray(source.extensions?.regex_scripts)) return source.extensions.regex_scripts;
  if (source.find_regex !== undefined || source.findRegex !== undefined) return [source];
  return [];
}

function regexEntriesFromArtifact(artifact) {
  return regexValues(parseArtifactContent(artifact)).map((raw, index) => {
    const entry = objectValue(raw) || {};
    const name = String(entry.script_name ?? entry.scriptName ?? entry.name ?? entry.id ?? '').trim() || `正则 ${index + 1}`;
    const id = String(entry.id ?? '').trim();
    const find = String(entry.find_regex ?? entry.findRegex ?? '');
    return {
      key: id ? `id:${id}` : `name:${name}:find:${find}`,
      id,
      name,
      enabled: entry.enabled !== false && entry.disabled !== true,
      find_regex: find,
      replace_string: String(entry.replace_string ?? entry.replaceString ?? ''),
      run_on_edit: Boolean(entry.run_on_edit ?? entry.runOnEdit),
      min_depth: Number.isFinite(Number(entry.min_depth ?? entry.minDepth)) ? Number(entry.min_depth ?? entry.minDepth) : null,
      max_depth: Number.isFinite(Number(entry.max_depth ?? entry.maxDepth)) ? Number(entry.max_depth ?? entry.maxDepth) : null,
    };
  });
}

function flattenScriptTree(value, scope, folder = '', output = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output;
  if (value.type === 'folder') {
    const nextFolder = String(value.name || folder || '').trim();
    for (const script of value.scripts || []) flattenScriptTree(script, scope, nextFolder, output);
    return output;
  }
  if (value.type === 'script' || typeof value.content === 'string') {
    const name = String(value.name || value.id || '未命名脚本').trim();
    const id = String(value.id || '').trim();
    output.push({
      key: id ? `id:${id}` : `scope:${scope}:folder:${folder}:name:${name}`,
      id,
      name,
      folder,
      scope,
      enabled: value.enabled !== false,
      content: String(value.content || ''),
    });
  }
  return output;
}

function scriptsFromArtifact(artifact) {
  const scope = String(artifact.scope || 'character');
  if (artifact.format === 'text') {
    return [{
      key: `artifact:${artifact.name}:scope:${scope}`,
      id: '',
      name: artifact.name,
      folder: '',
      scope,
      enabled: true,
      content: String(artifact.content || ''),
    }];
  }
  const parsed = parseArtifactContent(artifact);
  const trees = Array.isArray(parsed) ? parsed : [parsed];
  const output = [];
  for (const tree of trees) flattenScriptTree(tree, scope, '', output);
  return output;
}

function resourceOverrideKey(rule) {
  const target = rule?.target || {};
  if (rule?.kind === 'worldbook') {
    return `worldbook:${target.worldbook || ''}:${target.uid ? `uid:${target.uid}` : `name:${target.name || ''}`}`;
  }
  if (rule?.kind === 'regex') {
    return `regex:${target.scope || 'character'}:${target.id ? `id:${target.id}` : `name:${target.name || ''}:find:${target.find_regex || ''}`}`;
  }
  return `script:${target.scope || ''}:${target.id ? `id:${target.id}` : `folder:${target.folder || ''}:name:${target.name || ''}`}`;
}

function bundleResourceOverrides(bundle) {
  const byKey = new Map();
  for (const raw of bundle?.resource_overrides || []) {
    if (!raw || !['worldbook', 'regex', 'script'].includes(raw.kind) || !['enabled', 'disabled'].includes(raw.state)) continue;
    const item = {
      key: resourceOverrideKey(raw),
      kind: raw.kind,
      state: raw.state,
      target: raw.target || {},
    };
    byKey.set(item.key, item);
  }

  for (const artifact of bundle?.artifacts || []) {
    if (!['worldbook', 'script'].includes(artifact?.kind)) continue;
    for (const conflict of artifact.original_conflicts || []) {
      const raw = {
        kind: artifact.kind,
        state: 'disabled',
        target: conflict?.target || {},
      };
      const key = resourceOverrideKey(raw);
      if (!byKey.has(key)) {
        byKey.set(key, { key, ...raw });
      }
    }
  }
  return [...byKey.values()];
}

function textPreview(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return String(text ?? '');
}

export function buildPublicContentPreview(bundle) {
  const artifacts = [];
  const worldbookEntries = [];
  const regexEntries = [];
  const scripts = [];
  let presetCount = 0;
  let dataCount = 0;
  const resourceOverrides = bundleResourceOverrides(bundle);

  for (const [index, artifact] of (bundle?.artifacts || []).entries()) {
    const base = {
      index,
      kind: artifact.kind,
      name: artifact.name,
      format: artifact.format,
      ...(artifact.scope ? { scope: artifact.scope } : {}),
      original_conflicts: Array.isArray(artifact.original_conflicts) ? artifact.original_conflicts : [],
    };

    if (artifact.kind === 'worldbook') {
      const entries = worldbookEntriesFromArtifact(artifact);
      entries.forEach(entry => worldbookEntries.push({ ...entry, artifact_name: artifact.name }));
      artifacts.push({ ...base, entry_count: entries.length });
      continue;
    }
    if (artifact.kind === 'regex') {
      const entries = regexEntriesFromArtifact(artifact);
      entries.forEach(entry => regexEntries.push({ ...entry, artifact_name: artifact.name }));
      artifacts.push({ ...base, entry_count: entries.length });
      continue;
    }
    if (artifact.kind === 'script') {
      const entries = scriptsFromArtifact(artifact);
      entries.forEach(entry => scripts.push({ ...entry, artifact_name: artifact.name }));
      artifacts.push({ ...base, entry_count: entries.length });
      continue;
    }

    if (artifact.kind === 'preset') presetCount += 1;
    if (artifact.kind === 'data') dataCount += 1;
    artifacts.push({
      ...base,
      entry_count: 1,
      preview: textPreview(parseArtifactContent(artifact)),
    });
  }

  return {
    artifacts,
    worldbook_entries: worldbookEntries,
    regex_entries: regexEntries,
    scripts,
    resource_overrides: resourceOverrides,
    counts: {
      artifacts: artifacts.length,
      worldbook_entries: worldbookEntries.length,
      regex_entries: regexEntries.length,
      scripts: scripts.length,
      presets: presetCount,
      data: dataCount,
      resource_overrides: resourceOverrides.length,
    },
  };
}

function changedFields(before, after) {
  const fields = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...fields].filter(field => field !== 'key' && JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field]));
}

function diffCollection(before, after, titleField = 'name') {
  const beforeMap = new Map((before || []).map(item => [item.key, item]));
  const afterMap = new Map((after || []).map(item => [item.key, item]));
  const changes = [];

  for (const item of after || []) {
    const previous = beforeMap.get(item.key);
    if (!previous) {
      changes.push({ status: 'added', key: item.key, title: item[titleField] || item.key, changed_fields: [] });
      continue;
    }
    const fields = changedFields(previous, item);
    if (fields.length) {
      changes.push({ status: 'modified', key: item.key, title: item[titleField] || item.key, changed_fields: fields });
    }
  }
  for (const item of before || []) {
    if (!afterMap.has(item.key)) {
      changes.push({ status: 'removed', key: item.key, title: item[titleField] || item.key, changed_fields: [] });
    }
  }
  return changes;
}

export function buildPublicChangePreview(previousPreview, currentPreview, previousVersion, currentVersion) {
  if (!previousPreview) return null;
  const worldbook = diffCollection(previousPreview.worldbook_entries, currentPreview.worldbook_entries);
  const regex = diffCollection(previousPreview.regex_entries, currentPreview.regex_entries);
  const scripts = diffCollection(previousPreview.scripts, currentPreview.scripts);
  const resourceOverrides = diffCollection(
    previousPreview.resource_overrides,
    currentPreview.resource_overrides,
    'key',
  );
  const all = [...worldbook, ...regex, ...scripts, ...resourceOverrides];
  return {
    from_version: Number(previousVersion),
    to_version: Number(currentVersion),
    summary: {
      added: all.filter(item => item.status === 'added').length,
      modified: all.filter(item => item.status === 'modified').length,
      removed: all.filter(item => item.status === 'removed').length,
    },
    worldbook,
    regex,
    scripts,
    resource_overrides: resourceOverrides,
  };
}
