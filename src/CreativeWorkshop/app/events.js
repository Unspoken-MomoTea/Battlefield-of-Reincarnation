import { parseDependencyText } from '../services/projects/dependency-input.js';
import { parseOriginalConflictText } from '../services/projects/original-conflict-input.js';
import { parseOriginalScriptConflictText } from '../services/projects/script-conflict-input.js';
import { createArtifactQueue as createArtifactQueueFactory } from '../ui/artifact-queue.js';

export function bindWorkshopEvents({
  host, doc, overlay, nodes, views, workshopApi, projectService,
  notifyError, openModal, showTab, getActiveTab, setAuth, close,
}) {
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelectorAll('.rw-tab[data-tab]').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

  overlay.querySelector('[data-action="maintenance"]').addEventListener('click', () => void views.maintenance.open());

  overlay.querySelector('[data-action="search"]').addEventListener('click', () => void views.discover.refresh());
  nodes.search.addEventListener('keydown', event => { if (event.key === 'Enter') void views.discover.refresh(); });
  nodes.tag.addEventListener('keydown', event => { if (event.key === 'Enter') void views.discover.refresh(); });
  nodes.sort.addEventListener('change', () => void views.discover.refresh());
  nodes.discoverCategories.forEach(categoryButton => {
    categoryButton.addEventListener('click', () => {
      nodes.category.value = categoryButton.dataset.categoryFilter || '';
      nodes.discoverCategories.forEach(buttonNode => {
        buttonNode.classList.toggle('is-active', buttonNode === categoryButton);
      });
      void views.discover.refresh();
    });
  });
  nodes.discoverMore.addEventListener('click', () => void views.discover.loadMore());

  nodes.checkAllUpdates.addEventListener('click', () => void views.installed.checkAllUpdates(true));
  nodes.storageManager.addEventListener('click', () => void views.installed.manageStorage());

  nodes.offlineInput.addEventListener('change', async () => {
    const selected = nodes.offlineInput.files?.[0];
    nodes.offlineInput.value = '';
    if (!selected) return;
    try {
      const imported = await projectService.importOffline(selected);
      try { host.toastr?.success?.(`已导入 ${imported.name} v${imported.version}`, '创意工坊'); } catch {}
      await views.installed.refresh();
    } catch (error) { notifyError(error); }
  });

  nodes.login.addEventListener('click', async () => {
    nodes.login.disabled = true;
    nodes.login.textContent = '等待授权...';
    try {
      setAuth(await workshopApi.login());
      showTab(getActiveTab());
    } catch (error) { notifyError(error); }
    finally {
      nodes.login.disabled = false;
      nodes.login.textContent = 'Discord 登录';
    }
  });

  nodes.logout.addEventListener('click', async () => {
    nodes.logout.disabled = true;
    try {
      await workshopApi.logout();
      setAuth(null);
    } catch (error) { notifyError(error); }
    finally { nodes.logout.disabled = false; }
  });

  const createOpen = overlay.querySelector('[data-action="create-project-open"]');
  const createCancel = overlay.querySelector('[data-action="create-project-cancel"]');
  const createArtifactSelect = nodes.createArtifactKind.querySelector('[name="artifact_kind"]');
  let createDirty = false;
  let publishConfirmModal = null;
  let createArtifactQueue = null;

  const resetCreateFiles = () => {
    createArtifactQueue?.clear();
    nodes.createVersion.value = '';
    nodes.createCover.value = '';
    nodes.createVersionState.textContent = '先选择内容类型，再分批添加文件；一个版本最多 32 个 artifact。';
    nodes.createCoverState.textContent = '未选择封面。';
  };

  const syncCreateArtifactOptions = () => {
    nodes.createScriptScope.hidden = createArtifactSelect.value !== 'script';
    nodes.createOriginalConflicts.hidden = createArtifactSelect.value !== 'worldbook';
    nodes.createScriptConflicts.hidden = createArtifactSelect.value !== 'script';
  };

  const resetCreateDraft = () => {
    nodes.createForm.reset();
    resetCreateFiles();
    createDirty = false;
    syncCreateArtifactOptions();
  };

  createArtifactSelect.addEventListener('change', syncCreateArtifactOptions);
  syncCreateArtifactOptions();

  const createOriginalConflictInput = nodes.createOriginalConflicts.querySelector('[name="original_conflicts"]');
  const createScriptConflictInput = nodes.createScriptConflicts.querySelector('[name="script_conflicts"]');
  const createScriptScopeInput = nodes.createScriptScope.querySelector('[name="script_scope"]');
  const createProjectTypeInput = nodes.createForm.querySelector('[name="category"]');

  createArtifactQueue = createArtifactQueueFactory({
    doc,
    input: nodes.createVersion,
    list: nodes.createArtifactList,
    getProject: () => ({ category: createProjectTypeInput.value || 'extension' }),
    getKind: () => createArtifactSelect.value || 'data',
    getOptions: () => ({
      scriptScope: createScriptScopeInput.value || 'character',
      originalConflicts: createArtifactSelect.value === 'worldbook'
        ? parseOriginalConflictText(createOriginalConflictInput.value)
        : createArtifactSelect.value === 'script'
          ? parseOriginalScriptConflictText(createScriptConflictInput.value)
          : [],
    }),
    onChange: queue => {
      nodes.createVersionState.textContent = queue.count
        ? `已加入 ${queue.count} 个 artifact：${queue.summary()}`
        : '先选择内容类型，再分批添加文件；一个版本最多 32 个 artifact。';
      createDirty = true;
    },
  });

  nodes.createVersion.addEventListener('change', async () => {
    const files = nodes.createVersion.files;
    if (!files?.length) return;
    try {
      await createArtifactQueue.addFiles(files);
    } catch (error) {
      nodes.createVersion.value = '';
      notifyError(error);
    }
  });

  const createVersionDrop = overlay.querySelector('[data-drop-target="create-version"]');
  createVersionDrop.addEventListener('dragover', event => {
    event.preventDefault();
    createVersionDrop.classList.add('is-dragover');
  });
  createVersionDrop.addEventListener('dragleave', () => createVersionDrop.classList.remove('is-dragover'));
  createVersionDrop.addEventListener('drop', async event => {
    event.preventDefault();
    createVersionDrop.classList.remove('is-dragover');
    try {
      await createArtifactQueue.addFiles(event.dataTransfer?.files);
    } catch (error) {
      notifyError(error);
    }
  });

  nodes.createForm.addEventListener('input', () => { createDirty = true; });
  nodes.createForm.addEventListener('change', () => { createDirty = true; });

  const bindCreateFile = (target, input, stateNode, emptyText) => {
    const render = () => {
      const selected = input.files?.[0];
      stateNode.textContent = selected ? `已选择：${selected.name}（尚未上传）` : emptyText;
      if (selected) createDirty = true;
    };
    input.addEventListener('change', render);
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
        const Transfer = host.DataTransfer || DataTransfer;
        const transfer = new Transfer();
        transfer.items.add(selected);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change'));
      } catch {
        input.click();
      }
    });
  };

  bindCreateFile(
    overlay.querySelector('[data-drop-target="create-cover"]'),
    nodes.createCover,
    nodes.createCoverState,
    '未选择封面。',
  );

  createOpen?.addEventListener('click', () => {
    nodes.createForm.hidden = false;
    nodes.createForm.querySelector('[name="name"]')?.focus();
  });

  createCancel?.addEventListener('click', () => {
    if (createDirty) {
      const confirmed = typeof host.confirm === 'function'
        ? host.confirm('有未提交的本地内容，确定放弃吗？')
        : true;
      if (!confirmed) return;
    }
    publishConfirmModal?.close({ force: true });
    publishConfirmModal = null;
    resetCreateDraft();
    nodes.createForm.hidden = true;
  });

  nodes.createForm.addEventListener('submit', async event => {
    event.preventDefault();

    const form = new FormData(nodes.createForm);
    const name = String(form.get('name') || '').trim();
    const summary = String(form.get('summary') || '');
    const category = String(form.get('category') || 'extension');
    const tags = String(form.get('tags') || '').split(/[,，\n]/u).map(value => value.trim()).filter(Boolean);
    let dependencies;
    try {
      dependencies = parseDependencyText(form.get('dependencies'));
    } catch (error) {
      notifyError(error);
      return;
    }
    const selectedCover = nodes.createCover.files?.[0] || null;

    if (!name) {
      notifyError(new Error('请先填写作品名称'));
      return;
    }
    if (!createArtifactQueue.count) {
      notifyError(new Error('请先添加至少一个版本内容文件'));
      return;
    }

    let bundle;
    try {
      bundle = createArtifactQueue.bundle();
    } catch (error) {
      notifyError(error);
      return;
    }

    publishConfirmModal?.close({ force: true });
    publishConfirmModal = openModal('发布前确认', {
      wide: false,
      onClose: () => { publishConfirmModal = null; },
    });

    const review = doc.createElement('div');
    review.className = 'rw-publish-review';
    const title = doc.createElement('h3');
    title.textContent = name;
    const desc = doc.createElement('div');
    desc.className = 'rw-muted';
    desc.textContent = summary || '暂无简介';
    const facts = doc.createElement('div');
    facts.className = 'rw-publish-review-facts';
    const factValues = [
      `类型：${category === 'character' ? '角色' : '扩展'}`,
      `版本内容：${createArtifactQueue.count} 项`,
      `内容清单：${createArtifactQueue.summary()}`,
      selectedCover ? `封面：${selectedCover.name}` : '封面：未选择',
      tags.length ? `标签：${tags.join('、')}` : '标签：无',
      dependencies.length ? `依赖：${dependencies.length} 项` : '依赖：无',
    ];
    for (const value of factValues) {
      const row = doc.createElement('div');
      row.textContent = value;
      facts.appendChild(row);
    }
    const note = doc.createElement('div');
    note.className = 'rw-status';
    note.textContent = '在你点击“确认提交审核”之前，上面的资料和文件都只保留在当前浏览器页面中，不会创建远程作品，也不会上传到 R2。';
    const actions = doc.createElement('div');
    actions.className = 'rw-row';
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'rw-button';
    back.textContent = '返回修改';
    const confirm = doc.createElement('button');
    confirm.type = 'button';
    confirm.className = 'rw-button good';
    confirm.textContent = '确认提交审核';
    actions.append(back, confirm);
    review.append(title, desc, facts, note, actions);
    publishConfirmModal.body.appendChild(review);

    back.addEventListener('click', () => publishConfirmModal?.close({ force: true }));
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      back.disabled = true;
      let createdProjectId = null;
      try {
        confirm.textContent = '正在创建作品...';
        const created = await workshopApi.createProject({
          name,
          summary,
          category,
          tags,
          dependencies,
        });
        const project = created.project;
        createdProjectId = project.id;

        confirm.textContent = '正在上传版本...';
        await workshopApi.uploadProjectVersion(project.id, { changelog: '', bundle });

        if (selectedCover) {
          confirm.textContent = '正在上传封面...';
          await workshopApi.uploadProjectCover(project.id, selectedCover);
        }

        confirm.textContent = '正在提交审核...';
        await workshopApi.submitProject(project.id);

        createDirty = false;
        publishConfirmModal?.close({ force: true });
        publishConfirmModal = null;
        resetCreateDraft();
        nodes.createForm.hidden = true;
        try { host.toastr?.success?.('作品已提交审核', '创意工坊'); } catch {}
        await views.author.refresh();
      } catch (error) {
        notifyError(error);
        if (createdProjectId) {
          try { host.toastr?.warning?.('提交过程中断，服务器可能保留了一个未发布草稿，可在“我的作品”中继续处理或删除。', '创意工坊'); } catch {}
        }
      } finally {
        if (confirm.isConnected) {
          confirm.disabled = false;
          back.disabled = false;
          confirm.textContent = '确认提交审核';
        }
      }
    });
  });

  return () => {};
}
