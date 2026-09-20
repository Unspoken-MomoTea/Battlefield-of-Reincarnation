import { ARTIFACT_LABELS } from './constants.js';

function clone(value) {
  return structuredClone(value);
}

function worldbookConflictKey(conflict) {
  const target = conflict?.target || {};
  return `${String(target.worldbook || '')}\u0000${target.uid ? `uid:${target.uid}` : `name:${String(target.name || '')}`}`;
}

function scriptConflictKey(conflict) {
  const target = conflict?.target || {};
  return `${String(target.scope || '')}\u0000${target.id ? `id:${target.id}` : `name:${String(target.name || '')}`}\u0000${String(target.folder || '')}`;
}

function assignConflicts(artifacts, kind, conflicts) {
  let assigned = false;
  return artifacts.map(artifact => {
    if (artifact.kind !== kind) return artifact;
    const next = { ...artifact };
    delete next.original_conflicts;
    if (!assigned && conflicts.length) {
      next.original_conflicts = clone(conflicts);
      assigned = true;
    }
    return next;
  });
}

function makeCheckbox(doc, checked = false) {
  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  return input;
}

function resourceOption(doc, { title, meta, checked, onChange }) {
  const label = doc.createElement('label');
  label.className = 'rw-resource-option';
  const checkbox = makeCheckbox(doc, checked);
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  const copy = doc.createElement('span');
  const strong = doc.createElement('strong');
  strong.textContent = title;
  const small = doc.createElement('small');
  small.textContent = meta;
  copy.append(strong, small);
  label.append(checkbox, copy);
  return label;
}

