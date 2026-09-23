const OPENING_RANKS = ['Ⅰ', 'Ⅱ', 'Ⅲ'];
const WORLD_RANKS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ'];
const STORE_QUALITIES = ['F', 'E', 'D'];
const EQUIPMENT_ATTR_QUALITIES = ['F', 'E', 'D', 'C', 'B', 'A'];
const STORE_PRICE_FLOOR = { F: 50, E: 300, D: 700 };
const POINT_QUALITIES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const ATTRIBUTES = ['力量', '敏捷', '体质', '精神', '魅力'];
const STORE_ATTRIBUTES = ['力量', '敏捷', '体质', '精神', '魅力', 'ATK', 'DEF', 'MATK', 'MDEF', 'AP'];
const STORE_EQUIPMENT_TYPES = [
  { value: '0', label: '刀剑类' },
  { value: '1', label: '枪矛类' },
  { value: '2', label: '棍棒类' },
  { value: '3', label: '机械类' },
  { value: '4', label: '弓弩类' },
  { value: '5', label: '盾牌类' },
  { value: '6', label: '匕首短刃' },
  { value: '7', label: '法杖魔导书' },
  { value: '8', label: '圣典权杖' },
  { value: '9', label: '特殊武器' },
  { value: '10', label: '手部' },
  { value: '11', label: '头部' },
  { value: '12', label: '胸部' },
  { value: '13', label: '腿部' },
  { value: '14', label: '鞋子' },
  { value: '15', label: '披风' },
  { value: '16', label: '饰品' },
  { value: '17', label: '世界遗物' },
];
const EQUIPMENT_TYPES = [
  { value: '0', label: '手持' },
  { value: '1', label: '手部' },
  { value: '2', label: '头部' },
  { value: '3', label: '胸部' },
  { value: '4', label: '腿部' },
  { value: '5', label: '鞋子' },
  { value: '6', label: '披风' },
  { value: '7', label: '饰品' },
  { value: '8', label: '特殊' },
];

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

