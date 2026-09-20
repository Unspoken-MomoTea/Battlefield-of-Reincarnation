import { parseDependencyText } from '../services/projects/dependency-input.js';

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
  createOpen?.addEventListener('click', () => {
    nodes.createForm.hidden = false;
    nodes.createForm.querySelector('[name="name"]')?.focus();
    nodes.createForm.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  createCancel?.addEventListener('click', () => {
    nodes.createForm.reset();
    nodes.createForm.hidden = true;
  });

  nodes.createForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = nodes.createForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const form = new FormData(nodes.createForm);
      await workshopApi.createProject({
        name: String(form.get('name') || ''),
        summary: String(form.get('summary') || ''),
        category: String(form.get('category') || 'data'),
        tags: String(form.get('tags') || '').split(/[,，\n]/u).map(value => value.trim()).filter(Boolean),
        dependencies: parseDependencyText(form.get('dependencies')),
      });
      nodes.createForm.reset();
      nodes.createForm.hidden = true;
      try { host.toastr?.success?.('草稿已创建，可以继续上传版本与封面', '创意工坊'); } catch {}
      await views.author.refresh();
    } catch (error) { notifyError(error); }
    finally { submit.disabled = false; }
  });

  return () => {};
}
