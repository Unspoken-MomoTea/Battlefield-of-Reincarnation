const OPENING_RANKS = ['Ⅰ', 'Ⅱ', 'Ⅲ'];
const WORLD_RANKS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ'];
const QUALITIES = ['F', 'E', 'D'];
const ATTRIBUTES = ['力量', '敏捷', '体质', '精神', '魅力'];
const STORE_ATTRIBUTES = ['力量', '敏捷', '体质', '精神', '魅力', 'ATK', 'DEF', 'MATK', 'MDEF', 'AP'];

function el(doc, tag, className = '', text = '') {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function makeInput(doc, name, value = '', options = {}) {
  const node = el(doc, options.textarea ? 'textarea' : 'input', options.textarea ? 'rw-textarea' : 'rw-input');
  node.name = name;
  node.value = value ?? '';
  if (!options.textarea) node.type = options.type || 'text';
  if (options.placeholder) node.placeholder = options.placeholder;
  if (options.maxLength) node.maxLength = options.maxLength;
  if (options.min !== undefined) node.min = String(options.min);
  if (options.max !== undefined) node.max = String(options.max);
  if (options.step !== undefined) node.step = String(options.step);
  return node;
}

function makeSelect(doc, name, values, selected) {
  const node = el(doc, 'select', 'rw-select');
  node.name = name;
  for (const item of values) {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    const option = doc.createElement('option');
    option.value = String(value);
    option.textContent = String(label);
    option.selected = String(value) === String(selected ?? values[0]?.value ?? values[0] ?? '');
    node.appendChild(option);
  }
  return node;
}

function field(doc, label, control, hint = '') {
  const wrapper = el(doc, 'label', 'rw-field');
  wrapper.append(el(doc, 'span', '', label), control);
  if (hint) wrapper.append(el(doc, 'small', '', hint));
  return wrapper;
}

function getValue(root, name) {
  return root.querySelector(`[name="${name}"]`)?.value ?? '';
}

function valuesFromNames(root, names) {
  return Object.fromEntries(names.map(name => [name, getValue(root, name)]));
}

function effectObject(name, description) {
  const title = String(name || '').trim();
  const body = String(description || '').trim();
  if (!body) return {};
  return { [title || '效果']: body };
}

function randomId(kind, index) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${index.toString(36)}`;
  return `workshop-${kind}-${suffix}`;
}

function normalizeStoreEntries(initial = {}) {
  const rows = [];
  for (const [kind, key] of [['equipment', 'equipments'], ['item', 'items'], ['skill', 'skills']]) {
    for (const item of initial?.[key] || []) rows.push({ kind, item: structuredClone(item) });
  }
  return rows;
}

function firstEffect(item = {}) {
  const entry = Object.entries(item.effects || {})[0] || ['', ''];
  return { name: entry[0], description: entry[1] };
}

function storeEditor(doc, initial, emit) {
  const root = el(doc, 'div', 'rw-special-editor');
  const head = el(doc, 'div', 'rw-special-editor-head');
  head.append(
    el(doc, 'strong', '', '开局商店'),
    el(doc, 'small', '', '逐项添加商品，不需要填写 JSON。品质只允许 F / E / D，单件价格最高 1000。'),
  );
  root.appendChild(head);

  const list = el(doc, 'div', 'rw-store-entry-list');
  const add = el(doc, 'button', 'rw-button rw-store-add', '+ 添加商品');
  add.type = 'button';
  root.append(list, add);

  const entries = normalizeStoreEntries(initial);
  let counter = entries.length;

  const render = () => {
    list.replaceChildren();
    if (!entries.length) {
      list.appendChild(el(doc, 'div', 'rw-local-note', '还没有商品。点击“添加商品”后选择装备、道具或技能。'));
      return;
    }

    entries.forEach((entry, index) => {
      const item = entry.item || {};
      const effect = firstEffect(item);
      const card = el(doc, 'section', 'rw-store-entry');
      card.dataset.storeIndex = String(index);

      const cardHead = el(doc, 'div', 'rw-store-entry-head');
      const kind = makeSelect(doc, 'store_kind', [
        { value: 'equipment', label: '装备' },
        { value: 'item', label: '道具' },
        { value: 'skill', label: '技能' },
      ], entry.kind);
      const remove = el(doc, 'button', 'rw-button danger rw-store-remove', '删除');
      remove.type = 'button';
      cardHead.append(kind, remove);
      card.appendChild(cardHead);

      const common = el(doc, 'div', 'rw-special-grid');
      common.append(
        field(doc, '名称 *', makeInput(doc, 'store_name', item.name || '', { maxLength: 80 })),
        field(doc, '品质', makeSelect(doc, 'store_quality', QUALITIES, item.tier || 'F')),
        field(doc, '价格（0-1000）', makeInput(doc, 'store_cost', Number(item.cost || 0), { type: 'number', min: 0, max: 1000, step: 1 })),
      );
      card.appendChild(common);

      const kindSpecific = el(doc, 'div', 'rw-store-kind-specific');
      if (entry.kind === 'equipment') {
        kindSpecific.appendChild(el(doc, 'div', 'rw-special-subtitle', '原始属性'));
        const attrs = el(doc, 'div', 'rw-store-attr-grid');
        for (const attr of STORE_ATTRIBUTES) {
          const select = makeSelect(doc, `store_attr_${attr}`, [
            { value: '', label: '无' },
            ...QUALITIES.map(value => ({ value, label: value })),
          ], item.attrs?.[attr] || '');
          attrs.appendChild(field(doc, attr, select));
        }
        kindSpecific.appendChild(attrs);
      } else if (entry.kind === 'item') {
        kindSpecific.appendChild(field(
          doc,
          '数量',
          makeInput(doc, 'store_quantity', Number(item.quantity || 1), { type: 'number', min: 1, max: 999, step: 1 }),
          '购买一次写入背包的数量。',
        ));
      }
      card.appendChild(kindSpecific);

      const effectGrid = el(doc, 'div', 'rw-special-grid');
      effectGrid.append(
        field(doc, '效果名称', makeInput(doc, 'store_effect_name', effect.name || '', { maxLength: 80 }), '不填名称时会自动使用“效果”。'),
        field(doc, '效果', makeInput(doc, 'store_effect_desc', effect.description || '', { textarea: true, maxLength: 1600 })),
      );
      card.append(
        el(doc, 'div', 'rw-special-subtitle', '效果与描述'),
        effectGrid,
        field(doc, '描述', makeInput(doc, 'store_desc', item.desc || '', { textarea: true, maxLength: 1600 })),
      );

      const sync = () => {
        entry.kind = kind.value;
        const previousId = entry.item?.id || randomId(entry.kind, counter++);
        const attrsValue = {};
        if (entry.kind === 'equipment') {
          for (const attr of STORE_ATTRIBUTES) {
            const value = getValue(card, `store_attr_${attr}`);
            if (value) attrsValue[attr] = value;
          }
        }
        const effectValue = effectObject(getValue(card, 'store_effect_name'), getValue(card, 'store_effect_desc'));
        const base = {
          id: previousId,
          name: getValue(card, 'store_name').trim(),
          tier: getValue(card, 'store_quality') || 'F',
          cost: Math.max(0, Math.min(1000, Number(getValue(card, 'store_cost')) || 0)),
          source: '创意工坊',
          tags: [],
          effects: effectValue,
          desc: getValue(card, 'store_desc').trim(),
        };
        entry.item = entry.kind === 'equipment'
          ? { ...base, type: 0, attrs: attrsValue, consume: '无' }
          : entry.kind === 'item'
            ? { ...base, type: '特殊', quantity: Math.max(1, Math.min(999, Number(getValue(card, 'store_quantity')) || 1)), consume: '无', cd: '0' }
            : { ...base, type: 0, consume: '无' };
        emit();
      };

      kind.addEventListener('change', () => {
        sync();
        render();
      });
      card.addEventListener('input', sync);
      card.addEventListener('change', event => {
        if (event.target !== kind) sync();
      });
      remove.addEventListener('click', () => {
        entries.splice(index, 1);
        render();
        emit();
      });
      list.appendChild(card);
    });
  };

  add.addEventListener('click', () => {
    entries.push({
      kind: 'equipment',
      item: {
        id: randomId('equipment', counter++),
        name: '',
        tier: 'F',
        cost: 0,
        type: 0,
        source: '创意工坊',
        tags: [],
        attrs: {},
        effects: {},
        desc: '',
        consume: '无',
      },
    });
    render();
    emit();
  });

  render();

  return {
    node: root,
    values() {
      const catalog = { equipments: [], items: [], skills: [] };
      for (const entry of entries) {
        if (!entry.item?.name?.trim()) continue;
        if (entry.kind === 'equipment') catalog.equipments.push(structuredClone(entry.item));
        if (entry.kind === 'item') catalog.items.push(structuredClone(entry.item));
        if (entry.kind === 'skill') catalog.skills.push(structuredClone(entry.item));
      }
      return { store_catalog: catalog };
    },
  };
}

function worldEditor(doc, initial, emit) {
  const root = el(doc, 'div', 'rw-special-editor');
  const head = el(doc, 'div', 'rw-special-editor-head');
  head.append(
    el(doc, 'strong', '', '世界书角色'),
    el(doc, 'small', '', '填写人物设定，发布时自动生成世界书角色条目。'),
  );
  root.appendChild(head);

  const grid = el(doc, 'div', 'rw-special-grid');
  grid.append(
    field(doc, '角色姓名 *', makeInput(doc, 'world_name', initial.world_name || '', { maxLength: 80 })),
    field(doc, '关键词 / 别名', makeInput(doc, 'world_keywords', initial.world_keywords || '', { maxLength: 300 }), '多个关键词用逗号分隔，姓名会自动加入关键词。'),
    field(doc, '种族', makeInput(doc, 'world_race', initial.world_race || '', { maxLength: 120 })),
    field(doc, '身份', makeInput(doc, 'world_identity', initial.world_identity || '', { maxLength: 300 }), '多个身份用逗号分隔。'),
    field(doc, '职业', makeInput(doc, 'world_occupation', initial.world_occupation || '', { maxLength: 160 })),
    field(doc, '层级', makeSelect(doc, 'world_rank', WORLD_RANKS, initial.world_rank || 'Ⅰ')),
  );
  root.append(
    grid,
    field(doc, '性格', makeInput(doc, 'world_personality', initial.world_personality || '', { textarea: true, maxLength: 1600 })),
    field(doc, '外貌', makeInput(doc, 'world_appearance', initial.world_appearance || '', { textarea: true, maxLength: 1600 })),
    field(doc, '背景故事', makeInput(doc, 'world_background', initial.world_background || '', { textarea: true, maxLength: 4000 })),
    field(doc, '补充设定', makeInput(doc, 'world_notes', initial.world_notes || '', { textarea: true, maxLength: 4000 })),
  );
  root.addEventListener('input', emit);
  root.addEventListener('change', emit);

  const names = [
    'world_name', 'world_keywords', 'world_race', 'world_identity', 'world_occupation',
    'world_rank', 'world_personality', 'world_appearance', 'world_background', 'world_notes',
  ];
  return { node: root, values: () => valuesFromNames(root, names) };
}

function openingEditor(doc, mode, initial, emit) {
  const root = el(doc, 'div', 'rw-special-editor');
  const partner = mode === 'opening_partner';
  const head = el(doc, 'div', 'rw-special-editor-head');
  head.append(
    el(doc, 'strong', '', partner ? '开局伙伴' : '开局角色'),
    el(doc, 'small', '', '层级只允许Ⅰ-Ⅲ。原始构筑只能填写 1 项血统和最多 2 项技能；不会填写装备、状态或形态 JSON。'),
  );
  root.appendChild(head);

  const grid = el(doc, 'div', 'rw-special-grid');
  grid.append(
    field(doc, '姓名 *', makeInput(doc, 'opening_name', initial.opening_name || '', { maxLength: 80 })),
    field(doc, '种族', makeInput(doc, 'opening_race', initial.opening_race || '人类', { maxLength: 120 })),
    field(doc, '身份', makeInput(doc, 'opening_identity', initial.opening_identity || '', { maxLength: 300 }), '多个身份用逗号分隔。'),
    field(doc, '职业名称', makeInput(doc, 'opening_occupation_name', initial.opening_occupation_name || '', { maxLength: 160 })),
    field(doc, '职业类型', makeSelect(doc, 'opening_occupation_type', ['战斗', '生活', '辅助'], initial.opening_occupation_type || '辅助')),
    field(doc, '职业特性', makeInput(doc, 'opening_occupation_traits', initial.opening_occupation_traits || '', { maxLength: 300 }), '多个特性用逗号分隔。'),
    field(doc, '职业来源', makeInput(doc, 'opening_occupation_source', initial.opening_occupation_source || '', { maxLength: 300 })),
    field(doc, '层级', makeSelect(doc, 'opening_rank', OPENING_RANKS, OPENING_RANKS.includes(initial.opening_rank) ? initial.opening_rank : 'Ⅰ')),
  );
  root.appendChild(grid);

  if (partner) {
    root.append(
      el(doc, 'div', 'rw-special-subtitle', '伙伴人设'),
      field(doc, '性格', makeInput(doc, 'opening_personality', initial.opening_personality || '', { textarea: true, maxLength: 1600 })),
      field(doc, '喜爱', makeInput(doc, 'opening_likes', initial.opening_likes || '', { textarea: true, maxLength: 1000 })),
      field(doc, '背景故事', makeInput(doc, 'opening_background', initial.opening_background || '', { textarea: true, maxLength: 4000 })),
    );
  }

  root.appendChild(el(doc, 'div', 'rw-special-subtitle', '原始构筑 · 血统'));
  const bloodGrid = el(doc, 'div', 'rw-special-grid');
  bloodGrid.append(
    field(doc, '血统名称', makeInput(doc, 'opening_bloodline_name', initial.opening_bloodline_name || '', { maxLength: 120 })),
    field(doc, '品质', makeSelect(doc, 'opening_bloodline_quality', QUALITIES, initial.opening_bloodline_quality || 'F')),
    field(doc, '效果名称', makeInput(doc, 'opening_bloodline_effect_name', initial.opening_bloodline_effect_name || '', { maxLength: 80 })),
    field(doc, '效果', makeInput(doc, 'opening_bloodline_effect_desc', initial.opening_bloodline_effect_desc || '', { textarea: true, maxLength: 1600 })),
  );
  root.appendChild(bloodGrid);

  const attrs = el(doc, 'div', 'rw-opening-attr-grid');
  for (const attr of ATTRIBUTES) {
    attrs.appendChild(field(
      doc,
      attr,
      makeSelect(doc, `opening_bloodline_attr_${attr}`, QUALITIES, initial[`opening_bloodline_attr_${attr}`] || 'F'),
    ));
  }
  root.append(
    attrs,
    field(doc, '血统描述', makeInput(doc, 'opening_bloodline_desc', initial.opening_bloodline_desc || '', { textarea: true, maxLength: 1600 })),
  );

  root.appendChild(el(doc, 'div', 'rw-special-subtitle', '原始构筑 · 技能（最多 2 项）'));
  for (let index = 1; index <= 2; index += 1) {
    const card = el(doc, 'section', 'rw-opening-skill-card');
    const cardHead = el(doc, 'div', 'rw-opening-skill-head');
    cardHead.append(el(doc, 'strong', '', `技能 ${index}`), el(doc, 'small', '', '不填写名称则不生成该技能'));
    card.appendChild(cardHead);
    const skillGrid = el(doc, 'div', 'rw-special-grid');
    skillGrid.append(
      field(doc, '技能名称', makeInput(doc, `opening_skill_${index}_name`, initial[`opening_skill_${index}_name`] || '', { maxLength: 120 })),
      field(doc, '品质', makeSelect(doc, `opening_skill_${index}_quality`, QUALITIES, initial[`opening_skill_${index}_quality`] || 'F')),
      field(doc, '类型', makeSelect(doc, `opening_skill_${index}_type`, [
        { value: '0', label: '主动' },
        { value: '1', label: '被动' },
        { value: '2', label: '特殊' },
      ], initial[`opening_skill_${index}_type`] ?? '0')),
      field(doc, '消耗', makeInput(doc, `opening_skill_${index}_consume`, initial[`opening_skill_${index}_consume`] || '', { maxLength: 300 })),
      field(doc, '效果名称', makeInput(doc, `opening_skill_${index}_effect_name`, initial[`opening_skill_${index}_effect_name`] || '', { maxLength: 80 })),
      field(doc, '效果', makeInput(doc, `opening_skill_${index}_effect_desc`, initial[`opening_skill_${index}_effect_desc`] || '', { textarea: true, maxLength: 1600 })),
    );
    card.append(
      skillGrid,
      field(doc, '描述', makeInput(doc, `opening_skill_${index}_desc`, initial[`opening_skill_${index}_desc`] || '', { textarea: true, maxLength: 1600 })),
    );
    root.appendChild(card);
  }

  root.addEventListener('input', emit);
  root.addEventListener('change', emit);

  const names = [
    'opening_name', 'opening_race', 'opening_identity', 'opening_occupation_name',
    'opening_occupation_type', 'opening_occupation_traits', 'opening_occupation_source',
    'opening_rank', 'opening_personality', 'opening_likes', 'opening_background',
    'opening_bloodline_name', 'opening_bloodline_quality', 'opening_bloodline_effect_name',
    'opening_bloodline_effect_desc', 'opening_bloodline_desc',
    ...ATTRIBUTES.map(attr => `opening_bloodline_attr_${attr}`),
    ...[1, 2].flatMap(index => [
      `opening_skill_${index}_name`, `opening_skill_${index}_quality`,
      `opening_skill_${index}_type`, `opening_skill_${index}_consume`,
      `opening_skill_${index}_effect_name`, `opening_skill_${index}_effect_desc`,
      `opening_skill_${index}_desc`,
    ]),
  ];
  return { node: root, values: () => valuesFromNames(root, names) };
}

export function createDedicatedPublishEditor({
  doc,
  mode,
  initial = {},
  onChange = null,
}) {
  const emit = () => {
    try { onChange?.(); } catch {}
  };
  if (mode === 'store_catalog') return storeEditor(doc, initial.store_catalog || initial, emit);
  if (mode === 'world_character') return worldEditor(doc, initial, emit);
  if (mode === 'opening_character' || mode === 'opening_partner') {
    return openingEditor(doc, mode, initial, emit);
  }
  throw new Error(`不支持的专用发布模式：${mode}`);
}
