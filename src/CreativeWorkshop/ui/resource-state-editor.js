import { scanPublishResources } from '../services/publish-resources.js';
import {
  normalizeResourceOverrides,
  resourceOverrideKey,
} from '../services/resource-overrides.js';

const TAB_META = {
  worldbook: { label: '世界书', icon: '书' },
  regex: { label: '正则', icon: '正' },
  script: { label: '酒馆助手脚本', icon: 'JS' },
};

function text(value) {
  return String(value ?? '').trim();
}

function currentBadge(doc, enabled) {
  const badge = doc.createElement('span');
  badge.className = `rw-resource-current ${enabled ? 'is-enabled' : 'is-disabled'}`;
  badge.textContent = enabled ? '● 当前启用' : '○ 当前停用';
  return badge;
}

function previewDetails(doc, label, content) {
  if (!String(content || '').trim()) return null;
  const details = doc.createElement('details');
  details.className = 'rw-resource-state-preview';
  const summary = doc.createElement('summary');
  summary.textContent = label;
  const pre = doc.createElement('pre');
  pre.textContent = String(content || '');
  details.append(summary, pre);
  return details;
}

function resourceRule(resource) {
  if (resource.kind === 'worldbook') {
    return {
      kind: 'worldbook',
      state: 'disabled',
      target: {
        worldbook: resource.worldbook,
        ...(resource.uid ? { uid: resource.uid } : {}),
        ...(resource.name ? { name: resource.name } : {}),
      },
    };
  }
  if (resource.kind === 'regex') {
    return {
      kind: 'regex',
      state: 'disabled',
      target: {
        scope: 'character',
        ...(resource.id ? { id: resource.id } : {}),
        ...(resource.name ? { name: resource.name } : {}),
        ...(resource.find_regex ? { find_regex: resource.find_regex } : {}),
      },
    };
  }
  return {
    kind: 'script',
    state: 'disabled',
    target: {
      scope: resource.scope,
      ...(resource.id ? { id: resource.id } : {}),
      ...(resource.name ? { name: resource.name } : {}),
      ...(resource.folder ? { folder: resource.folder } : {}),
    },
  };
}

function flattenResources(scan) {
  const output = [];
  for (const book of scan?.worldbooks || []) {
    for (const entry of book.entries || []) {
      output.push({
        kind: 'worldbook',
        worldbook: book.name,
        sources: book.sources || [],
        uid: entry.uid || '',
        name: entry.name,
        enabled: Boolean(entry.enabled),
        strategy_symbol: entry.strategy_symbol || '',
        strategy_label: entry.strategy_label || '',
        keys: entry.keys || [],
        content: entry.content || '',
        selectable: entry.selectable !== false,
      });
    }
  }
  for (const regex of scan?.regexes || []) {
    output.push({
      kind: 'regex',
      scope: 'character',
      id: regex.id || '',
      name: regex.name,
      enabled: Boolean(regex.enabled),
      find_regex: regex.find_regex || '',
      replace_string: regex.replace_string || '',
      selectable: regex.selectable !== false,
    });
  }
  for (const script of scan?.scripts || []) {
    output.push({
      kind: 'script',
      scope: script.scope,
      folder: script.folder || '',
      id: script.id || '',
      name: script.name,
      enabled: Boolean(script.enabled),
      content: script.content || '',
      selectable: script.selectable !== false,
    });
  }
  return output;
}

