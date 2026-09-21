import { formatDependencyText, parseDependencyText } from '../services/projects/dependency-input.js';
import { scanPublishResources } from '../services/publish-resources.js';
import { createInstallRulePicker } from '../ui/install-rule-picker.js';
import { createSmartArtifactQueue } from '../ui/smart-artifact-queue.js';

export function createAuthorView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  doc,
  host,
  categoryLabels,
  artifactLabels,
  statusLabels,
  getAuth,
  notifyError,
  confirmDialog,
  openModal,
}) {
  function deleteErrorMessage(error, project) {
    if (
      project.status === 'archived' &&
      (error?.code === 'published_project_delete_forbidden' || error?.status === 404 || error?.status === 405)
    ) {
      return '服务器仍是旧版，尚未启用“下架后删除”能力。请先重新部署 staging Worker（服务端需要 0.9.0+），再重试。';
    }
    return error instanceof Error ? error.message : String(error);
  }

  function showDeleteFailure(project, error) {
    const modal = openModal('删除失败', { wide: false });
    const box = element('div', 'rw-delete-error');
    box.append(
      element('strong', '', `“${project.name}”没有被删除`),
      element('div', '', deleteErrorMessage(error, project)),
    );
    const actions = element('div', 'rw-row');
    actions.appendChild(button('知道了', 'primary', () => modal.close({ force: true })));
    modal.body.append(box, actions);
  }

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
    if (project.status === 'archived') {
      const archivedAt = Number(project.archived_at || 0)
        ? new Date(Number(project.archived_at) * 1000).toLocaleString()
        : '';
      const archiveText = [
        '管理员已下架此作品',
        project.archive_note ? `原因：${project.archive_note}` : '未填写下架原因',
        archivedAt ? `时间：${archivedAt}` : '',
        '下架后不会出现在公开工坊；如需重新公开，请由管理员恢复。',
      ].filter(Boolean).join('\n');
      card.appendChild(element('div', 'rw-status bad rw-author-archive-status', archiveText));
    }

    let editorModal = null;
    let uploadModal = null;

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
    const autoDetectHint = element(
      'div',
      'rw-maintenance-protection',
    );
    autoDetectHint.append(
      element('strong', '', '直接上传文件即可'),
      element('div', '', '世界书、正则、酒馆助手脚本和预设会自动识别；识别不确定时，可在文件列表中单独修正类型。原版替换目标会在上传前通过勾选选择。'),
    );
    uploadBox.append(changelog, autoDetectHint);

    const coverFile = element('input', '');
    coverFile.type = 'file';
    coverFile.accept = 'image/png,image/jpeg,image/webp';
    coverFile.hidden = true;
    const versionFile = element('input', '');
    versionFile.type = 'file';
    versionFile.multiple = true;
    versionFile.accept = '.json,.txt,.js,.mjs,application/json,text/plain,text/javascript,application/javascript';
    versionFile.hidden = true;
    const coverState = element('div', 'rw-file-state', '封面：选择后先预览，再确认上传');
    const coverPreview = element('img', 'rw-author-cover-preview');
    coverPreview.hidden = true;
    const versionState = element('div', 'rw-file-state', '直接添加文件，系统会自动识别；完整 bundle JSON 也可直接加入');
    const artifactList = element('div', 'rw-artifact-list');
    artifactList.hidden = true;
    uploadBox.append(coverFile, coverPreview, coverState, versionFile, versionState, artifactList);

    let coverPreviewUrl = '';
    const clearCoverPreview = () => {
      if (coverPreviewUrl) {
        try { host.URL.revokeObjectURL(coverPreviewUrl); } catch {}
        coverPreviewUrl = '';
      }
      coverPreview.hidden = true;
      coverPreview.removeAttribute('src');
    };

    let coverButton;
    let uploadCoverButton;
    coverButton = button('选择或拖入封面 · PNG / JPEG / WebP', '', () => {
      coverFile.value = '';
      coverFile.click();
    });
    uploadCoverButton = button('上传封面', 'good', async () => {
      const selected = coverFile.files?.[0];
      if (!selected) throw new Error('请先选择封面');
      uploadCoverButton.disabled = true;
      coverButton.disabled = true;
      coverState.textContent = `正在上传：${selected.name}`;
      try {
        await workshopApi.uploadProjectCover(project.id, selected);
        try { host.toastr?.success?.('封面上传成功', '创意工坊'); } catch {}
        coverFile.value = '';
        clearCoverPreview();
        coverState.textContent = '封面已上传';
        await refreshMine();
      } catch (error) {
        coverState.textContent = `封面上传失败：${selected.name}`;
        notifyError(error);
      } finally {
        if (uploadCoverButton.isConnected) uploadCoverButton.disabled = !coverFile.files?.length;
        if (coverButton.isConnected) coverButton.disabled = false;
      }
    });
    uploadCoverButton.disabled = true;

    coverFile.addEventListener('change', () => {
      clearCoverPreview();
      const selected = coverFile.files?.[0];
      if (!selected) {
        coverState.textContent = '封面：选择后先预览，再确认上传';
        uploadCoverButton.disabled = true;
        return;
      }
      coverPreviewUrl = host.URL.createObjectURL(selected);
      coverPreview.src = coverPreviewUrl;
      coverPreview.hidden = false;
      coverState.textContent = `已选择：${selected.name} · 尚未上传`;
      uploadCoverButton.disabled = false;
    });

    let versionButton;
    let uploadVersionButton;
    versionButton = button('添加内容文件 · 自动识别', 'primary', () => {
      versionFile.value = '';
      versionFile.click();
    });

    const versionQueue = createSmartArtifactQueue({
      doc,
      input: versionFile,
      list: artifactList,
      getProject: () => project,
      onChange: queue => {
        versionState.textContent = queue.count
          ? `已识别 ${queue.count} 项：${queue.summary()}`
          : '直接添加文件，系统会自动识别；完整 bundle JSON 也可直接加入';
        if (uploadVersionButton) uploadVersionButton.disabled = queue.count === 0;
      },
    });

    versionFile.addEventListener('change', async () => {
      if (!versionFile.files?.length) return;
      versionButton.disabled = true;
      try {
        await versionQueue.addFiles(versionFile.files);
      } catch (error) {
        versionFile.value = '';
        notifyError(error);
      } finally {
        versionButton.disabled = false;
      }
    });

    uploadVersionButton = button('检查并上传版本', 'good', async () => {
      if (!versionQueue.count) throw new Error('请先添加至少一个版本内容文件');

      const artifacts = versionQueue.artifacts();
      let resources = { worldbooks: [], scripts: [] };
      if (artifacts.some(item => item.kind === 'worldbook' || item.kind === 'script')) {
        try {
          resources = await scanPublishResources();
        } catch (error) {
          try {
            host.toastr?.warning?.(
              `无法扫描当前酒馆原版资源：${error.message}。仍可上传，但不能通过界面新增替换目标。`,
              '创意工坊',
            );
          } catch {}
        }
      }

      let rulesModal = null;
      rulesModal = openModal('新版本 · 检查与安装规则 · ' + project.name, {
        wide: true,
        onClose: () => { rulesModal = null; },
      });
      const rules = createInstallRulePicker({ doc, artifacts, resources });
      rulesModal.body.appendChild(rules.node);

      const note = element('div', 'rw-maintenance-protection');
      note.append(
        element('strong', '', '原版内容不会被删除'),
        element('div', '', '勾选的世界书条目或脚本只会在作品启用期间临时关闭；停用后按快照恢复。'),
      );
      const actions = element('div', 'rw-row rw-publish-final-actions');
      const cancel = button('返回修改', '', () => rulesModal?.close({ force: true }));
      const confirm = button('上传这个版本', 'good', async () => {
        confirm.disabled = true;
        cancel.disabled = true;
        versionButton.disabled = true;
        try {
          await workshopApi.uploadProjectVersion(project.id, {
            changelog: changelog.value,
            bundle: versionQueue.bundle(rules.buildArtifacts()),
          });
          versionQueue.clear();
          changelog.value = '';
          rulesModal?.close({ force: true });
          try { host.toastr?.success?.('新版本上传成功', '创意工坊'); } catch {}
          await refreshMine();
        } catch (error) {
          notifyError(error);
        } finally {
          if (confirm.isConnected) confirm.disabled = false;
          if (cancel.isConnected) cancel.disabled = false;
          if (versionButton.isConnected) versionButton.disabled = false;
          if (uploadVersionButton.isConnected) uploadVersionButton.disabled = versionQueue.count === 0;
        }
      });
      actions.append(cancel, confirm);
      rulesModal.body.append(note, actions);
    });
    uploadVersionButton.disabled = true;

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

    versionButton.addEventListener('dragover', event => {
      event.preventDefault();
      versionButton.classList.add('is-dragover');
    });
    versionButton.addEventListener('dragleave', () => versionButton.classList.remove('is-dragover'));
    versionButton.addEventListener('drop', async event => {
      event.preventDefault();
      versionButton.classList.remove('is-dragover');
      try {
        await versionQueue.addFiles(event.dataTransfer?.files);
      } catch (error) {
        notifyError(error);
      }
    });

    const uploadActions = element('div', 'rw-row rw-upload-actions');
    uploadActions.append(coverButton, uploadCoverButton, versionButton, uploadVersionButton);
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

    const canPermanentlyDelete = project.status !== 'pending' &&
      (Number(project.published_version) === 0 || project.status === 'archived');

    const deleteProjectAction = async () => {
      const confirmed = await confirmDialog({
        title: `删除“${project.name}”？`,
        message: Number(project.published_version) > 0
          ? '删除后会清理这个作品的全部版本、Manifest、封面、互动记录和服务器文件，且无法恢复。'
          : '删除后会清理这个草稿的版本文件和封面，且无法恢复。',
        confirmText: '删除作品',
        cancelText: '取消',
        danger: true,
      });
      if (!confirmed) return;

      try {
        await workshopApi.deleteProject(project.id);
        try { host.toastr?.success?.('作品已删除', '创意工坊'); } catch {}
        await refreshMine();
      } catch (error) {
        showDeleteFailure(project, error);
      }
    };

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
    if (canPermanentlyDelete) {
      menuDropdown.appendChild(button('删除作品', 'danger', () => {
        menuDropdown.hidden = true;
        void deleteProjectAction();
      }));
    }
    menu.append(menuTrigger, menuDropdown);

    card.append(menu, actions, uploadBox, editor);
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