function randomId(kind, index) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${index.toString(36)}`;
  return `workshop-${kind}-${suffix}`;
}

function firstEffects(item = {}) {
  return Object.entries(item.effects || {}).slice(0, 2).map(([name, description]) => ({ name, description }));
}

function effectsFromCard(card) {
  const result = {};
  for (const row of card.querySelectorAll('[data-effect-row]')) {
    const name = getValue(row, 'effect_name').trim();
    const description = getValue(row, 'effect_desc').trim();
    if (!description) continue;
    result[name || '效果'] = description;
  }
  return result;
}

function appendEffectEditor(doc, card, effects, emit, { max = 2 } = {}) {
  const block = el(doc, 'div', 'rw-effect-editor');
  const rows = el(doc, 'div', 'rw-effect-list');
  const add = el(doc, 'button', 'rw-button rw-effect-add', '+ 添加效果');
  add.type = 'button';
  block.append(rows, add);

  const state = effects?.length ? effects.slice(0, max) : [];

  const render = () => {
    rows.replaceChildren();
    state.forEach((entry, index) => {
      const row = el(doc, 'div', 'rw-effect-row');
      row.dataset.effectRow = String(index);
      const name = makeInput(doc, 'effect_name', entry.name || '', { maxLength: 80, placeholder: '效果名称' });
      const description = makeInput(doc, 'effect_desc', entry.description || '', { textarea: true, maxLength: 1600, placeholder: '填写效果内容' });
      const remove = el(doc, 'button', 'rw-button danger rw-effect-remove', '删除');
      remove.type = 'button';
      row.append(field(doc, '效果名称', name), field(doc, '效果', description), remove);
      const sync = () => {
        entry.name = name.value;
        entry.description = description.value;
        emit();
      };
      name.addEventListener('input', sync);
      description.addEventListener('input', sync);
      remove.addEventListener('click', () => {
        state.splice(index, 1);
        render();
        emit();
      });
      rows.appendChild(row);
    });
    add.disabled = state.length >= max;
    add.hidden = state.length >= max;
  };

  add.addEventListener('click', () => {
    if (state.length >= max) return;
    state.push({ name: '', description: '' });
    render();
    emit();
  });
  render();
  return { node: block, values: () => state.filter(item => item.description?.trim()).map(item => ({ ...item })) };
}

function pointAllocator(doc, { budget, initial = {}, emit }) {
  const root = el(doc, 'div', 'rw-point-allocator');
  const remaining = el(doc, 'span', 'rw-point-remaining');
  const grid = el(doc, 'div', 'rw-point-grid');
  root.append(grid);

  const values = Object.fromEntries(ATTRIBUTES.map(attr => [
    attr,
    Math.max(0, Math.min(8, Number(initial?.[attr]) || 0)),
  ]));
  let total = Object.values(values).reduce((sum, value) => sum + value, 0);
  while (total > budget) {
    const attr = ATTRIBUTES.find(key => values[key] > 0);
    if (!attr) break;
    values[attr] -= 1;
    total -= 1;
  }

  const controls = new Map();
  for (const attr of ATTRIBUTES) {
    const card = el(doc, 'div', 'rw-point-card');
    const label = el(doc, 'strong', '', attr);
    const row = el(doc, 'div', 'rw-point-controls');
    const minus = el(doc, 'button', 'rw-point-button', '−');
    const tier = el(doc, 'span', 'rw-point-tier');
    const plus = el(doc, 'button', 'rw-point-button', '+');
    minus.type = plus.type = 'button';
    row.append(minus, tier, plus);
    card.append(label, row);
    grid.appendChild(card);
    controls.set(attr, { tier, minus, plus });

    minus.addEventListener('click', () => {
      if (values[attr] <= 0) return;
      values[attr] -= 1;
      render();
      emit();
    });
    plus.addEventListener('click', () => {
      const used = Object.values(values).reduce((sum, value) => sum + value, 0);
      if (values[attr] >= 8 || used >= budget) return;
      values[attr] += 1;
      render();
      emit();
    });
  }

  const render = () => {
    const used = Object.values(values).reduce((sum, value) => sum + value, 0);
    remaining.textContent = `剩余 ${Math.max(0, budget - used)} 点`;
    for (const [attr, control] of controls) {
      const value = values[attr];
      control.tier.textContent = POINT_QUALITIES[value] || 'SSS';
      control.minus.disabled = value <= 0;
      control.plus.disabled = value >= 8 || used >= budget;
    }
  };
  render();

  return {
    node: root,
    remaining,
    values: () => structuredClone(values),
  };
}

function normalizeStoreEntries(initial = {}) {
  const rows = [];
  for (const [kind, key] of [['equipment', 'equipments'], ['item', 'items'], ['skill', 'skills']]) {
    for (const item of initial?.[key] || []) {
      const normalized = structuredClone(item);
      const tier = STORE_QUALITIES.includes(String(normalized.tier || '').toUpperCase())
        ? String(normalized.tier).toUpperCase()
        : 'F';
      normalized.tier = tier;
      normalized.cost = Math.max(
        STORE_PRICE_FLOOR[tier],
        Math.min(1000, Number(normalized.cost) || 0),
      );
      normalized.effects = Object.fromEntries(Object.entries(normalized.effects || {}).slice(0, 2));
      rows.push({ kind, item: normalized });
    }
  }
  return rows;
}

function storeEditor(doc, initial, emit) {
  const root = el(doc, 'div', 'rw-special-editor');
  const head = el(doc, 'div', 'rw-special-editor-head');
  head.append(
    el(doc, 'strong', '', '开局商店'),
    el(doc, 'small', '', '逐项添加商品。品质只允许 F / E / D，单件价格最高 1000；每件商品最多 2 条效果。'),
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
      const card = el(doc, 'section', 'rw-store-entry');
      card.dataset.storeIndex = String(index);

      const cardHead = el(doc, 'div', 'rw-store-entry-head');
      const kind = makeSelect(doc, 'store_kind', [
        { value: 'equipment', label: '装备' },
        { value: 'item', label: '道具' },
        { value: 'skill', label: '技能' },
      ], entry.kind);
      const remove = el(doc, 'button', 'rw-button danger rw-store-remove', '删除商品');
      remove.type = 'button';
      cardHead.append(kind, remove);
      card.appendChild(cardHead);

      const common = el(doc, 'div', 'rw-special-grid');
      const quality = makeSelect(doc, 'store_quality', STORE_QUALITIES, item.tier || 'F');
      const initialQuality = quality.value || 'F';
      const price = makeInput(
        doc,
        'store_cost',
        Math.max(STORE_PRICE_FLOOR[initialQuality], Number(item.cost || 0)),
        { type: 'number', min: STORE_PRICE_FLOOR[initialQuality], max: 1000, step: 1 },
      );
      common.append(
        field(doc, '名称 *', makeInput(doc, 'store_name', item.name || '', { maxLength: 80 })),
        field(doc, '品质', quality),
        field(doc, '价格', price, 'F≥50 / E≥300 / D≥700；最高1000。'),
      );
      card.appendChild(common);

      if (entry.kind === 'equipment') {
        card.appendChild(field(
          doc,
          '装备类型',
          makeSelect(doc, 'store_equipment_type', STORE_EQUIPMENT_TYPES, String(item.type ?? 0)),
        ));
        card.appendChild(el(doc, 'div', 'rw-special-subtitle', '原始属性'));
        const attrs = el(doc, 'div', 'rw-store-attr-grid');
        for (const attr of STORE_ATTRIBUTES) {
          attrs.appendChild(field(
            doc,
            attr,
            makeSelect(doc, `store_attr_${attr}`, [
              { value: '', label: '无' },
              ...EQUIPMENT_ATTR_QUALITIES.map(value => ({ value, label: value })),
            ], item.attrs?.[attr] || ''),
          ));
        }
        card.appendChild(attrs);
      } else if (entry.kind === 'item') {
        card.appendChild(field(
          doc,
          '数量',
          makeInput(doc, 'store_quantity', Number(item.quantity || 1), { type: 'number', min: 1, max: 999, step: 1 }),
          '购买一次写入背包的数量。',
        ));
      }

      card.appendChild(el(doc, 'div', 'rw-special-subtitle', '效果与描述'));
      const effectEditor = appendEffectEditor(doc, card, firstEffects(item), emit, { max: 2 });
      card.append(
        effectEditor.node,
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
        const base = {
          id: previousId,
          name: getValue(card, 'store_name').trim(),
          tier: getValue(card, 'store_quality') || 'F',
          cost: Math.max(
            STORE_PRICE_FLOOR[getValue(card, 'store_quality') || 'F'] || 50,
            Math.min(1000, Number(getValue(card, 'store_cost')) || 0),
          ),
          source: '创意工坊',
          tags: [],
          effects: effectsFromCard(card),
          desc: getValue(card, 'store_desc').trim(),
        };
        entry.item = entry.kind === 'equipment'
          ? {
              ...base,
              type: Math.max(0, Math.min(17, Number(getValue(card, 'store_equipment_type')) || 0)),
              attrs: attrsValue,
              consume: '无',
            }
          : entry.kind === 'item'
            ? { ...base, type: '特殊', quantity: Math.max(1, Math.min(999, Number(getValue(card, 'store_quantity')) || 1)), consume: '无', cd: '0' }
            : { ...base, type: 0, consume: '无' };
        emit();
      };

      price.addEventListener('change', () => {
        const floor = STORE_PRICE_FLOOR[quality.value] || 50;
        const next = Math.max(floor, Math.min(1000, Number(price.value) || 0));
        price.value = String(next);
        sync();
      });
      quality.addEventListener('change', () => {
        const floor = STORE_PRICE_FLOOR[quality.value] || 50;
        price.min = String(floor);
        if ((Number(price.value) || 0) < floor) price.value = String(floor);
        sync();
      });
      kind.addEventListener('change', () => {
        sync();
        render();
      });
      card.addEventListener('input', event => {
        if (!event.target.closest?.('[data-effect-row]')) sync();
      });
      card.addEventListener('change', event => {
        if (event.target !== kind) sync();
      });
      effectEditor.node.addEventListener('input', sync);
      effectEditor.node.addEventListener('click', event => {
        if (event.target?.closest?.('.rw-effect-add,.rw-effect-remove')) sync();
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
        cost: 50,
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

function rankQuality(rank) {
  return ({ 'Ⅰ': 'F', 'Ⅱ': 'E', 'Ⅲ': 'D' })[rank] || 'F';
}

function openingEquipmentEditor(doc, initial = [], emit) {
  const root = el(doc, 'div', 'rw-partner-equipment');
  const list = el(doc, 'div', 'rw-partner-equipment-list');
  const add = el(doc, 'button', 'rw-button', '+ 添加装备');
  add.type = 'button';
  root.append(list, add);
  const entries = (initial || []).map(item => {
    const next = structuredClone(item);
    next.品质 = STORE_QUALITIES.includes(String(next.品质 || '').toUpperCase())
      ? String(next.品质).toUpperCase()
      : 'F';
    next.效果 = Object.fromEntries(Object.entries(next.效果 || {}).slice(0, 2));
    return next;
  });

  const render = () => {
    list.replaceChildren();
    if (!entries.length) list.appendChild(el(doc, 'div', 'rw-local-note', '伙伴可以携带装备；不需要装备时保持为空即可。'));
    entries.forEach((item, index) => {
      const card = el(doc, 'section', 'rw-opening-equipment-card');
      const head = el(doc, 'div', 'rw-store-entry-head');
      head.append(
        el(doc, 'strong', '', `装备 ${index + 1}`),
        (() => {
          const remove = el(doc, 'button', 'rw-button danger', '删除装备');
          remove.type = 'button';
          remove.addEventListener('click', () => {
            entries.splice(index, 1);
            render();
            emit();
          });
          return remove;
        })(),
      );
      card.appendChild(head);

      const grid = el(doc, 'div', 'rw-special-grid');
      grid.append(
        field(doc, '装备名称 *', makeInput(doc, 'partner_equipment_name', item.name || '', { maxLength: 120 })),
        field(doc, '品质', makeSelect(doc, 'partner_equipment_quality', STORE_QUALITIES, item.品质 || 'F')),
        field(doc, '类型', makeSelect(doc, 'partner_equipment_type', EQUIPMENT_TYPES, String(item.类型 ?? 0))),
      );
      card.appendChild(grid);

      card.appendChild(el(doc, 'div', 'rw-special-subtitle', '原始属性'));
      const attrs = el(doc, 'div', 'rw-store-attr-grid');
      for (const attr of STORE_ATTRIBUTES) {
        attrs.appendChild(field(
          doc,
          attr,
          makeSelect(doc, `partner_equipment_attr_${attr}`, [
            { value: '', label: '无' },
            ...EQUIPMENT_ATTR_QUALITIES.map(value => ({ value, label: value })),
          ], item.原始属性?.[attr] || ''),
        ));
      }
      card.appendChild(attrs);

      const effects = Object.entries(item.效果 || {}).slice(0, 2).map(([name, description]) => ({ name, description }));
      card.appendChild(el(doc, 'div', 'rw-special-subtitle', '效果与描述'));
      const effectEditor = appendEffectEditor(doc, card, effects, emit, { max: 2 });
      card.append(effectEditor.node, field(doc, '描述', makeInput(doc, 'partner_equipment_desc', item.描述 || '', { textarea: true, maxLength: 1600 })));

      const sync = () => {
        const attrsValue = {};
        for (const attr of STORE_ATTRIBUTES) {
          const value = getValue(card, `partner_equipment_attr_${attr}`);
          if (value) attrsValue[attr] = value;
        }
        entries[index] = {
          name: getValue(card, 'partner_equipment_name').trim(),
          品质: getValue(card, 'partner_equipment_quality') || 'F',
          类型: Math.max(0, Math.min(8, Number(getValue(card, 'partner_equipment_type')) || 0)),
          标签: [],
          原始属性: attrsValue,
          效果: effectsFromCard(card),
          描述: getValue(card, 'partner_equipment_desc').trim(),
          消耗: '无',
          状态: 0,
        };
        emit();
      };
      card.addEventListener('input', sync);
      card.addEventListener('change', sync);
      card.addEventListener('click', event => {
        if (event.target?.closest?.('.rw-effect-add,.rw-effect-remove')) sync();
      });
      list.appendChild(card);
    });
  };

  add.addEventListener('click', () => {
    entries.push({
      name: '',
      品质: 'F',
      类型: 0,
      标签: [],
      原始属性: {},
      效果: {},
      描述: '',
      消耗: '无',
      状态: 0,
    });
    render();
    emit();
  });
  render();

  return {
    node: root,
    values: () => entries.filter(item => item.name?.trim()).map(item => structuredClone(item)),
  };
}

function openingSkillEditor(doc, initial = [], getQuality, emit) {
  const root = el(doc, 'div', 'rw-opening-skills-editor');
  const list = el(doc, 'div', 'rw-opening-skills-list');
  const add = el(doc, 'button', 'rw-button rw-opening-skill-add', '+ 添加技能');
  add.type = 'button';
  root.append(list, add);

  const entries = (initial || []).slice(0, 2).map(item => ({
    name: String(item?.name || ''),
    type: String(item?.type ?? '0'),
    consume: String(item?.consume || ''),
    effectName: String(item?.effectName || ''),
    effectDesc: String(item?.effectDesc || ''),
    desc: String(item?.desc || ''),
  }));
  const qualityNodes = [];

  const render = () => {
    list.replaceChildren();
    qualityNodes.length = 0;
    if (!entries.length) {
      list.appendChild(el(doc, 'div', 'rw-local-note', '还没有技能。点击“添加技能”创建，最多 2 项。'));
    }
    entries.forEach((item, index) => {
      const card = el(doc, 'section', 'rw-opening-skill-card');
      const cardHead = el(doc, 'div', 'rw-opening-skill-head');
      const autoQuality = el(doc, 'span', 'rw-auto-quality rw-auto-quality--inline');
      qualityNodes.push(autoQuality);
      const remove = el(doc, 'button', 'rw-button danger rw-opening-skill-remove', '删除技能');
      remove.type = 'button';
      cardHead.append(el(doc, 'strong', '', `技能 ${index + 1}`), autoQuality, remove);
      card.appendChild(cardHead);

      const skillGrid = el(doc, 'div', 'rw-special-grid');
      const name = makeInput(doc, 'opening_skill_name', item.name, { maxLength: 120 });
      const type = makeSelect(doc, 'opening_skill_type', [
        { value: '0', label: '主动' },
        { value: '1', label: '被动' },
        { value: '2', label: '特殊' },
      ], item.type);
      const consume = makeInput(doc, 'opening_skill_consume', item.consume, { maxLength: 300 });
      const effectName = makeInput(doc, 'opening_skill_effect_name', item.effectName, { maxLength: 80 });
      const effectDesc = makeInput(doc, 'opening_skill_effect_desc', item.effectDesc, { textarea: true, maxLength: 1600 });
      const desc = makeInput(doc, 'opening_skill_desc', item.desc, { textarea: true, maxLength: 1600 });

      skillGrid.append(
        field(doc, '技能名称 *', name),
        field(doc, '类型', type),
        field(doc, '消耗', consume),
        field(doc, '效果名称', effectName),
        field(doc, '效果', effectDesc),
      );
      card.append(skillGrid, field(doc, '描述', desc));

      const sync = () => {
        item.name = name.value;
        item.type = type.value;
        item.consume = consume.value;
        item.effectName = effectName.value;
        item.effectDesc = effectDesc.value;
        item.desc = desc.value;
        emit();
      };
      card.addEventListener('input', sync);
      card.addEventListener('change', sync);
      remove.addEventListener('click', () => {
        entries.splice(index, 1);
        render();
        emit();
      });
      list.appendChild(card);
    });
    const q = getQuality();
    qualityNodes.forEach(node => { node.textContent = `品质 ${q} · 自动`; });
    add.hidden = entries.length >= 2;
    add.disabled = entries.length >= 2;
  };

  add.addEventListener('click', () => {
    if (entries.length >= 2) return;
    entries.push({ name: '', type: '0', consume: '', effectName: '', effectDesc: '', desc: '' });
    render();
    emit();
  });
  render();

  return {
    node: root,
    values: () => entries.filter(item => item.name.trim()).map(item => structuredClone(item)),
    syncQuality: () => {
      const q = getQuality();
      qualityNodes.forEach(node => { node.textContent = `品质 ${q} · 自动`; });
    },
  };
}

function openingEditor(doc, mode, initial, emit) {
  const root = el(doc, 'div', 'rw-special-editor');
  const partner = mode === 'opening_partner';
  const budget = partner ? 16 : 8;
  const head = el(doc, 'div', 'rw-special-editor-head');
  head.append(
    el(doc, 'strong', '', partner ? '开局伙伴' : '开局角色'),
    el(doc, 'small', '', partner
      ? '层级只允许Ⅰ-Ⅲ；五维使用与开局一致的点数分配，血统和技能品质由层级自动决定，伙伴可额外携带装备。'
      : '层级只允许Ⅰ-Ⅲ；五维使用与开局一致的点数分配，血统和技能品质由层级自动决定。'),
  );
  root.appendChild(head);

  const grid = el(doc, 'div', 'rw-special-grid');
  const rank = makeSelect(doc, 'opening_rank', OPENING_RANKS, OPENING_RANKS.includes(initial.opening_rank) ? initial.opening_rank : 'Ⅰ');
  grid.append(
    field(doc, '姓名 *', makeInput(doc, 'opening_name', initial.opening_name || '', { maxLength: 80 })),
    field(doc, '种族', makeInput(doc, 'opening_race', initial.opening_race || '人类', { maxLength: 120 })),
    field(doc, '身份', makeInput(doc, 'opening_identity', initial.opening_identity || '', { maxLength: 300 }), '多个身份用逗号分隔。'),
    field(doc, '职业名称', makeInput(doc, 'opening_occupation_name', initial.opening_occupation_name || '', { maxLength: 160 })),
    field(doc, '职业类型', makeSelect(doc, 'opening_occupation_type', ['战斗', '生活', '辅助'], initial.opening_occupation_type || '辅助')),
    field(doc, '职业特性', makeInput(doc, 'opening_occupation_traits', initial.opening_occupation_traits || '', { maxLength: 300 }), '多个特性用逗号分隔。'),
    field(doc, '职业来源', makeInput(doc, 'opening_occupation_source', initial.opening_occupation_source || '', { maxLength: 300 })),
    field(doc, '层级', rank, 'Ⅰ→F，Ⅱ→E，Ⅲ→D；血统与技能品质会自动同步。'),
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

  const allocator = pointAllocator(doc, {
    budget,
    initial: initial.opening_attributes || {},
    emit,
  });
  const buildHead = el(doc, 'div', 'rw-special-subtitle-row');
  buildHead.append(
    el(doc, 'div', 'rw-special-subtitle', '原始构筑 · 血统与五维'),
    allocator.remaining,
  );
  root.append(buildHead, allocator.node);

  const bloodGrid = el(doc, 'div', 'rw-special-grid');
  const bloodQuality = el(doc, 'div', 'rw-auto-quality');
  bloodGrid.append(
    field(doc, '血统名称 *', makeInput(doc, 'opening_bloodline_name', initial.opening_bloodline_name || '', { maxLength: 120 })),
    field(doc, '血统品质（自动）', bloodQuality),
    field(doc, '效果名称', makeInput(doc, 'opening_bloodline_effect_name', initial.opening_bloodline_effect_name || '', { maxLength: 80 })),
    field(doc, '效果', makeInput(doc, 'opening_bloodline_effect_desc', initial.opening_bloodline_effect_desc || '', { textarea: true, maxLength: 1600 })),
  );
  root.append(
    bloodGrid,
    field(doc, '血统描述', makeInput(doc, 'opening_bloodline_desc', initial.opening_bloodline_desc || '', { textarea: true, maxLength: 1600 })),
  );

  root.appendChild(el(doc, 'div', 'rw-special-subtitle', '原始构筑 · 技能'));
  const skillEditor = openingSkillEditor(
    doc,
    initial.opening_skills || [],
    () => rankQuality(rank.value),
    emit,
  );

  root.appendChild(skillEditor.node);

  let equipmentEditor = null;
  if (partner) {
    root.appendChild(el(doc, 'div', 'rw-special-subtitle', '原始构筑 · 装备'));
    equipmentEditor = openingEquipmentEditor(doc, initial.opening_partner_equipment || [], emit);
    root.appendChild(equipmentEditor.node);
  }

  const syncAutoQuality = () => {
    const value = rankQuality(rank.value);
    bloodQuality.textContent = `${value}（随${rank.value}阶）`;
    skillEditor.syncQuality();
  };
  rank.addEventListener('change', () => {
    syncAutoQuality();
    emit();
  });
  syncAutoQuality();

  root.addEventListener('input', emit);
  root.addEventListener('change', emit);

  const names = [
    'opening_name', 'opening_race', 'opening_identity', 'opening_occupation_name',
    'opening_occupation_type', 'opening_occupation_traits', 'opening_occupation_source',
    'opening_rank', 'opening_personality', 'opening_likes', 'opening_background',
    'opening_bloodline_name', 'opening_bloodline_effect_name',
    'opening_bloodline_effect_desc', 'opening_bloodline_desc',
  ];

  return {
    node: root,
    values() {
      return {
        ...valuesFromNames(root, names),
        opening_attributes: allocator.values(),
        opening_skills: skillEditor.values(),
        ...(partner ? { opening_partner_equipment: equipmentEditor?.values() || [] } : {}),
      };
    },
  };
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
