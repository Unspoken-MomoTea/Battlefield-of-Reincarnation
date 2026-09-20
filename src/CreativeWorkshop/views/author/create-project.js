import { parseDependencyText } from '../../services/projects/dependency-input.js';
import { scanPublishResources } from '../../services/publish-resources.js';
import { createSmartArtifactQueue } from '../../ui/smart-artifact-queue.js';
import { ARTIFACT_LABELS } from '../../ui/constants.js';

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

function artifactSummary(artifacts) {
  const counts = new Map();
  for (const artifact of artifacts) {
    const label = ARTIFACT_LABELS[artifact.kind] || artifact.kind;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => count > 1 ? `${label} × ${count}` : label)
    .join('、');
}

function makeCheckbox(doc, checked = false) {
  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  return input;
}

export function bindCreateProjectFlow({
  host,
  doc,
  overlay,
  nodes,
  workshopApi,
  notifyError,
  openModal,
  refreshMine,
}) {
  const openButton = overlay.querySelector('[data-action="create-project-open"]');
  const cancelButtons = [...overlay.querySelectorAll('[data-action="create-project-cancel"]')];
  const projectType = nodes.createForm.querySelector('[name="category"]');

  let dirty = false;
  let rulesModal = null;
  let coverUrl = '';
  let queue = null;

  const revokeCoverPreview = () => {
    if (!coverUrl) return;
    try { host.URL.revokeObjectURL(coverUrl); } catch {}
    coverUrl = '';
  };

  const renderCover = () => {
    revokeCoverPreview();
    const selected = nodes.createCover.files?.[0] || null;
    if (!selected) {
      nodes.createCoverState.textContent = '可选。建议 16:9，选择后会立即预览。';
      nodes.createCoverPreview.hidden = true;
      nodes.createCoverPreview.removeAttribute('src');
      return;
    }
    coverUrl = host.URL.createObjectURL(selected);
    nodes.createCoverPreview.src = coverUrl;
    nodes.createCoverPreview.hidden = false;
    nodes.createCoverState.textContent = `已选择：${selected.name} · 尚未上传`;
    dirty = true;
  };

  const reset = () => {
    nodes.createForm.reset();
    queue?.clear();
    nodes.createVersion.value = '';
    nodes.createCover.value = '';
    nodes.createVersionState.textContent = '拖入文件即可，系统会自动识别世界书、正则、脚本和预设。';
    revokeCoverPreview();
    nodes.createCoverPreview.hidden = true;
    nodes.createCoverPreview.removeAttribute('src');
    nodes.createCoverState.textContent = '可选。建议 16:9，选择后会立即预览。';
    dirty = false;
  };

  queue = createSmartArtifactQueue({
    doc,
    input: nodes.createVersion,
    list: nodes.createArtifactList,
    getProject: () => ({ category: projectType.value || 'extension' }),
    onChange: current => {
      nodes.createVersionState.textContent = current.count
        ? `已识别 ${current.count} 项：${current.summary()}`
        : '拖入文件即可，系统会自动识别世界书、正则、脚本和预设。';
      if (current.count) dirty = true;
    },
  });

  async function addFiles(files) {
    try {
      await queue.addFiles(files);
    } catch (error) {
      nodes.createVersion.value = '';
      notifyError(error);
    }
  }

  nodes.createVersion.addEventListener('change', () => {
    if (nodes.createVersion.files?.length) void addFiles(nodes.createVersion.files);
  });

  const versionDrop = overlay.querySelector('[data-drop-target="create-version"]');
  versionDrop.addEventListener('dragover', event => {
    event.preventDefault();
    versionDrop.classList.add('is-dragover');
  });
  versionDrop.addEventListener('dragleave', () => versionDrop.classList.remove('is-dragover'));
  versionDrop.addEventListener('drop', event => {
    event.preventDefault();
    versionDrop.classList.remove('is-dragover');
    void addFiles(event.dataTransfer?.files);
  });

  nodes.createCover.addEventListener('change', renderCover);
  const coverDrop = overlay.querySelector('[data-drop-target="create-cover"]');
  coverDrop.addEventListener('dragover', event => {
    event.preventDefault();
    coverDrop.classList.add('is-dragover');
  });
  coverDrop.addEventListener('dragleave', () => coverDrop.classList.remove('is-dragover'));
  coverDrop.addEventListener('drop', event => {
    event.preventDefault();
    coverDrop.classList.remove('is-dragover');
    const selected = event.dataTransfer?.files?.[0];
    if (!selected) return;
    try {
      const Transfer = host.DataTransfer || DataTransfer;
      const transfer = new Transfer();
      transfer.items.add(selected);
      nodes.createCover.files = transfer.files;
      renderCover();
    } catch {
      nodes.createCover.click();
    }
  });

  nodes.createForm.addEventListener('input', () => { dirty = true; });
  nodes.createForm.addEventListener('change', () => { dirty = true; });

  openButton?.addEventListener('click', () => {
    nodes.createForm.hidden = false;
    nodes.createForm.querySelector('[name="name"]')?.focus();
  });

  const closeCreate = () => {
    if (dirty) {
      const confirmed = typeof host.confirm === 'function'
        ? host.confirm('有尚未提交的作品资料或文件，确定放弃吗？')
        : true;
      if (!confirmed) return;
    }
    rulesModal?.close({ force: true });
    rulesModal = null;
    reset();
    nodes.createForm.hidden = true;
  };
  cancelButtons.forEach(button => button.addEventListener('click', closeCreate));

  function resourceOption({ title, meta, checked, onChange }) {
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

  function installRulesSection(artifacts, resources) {
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
            options.appendChild(resourceOption({
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
            options.appendChild(resourceOption({
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

  async function openRules(draft) {
    rulesModal?.close({ force: true });
    rulesModal = openModal('发布项目 · 检查与安装规则', {
      wide: true,
      onClose: () => { rulesModal = null; },
    });

    const loading = doc.createElement('div');
    loading.className = 'rw-empty';
    loading.textContent = '正在检查上传文件与当前酒馆资源…';
    rulesModal.body.appendChild(loading);

    let resources = null;
    const needsScan = draft.artifacts.some(item => item.kind === 'worldbook' || item.kind === 'script');
    if (needsScan) {
      try {
        resources = await scanPublishResources();
      } catch (error) {
        resources = { worldbooks: [], scripts: [] };
        try {
          host.toastr?.warning?.(
            `无法扫描当前酒馆原版资源：${error.message}。仍可发布，但本次不能通过界面选择替换目标。`,
            '创意工坊',
          );
        } catch {}
      }
    }

    rulesModal.body.replaceChildren();
    const rules = installRulesSection(draft.artifacts, resources);
    rulesModal.body.appendChild(rules.node);

    const note = doc.createElement('div');
    note.className = 'rw-maintenance-protection';
    note.append(
      Object.assign(doc.createElement('strong'), { textContent: '原版内容不会被删除' }),
      Object.assign(doc.createElement('div'), {
        textContent: '勾选的世界书条目或脚本只会在作品启用期间临时关闭。停用/卸载时按安装前快照恢复；玩家期间的修改不会被强制覆盖。',
      }),
    );
    rulesModal.body.appendChild(note);

    const actions = doc.createElement('div');
    actions.className = 'rw-row rw-publish-final-actions';
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'rw-button';
    back.textContent = '← 返回修改';
    const confirm = doc.createElement('button');
    confirm.type = 'button';
    confirm.className = 'rw-button good';
    confirm.textContent = '提交审核';
    actions.append(back, confirm);
    rulesModal.body.appendChild(actions);

    back.addEventListener('click', () => rulesModal?.close({ force: true }));
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      back.disabled = true;
      let createdProjectId = null;
      try {
        const finalArtifacts = rules.buildArtifacts();
        const bundle = queue.bundle(finalArtifacts);

        confirm.textContent = '正在创建作品…';
        const created = await workshopApi.createProject({
          name: draft.name,
          summary: draft.summary,
          category: draft.category,
          tags: draft.tags,
          dependencies: draft.dependencies,
        });
        createdProjectId = created.project.id;

        confirm.textContent = '正在上传内容…';
        await workshopApi.uploadProjectVersion(createdProjectId, { changelog: '', bundle });

        if (draft.cover) {
          confirm.textContent = '正在上传封面…';
          await workshopApi.uploadProjectCover(createdProjectId, draft.cover);
        }

        confirm.textContent = '正在提交审核…';
        await workshopApi.submitProject(createdProjectId);

        dirty = false;
        rulesModal?.close({ force: true });
        rulesModal = null;
        reset();
        nodes.createForm.hidden = true;
        try { host.toastr?.success?.('作品已提交审核', '创意工坊'); } catch {}
        await refreshMine();
      } catch (error) {
        notifyError(error);
        if (createdProjectId) {
          try {
            host.toastr?.warning?.(
              '提交过程中断，服务器可能保留了一个未发布草稿，可在“我的项目”中继续处理。',
              '创意工坊',
            );
          } catch {}
        }
      } finally {
        if (confirm.isConnected) {
          confirm.disabled = false;
          back.disabled = false;
          confirm.textContent = '提交审核';
        }
      }
    });
  }

  nodes.createForm.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(nodes.createForm);
    const name = String(form.get('name') || '').trim();
    const summary = String(form.get('summary') || '');
    const category = String(form.get('category') || 'extension');
    const tags = String(form.get('tags') || '')
      .split(/[,，\n]/u)
      .map(value => value.trim())
      .filter(Boolean);

    if (!name) return notifyError(new Error('请先填写作品名称'));
    if (!queue.count) return notifyError(new Error('请至少拖入一个作品内容文件'));

    let dependencies;
    try {
      dependencies = parseDependencyText(form.get('dependencies'));
    } catch (error) {
      notifyError(error);
      return;
    }

    void openRules({
      name,
      summary,
      category,
      tags,
      dependencies,
      cover: nodes.createCover.files?.[0] || null,
      artifacts: queue.artifacts(),
    });
  });

  return {
    reset,
    destroy() {
      revokeCoverPreview();
      rulesModal?.close({ force: true });
    },
  };
}