export function createResourceStateEditor({
  doc,
  initialRules = [],
  notifyError = null,
  scan = scanPublishResources,
  onChange = null,
}) {
  const root = doc.createElement('section');
  root.className = 'rw-resource-state-editor';

  const heading = doc.createElement('div');
  heading.className = 'rw-resource-state-head';
  const headingCopy = doc.createElement('div');
  headingCopy.className = 'rw-resource-state-head-copy';
  const title = doc.createElement('strong');
  title.textContent = '原版资源状态（可选）';
  const subtitle = doc.createElement('small');
  subtitle.textContent = '作品启用期间可让原世界书、正则或酒馆助手脚本保持原状态、强制启用或强制停用；停用作品后恢复安装前状态。';
  headingCopy.append(title, subtitle);

  const refreshButton = doc.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'rw-button rw-resource-state-refresh';
  refreshButton.textContent = '重新扫描';
  heading.append(headingCopy, refreshButton);

  const tabs = doc.createElement('div');
  tabs.className = 'rw-resource-state-tabs';
  const tabButtons = new Map();
  for (const kind of ['worldbook', 'regex', 'script']) {
    const meta = TAB_META[kind];
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'rw-resource-state-tab';
    button.dataset.kind = kind;
    button.textContent = `${meta.icon} ${meta.label}`;
    if (kind === 'worldbook') button.classList.add('is-active');
    tabs.appendChild(button);
    tabButtons.set(kind, button);
  }

  const toolbar = doc.createElement('div');
  toolbar.className = 'rw-resource-state-toolbar';
  const search = doc.createElement('input');
  search.type = 'search';
  search.className = 'rw-input';
  search.placeholder = '搜索当前页资源';
  const selectedCount = doc.createElement('span');
  selectedCount.className = 'rw-resource-state-count';
  toolbar.append(search, selectedCount);

  const body = doc.createElement('div');
  body.className = 'rw-resource-state-body';

  const status = doc.createElement('div');
  status.className = 'rw-resource-state-status';
  status.textContent = '打开发布或更新界面后会读取当前酒馆资源。';

  root.append(heading, tabs, toolbar, status, body);

  let activeKind = 'worldbook';
  let loading = false;
  let resources = [];
  let selected = new Map(
    normalizeResourceOverrides(initialRules)
      .map(rule => [resourceOverrideKey(rule), rule]),
  );

  function selectedRuleFor(resource) {
    const base = resourceRule(resource);
    return selected.get(resourceOverrideKey(base)) || null;
  }

  function setRule(resource, state) {
    const base = resourceRule(resource);
    const key = resourceOverrideKey(base);
    if (!key) return;
    if (state === 'keep') selected.delete(key);
    else selected.set(key, { ...base, state });
    render();
    try { onChange?.(normalizeResourceOverrides([...selected.values()])); } catch {}
  }

  function stateButton(resource, value, currentRule) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = `rw-resource-state-choice rw-resource-state-choice--${value}`;
    button.textContent = value === 'keep' ? '保持' : value === 'enabled' ? '启用' : '停用';
    const selectedValue = currentRule?.state || 'keep';
    button.classList.toggle('is-selected', selectedValue === value);
    button.disabled = resource.selectable === false;
    button.addEventListener('click', () => setRule(resource, value));
    return button;
  }

  function resourceMeta(resource) {
    if (resource.kind === 'worldbook') {
      return [
        resource.worldbook,
        resource.strategy_symbol && resource.strategy_label
          ? `${resource.strategy_symbol} ${resource.strategy_label}`
          : '',
        resource.uid ? `UID ${resource.uid}` : '',
        resource.keys?.length ? `关键词：${resource.keys.slice(0, 4).join('、')}` : '',
      ].filter(Boolean).join(' · ');
    }
    if (resource.kind === 'regex') {
      return [
        '当前角色正则',
        resource.id ? `ID ${resource.id}` : '',
        resource.find_regex ? `匹配：${resource.find_regex}` : '',
      ].filter(Boolean).join(' · ');
    }
    const scope = ({ character: '当前角色', preset: '当前预设', global: '全局' })[resource.scope] || resource.scope;
    return [
      scope,
      resource.folder ? `文件夹：${resource.folder}` : '',
      resource.id ? `ID ${resource.id}` : '',
    ].filter(Boolean).join(' · ');
  }

  function resourcePreview(resource) {
    if (resource.kind === 'worldbook') {
      return previewDetails(doc, '查看世界书内容', resource.content);
    }
    if (resource.kind === 'regex') {
      const value = [
        `匹配：${resource.find_regex || '(空)'}`,
        `替换：${resource.replace_string || '(空)'}`,
      ].join('\n');
      return previewDetails(doc, '查看正则内容', value);
    }
    return previewDetails(doc, '查看脚本内容', resource.content);
  }

  function resourceRow(resource, { missing = false } = {}) {
    const row = doc.createElement('div');
    row.className = `rw-resource-state-row${missing ? ' is-missing' : ''}`;

    const top = doc.createElement('div');
    top.className = 'rw-resource-state-row-main';

    const copy = doc.createElement('div');
    copy.className = 'rw-resource-state-copy';
    const titleRow = doc.createElement('div');
    titleRow.className = 'rw-resource-state-title';
    const strong = doc.createElement('strong');
    strong.textContent = resource.folder
      ? `${resource.folder} / ${resource.name}`
      : resource.name || '未命名资源';
    titleRow.append(strong);
    if (!missing) titleRow.append(currentBadge(doc, resource.enabled));
    else {
      const badge = doc.createElement('span');
      badge.className = 'rw-resource-current is-missing';
      badge.textContent = '当前未扫描到';
      titleRow.appendChild(badge);
    }

    const meta = doc.createElement('small');
    meta.textContent = resourceMeta(resource);
    copy.append(titleRow, meta);

    const choices = doc.createElement('div');
    choices.className = 'rw-resource-state-choices';
    const rule = selectedRuleFor(resource);
    choices.append(
      stateButton(resource, 'keep', rule),
      stateButton(resource, 'enabled', rule),
      stateButton(resource, 'disabled', rule),
    );

    top.append(copy, choices);
    row.appendChild(top);

    if (!missing) {
      const preview = resourcePreview(resource);
      if (preview) row.appendChild(preview);
    }

    if (resource.selectable === false) {
      const warning = doc.createElement('div');
      warning.className = 'rw-resource-state-warning';
      warning.textContent = '这个资源缺少稳定标识且存在重复项，无法安全自动控制状态。';
      row.appendChild(warning);
    }
    return row;
  }

  function resourceFromSavedRule(rule) {
    const target = rule.target || {};
    if (rule.kind === 'worldbook') {
      return {
        kind: 'worldbook',
        worldbook: target.worldbook || '',
        uid: target.uid || '',
        name: target.name || target.uid || '已保存世界书规则',
        enabled: false,
        selectable: true,
      };
    }
    if (rule.kind === 'regex') {
      return {
        kind: 'regex',
        scope: target.scope || 'character',
        id: target.id || '',
        name: target.name || target.id || '已保存正则规则',
        find_regex: target.find_regex || '',
        enabled: false,
        selectable: true,
      };
    }
    return {
      kind: 'script',
      scope: target.scope || 'character',
      folder: target.folder || '',
      id: target.id || '',
      name: target.name || target.id || '已保存脚本规则',
      enabled: false,
      selectable: true,
    };
  }

  function render() {
    for (const [kind, button] of tabButtons) {
      button.classList.toggle('is-active', kind === activeKind);
    }

    const rules = [...selected.values()];
    selectedCount.textContent = rules.length
      ? `已设置 ${rules.length} 条状态规则`
      : '未设置状态覆盖';

    const needle = text(search.value).toLocaleLowerCase();
    const visible = resources.filter(resource => {
      if (resource.kind !== activeKind) return false;
      if (!needle) return true;
      return [
        resource.name,
        resource.worldbook,
        resource.folder,
        resource.id,
        ...(resource.keys || []),
      ].some(value => text(value).toLocaleLowerCase().includes(needle));
    });

    const visibleKeys = new Set(visible.map(resource => resourceOverrideKey(resourceRule(resource))));
    const missingRules = rules
      .filter(rule => rule.kind === activeKind && !visibleKeys.has(resourceOverrideKey(rule)))
      .filter(rule => {
        if (!needle) return true;
        const target = rule.target || {};
        return [target.name, target.worldbook, target.folder, target.id]
          .some(value => text(value).toLocaleLowerCase().includes(needle));
      });

    const nodes = [];

    if (activeKind === 'worldbook') {
      const byBook = new Map();
      for (const resource of visible) {
        if (!byBook.has(resource.worldbook)) byBook.set(resource.worldbook, []);
        byBook.get(resource.worldbook).push(resource);
      }
      for (const [bookName, values] of byBook) {
        const group = doc.createElement('section');
        group.className = 'rw-resource-state-group';
        const head = doc.createElement('div');
        head.className = 'rw-resource-state-group-head';
        head.append(
          Object.assign(doc.createElement('strong'), { textContent: bookName }),
          Object.assign(doc.createElement('span'), {
            textContent: `${values.length} 条 · ${values.filter(item => item.enabled).length} 启用 / ${values.filter(item => !item.enabled).length} 停用`,
          }),
        );
        group.appendChild(head);
        values.forEach(resource => group.appendChild(resourceRow(resource)));
        nodes.push(group);
      }
    } else {
      visible.forEach(resource => nodes.push(resourceRow(resource)));
    }

    if (missingRules.length) {
      const group = doc.createElement('section');
      group.className = 'rw-resource-state-group is-saved-only';
      const head = doc.createElement('div');
      head.className = 'rw-resource-state-group-head';
      head.append(
        Object.assign(doc.createElement('strong'), { textContent: '已保存规则 · 当前未扫描到' }),
        Object.assign(doc.createElement('span'), { textContent: '可以改为“保持”来取消这条规则' }),
      );
      for (const rule of missingRules) {
        group.appendChild(resourceRow(resourceFromSavedRule(rule), { missing: true }));
      }
      nodes.push(group);
    }

    if (!nodes.length) {
      const empty = doc.createElement('div');
      empty.className = 'rw-content-empty';
      empty.textContent = loading
        ? '正在扫描当前酒馆资源…'
        : needle
          ? '没有找到匹配的资源。'
          : activeKind === 'worldbook'
            ? '当前没有扫描到角色 / 聊天 / 全局正在使用的世界书。'
            : activeKind === 'regex'
              ? '当前角色没有可控制的原正则。'
              : '当前没有可控制的原酒馆助手脚本。';
      nodes.push(empty);
    }

    body.replaceChildren(...nodes);
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    refreshButton.disabled = true;
    status.textContent = '正在读取当前酒馆的世界书、正则与酒馆助手脚本…';
    render();
    try {
      const result = await scan();
      resources = flattenResources(result);
      status.textContent = [
        result.characterName ? `当前角色：${result.characterName}` : '',
        `世界书 ${resources.filter(item => item.kind === 'worldbook').length} 条`,
        `正则 ${resources.filter(item => item.kind === 'regex').length} 条`,
        `脚本 ${resources.filter(item => item.kind === 'script').length} 项`,
      ].filter(Boolean).join(' · ');
    } catch (error) {
      status.textContent = `扫描失败：${error instanceof Error ? error.message : String(error)}`;
      try { notifyError?.(error); } catch {}
    } finally {
      loading = false;
      refreshButton.disabled = false;
      render();
    }
  }

  function setRules(nextRules) {
    selected = new Map(
      normalizeResourceOverrides(nextRules)
        .map(rule => [resourceOverrideKey(rule), rule]),
    );
    render();
  }

  for (const [kind, button] of tabButtons) {
    button.addEventListener('click', () => {
      activeKind = kind;
      render();
    });
  }
  search.addEventListener('input', render);
  refreshButton.addEventListener('click', () => void refresh());

  render();

  return {
    node: root,
    refresh,
    setRules,
    values() {
      return normalizeResourceOverrides([...selected.values()]);
    },
    clear() {
      selected.clear();
      resources = [];
      search.value = '';
      activeKind = 'worldbook';
      status.textContent = '打开发布或更新界面后会读取当前酒馆资源。';
      render();
    },
  };
}
