const KIND_LABELS = {
  world_character: '世界书角色',
  opening_character: '开局角色',
  opening_partner: '开局伙伴',
  store_catalog: '开局商店',
  generic_data: '数据',
};

const SKILL_TYPES = ['主动', '被动', '特殊'];
const PARTNER_EQUIPMENT_TYPES = ['手持', '手部', '头部', '胸部', '腿部', '鞋子', '披风', '饰品', '特殊'];
const STORE_EQUIPMENT_TYPES = [
  '刀剑类', '枪矛类', '棍棒类', '机械类', '弓弩类', '盾牌类', '匕首短刃', '法杖魔导书',
  '圣典权杖', '特殊武器', '手部', '头部', '胸部', '腿部', '鞋子', '披风', '饰品', '世界遗物',
];

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function entries(value) {
  return Object.entries(objectValue(value));
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function cleanArtifactName(name = '') {
  return String(name)
    .replace(/\.(?:opening|store|character)?\.json$/iu, '')
    .replace(/\.json$/iu, '')
    .trim();
}

function textValue(value, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function prettyJson(value) {
  try { return JSON.stringify(value, null, 2); }
  catch { return String(value ?? ''); }
}

export function summarizeMvuEntry(entry = {}) {
  const content = objectValue(entry.content);
  const kind = String(entry.kind || content.kind || 'generic_data');
  const build = objectValue(content.build || content.character);
  const catalog = objectValue(content.catalog);
  const identity = list(build.身份).map(value => String(value).trim()).filter(Boolean);
  const storeCounts = {
    equipments: Array.isArray(catalog.equipments) ? catalog.equipments.length : 0,
    items: Array.isArray(catalog.items) ? catalog.items.length : 0,
    skills: Array.isArray(catalog.skills) ? catalog.skills.length : 0,
    total: 0,
  };
  storeCounts.total = storeCounts.equipments + storeCounts.items + storeCounts.skills;

  return {
    kind,
    typeLabel: KIND_LABELS[kind] || '数据',
    title: String(entry.name || content.name || content.profile?.name || cleanArtifactName(entry.artifact_name) || '未命名数据'),
    artifactName: String(entry.artifact_name || ''),
    schemaVersion: Number(entry.schema_version || content.schema_version || 0),
    race: String(build.种族 || ''),
    identity,
    rank: String(build.层级 || ''),
    bloodlines: entries(build.血统).length,
    skills: entries(build.技能).length,
    equipment: entries(build.装备).length,
    favorability: Number.isFinite(Number(build.好感度)) ? Number(build.好感度) : null,
    teammate: typeof build.是否队友 === 'boolean' ? build.是否队友 : null,
    storeCounts,
  };
}

function chip(doc, label, className = '') {
  const node = doc.createElement('span');
  node.className = `rw-mvu-chip ${className}`.trim();
  node.textContent = label;
  return node;
}

function textBlock(doc, label, value) {
  const block = doc.createElement('div');
  block.className = 'rw-mvu-text-block';
  const title = doc.createElement('strong');
  title.textContent = label;
  const body = doc.createElement('div');
  body.textContent = textValue(value, '未填写');
  block.append(title, body);
  return block;
}

function fact(doc, label, value) {
  const item = doc.createElement('div');
  item.className = 'rw-mvu-fact';
  const small = doc.createElement('span');
  small.textContent = label;
  const strong = doc.createElement('strong');
  strong.textContent = textValue(value);
  item.append(small, strong);
  return item;
}

function sectionTitle(doc, title, subtitle = '', count = null) {
  const head = doc.createElement('div');
  head.className = 'rw-mvu-subhead';
  const copy = doc.createElement('div');
  const strong = doc.createElement('strong');
  strong.textContent = title;
  copy.appendChild(strong);
  if (subtitle) {
    const span = doc.createElement('span');
    span.textContent = subtitle;
    copy.appendChild(span);
  }
  head.appendChild(copy);
  if (count !== null) head.appendChild(chip(doc, `${count} 项`));
  return head;
}

function renderEffects(doc, effects) {
  const values = entries(effects);
  if (!values.length) return null;
  const listNode = doc.createElement('div');
  listNode.className = 'rw-mvu-effect-list';
  for (const [name, description] of values) {
    const row = doc.createElement('div');
    row.className = 'rw-mvu-effect';
    row.append(chip(doc, String(name), 'accent'), Object.assign(doc.createElement('span'), {
      textContent: textValue(description, '未填写效果说明'),
    }));
    listNode.appendChild(row);
  }
  return listNode;
}

function renderAttributes(doc, attrs) {
  const values = entries(attrs);
  if (!values.length) return null;
  const wrap = doc.createElement('div');
  wrap.className = 'rw-mvu-attribute-list';
  for (const [name, value] of values) wrap.appendChild(chip(doc, `${name} · ${textValue(value)}`, 'attribute'));
  return wrap;
}

function renderNamedCard(doc, name, value, { kind = 'item', typeLabel = '', price = null } = {}) {
  const item = objectValue(value);
  const card = doc.createElement('article');
  card.className = `rw-mvu-entry-card rw-mvu-entry-card--${kind}`;

  const head = doc.createElement('div');
  head.className = 'rw-mvu-entry-head';
  const copy = doc.createElement('div');
  const title = doc.createElement('strong');
  title.textContent = name || '未命名';
  const meta = doc.createElement('span');
  meta.textContent = [
    item.品质 || item.tier || '',
    typeLabel,
    price !== null ? `${price} 积分` : '',
  ].filter(Boolean).join(' · ') || 'MVU 数据';
  copy.append(title, meta);
  head.appendChild(copy);
  const tags = Array.isArray(item.标签) ? item.标签 : Array.isArray(item.tags) ? item.tags : [];
  if (tags.length) {
    const tagWrap = doc.createElement('div');
    tagWrap.className = 'rw-mvu-entry-tags';
    tags.slice(0, 5).forEach(tag => tagWrap.appendChild(chip(doc, String(tag))));
    head.appendChild(tagWrap);
  }
  card.appendChild(head);

  const attrs = renderAttributes(doc, item.原始属性 || item.attrs);
  if (attrs) card.appendChild(attrs);

  const effects = renderEffects(doc, item.效果 || item.effects);
  if (effects) card.appendChild(effects);

  const description = item.描述 ?? item.description;
  const consume = item.消耗 ?? item.consume;
  const extra = [];
  if (description) extra.push(textBlock(doc, '描述', description));
  if (consume) extra.push(textBlock(doc, '消耗', consume));
  if (item.quantity !== undefined) extra.push(textBlock(doc, '数量', item.quantity));
  if (item.cd !== undefined) extra.push(textBlock(doc, '冷却', item.cd));
  if (extra.length) {
    const grid = doc.createElement('div');
    grid.className = 'rw-mvu-copy-grid';
    grid.append(...extra);
    card.appendChild(grid);
  }
  return card;
}

function renderOpening(doc, entry, summary) {
  const content = objectValue(entry.content);
  const profile = objectValue(content.profile);
  const build = objectValue(content.build || content.character);
  const body = doc.createElement('div');
  body.className = 'rw-mvu-body';

  const facts = doc.createElement('div');
  facts.className = 'rw-mvu-facts';
  facts.append(
    fact(doc, '种族', summary.race || '未填写'),
    fact(doc, '层级', summary.rank || '未填写'),
    fact(doc, '身份', summary.identity.join(' / ') || '未填写'),
    fact(doc, '血统', summary.bloodlines),
    fact(doc, '技能', summary.skills),
  );
  if (summary.kind === 'opening_partner') {
    facts.append(
      fact(doc, '装备', summary.equipment),
      fact(doc, '初始好感', summary.favorability ?? 0),
      fact(doc, '默认队友', summary.teammate === null ? '未注明' : summary.teammate ? '是' : '否'),
    );
  }
  body.appendChild(facts);

  if (Object.keys(profile).length) {
    const profileSection = doc.createElement('section');
    profileSection.className = 'rw-mvu-subsection';
    profileSection.appendChild(sectionTitle(doc, '人物资料', '作者提交的角色描述'));
    const grid = doc.createElement('div');
    grid.className = 'rw-mvu-copy-grid';
    const fields = [
      ['性格', profile.性格],
      ['喜爱', profile.喜爱],
      ['外貌', profile.外貌],
      ['背景故事', profile.背景故事],
    ].filter(([, value]) => value !== undefined && value !== '');
    grid.append(...fields.map(([label, value]) => textBlock(doc, label, value)));
    profileSection.appendChild(grid);
    body.appendChild(profileSection);
  }

  const bloodlines = entries(build.血统);
  if (bloodlines.length) {
    const section = doc.createElement('section');
    section.className = 'rw-mvu-subsection';
    section.appendChild(sectionTitle(doc, '血统', '品质、原始属性与效果', bloodlines.length));
    const grid = doc.createElement('div');
    grid.className = 'rw-mvu-card-grid';
    for (const [name, value] of bloodlines) grid.appendChild(renderNamedCard(doc, name, value, { kind: 'bloodline' }));
    section.appendChild(grid);
    body.appendChild(section);
  }

  const skills = entries(build.技能);
  if (skills.length) {
    const section = doc.createElement('section');
    section.className = 'rw-mvu-subsection';
    section.appendChild(sectionTitle(doc, '技能', '实际进入 MVU 的技能数据', skills.length));
    const grid = doc.createElement('div');
    grid.className = 'rw-mvu-card-grid';
    for (const [name, value] of skills) {
      const type = SKILL_TYPES[Math.max(0, Math.min(2, Number(value?.类型) || 0))] || '';
      grid.appendChild(renderNamedCard(doc, name, value, { kind: 'skill', typeLabel: type }));
    }
    section.appendChild(grid);
    body.appendChild(section);
  }

  const equipment = entries(build.装备);
  if (equipment.length) {
    const section = doc.createElement('section');
    section.className = 'rw-mvu-subsection';
    section.appendChild(sectionTitle(doc, '初始装备', '伙伴随身携带的装备', equipment.length));
    const grid = doc.createElement('div');
    grid.className = 'rw-mvu-card-grid';
    for (const [name, value] of equipment) {
      const type = PARTNER_EQUIPMENT_TYPES[Math.max(0, Math.min(8, Number(value?.类型) || 0))] || '';
      grid.appendChild(renderNamedCard(doc, name, value, { kind: 'equipment', typeLabel: type }));
    }
    section.appendChild(grid);
    body.appendChild(section);
  }

  if (content.worldbook?.content) {
    const section = doc.createElement('section');
    section.className = 'rw-mvu-subsection';
    section.appendChild(sectionTitle(doc, '伙伴世界书', '随伙伴一起发布的补充设定'));
    const aliases = Array.isArray(content.worldbook.aliases) ? content.worldbook.aliases : [];
    if (aliases.length) {
      const chips = doc.createElement('div');
      chips.className = 'rw-mvu-chip-list';
      aliases.forEach(alias => chips.appendChild(chip(doc, String(alias))));
      section.appendChild(chips);
    }
    section.appendChild(textBlock(doc, '正文', content.worldbook.content));
    body.appendChild(section);
  }

  return body;
}

function storeItemTypeLabel(group, value) {
  if (group === 'equipments') return STORE_EQUIPMENT_TYPES[Math.max(0, Math.min(17, Number(value) || 0))] || '';
  if (group === 'skills') return SKILL_TYPES[Math.max(0, Math.min(2, Number(value) || 0))] || '';
  return String(value || '');
}

function renderStoreGroup(doc, label, key, values) {
  const section = doc.createElement('section');
  section.className = 'rw-mvu-subsection';
  section.appendChild(sectionTitle(doc, label, '安装后可在开局商店中选择', values.length));
  const grid = doc.createElement('div');
  grid.className = 'rw-mvu-store-grid';
  for (const item of values) {
    const name = String(item?.name || '未命名商品');
    grid.appendChild(renderNamedCard(doc, name, item, {
      kind: key,
      typeLabel: storeItemTypeLabel(key, item?.type),
      price: Number.isFinite(Number(item?.cost)) ? Number(item.cost) : null,
    }));
  }
  section.appendChild(grid);
  return section;
}

function renderStore(doc, entry, summary) {
  const catalog = objectValue(objectValue(entry.content).catalog);
  const body = doc.createElement('div');
  body.className = 'rw-mvu-body';

  const facts = doc.createElement('div');
  facts.className = 'rw-mvu-facts rw-mvu-facts--store';
  facts.append(
    fact(doc, '商品总数', summary.storeCounts.total),
    fact(doc, '装备', summary.storeCounts.equipments),
    fact(doc, '道具', summary.storeCounts.items),
    fact(doc, '技能', summary.storeCounts.skills),
  );
  body.appendChild(facts);

  const groups = [
    ['装备', 'equipments', Array.isArray(catalog.equipments) ? catalog.equipments : []],
    ['道具', 'items', Array.isArray(catalog.items) ? catalog.items : []],
    ['技能', 'skills', Array.isArray(catalog.skills) ? catalog.skills : []],
  ];
  for (const [label, key, values] of groups) {
    if (values.length) body.appendChild(renderStoreGroup(doc, label, key, values));
  }
  return body;
}

function renderWorldCharacter(doc, entry) {
  const content = objectValue(entry.content);
  const profile = objectValue(content.profile);
  const body = doc.createElement('div');
  body.className = 'rw-mvu-body';
  const facts = doc.createElement('div');
  facts.className = 'rw-mvu-facts';
  facts.append(
    fact(doc, '角色名', content.name || profile.name || '未填写'),
    fact(doc, '关键词', Array.isArray(profile.aliases) ? profile.aliases.join(' / ') || '无' : '无'),
  );
  body.appendChild(facts);
  if (profile.content) body.appendChild(textBlock(doc, '角色资料', profile.content));
  return body;
}

function renderGeneric(doc, entry) {
  const body = doc.createElement('div');
  body.className = 'rw-mvu-body';
  body.appendChild(textBlock(doc, '说明', '未识别为专用 MVU 类型，仍完整保留原始数据供查看。'));
  return body;
}

function rawData(doc, entry) {
  const details = doc.createElement('details');
  details.className = 'rw-mvu-raw';
  const summary = doc.createElement('summary');
  summary.textContent = '查看原始 JSON';
  const pre = doc.createElement('pre');
  pre.className = 'rw-content-source rw-mvu-json';
  pre.textContent = prettyJson(entry.content);
  details.append(summary, pre);
  return details;
}

function renderMvuCard(doc, entry) {
  const summary = summarizeMvuEntry(entry);
  const card = doc.createElement('article');
  card.className = `rw-mvu-card rw-mvu-card--${summary.kind}`;

  const head = doc.createElement('header');
  head.className = 'rw-mvu-head';
  const copy = doc.createElement('div');
  copy.className = 'rw-mvu-head-copy';
  const eyebrow = doc.createElement('span');
  eyebrow.className = 'rw-mvu-eyebrow';
  eyebrow.textContent = summary.typeLabel;
  const title = doc.createElement('h3');
  title.textContent = summary.title;
  const source = doc.createElement('span');
  source.className = 'rw-mvu-source';
  source.textContent = [summary.artifactName, summary.schemaVersion ? `Schema v${summary.schemaVersion}` : ''].filter(Boolean).join(' · ');
  copy.append(eyebrow, title, source);

  const badges = doc.createElement('div');
  badges.className = 'rw-mvu-head-badges';
  badges.appendChild(chip(doc, summary.typeLabel, 'type'));
  if (summary.kind === 'opening_character' || summary.kind === 'opening_partner') {
    if (summary.rank) badges.appendChild(chip(doc, `层级 ${summary.rank}`, 'rank'));
    if (summary.race) badges.appendChild(chip(doc, summary.race));
  }
  if (summary.kind === 'store_catalog') badges.appendChild(chip(doc, `${summary.storeCounts.total} 件商品`, 'rank'));
  head.append(copy, badges);
  card.appendChild(head);

  if (summary.kind === 'opening_character' || summary.kind === 'opening_partner') {
    card.appendChild(renderOpening(doc, entry, summary));
  } else if (summary.kind === 'store_catalog') {
    card.appendChild(renderStore(doc, entry, summary));
  } else if (summary.kind === 'world_character') {
    card.appendChild(renderWorldCharacter(doc, entry));
  } else {
    card.appendChild(renderGeneric(doc, entry));
  }
  card.appendChild(rawData(doc, entry));
  return card;
}

export function renderMvuPreview(doc, dataEntries = []) {
  const values = Array.isArray(dataEntries) ? dataEntries : [];
  if (!values.length) return null;

  const section = doc.createElement('section');
  section.className = 'rw-detail-content-section rw-mvu-section';

  const heading = doc.createElement('div');
  heading.className = 'rw-detail-content-heading';
  const copy = doc.createElement('div');
  const strong = doc.createElement('strong');
  strong.textContent = '作品内容';
  const subtitle = doc.createElement('span');
  subtitle.textContent = '直接查看作者提交并实际安装的 MVU 数据';
  copy.append(strong, subtitle);
  heading.append(copy, chip(doc, `${values.length} 项`, 'type'));
  section.appendChild(heading);

  const listNode = doc.createElement('div');
  listNode.className = 'rw-mvu-list';
  values.forEach(entry => listNode.appendChild(renderMvuCard(doc, entry)));
  section.appendChild(listNode);
  return section;
}
