import { formatDependencyText, parseDependencyText } from '../services/projects/dependency-input.js';

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
  statusLabels,
  getAuth,
  notifyError,
}) {
  function ownProjectCard(project) {
    const card = element('article', 'rw-card');
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

    const addField = (label, control) => {
      const field = element('label', 'rw-field');
      field.append(element('span', '', label), control);
      editor.appendChild(field);
    };
    addField('作品名称', editName);
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
        summary: editSummary.value,
        tags,
        dependencies,
      });
      try { host.toastr?.success?.('作品资料已保存', '创意工坊'); } catch {}
      await refreshMine();
    }));
    editorActions.appendChild(button('取消', '', () => { editor.hidden = true; }));
    editor.appendChild(editorActions);

    const uploadBox = element('div', 'rw-upload-box');
    const changelog = element('input', 'rw-input');
    changelog.placeholder = '版本更新说明（上传新版本前可填写）';
    changelog.maxLength = 2000;
    const kind = element('select', 'rw-select');
    for (const value of ['worldbook', 'regex', 'preset', 'data']) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = categoryLabels[value];
      if (value === project.category) option.selected = true;
      kind.appendChild(option);
    }
    kind.hidden = project.category !== 'mixed';
    uploadBox.append(changelog, kind);

    const coverFile = element('input', '');
    coverFile.type = 'file';
    coverFile.accept = 'image/png,image/jpeg,image/webp';
    coverFile.hidden = true;
    const versionFile = element('input', '');
    versionFile.type = 'file';
    versionFile.accept = '.json,.txt,application/json,text/plain';
    versionFile.hidden = true;
    const coverState = element('div', 'rw-file-state', '封面：点击“选择并上传封面”选择 PNG / JPEG / WebP');
    const versionState = element('div', 'rw-file-state', '版本：点击“选择文件并上传版本”选择 .json / .txt');
    uploadBox.append(coverFile, coverState, versionFile, versionState);

    let coverButton;
    coverButton = button('选择并上传封面', '', () => {
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
    versionButton = button('选择文件并上传版本', 'primary', () => {
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
        const bundle = buildUploadBundle(project, selected.name, raw, kind.value);
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

    const actions = element('div', 'rw-row');
    actions.appendChild(button('编辑资料', '', () => { editor.hidden = !editor.hidden; }));
    actions.appendChild(coverButton);
    actions.appendChild(versionButton);
    actions.appendChild(button('提交审核', 'good', async () => {
      await workshopApi.submitProject(project.id);
      await refreshMine();
    }));

    const deleteZone = element('div', 'rw-danger-zone');
    deleteZone.hidden = true;
    if (Number(project.published_version) === 0 && project.status !== 'pending') {
      const deleteText = element('div', 'rw-status bad', '确定删除这个未发布作品？版本文件与封面也会一并删除，此操作不可恢复。');
      const deleteActions = element('div', 'rw-row');
      deleteActions.appendChild(button('确认删除', 'danger', async () => {
        await workshopApi.deleteProject(project.id);
        try { host.toastr?.success?.('作品已删除', '创意工坊'); } catch {}
        await refreshMine();
      }));
      deleteActions.appendChild(button('取消', '', () => { deleteZone.hidden = true; }));
      deleteZone.append(deleteText, deleteActions);
      actions.appendChild(button('删除作品', 'danger', () => { deleteZone.hidden = false; }));
    } else if (Number(project.published_version) > 0) {
      uploadBox.appendChild(element('div', 'rw-muted', '已发布作品不会在作者页直接永久删除；需要下架时请使用管理页。'));
    }

    card.append(uploadBox, actions, editor, deleteZone);
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
