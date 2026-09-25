const OPENING_RANKS = new Set(['Ⅰ', 'Ⅱ', 'Ⅲ']);
const RANK_QUALITY = { 'Ⅰ': 'F', 'Ⅱ': 'E', 'Ⅲ': 'D' };
const STORE_QUALITIES = new Set(['F', 'E', 'D']);
const EQUIPMENT_ATTR_QUALITIES = new Set(['F', 'E', 'D', 'C', 'B', 'A']);
const STORE_PRICE_FLOOR = { F: 50, E: 300, D: 700 };
const STORE_ITEM_TYPES = new Set(['消耗', '材料', '特殊']);
const POINT_QUALITIES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const BLOOD_ATTRS = ['力量', '敏捷', '体质', '精神', '魅力'];
const WORLD_CHARACTER_ORDER = 650;

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

export function worldCharacterTemplate(name = '{{角色姓名}}') {
  return `${name}:
  基本信息:
    性别:
    年龄:
    种族:
    阵营:

  背景设定:
    出身:
    关键经历:

  外貌描写:
    整体印象:
    面部:
    体型身材:
    发型发色:
    眼睛:
    穿着风格:
    显著特征:
    配饰:
    风格印象:

  身体数据:
    身高:
    体重:
    三围:
    头部特征:
    腰臀特征:
    四肢特征:
    私密部位:

  性格特征:
    行为模式:
    语言风格:
    道德体系:
    个人特质:
      - 特质一（主导/核心）:
          体现:
          行为举例:
      - 特质二（次要/表象）:
          体现:
          行为举例:
      - 特质三（隐藏/本质）:
          体现:
          行为举例:

  目标动机:
    短期目标:
    长期目标:
    核心驱动:

  战斗能力:
    战斗风格:
    技能:

  个人物品:
`;
}

function legacyWorldCharacterContent(profile = {}) {
  const identities = Array.isArray(profile.identities) ? profile.identities.join(' / ') : '';
  const background = [profile.background, profile.notes].filter(Boolean).join('\n');
  return `${profile.name || '{{角色姓名}}'}:
  基本信息:
    种族: ${profile.race || ''}
    身份: ${identities}
    职业: ${profile.occupation || ''}
    层级: ${profile.rank || ''}

  背景设定:
${background ? background.split('\n').map(line => `    ${line}`).join('\n') : '    '}

  外貌描写:
    整体印象: ${profile.appearance || ''}

  性格特征:
    行为模式: ${profile.personality || ''}
`;
}

function worldCharacterContent(profile) {
  const raw = String(profile?.content || '').trim() || legacyWorldCharacterContent(profile);
  return raw.replaceAll('{{角色姓名}}', profile?.name || '角色');
}

function partnerWorldbookContent(name, build = {}, profile = {}, backgroundSetting = '') {
  const identities = Array.isArray(build.身份) ? build.身份.join(' / ') : String(build.身份 || '');
  const extra = String(backgroundSetting || '').trim();
  const lines = [
    `${name}:`,
    '  基本信息:',
    `    种族: ${build.种族 || ''}`,
    `    身份: ${identities}`,
    `    层级: ${build.层级 || ''}`,
    `    性格: ${profile.性格 || ''}`,
    `    喜爱: ${profile.喜爱 || ''}`,
    `    背景故事: ${profile.背景故事 || ''}`,
    '',
    '  背景设定:',
  ];
  if (extra) lines.push(...extra.split('\n').map(line => `    ${line}`));
  return lines.join('\n');
}