export function createInstallRulePicker({ doc, artifacts, resources }) {
  const wrapper = doc.createElement('div');
  wrapper.className = 'rw-install-rules';

  const recognized = doc.createElement('section');
  recognized.className = 'rw-rule-section';
  recognized.innerHTML = '<div class="rw-rule-section-title"><span>01</span><div><strong>文件检查完成</strong><small>系统已经识别上传内容；识别错误可返回上一步修正。</small></div></div>';
  const recognizedList = doc.createElement('div');
  recognizedList.className = 'rw-rule-artifacts';
  artifacts.forEach(artifact => {
    const row = doc.createElement('div');
    row.className = 'rw-rule-artifact';
    const name = doc.createElement('strong');
    name.textContent = artifact.name;
    const type = doc.createElement('span');
    const scope = artifact.kind === 'script'
      ? ` · ${({ character: '当前角色', preset: '当前预设', global: '全局' })[artifact.scope || 'character']}`
      : '';
    type.textContent = `${ARTIFACT_LABELS[artifact.kind] || artifact.kind}${scope}`;
    row.append(name, type);
    recognizedList.appendChild(row);
  });
  recognized.appendChild(recognizedList);
  wrapper.appendChild(recognized);

  const existingWorldbook = artifacts
    .filter(item => item.kind === 'worldbook')
    .flatMap(item => item.original_conflicts || []);
  const existingScripts = artifacts
    .filter(item => item.kind === 'script')
    .flatMap(item => item.original_conflicts || []);
  const selectedWorldbooks = new Map(existingWorldbook.map(item => [worldbookConflictKey(item), clone(item)]));
  const selectedScripts = new Map(existingScripts.map(item => [scriptConflictKey(item), clone(item)]));

  if (artifacts.some(item => item.kind === 'worldbook')) {
    const section = doc.createElement('section');
    section.className = 'rw-rule-section';
    section.innerHTML = '<div class="rw-rule-section-title"><span>02</span><div><strong>原版世界书处理</strong><small>只有这个作品确实要覆盖的条目才需要勾选。安装时临时关闭，停用作品时恢复。</small></div></div>';

    const books = doc.createElement('div');
    books.className = 'rw-resource-groups';
    if (!resources?.worldbooks?.length) {
      const empty = doc.createElement('div');
      empty.className = 'rw-status';
      empty.textContent = '当前酒馆没有扫描到可选择的原版世界书。无需替换时可以直接继续。';
      books.appendChild(empty);
    } else {
      for (const book of resources.worldbooks) {
        const details = doc.createElement('details');
        details.className = 'rw-resource-group';
        details.open = Boolean(book.bound);
        const summary = doc.createElement('summary');
        summary.textContent = `${book.bound ? '当前角色 · ' : ''}${book.name} · ${book.entries.length} 条`;
        details.appendChild(summary);

        const options = doc.createElement('div');
        options.className = 'rw-resource-options';
        for (const entry of book.entries) {
          const conflict = {
            action: 'replace',
            target: {
              worldbook: book.name,
              ...(entry.uid ? { uid: entry.uid } : {}),
              ...(entry.name ? { name: entry.name } : {}),
            },
          };
          const key = worldbookConflictKey(conflict);
          options.appendChild(resourceOption(doc, {
            title: entry.name,
            meta: `${entry.uid ? `UID ${entry.uid} · ` : ''}${entry.enabled ? '当前启用' : '当前已关闭'}`,
            checked: selectedWorldbooks.has(key),
            onChange: checked => {
              if (checked) selectedWorldbooks.set(key, conflict);
              else selectedWorldbooks.delete(key);
            },
          }));
        }
        details.appendChild(options);
        books.appendChild(details);
      }
    }
    section.appendChild(books);
    wrapper.appendChild(section);
  }

  if (artifacts.some(item => item.kind === 'script')) {
    const section = doc.createElement('section');
    section.className = 'rw-rule-section';
    section.innerHTML = '<div class="rw-rule-section-title"><span>03</span><div><strong>酒馆助手脚本处理</strong><small>勾选被新脚本替代的旧脚本。系统会记录原脚本，停用作品时安全恢复。</small></div></div>';

    const scripts = doc.createElement('div');
    scripts.className = 'rw-resource-groups';
    if (!resources?.scripts?.length) {
      const empty = doc.createElement('div');
      empty.className = 'rw-status';
      empty.textContent = '当前没有扫描到可替换的原酒馆助手脚本。无需替换时可以直接继续。';
      scripts.appendChild(empty);
    } else {
      const scopeLabels = { character: '当前角色', preset: '当前预设', global: '全局' };
      for (const scope of ['character', 'preset', 'global']) {
        const values = resources.scripts.filter(item => item.scope === scope);
        if (!values.length) continue;
        const details = doc.createElement('details');
        details.className = 'rw-resource-group';
        details.open = scope === 'character';
        const summary = doc.createElement('summary');
        summary.textContent = `${scopeLabels[scope]} · ${values.length} 个脚本`;
        details.appendChild(summary);
        const options = doc.createElement('div');
        options.className = 'rw-resource-options';
        for (const script of values) {
          const conflict = {
            action: 'replace',
            target: {
              scope: script.scope,
              ...(script.id ? { id: script.id } : {}),
              ...(script.name ? { name: script.name } : {}),
              ...(script.folder ? { folder: script.folder } : {}),
            },
          };
          const key = scriptConflictKey(conflict);
          options.appendChild(resourceOption(doc, {
            title: script.folder ? `${script.folder} / ${script.name}` : script.name,
            meta: `${scopeLabels[scope]} · ${script.enabled ? '当前启用' : '当前已关闭'}`,
            checked: selectedScripts.has(key),
            onChange: checked => {
              if (checked) selectedScripts.set(key, conflict);
              else selectedScripts.delete(key);
            },
          }));
        }
        details.appendChild(options);
        scripts.appendChild(details);
      }
    }
    section.appendChild(scripts);
    wrapper.appendChild(section);
  }

  return {
    node: wrapper,
    buildArtifacts() {
      let next = clone(artifacts);
      next = assignConflicts(next, 'worldbook', [...selectedWorldbooks.values()]);
      next = assignConflicts(next, 'script', [...selectedScripts.values()]);
      return next;
    },
  };
}
