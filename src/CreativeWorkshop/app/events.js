export function bindWorkshopEvents({
  host, doc, launcher, overlay, nodes, views, workshopApi, projectService,
  notifyError, showTab, getActiveTab, setAuth, close,
}) {
  launcher.addEventListener('click', () => overlay.classList.add('is-open'));
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelectorAll('.rw-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

  overlay.querySelector('[data-action="search"]').addEventListener('click', () => void views.discover.refresh());
  nodes.search.addEventListener('keydown', event => { if (event.key === 'Enter') void views.discover.refresh(); });
  nodes.tag.addEventListener('keydown', event => { if (event.key === 'Enter') void views.discover.refresh(); });

  overlay.querySelector('[data-action="admin-search"]').addEventListener('click', () => void views.admin.refresh());
  nodes.adminSearch.addEventListener('keydown', event => { if (event.key === 'Enter') void views.admin.refresh(); });
  nodes.adminStatus.addEventListener('change', () => void views.admin.refresh());
  nodes.adminCategory.addEventListener('change', () => void views.admin.refresh());

  nodes.checkAllUpdates.addEventListener('click', () => void views.installed.checkAllUpdates(true));

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
      });
      nodes.createForm.reset();
      await views.author.refresh();
    } catch (error) { notifyError(error); }
    finally { submit.disabled = false; }
  });

  return () => {};
}