function worldbookArtifact(name, keys, content) {
  return {
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
        position: {
          type: 'after_character_definition',
          role: 'system',
          depth: 4,
          order: WORLD_CHARACTER_ORDER,
        },
        content,
        probability: 100,
      }],
    },
  };
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
    for (const [attr, value] of Object.entries(item.原始属性 || {})) {
      if (!EQUIPMENT_ATTR_QUALITIES.has(String(value || '').toUpperCase())) {
        throw new Error(`伙伴装备“${name}”原始属性 ${attr} 只能是 F-A`);
      }
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

  const skillRows = Array.isArray(source?.opening_skills)
    ? source.opening_skills.slice(0, 2)
    : [1, 2].map(index => ({
        name: read(source, `opening_skill_${index}_name`),
        type: read(source, `opening_skill_${index}_type`),
        consume: read(source, `opening_skill_${index}_consume`),
        effectName: read(source, `opening_skill_${index}_effect_name`),
        effectDesc: read(source, `opening_skill_${index}_effect_desc`),
        desc: read(source, `opening_skill_${index}_desc`),
      }));
  const skills = {};
  for (const row of skillRows) {
    const name = String(row?.name || '').trim();
    if (!name) continue;
    skills[name] = {
      品质: autoQuality,
      类型: Math.max(0, Math.min(2, Number(row?.type) || 0)),
      标签: [],
      效果: effect(row?.effectName, row?.effectDesc),
      描述: String(row?.desc || '').trim(),
      消耗: String(row?.consume || '').trim(),
    };
  }

  return {
    种族: read(source, 'opening_race') || '人类',
    身份: csv(read(source, 'opening_identity')),
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
      const itemQuality = String(item.tier || '').toUpperCase();
      const cost = Number(item.cost);
      const floor = STORE_PRICE_FLOOR[itemQuality] || 50;
      if (!Number.isFinite(cost) || cost < floor || cost > 1000) {
        throw new Error(`${label}“${item.name}”价格必须符合 ${itemQuality} 级下限 ${floor}，且不超过 1000`);
      }
      if (key === 'equipments') {
        const equipmentType = Number(item.type);
        if (!Number.isInteger(equipmentType) || equipmentType < 0 || equipmentType > 17) {
          throw new Error(`装备“${item.name}”类型必须是开局装备分类 0-17`);
        }
        for (const [attr, value] of Object.entries(item.attrs || {})) {
          if (!EQUIPMENT_ATTR_QUALITIES.has(String(value || '').toUpperCase())) {
            throw new Error(`装备“${item.name}”原始属性 ${attr} 只能是 F-A`);
          }
        }
      }
      if (Object.keys(item.effects || {}).length > 2) {
        throw new Error(`${label}“${item.name}”最多只能填写 2 条效果`);
      }
      const tags = Array.isArray(item.tags) ? item.tags : [];
      if (!tags.every(tag => typeof tag === 'string' && tag.trim())) {
        throw new Error(`${label}“${item.name}”标签格式无效`);
      }
      if (typeof item.consume !== 'string') {
        throw new Error(`${label}“${item.name}”消耗必须是文本`);
      }
      if (key === 'items') {
        if (!STORE_ITEM_TYPES.has(String(item.type || ''))) {
          throw new Error(`道具“${item.name}”类型必须是消耗、材料或特殊`);
        }
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
          throw new Error(`道具“${item.name}”数量必须在 1-999 之间`);
        }
        if (typeof item.cd !== 'string') {
          throw new Error(`道具“${item.name}”冷却必须是文本`);
        }
      }
      if (key === 'skills') {
        const skillType = Number(item.type);
        if (!Number.isInteger(skillType) || skillType < 0 || skillType > 2) {
          throw new Error(`技能“${item.name}”类型必须是主动、被动或特殊`);
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
    const content = read(source, 'world_content').trim();
    if (!content) throw new Error('请填写世界书角色内容');
    const profile = { name, aliases, content };
    const keys = [...new Set([name, ...aliases])];
    return [
      worldbookArtifact(name, keys, worldCharacterContent(profile)),
      {
        kind: 'data',
        name: `${name}.character.json`,
        format: 'json',
        content: { schema_version: 2, kind: 'world_character', name, profile },
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
    const partnerWorldbook = mode === 'opening_partner' && source?.opening_worldbook_enabled
      ? read(source, 'opening_worldbook_content').trim()
      : '';
    const dataArtifact = {
      kind: 'data',
      name: `${name}.opening.json`,
      format: 'json',
      content: {
        schema_version: partnerWorldbook ? 2 : 1,
        kind: mode,
        name,
        ...(mode === 'opening_partner' ? {
          profile,
          ...(partnerWorldbook ? { worldbook: { content: partnerWorldbook } } : {}),
        } : {}),
        build,
      },
    };
    if (!partnerWorldbook) return [dataArtifact];
    return [
      dataArtifact,
      worldbookArtifact(name, [name], partnerWorldbookContent(name, build, profile, partnerWorldbook)),
    ];
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
    const name = data.name || profile.name || projectName;
    return {
      world_name: name,
      world_keywords: (profile.aliases || []).join(', '),
      world_content: String(profile.content || '').trim()
        || (Object.keys(profile).length ? legacyWorldCharacterContent({ ...profile, name }) : worldCharacterTemplate()),
    };
  }

  if (mode === 'opening_character' || mode === 'opening_partner') {
    const data = values.find(value => value.kind === mode) || {};
    const build = data.build || data.character || {};
    const profile = data.profile || {};
    const bloodlineName = Object.keys(build.血统 || {})[0] || '';
    const bloodline = bloodlineName ? build.血统?.[bloodlineName] || {} : {};
    const [bloodEffectName, bloodEffectDesc] = firstEffect(bloodline.效果);
    const skills = Object.entries(build.技能 || {}).slice(0, 2);

    const result = {
      opening_name: data.name || projectName,
      opening_race: build.种族 || '人类',
      opening_identity: Array.isArray(build.身份) ? build.身份.join(', ') : String(build.身份 || ''),
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

    result.opening_skills = skills.map(([name, skill = {}]) => {
      const [effectName, effectDesc] = firstEffect(skill.效果);
      return {
        name,
        type: String(Math.max(0, Math.min(2, Number(skill.类型) || 0))),
        consume: skill.消耗 || '',
        effectName,
        effectDesc,
        desc: skill.描述 || '',
      };
    });

    if (mode === 'opening_partner') {
      result.opening_partner_equipment = Object.entries(build.装备 || {}).map(([name, item]) => ({
        name,
        ...structuredClone(item),
      }));
      result.opening_worldbook_content = String(data.worldbook?.content || '');
      result.opening_worldbook_enabled = Boolean(result.opening_worldbook_content.trim());
    }
    return result;
  }

  if (mode === 'store_catalog') {
    const data = values.find(value => value.kind === 'store_catalog') || {};
    return { store_catalog: structuredClone(data.catalog || { equipments: [], items: [], skills: [] }) };
  }

  return {};
}
