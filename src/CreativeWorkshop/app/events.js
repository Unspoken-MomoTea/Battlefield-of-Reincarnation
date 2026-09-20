import { parseDependencyText } from '../services/projects/dependency-input.js';
import { buildUploadBundle } from '../services/upload.js';

export function bindWorkshopEvents({
  host, doc, overlay, nodes, views, workshopApi, projectService,
  notifyError, showTab, getActiveTab, setAuth, close,
}) {
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelectorAll('.rw-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

  overlay.querySelector('[data-action="search"]').addEventListener('click', () => void views.discover.refresh());
  nodes.search.addEventListener('keydown', event => { if (event.key === 'Enter') void views.discover.refresh(); });
  nodes.tag.addEventListener('keydown', event => { if (event.key === 'Enter') void views.discover.refresh(); });

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
  const createCategory = nodes.createForm.querySelector('[name="category"]');

  const resetCreateFiles = () => {
    nodes.createVersion.value = '';
    nodes.createCover.value = '';
    nodes.createVersionState.textContent = '未选择版本文件；不选择则只创建草稿。';
    nodes.createCoverState.textContent = '未选择封面。';
  };

  const syncCreateCategory = () => {
    nodes.createArtifactKind.hidden = createCategory.value !== 'mixed';
  };
  createCategory.addEventListener('change', syncCreateCategory);
  syncCreateCategory();

  const bindCreateFile = (target, input, stateNode, emptyText) => {
    const render = () => {
      const selected = input.files?.[0];
      stateNode.textContent = selected ? `已选择：${selected.name}` : emptyText;
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
    overlay.querySelector('[data-drop-target="create-version"]'),
    nodes.createVersion,
    nodes.createVersionState,
    '未选择版本文件；不选择则只创建草稿。',
  );
  bindCreateFile(
    overlay.querySelector('[data-drop-target="create-cover"]'),
    nodes.createCover,
    nodes.createCoverState,
    '未选择封面。',
  );

  createOpen?.addEventListener('click', () => {
    nodes.createForm.hidden = false;
    syncCreateCategory();
    nodes.createForm.querySelector('[name="name"]')?.focus();
  });
  createCancel?.addEventListener('click', () => {
    nodes.createForm.reset();
    resetCreateFiles();
    syncCreateCategory();
    nodes.createForm.hidden = true;
  });

  nodes.createForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = nodes.createForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = '正在创建...';
    try {
      const form = new FormData(nodes.createForm);
      const category = String(form.get('category') || 'data');
      const selectedVersion = nodes.createVersion.files?.[0] || null;
      const selectedCover = nodes.createCover.files?.[0] || null;
      const created = await workshopApi.createProject({
        name: String(form.get('name') || ''),
        summary: String(form.get('summary') || ''),
        category,
        tags: String(form.get('tags') || '').split(/[,，\n]/u).map(value => value.trim()).filter(Boolean),
        dependencies: parseDependencyText(form.get('dependencies')),
      });
      const project = created.project;

      if (selectedVersion) {
        submit.textContent = '正在上传版本...';
        const raw = await selectedVersion.text();
        const bundle = buildUploadBundle(
          project,
          selectedVersion.name,
          raw,
          String(form.get('artifact_kind') || 'data'),
        );
        await workshopApi.uploadProjectVersion(project.id, { changelog: '', bundle });
      }

      if (selectedCover) {
        submit.textContent = '正在上传封面...';
        await workshopApi.uploadProjectCover(project.id, selectedCover);
      }

      const submitReview = Boolean(selectedVersion && form.get('submit_review'));
      if (submitReview) {
        submit.textContent = '正在提交审核...';
        await workshopApi.submitProject(project.id);
      }

      nodes.createForm.reset();
      resetCreateFiles();
      syncCreateCategory();
      nodes.createForm.hidden = true;
      try {
        host.toastr?.success?.(
          submitReview ? '作品已创建并提交审核' : selectedVersion ? '作品与版本已创建' : '草稿已创建',
          '创意工坊',
        );
      } catch {}
      await views.author.refresh();
    } catch (error) {
      notifyError(error);
      await views.author.refresh();
    } finally {
      submit.disabled = false;
      submit.textContent = '创建作品';
    }
  });

  return () => {};
}
