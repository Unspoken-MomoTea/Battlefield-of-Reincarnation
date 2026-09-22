function positionLabel(entry) {
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
  const raw = String(entry?.position_type || '');
  const numeric = /^-?\d+$/u.test(raw) ? Number(raw) : null;
  const type = Number.isInteger(numeric) && numeric >= 0 && numeric < legacy.length
    ? legacy[numeric]
    : raw;
  const labels = {
    before_character_definition: '角色定义之前',
    after_character_definition: '角色定义之后',
    before_example_messages: '示例消息之前',
    after_example_messages: '示例消息之后',
    before_author_note: '作者注释之前',
    after_author_note: '作者注释之后',
  };
  if (type === 'at_depth') return '在深度';
  if (type === 'outlet') return '出口';
  return labels[type] || type || '默认位置';
}

function textValue(value) {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function makeChip(doc, text, className = '') {
  const chip = doc.createElement('span');
  chip.className = `rw-content-chip ${className}`.trim();
  chip.textContent = text;
  return chip;
}

function strategyMeta(entry) {
  const type = String(entry?.strategy_type || 'selective');
  if (type === 'constant') return { symbol: '🔵', label: '常驻', className: 'constant' };
  if (type === 'vectorized') return { symbol: '🔗', label: '向量化', className: 'vectorized' };
  return { symbol: '🟢', label: '关键词', className: 'selective' };
}

function makeStrategyChip(doc, entry, compact = false) {
  const strategy = strategyMeta(entry);
  const chip = doc.createElement('span');
  chip.className = `rw-strategy-chip rw-strategy-chip--${strategy.className}${compact ? ' is-compact' : ''}`;
  chip.textContent = `${strategy.symbol} ${strategy.label}`;
  chip.title = strategy.label === '常驻'
    ? '蓝灯：常驻条目，不依赖关键词触发'
    : strategy.label === '关键词'
      ? '绿灯：关键词触发条目'
      : '向量化触发条目';
  return chip;
}

function renderWorldbookEntry(doc, entry) {
  const panel = doc.createElement('article');
  panel.className = 'rw-content-reader-panel';

  const head = doc.createElement('div');
  head.className = 'rw-content-reader-head';
  const title = doc.createElement('div');
  title.className = 'rw-content-reader-title';
  const h3 = doc.createElement('h3');
  h3.textContent = entry.name || '未命名条目';
  const source = doc.createElement('span');
  source.textContent = entry.artifact_name ? `来自 ${entry.artifact_name}` : '世界书条目';
  title.append(h3, source);
  const stateWrap = doc.createElement('div');
  stateWrap.className = 'rw-content-reader-states';
  stateWrap.append(
    makeStrategyChip(doc, entry),
    makeChip(doc, entry.enabled === false ? '已关闭' : '已启用', entry.enabled === false ? 'muted' : 'good'),
  );
  head.append(title, stateWrap);
  panel.appendChild(head);

  const meta = doc.createElement('div');
  meta.className = 'rw-content-entry-meta';
  meta.append(
    makeChip(doc, `位置 ${positionLabel(entry)}`),
    makeChip(doc, `深度 ${String(entry?.position_type || '') === 'at_depth' ? textValue(entry.depth) : '—'}`),
    makeChip(doc, `顺序 ${textValue(entry.order)}`),
  );
  panel.appendChild(meta);

  const keywords = doc.createElement('div');
  keywords.className = 'rw-content-keywords';
  const primary = doc.createElement('div');
  const primaryTitle = doc.createElement('strong');
  primaryTitle.textContent = '主要关键词';
  const primaryValues = doc.createElement('div');
  primaryValues.className = 'rw-content-chip-list';
  const primaryKeys = Array.isArray(entry.primary_keys) ? entry.primary_keys : [];
  if (primaryKeys.length) primaryValues.append(...primaryKeys.map(value => makeChip(doc, String(value))));
  else primaryValues.appendChild(makeChip(doc, '无', 'muted'));
  primary.append(primaryTitle, primaryValues);

  const secondary = doc.createElement('div');
  const secondaryTitle = doc.createElement('strong');
  secondaryTitle.textContent = '次要关键词';
  const secondaryValues = doc.createElement('div');
  secondaryValues.className = 'rw-content-chip-list';
  const secondaryKeys = Array.isArray(entry.secondary_keys) ? entry.secondary_keys : [];
  if (secondaryKeys.length) secondaryValues.append(...secondaryKeys.map(value => makeChip(doc, String(value))));
  else secondaryValues.appendChild(makeChip(doc, '无', 'muted'));
  secondary.append(secondaryTitle, secondaryValues);
  keywords.append(primary, secondary);
  panel.appendChild(keywords);

  const content = doc.createElement('pre');
  content.className = 'rw-content-source rw-content-source--worldbook';
  content.textContent = entry.content || '（空内容）';
  panel.appendChild(content);
  return panel;
}

function renderRegexEntry(doc, entry) {
  const panel = doc.createElement('article');
  panel.className = 'rw-content-reader-panel';

  const head = doc.createElement('div');
  head.className = 'rw-content-reader-head';
  const title = doc.createElement('div');
  title.className = 'rw-content-reader-title';
  const h3 = doc.createElement('h3');
  h3.textContent = entry.name || '未命名正则';
  const source = doc.createElement('span');
  source.textContent = entry.artifact_name ? `来自 ${entry.artifact_name}` : 'SillyTavern 正则';
  title.append(h3, source);
  head.append(title, makeChip(doc, entry.enabled === false ? '关闭' : '启用', entry.enabled === false ? 'muted' : 'good'));
  panel.appendChild(head);

  const fields = doc.createElement('div');
  fields.className = 'rw-regex-fields';
  const find = doc.createElement('div');
  find.appendChild(Object.assign(doc.createElement('strong'), { textContent: '匹配表达式' }));
  const findPre = doc.createElement('pre');
  findPre.className = 'rw-content-source rw-content-source--compact';
  findPre.textContent = entry.find_regex || '（空）';
  find.appendChild(findPre);

  const replace = doc.createElement('div');
  replace.appendChild(Object.assign(doc.createElement('strong'), { textContent: '替换内容' }));
  const replacePre = doc.createElement('pre');
  replacePre.className = 'rw-content-source rw-content-source--compact';
  replacePre.textContent = entry.replace_string || '（删除匹配内容）';
  replace.appendChild(replacePre);
  fields.append(find, replace);
  panel.appendChild(fields);
  return panel;
}

function renderScriptEntry(doc, entry) {
  const panel = doc.createElement('article');
  panel.className = 'rw-content-reader-panel';

  const head = doc.createElement('div');
  head.className = 'rw-content-reader-head';
  const title = doc.createElement('div');
  title.className = 'rw-content-reader-title';
  const h3 = doc.createElement('h3');
  h3.textContent = entry.folder ? `${entry.folder} / ${entry.name}` : entry.name;
  const scope = ({ character: '当前角色', preset: '当前预设', global: '全局' })[entry.scope] || entry.scope || '当前角色';
  const source = doc.createElement('span');
  source.textContent = `${scope}${entry.artifact_name ? ` · 来自 ${entry.artifact_name}` : ''}`;
  title.append(h3, source);
  head.append(title, makeChip(doc, '安装时才执行', 'warning'));
  panel.appendChild(head);

  const code = doc.createElement('pre');
  code.className = 'rw-content-source rw-content-source--script';
  code.textContent = entry.content || '（空脚本）';
  panel.appendChild(code);
  return panel;
}

function createWorkspace(doc, title, subtitle, entries, renderer, emptyText) {
  const section = doc.createElement('section');
  section.className = 'rw-detail-content-section';

  const heading = doc.createElement('div');
  heading.className = 'rw-detail-content-heading';
  const copy = doc.createElement('div');
  const strong = doc.createElement('strong');
  strong.textContent = title;
  const small = doc.createElement('span');
  small.textContent = subtitle;
  copy.append(strong, small);
  const count = makeChip(doc, `${entries.length} 项`);
  heading.append(copy, count);
  section.appendChild(heading);

  if (!entries.length) {
    const empty = doc.createElement('div');
    empty.className = 'rw-content-empty';
    empty.textContent = emptyText;
    section.appendChild(empty);
    return section;
  }

  const workspace = doc.createElement('div');
  workspace.className = 'rw-content-workspace';
  const nav = doc.createElement('div');
  nav.className = 'rw-content-nav';
  const reader = doc.createElement('div');
  reader.className = 'rw-content-reader';

  const renderIndex = index => {
    [...nav.querySelectorAll('.rw-content-nav-item')].forEach(button => {
      const active = Number(button.dataset.entryIndex) === index;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    reader.replaceChildren(renderer(doc, entries[index]));
  };

  const createNavItem = (entry, index) => {
    const item = doc.createElement('button');
    item.type = 'button';
    item.className = 'rw-content-nav-item';
    item.dataset.entryIndex = String(index);
    const titleRow = doc.createElement('span');
    titleRow.className = 'rw-content-nav-title-row';
    if (title === '世界书内容') titleRow.appendChild(makeStrategyChip(doc, entry, true));
    const name = doc.createElement('strong');
    name.textContent = entry.name || `项目 ${index + 1}`;
    titleRow.appendChild(name);
    const meta = doc.createElement('span');
    meta.textContent = title === '世界书内容'
      ? `位置 ${positionLabel(entry)} · 深度 ${String(entry?.position_type || '') === 'at_depth' ? textValue(entry.depth) : '—'} · 顺序 ${textValue(entry.order)}`
      : (entry.artifact_name || '');
    item.append(titleRow, meta);
    item.addEventListener('click', () => renderIndex(index));
    return item;
  };

  if (title === '世界书内容') {
    entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const aDisplay = Number.isFinite(Number(a.entry.display_index))
          ? Number(a.entry.display_index)
          : Number.isFinite(Number(a.entry.uid))
            ? Number(a.entry.uid)
            : a.index;
        const bDisplay = Number.isFinite(Number(b.entry.display_index))
          ? Number(b.entry.display_index)
          : Number.isFinite(Number(b.entry.uid))
            ? Number(b.entry.uid)
            : b.index;
        return aDisplay - bDisplay || a.index - b.index;
      })
      .forEach(({ entry, index }) => nav.appendChild(createNavItem(entry, index)));
  } else {
    entries.forEach((entry, index) => nav.appendChild(createNavItem(entry, index)));
  }

  workspace.append(nav, reader);
  section.appendChild(workspace);
  renderIndex(0);
  return section;
}

function statusLabel(status) {
  if (status === 'added') return ['+', '新增', 'added'];
  if (status === 'modified') return ['~', '修改', 'modified'];
  return ['−', '删除', 'removed'];
}

function fieldLabel(field) {
  return ({
    content: '正文',
    primary_keys: '主要关键词',
    secondary_keys: '次要关键词',
    enabled: '启用状态',
    position_type: '位置',
    depth: '深度',
    order: '顺序',
    display_index: '条目排序',
    probability: '概率',
    find_regex: '匹配表达式',
    replace_string: '替换内容',
    scope: '作用域',
    folder: '文件夹',
  })[field] || field;
}

export function renderChangePreview(doc, changePreview, changelog = '') {
  const section = doc.createElement('section');
  section.className = 'rw-detail-content-section rw-change-section';

  const heading = doc.createElement('div');
  heading.className = 'rw-detail-content-heading';
  const copy = doc.createElement('div');
  copy.append(
    Object.assign(doc.createElement('strong'), { textContent: '本次更新' }),
    Object.assign(doc.createElement('span'), {
      textContent: changePreview
        ? `v${changePreview.from_version} → v${changePreview.to_version}`
        : '首次发布',
    }),
  );
  heading.appendChild(copy);
  section.appendChild(heading);

  if (changelog) {
    const note = doc.createElement('div');
    note.className = 'rw-change-note';
    note.textContent = changelog;
    section.appendChild(note);
  }

  if (!changePreview) {
    const first = doc.createElement('div');
    first.className = 'rw-content-empty';
    first.textContent = '首次发布，没有上一版本可比较。';
    section.appendChild(first);
    return section;
  }

  const summary = doc.createElement('div');
  summary.className = 'rw-change-summary';
  summary.append(
    makeChip(doc, `+ 新增 ${changePreview.summary?.added || 0}`, 'added'),
    makeChip(doc, `~ 修改 ${changePreview.summary?.modified || 0}`, 'modified'),
    makeChip(doc, `− 删除 ${changePreview.summary?.removed || 0}`, 'removed'),
  );
  section.appendChild(summary);

  const groups = [
    ['世界书', changePreview.worldbook || []],
    ['正则', changePreview.regex || []],
    ['脚本', changePreview.scripts || []],
  ];
  for (const [label, values] of groups) {
    if (!values.length) continue;
    const group = doc.createElement('div');
    group.className = 'rw-change-group';
    const title = doc.createElement('strong');
    title.textContent = `${label} · ${values.length} 处变化`;
    group.appendChild(title);
    for (const change of values) {
      const row = doc.createElement('div');
      row.className = 'rw-change-row';
      const [symbol, status, className] = statusLabel(change.status);
      const badge = makeChip(doc, `${symbol} ${status}`, className);
      const name = doc.createElement('span');
      name.className = 'rw-change-row-title';
      name.textContent = change.title || '未命名';
      const fields = doc.createElement('small');
      fields.textContent = change.changed_fields?.length
        ? change.changed_fields.map(fieldLabel).join(' · ')
        : '';
      row.append(badge, name, fields);
      group.appendChild(row);
    }
    section.appendChild(group);
  }
  return section;
}

export function renderVersionHistory(doc, history) {
  const values = Array.isArray(history) ? history : [];
  const details = doc.createElement('details');
  details.className = 'rw-version-history';
  const summary = doc.createElement('summary');
  summary.textContent = `更新记录 · ${values.length} 个已发布版本`;
  details.appendChild(summary);

  const list = doc.createElement('div');
  list.className = 'rw-version-history-list';
  for (const item of values) {
    const row = doc.createElement('div');
    row.className = 'rw-version-history-row';
    const title = doc.createElement('strong');
    title.textContent = `v${item.version}`;
    const time = doc.createElement('span');
    const timestamp = Number(item.reviewed_at || item.created_at || 0);
    time.textContent = timestamp ? new Date(timestamp * 1000).toLocaleString() : '';
    const note = doc.createElement('div');
    note.textContent = item.changelog || '无更新说明';
    row.append(title, time, note);
    list.appendChild(row);
  }
  details.appendChild(list);
  return details;
}

export function renderContentPreview(doc, detail) {
  const preview = detail?.content_preview || {};
  const fragment = doc.createDocumentFragment();

  fragment.appendChild(createWorkspace(
    doc,
    '世界书内容',
    '直接查看条目关键词、位置和正文',
    Array.isArray(preview.worldbook_entries) ? preview.worldbook_entries : [],
    renderWorldbookEntry,
    '这个版本没有世界书内容。',
  ));

  if (preview.regex_entries?.length) {
    fragment.appendChild(createWorkspace(
      doc,
      '正则',
      '查看实际匹配表达式和替换内容',
      preview.regex_entries,
      renderRegexEntry,
      '这个版本没有正则。',
    ));
  }

  if (preview.scripts?.length) {
    fragment.appendChild(createWorkspace(
      doc,
      '酒馆助手脚本',
      '这里只预览代码；下载和浏览不会执行脚本',
      preview.scripts,
      renderScriptEntry,
      '这个版本没有脚本。',
    ));
  }

  const extras = (preview.artifacts || []).filter(item => ['preset', 'data'].includes(item.kind));
  if (extras.length) {
    const section = doc.createElement('section');
    section.className = 'rw-detail-content-section';
    const heading = doc.createElement('div');
    heading.className = 'rw-detail-content-heading';
    const copy = doc.createElement('div');
    copy.append(
      Object.assign(doc.createElement('strong'), { textContent: '其他内容' }),
      Object.assign(doc.createElement('span'), { textContent: '预设与数据文件' }),
    );
    heading.append(copy, makeChip(doc, `${extras.length} 项`));
    section.appendChild(heading);

    for (const artifact of extras) {
      const details = doc.createElement('details');
      details.className = 'rw-extra-artifact';
      const summary = doc.createElement('summary');
      summary.textContent = `${artifact.kind === 'preset' ? '预设' : '数据'} · ${artifact.name}`;
      const pre = doc.createElement('pre');
      pre.className = 'rw-content-source';
      pre.textContent = artifact.preview || '（空）';
      details.append(summary, pre);
      section.appendChild(details);
    }
    fragment.appendChild(section);
  }

  return fragment;
}
