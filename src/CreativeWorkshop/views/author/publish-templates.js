function text(form, name) {
  return String(form.get(name) || '').trim();
}

function csv(value) {
  return String(value || '')
    .split(/[,，\n]/u)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseJsonField(form, name, label, fallback) {
  const raw = text(form, name);
  if (!raw) return structuredClone(fallback);
  try {
    const value = JSON.parse(raw);
    if (value === null || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new Error(`${label}必须填写有效 JSON`);
  }
}

function worldCharacterContent(profile) {
  const lines = [
    `【角色】${profile.name}`,
    profile.race && `种族：${profile.race}`,
    profile.identities.length && `身份：${profile.identities.join(' / ')}`,
    profile.occupation && `职业：${profile.occupation}`,
    profile.rank && `层级：${profile.rank}`,
    profile.personality && `性格：${profile.personality}`,
    profile.appearance && `外貌：${profile.appearance}`,
    profile.background && `背景故事：${profile.background}`,
    profile.notes && `补充设定：${profile.notes}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export function resolvePublishMode(category, characterKind, extensionKind) {
  if (category === 'character') {
    if (['world_character', 'opening_character', 'opening_partner'].includes(characterKind)) {
      return characterKind;
    }
    return 'world_character';
  }
  return extensionKind === 'store_catalog' ? 'store_catalog' : 'extension';
}

export function isDedicatedPublishMode(mode) {
  return ['world_character', 'opening_character', 'opening_partner', 'store_catalog'].includes(mode);
}

export function buildDedicatedArtifacts(form, mode, projectName) {
  if (mode === 'world_character') {
    const name = text(form, 'world_name') || projectName;
    if (!name) throw new Error('请填写世界角色姓名');
    const aliases = csv(text(form, 'world_keywords'));
    const profile = {
      name,
      aliases,
      race: text(form, 'world_race'),
      identities: csv(text(form, 'world_identity')),
      occupation: text(form, 'world_occupation'),
      rank: text(form, 'world_rank') || 'Ⅰ',
      personality: text(form, 'world_personality'),
      appearance: text(form, 'world_appearance'),
      background: text(form, 'world_background'),
      notes: text(form, 'world_notes'),
    };
    const keys = [...new Set([name, ...aliases])];
    return [
      {
        kind: 'worldbook',
        name: `${name}.worldbook.json`,
        format: 'json',
        content: {
          entries: [{
            name: `[角色] ${name}`,
            enabled: true,
            strategy: {
              type: 'selective',
              keys,
              keys_secondary: { logic: 'and_any', keys: [] },
              scan_depth: 'same_as_global',
            },
            position: { type: 'at_depth', role: 'system', depth: 4, order: 100 },
            content: worldCharacterContent(profile),
            probability: 100,
          }],
        },
      },
      {
        kind: 'data',
        name: `${name}.character.json`,
        format: 'json',
        content: {
          schema_version: 1,
          kind: 'world_character',
          name,
          profile,
        },
      },
    ];
  }

  if (mode === 'opening_character' || mode === 'opening_partner') {
    const name = text(form, 'opening_name') || projectName;
    if (!name) throw new Error(mode === 'opening_partner' ? '请填写开局伙伴姓名' : '请填写开局角色姓名');
    const build = {
      种族: text(form, 'opening_race') || '人类',
      身份: csv(text(form, 'opening_identity')),
      职业: text(form, 'opening_occupation'),
      层级: text(form, 'opening_rank') || 'Ⅰ',
      血统: parseJsonField(form, 'opening_bloodline', '血统', {}),
      技能: parseJsonField(form, 'opening_skills', '技能', {}),
      装备: parseJsonField(form, 'opening_equipment', '装备', {}),
      状态: parseJsonField(form, 'opening_status', '状态', {}),
      形态库: parseJsonField(form, 'opening_forms', '形态库', {}),
      当前形态: parseJsonField(form, 'opening_current_form', '当前形态', { 激活: false, 名称: '' }),
    };
    const profile = {
      性格: text(form, 'opening_personality'),
      喜爱: text(form, 'opening_likes'),
      背景故事: text(form, 'opening_background'),
    };
    return [{
      kind: 'data',
      name: `${name}.opening.json`,
      format: 'json',
      content: {
        schema_version: 1,
        kind: mode,
        name,
        ...(mode === 'opening_partner' ? { profile } : {}),
        build,
      },
    }];
  }

  if (mode === 'store_catalog') {
    const equipments = parseJsonField(form, 'store_equipments', '装备目录', []);
    const items = parseJsonField(form, 'store_items', '道具目录', []);
    const skills = parseJsonField(form, 'store_skills', '技能目录', []);
    for (const [label, value] of [['装备目录', equipments], ['道具目录', items], ['技能目录', skills]]) {
      if (!Array.isArray(value)) throw new Error(`${label}必须是 JSON 数组`);
    }
    if (!equipments.length && !items.length && !skills.length) {
      throw new Error('商店至少需要填写一项装备、道具或技能');
    }
    return [{
      kind: 'data',
      name: `${projectName || '开局商店'}.store.json`,
      format: 'json',
      content: {
        schema_version: 1,
        kind: 'store_catalog',
        catalog: { equipments, items, skills },
      },
    }];
  }

  return [];
}


function dataValues(artifacts = []) {
  return artifacts.flatMap(artifact => {
    if (artifact?.kind !== 'data') return [];
    return Array.isArray(artifact.content) ? artifact.content : [artifact.content];
  }).filter(value => value && typeof value === 'object');
}

export function detectPublishMode(category, artifacts = []) {
  const kinds = new Set(dataValues(artifacts).map(value => value.kind));
  if (category === 'character') {
    if (kinds.has('opening_partner')) return 'opening_partner';
    if (kinds.has('opening_character')) return 'opening_character';
    return 'world_character';
  }
  return kinds.has('store_catalog') ? 'store_catalog' : 'extension';
}

export function dedicatedInitialValues(artifacts = [], mode, projectName = '') {
  const values = dataValues(artifacts);
  if (mode === 'world_character') {
    const data = values.find(value => value.kind === 'world_character') || {};
    const profile = data.profile || {};
    return {
      world_name: data.name || profile.name || projectName,
      world_keywords: (profile.aliases || []).join(', '),
      world_race: profile.race || '',
      world_identity: (profile.identities || []).join(', '),
      world_occupation: profile.occupation || '',
      world_rank: profile.rank || 'Ⅰ',
      world_personality: profile.personality || '',
      world_appearance: profile.appearance || '',
      world_background: profile.background || '',
      world_notes: profile.notes || '',
    };
  }
  if (mode === 'opening_character' || mode === 'opening_partner') {
    const data = values.find(value => value.kind === mode) || {};
    const build = data.build || data.character || {};
    const profile = data.profile || {};
    const json = value => JSON.stringify(value ?? {}, null, 2);
    return {
      opening_name: data.name || projectName,
      opening_race: build.种族 || '人类',
      opening_identity: Array.isArray(build.身份) ? build.身份.join(', ') : String(build.身份 || ''),
      opening_occupation: typeof build.职业 === 'string' ? build.职业 : json(build.职业 || {}),
      opening_rank: build.层级 || 'Ⅰ',
      opening_personality: profile.性格 || '',
      opening_likes: profile.喜爱 || '',
      opening_background: profile.背景故事 || '',
      opening_bloodline: json(build.血统 || {}),
      opening_skills: json(build.技能 || {}),
      opening_equipment: json(build.装备 || {}),
      opening_status: json(build.状态 || {}),
      opening_forms: json(build.形态库 || {}),
      opening_current_form: json(build.当前形态 || { 激活: false, 名称: '' }),
    };
  }
  if (mode === 'store_catalog') {
    const data = values.find(value => value.kind === 'store_catalog') || {};
    const catalog = data.catalog || {};
    return {
      store_equipments: JSON.stringify(catalog.equipments || [], null, 2),
      store_items: JSON.stringify(catalog.items || [], null, 2),
      store_skills: JSON.stringify(catalog.skills || [], null, 2),
    };
  }
  return {};
}
