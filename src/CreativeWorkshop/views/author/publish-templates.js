const OPENING_RANKS = new Set(['Ⅰ', 'Ⅱ', 'Ⅲ']);
const RANK_QUALITY = { 'Ⅰ': 'F', 'Ⅱ': 'E', 'Ⅲ': 'D' };
const STORE_QUALITIES = new Set(['F', 'E', 'D']);
const POINT_QUALITIES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const BLOOD_ATTRS = ['力量', '敏捷', '体质', '精神', '魅力'];

function read(source, name) {
  if (source && typeof source.get === 'function') return String(source.get(name) || '').trim();
  return String(source?.[name] || '').trim();
}

function csv(value) {
  return String(value || '')
    .split(/[,，\n]/u)
    .map(item => item.trim())
    .filter(Boolean);
}

function clampPoint(value) {
  return Math.max(0, Math.min(8, Math.trunc(Number(value) || 0)));
}

function pointTier(value) {
  return POINT_QUALITIES[clampPoint(value)] || 'SSS';
}

function rankQuality(rank) {
  return RANK_QUALITY[rank] || 'F';
}

function effect(name, description) {
  const body = String(description || '').trim();
  if (!body) return {};
  return { [String(name || '').trim() || '效果']: body };
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

export function resolvePublishMode(categorySelection, characterKind = '') {
  if (categorySelection === 'store_catalog') return 'store_catalog';
  if (categorySelection === 'character') {
    return ['world_character', 'opening_character', 'opening_partner'].includes(characterKind)
      ? characterKind
      : 'world_character';
  }
  return 'extension';
}

export function projectCategoryForSelection(categorySelection) {
  return categorySelection === 'character' ? 'character' : 'extension';
}

export function isDedicatedPublishMode(mode) {
  return ['world_character', 'opening_character', 'opening_partner', 'store_catalog'].includes(mode);
}

function validatePointBudget(source, mode) {
  const budget = mode === 'opening_partner' ? 16 : 8;
  const raw = source?.opening_attributes || {};
  const points = Object.fromEntries(BLOOD_ATTRS.map(attr => [attr, clampPoint(raw[attr])]));
  const total = Object.values(points).reduce((sum, value) => sum + value, 0);
  if (total > budget) throw new Error(`五维加点超过上限：当前 ${total} / ${budget}`);
  return points;
}

function validatePartnerEquipment(source) {
  const rows = Array.isArray(source?.opening_partner_equipment)
    ? source.opening_partner_equipment
    : [];
  const result = {};
  for (const [index, item] of rows.entries()) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    if (!STORE_QUALITIES.has(String(item.品质 || '').toUpperCase())) {
      throw new Error(`伙伴装备“${name}”品质只能是 F、E、D`);
    }
    if (Object.keys(item.效果 || {}).length > 2) {
      throw new Error(`伙伴装备“${name}”最多只能填写 2 条效果`);
    }
    result[name] = {
      品质: String(item.品质 || 'F').toUpperCase(),
      类型: Math.max(0, Math.min(8, Number(item.类型) || 0)),
      标签: Array.isArray(item.标签) ? item.标签 : [],
      原始属性: item.原始属性 && typeof item.原始属性 === 'object' ? structuredClone(item.原始属性) : {},
      效果: item.效果 && typeof item.效果 === 'object' ? structuredClone(item.效果) : {},
      描述: String(item.描述 || ''),
      消耗: String(item.消耗 || '无'),
      状态: 0,
    };
    if (index > 50) break;
  }
  return result;
}

function openingBuild(source, mode) {
  const rank = OPENING_RANKS.has(read(source, 'opening_rank')) ? read(source, 'opening_rank') : 'Ⅰ';
  const autoQuality = rankQuality(rank);
  const occupationName = read(source, 'opening_occupation_name');
  const bloodlineName = read(source, 'opening_bloodline_name');
  if (!bloodlineName) throw new Error('请填写血统名称');

  const points = validatePointBudget(source, mode);
  const bloodline = {
    [bloodlineName]: {
      品质: autoQuality,
      标签: [],
      原始属性: Object.fromEntries(BLOOD_ATTRS.map(attr => [attr, pointTier(points[attr])])),
      效果: effect(
        read(source, 'opening_bloodline_effect_name'),
        read(source, 'opening_bloodline_effect_desc'),
      ),
      描述: read(source, 'opening_bloodline_desc'),
    },
  };

  const skills = {};
  for (let index = 1; index <= 2; index += 1) {
    const name = read(source, `opening_skill_${index}_name`);
    if (!name) continue;
    skills[name] = {
      品质: autoQuality,
      类型: Math.max(0, Math.min(2, Number(read(source, `opening_skill_${index}_type`)) || 0)),
      标签: [],
      效果: effect(
        read(source, `opening_skill_${index}_effect_name`),
        read(source, `opening_skill_${index}_effect_desc`),
      ),
      描述: read(source, `opening_skill_${index}_desc`),
      消耗: read(source, `opening_skill_${index}_consume`),
    };
  }

  return {
    种族: read(source, 'opening_race') || '人类',
    身份: csv(read(source, 'opening_identity')),
    职业: occupationName
      ? {
          [occupationName]: {
            类型: ['战斗', '生活', '辅助'].includes(read(source, 'opening_occupation_type'))
              ? read(source, 'opening_occupation_type')
              : '辅助',
            特性: csv(read(source, 'opening_occupation_traits')),
            来源: read(source, 'opening_occupation_source'),
          },
        }
      : {},
    层级: rank,
    血统: bloodline,
    技能: skills,
    ...(mode === 'opening_partner' ? { 装备: validatePartnerEquipment(source) } : {}),
  };
}

