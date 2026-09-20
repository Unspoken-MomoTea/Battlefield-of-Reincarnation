import { formatDependencyText, parseDependencyText } from '../services/projects/dependency-input.js';
import { parseOriginalConflictText } from '../services/projects/original-conflict-input.js';

export function createAuthorView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  buildUploadBundle,
  doc,
  host,
  categoryLabels,
  artifactLabels,
  statusLabels,
  getAuth,
  notifyError,
  openModal,
}) {
  function ownProjectCard(project) {
    const card = element('article', 'rw-card');
    if (project.has_cover && Number(project.published_version) > 0) {
      const cover = element('img', 'rw-cover');
      cover.src = workshopApi.getProjectCoverUrl(project.id);
      cover.alt = project.name + ' 封面';
      cover.loading = 'lazy';
      card.appendChild(cover);
    } else {
      const placeholder = element('div', 'rw-cover rw-cover-placeholder');
      placeholder.textContent = project.has_cover ? '封面将在版本发布后公开显示' : (categoryLabels[project.category] || '创意工坊');
      card.appendChild(placeholder);
    }
    card.appendChild(element('h3', '', project.name));
    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', categoryLabels[project.category] || project.category));
    meta.append(element('span', 'rw-pill', statusLabels[project.status] || project.status));
    meta.append(element('span', 'rw-pill', `最新 v${project.latest_version}`));
    meta.append(element('span', 'rw-pill', `公开 v${project.published_version}`));
    if (project.has_cover) meta.append(element('span', 'rw-pill', '已有封面'));
    if (project.dependencies?.length) meta.append(element('span', 'rw-pill', `依赖 ${project.dependencies.length}`));
    for (const tag of project.tags || []) meta.append(element('span', 'rw-pill', `#${tag}`));
    card.appendChild(meta);
    card.appendChild(element('div', 'rw-muted', project.summary || '暂无简介'));
    if (project.status === 'rejected' && project.review_note) {
      card.appendChild(element('div', 'rw-status bad', `审核意见：${project.review_note}`));
    }

    let editorModal = null;
    let uploadModal = null;
    let deleteModal = null;

    const mountPanelInModal = (title, panel, { wide = true, onClosed = null } = {}) => {
      const parent = panel.parentNode;
      const marker = doc.createComment('rw-modal-panel');
      if (parent) parent.insertBefore(marker, panel);
      panel.hidden = false;
      let modal;
      modal = openModal(title, {
        wide,
        onClose: () => {
          if (marker.parentNode) marker.replaceWith(panel);
          panel.hidden = true;
          try { onClosed?.(modal); } catch {}
        },
      });
      modal.body.appendChild(panel);
      return modal;
    };

    const editor = element('div', 'rw-editor');
    editor.hidden = true;
    const editName = element('input', 'rw-input');
    editName.value = project.name;
    editName.maxLength = 80;
    const editSummary = element('textarea', 'rw-textarea');
    editSummary.value = project.summary || '';
    editSummary.maxLength = 2000;
    const editTags = element('input', 'rw-input');
    editTags.value = (project.tags || []).join(', ');
    editTags.maxLength = 300;
    const editDependencies = element('input', 'rw-input');
    editDependencies.value = formatDependencyText(project.dependencies);
    editDependencies.maxLength = 1200;
    const editType = element('select', 'rw-select');
    for (const value of ['extension', 'character']) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = categoryLabels[value] || value;
      option.selected = value === project.category;
      editType.appendChild(option);
    }
    editType.disabled = Number(project.published_version) > 0;

    const addField = (label, control) => {
      const field = element('label', 'rw-field');
      field.append(element('span', '', label), control);
      editor.appendChild(field);
    };
    addField('作品名称', editName);
    addField('作品类型', editType);
    addField('作品简介', editSummary);
    addField('标签（逗号分隔）', editTags);
    addField('依赖（项目ID@最低版本，多个用逗号分隔）', editDependencies);

    const editorActions = element('div', 'rw-row');
    editorActions.appendChild(button('保存资料', 'primary', async () => {
      const tags = editTags.value
        .split(/[,，\n]/u)
        .map(value => value.trim())
        .filter(Boolean);
      const dependencies = parseDependencyText(editDependencies.value);
      await workshopApi.updateProject(project.id, {
        name: editName.value,
        category: editType.value,
        summary: editSummary.value,
        tags,
        dependencies,
      });
      try { host.toastr?.success?.('作品资料已保存', '创意工坊'); } catch {}
      editorModal?.close();
      await refreshMine();
    }));
    editorActions.appendChild(button('取消', '', () => editorModal?.close()));
    editor.appendChild(editorActions);

    const uploadBox = element('div', 'rw-upload-box');
    uploadBox.hidden = true;
    uploadBox.appendChild(element('div', 'rw-field-title', '内容与版本'));
    const changelog = element('input', 'rw-input');
    changelog.placeholder = '版本更新说明（上传新版本前可填写）';
    changelog.maxLength = 2000;
    const kind = element('select', 'rw-select');
    for (const value of ['worldbook', 'regex', 'script', 'preset', 'data']) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = artifactLabels[value];
      kind.appendChild(option);
    }
    const scriptScope = element('select', 'rw-select');
    for (const [value, label] of [
      ['character', '脚本作用域：当前角色'],
      ['preset', '脚本作用域：当前预设'],
      ['global', '脚本作用域：全局'],
    ]) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = label;
      scriptScope.appendChild(option);
    }
    scriptScope.hidden = true;
    const originalConflicts = element('textarea', 'rw-textarea');
    originalConflicts.placeholder = '原版条目关闭声明：每行“世界书名 | UID | 条目名”，UID 可留空';
    originalConflicts.hidden = false;
    const originalConflictsHint = element(
      'div',
      'rw-muted',
      '仅对单个世界书文件生效；完整 bundle JSON 请在 artifact.original_conflicts 中声明。',
    );
    const syncArtifactOptions = () => {
      scriptScope.hidden = kind.value !== 'script';
      originalConflicts.hidden = kind.value !== 'worldbook';
      originalConflictsHint.hidden = kind.value !== 'worldbook';
    };
    kind.addEventListener('change', syncArtifactOptions);
    syncArtifactOptions();
    uploadBox.append(changelog, kind, scriptScope, originalConflicts, originalConflictsHint);

    const coverFile = element('input', '');
    coverFile.type = 'file';
    coverFile.accept = 'image/png,image/jpeg,image/webp';
    coverFile.hidden = true;
    const versionFile = element('input', '');
    versionFile.type = 'file';
    versionFile.accept = '.json,.txt,.js,application/json,text/plain,text/javascript,application/javascript';
    versionFile.hidden = true;
    const coverState = element('div', 'rw-file-state', '封面：点击“选择并上传封面”选择 PNG / JPEG / WebP');
    const versionState = element('div', 'rw-file-state', '版本：选择 JSON / TXT / JS；完整 bundle JSON 可同时包含多种内容');
    uploadBox.append(coverFile, coverState, versionFile, versionState);

    let coverButton;
    coverButton = button('选择或拖入封面 · PNG / JPEG / WebP', '', () => {
      coverFile.value = '';
      coverFile.click();
    });
    coverFile.addEventListener('change', async () => {
      const selected = coverFile.files?.[0];
      if (!selected) return;
      coverButton.disabled = true;
      coverState.textContent = `正在上传：${selected.name}`;
      try {
        await workshopApi.uploadProjectCover(project.id, selected);
        try { host.toastr?.success?.('封面上传成功', '创意工坊'); } catch {}
        await refreshMine();
      } catch (error) {
        coverState.textContent = `封面上传失败：${selected.name}`;
        notifyError(error);
      } finally {
        coverButton.disabled = false;
        coverFile.value = '';
      }
    });

    let versionButton;
    versionButton = button('选择或拖入版本文件 · JSON / TXT / JS', 'primary', () => {
      versionFile.value = '';
      versionFile.click();
    });
    versionFile.addEventListener('change', async () => {
      const selected = versionFile.files?.[0];
      if (!selected) return;
      versionButton.disabled = true;
      versionState.textContent = `正在上传：${selected.name}`;
      try {
        const raw = await selected.text();
        const conflictDeclarations = kind.value === 'worldbook'
          ? parseOriginalConflictText(originalConflicts.value)
          : [];
        const bundle = buildUploadBundle(
          project,
          selected.name,
          raw,
          kind.value,
          {
            scriptScope: scriptScope.value,
            originalConflicts: conflictDeclarations,
          },
        );
        await workshopApi.uploadProjectVersion(project.id, {
          changelog: changelog.value,
          bundle,
        });
        try { host.toastr?.success?.('新版本上传成功', '创意工坊'); } catch {}
        await refreshMine();
      } catch (error) {
        versionState.textContent = `版本上传失败：${selected.name}`;
        notifyError(error);
      } finally {
        versionButton.disabled = false;
        versionFile.value = '';
      }
    });

    coverButton.classList.add('rw-file-drop-button');
    versionButton.classList.add('rw-file-drop-button');

    const bindDrop = (target, input) => {
      target.addEventListener('dragover', event => {
        event.preventDefault();
        target.classList.add('is-dragover');
      });
      target.addEventListener('dragleave', () => target.classList.remove('is-dragover'));
      target.addEventListener('drop', event => {
        event.preventDefault();
        target.classList.remove('is-dragover');
        const selected = event.dataTransfer?.files?.[0];
        if (!selected) return;
        try {
          const transfer = new DataTransfer();
          transfer.items.add(selected);
          input.files = transfer.files;
          input.dispatchEvent(new Event('change'));
        } catch {
          target.click();
        }
      });
    };
    bindDrop(coverButton, coverFile);
    bindDrop(versionButton, versionFile);

    const uploadActions = element('div', 'rw-row rw-upload-actions');
    uploadActions.append(coverButton, versionButton);
    uploadBox.appendChild(uploadActions);
    if (Number(project.published_version) > 0) {
      uploadBox.appendChild(element('div', 'rw-muted', '已发布版本保持在线；新版本只有审核通过后才会替换公开内容。'));
    }

    const actions = element('div', 'rw-row');
    actions.appendChild(button('管理内容', 'primary', () => {
      uploadModal?.close();
      uploadModal = mountPanelInModal('版本与封面 · ' + project.name, uploadBox, {
        onClosed: modal => { if (uploadModal === modal) uploadModal = null; },
      });
    }));
    if (Number(project.latest_version) > 0 && ['draft', 'rejected'].includes(project.status)) {
      actions.appendChild(button(project.status === 'rejected' ? '重新提交审核' : '提交审核', 'good', async () => {
        await workshopApi.submitProject(project.id);
        await refreshMine();
      }));
    } else if (project.status === 'pending') {
      actions.appendChild(element('span', 'rw-status', '正在等待审核'));
    }

    const deleteZone = element('div', 'rw-danger-zone');
    deleteZone.hidden = true;
    if (Number(project.published_version) === 0 && project.status !== 'pending') {
      const deleteText = element('div', 'rw-status bad', '删除后会同时清理这个草稿的版本文件与封面，且无法恢复。');
      const deleteActions = element('div', 'rw-row');
      deleteActions.appendChild(button('确认永久删除', 'danger', async () => {
        await workshopApi.deleteProject(project.id);
        try { host.toastr?.success?.('作品已删除', '创意工坊'); } catch {}
        deleteModal?.close();
        await refreshMine();
      }));
      deleteActions.appendChild(button('取消', '', () => deleteModal?.close()));
      deleteZone.append(deleteText, deleteActions);
    }

    const menu = element('div', 'rw-card-menu');
    const menuTrigger = button('⋯', 'rw-card-menu-trigger', () => {
      menuDropdown.hidden = !menuDropdown.hidden;
    });
    menuTrigger.setAttribute('aria-label', '作品管理');
    const menuDropdown = element('div', 'rw-card-menu-dropdown');
    menuDropdown.hidden = true;
    menuDropdown.appendChild(button('修改资料', '', () => {
      menuDropdown.hidden = true;
      editorModal?.close();
      editorModal = mountPanelInModal('修改项目 · ' + project.name, editor, {
        onClosed: modal => { if (editorModal === modal) editorModal = null; },
      });
    }));
    menuDropdown.appendChild(button('版本与封面', '', () => {
      menuDropdown.hidden = true;
      uploadModal?.close();
      uploadModal = mountPanelInModal('版本与封面 · ' + project.name, uploadBox, {
        onClosed: modal => { if (uploadModal === modal) uploadModal = null; },
      });
    }));
    if (Number(project.published_version) === 0 && project.status !== 'pending') {
      menuDropdown.appendChild(button('删除作品', 'danger', () => {
        menuDropdown.hidden = true;
        deleteModal?.close();
        deleteModal = mountPanelInModal('删除作品 · ' + project.name, deleteZone, {
          wide: false,
          onClosed: modal => { if (deleteModal === modal) deleteModal = null; },
        });
      }));
    }
    menu.append(menuTrigger, menuDropdown);

    card.append(menu, actions, uploadBox, editor, deleteZone);
    return card;
  }

  async function refreshMine() {
    if (!getAuth()?.user) return empty(nodes.myList, '请先使用 Discord 登录');
    try {
      const result = await workshopApi.listOwnProjects();
      if (!result.items.length) return empty(nodes.myList, '你还没有创建作品');
      nodes.myList.replaceChildren(...result.items.map(ownProjectCard));
    } catch (error) {
      empty(nodes.myList, `加载失败：${error.message}`);
    }
  }
  return { refresh: refreshMine };
}