function validateStoreCatalog(catalog) {
  const groups = [
    ['equipments', '装备'],
    ['items', '道具'],
    ['skills', '技能'],
  ];
  let total = 0;
  for (const [key, label] of groups) {
    if (!Array.isArray(catalog?.[key])) throw new Error(`${label}目录无效`);
    for (const [index, item] of catalog[key].entries()) {
      total += 1;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`${label}第 ${index + 1} 项无效`);
      }
      if (!String(item.name || '').trim()) throw new Error(`${label}第 ${index + 1} 项缺少名称`);
      if (!STORE_QUALITIES.has(String(item.tier || '').toUpperCase())) {
        throw new Error(`${label}“${item.name}”品质只能是 F、E、D`);
      }
      const cost = Number(item.cost);
      if (!Number.isFinite(cost) || cost < 0 || cost > 1000) {
        throw new Error(`${label}“${item.name}”价格必须在 0-1000 之间`);
      }
      if (Object.keys(item.effects || {}).length > 2) {
        throw new Error(`${label}“${item.name}”最多只能填写 2 条效果`);
      }
      if (key === 'items') {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
          throw new Error(`道具“${item.name}”数量必须在 1-999 之间`);
        }
      }
    }
  }
  if (!total) throw new Error('开局商店至少需要添加一项装备、道具或技能');
  return structuredClone(catalog);
}

export function buildDedicatedArtifacts(source, mode, projectName) {
  if (mode === 'world_character') {
    const name = read(source, 'world_name') || projectName;
    if (!name) throw new Error('请填写世界角色姓名');
    const aliases = csv(read(source, 'world_keywords'));
    const profile = {
      name,
      aliases,
      race: read(source, 'world_race'),
      identities: csv(read(source, 'world_identity')),
      occupation: read(source, 'world_occupation'),
      rank: read(source, 'world_rank') || 'Ⅰ',
      personality: read(source, 'world_personality'),
      appearance: read(source, 'world_appearance'),
      background: read(source, 'world_background'),
      notes: read(source, 'world_notes'),
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
        content: { schema_version: 1, kind: 'world_character', name, profile },
      },
    ];
  }

  if (mode === 'opening_character' || mode === 'opening_partner') {
    const name = read(source, 'opening_name') || projectName;
    if (!name) throw new Error(mode === 'opening_partner' ? '请填写开局伙伴姓名' : '请填写开局角色姓名');
    const build = openingBuild(source, mode);
    const profile = {
      性格: read(source, 'opening_personality'),
      喜爱: read(source, 'opening_likes'),
      背景故事: read(source, 'opening_background'),
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
    const catalog = validateStoreCatalog(source?.store_catalog || {});
    return [{
      kind: 'data',
      name: `${projectName || '开局商店'}.store.json`,
      format: 'json',
      content: {
        schema_version: 1,
        kind: 'store_catalog',
        catalog,
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

function firstEffect(value = {}) {
  return Object.entries(value || {})[0] || ['', ''];
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
    const occupationName = Object.keys(build.职业 || {})[0] || '';
    const occupation = occupationName ? build.职业?.[occupationName] || {} : {};
    const bloodlineName = Object.keys(build.血统 || {})[0] || '';
    const bloodline = bloodlineName ? build.血统?.[bloodlineName] || {} : {};
    const [bloodEffectName, bloodEffectDesc] = firstEffect(bloodline.效果);
    const skills = Object.entries(build.技能 || {}).slice(0, 2);

    const result = {
      opening_name: data.name || projectName,
      opening_race: build.种族 || '人类',
      opening_identity: Array.isArray(build.身份) ? build.身份.join(', ') : String(build.身份 || ''),
      opening_occupation_name: occupationName,
      opening_occupation_type: occupation.类型 || '辅助',
      opening_occupation_traits: (occupation.特性 || []).join(', '),
      opening_occupation_source: occupation.来源 || '',
      opening_rank: OPENING_RANKS.has(build.层级) ? build.层级 : 'Ⅰ',
      opening_personality: profile.性格 || '',
      opening_likes: profile.喜爱 || '',
      opening_background: profile.背景故事 || '',
      opening_bloodline_name: bloodlineName,
      opening_bloodline_effect_name: bloodEffectName,
      opening_bloodline_effect_desc: bloodEffectDesc,
      opening_bloodline_desc: bloodline.描述 || '',
      opening_attributes: Object.fromEntries(BLOOD_ATTRS.map(attr => [
        attr,
        Math.max(0, POINT_QUALITIES.indexOf(bloodline.原始属性?.[attr] || 'F')),
      ])),
    };

    for (let index = 1; index <= 2; index += 1) {
      const [name, skill = {}] = skills[index - 1] || ['', {}];
      const [effectName, effectDesc] = firstEffect(skill.效果);
      result[`opening_skill_${index}_name`] = name;
      result[`opening_skill_${index}_type`] = String(Math.max(0, Math.min(2, Number(skill.类型) || 0)));
      result[`opening_skill_${index}_consume`] = skill.消耗 || '';
      result[`opening_skill_${index}_effect_name`] = effectName;
      result[`opening_skill_${index}_effect_desc`] = effectDesc;
      result[`opening_skill_${index}_desc`] = skill.描述 || '';
    }

    if (mode === 'opening_partner') {
      result.opening_partner_equipment = Object.entries(build.装备 || {}).map(([name, item]) => ({
        name,
        ...structuredClone(item),
      }));
    }
    return result;
  }

  if (mode === 'store_catalog') {
    const data = values.find(value => value.kind === 'store_catalog') || {};
    return { store_catalog: structuredClone(data.catalog || { equipments: [], items: [], skills: [] }) };
  }

  return {};
}
