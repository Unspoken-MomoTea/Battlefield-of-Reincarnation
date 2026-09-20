import { bindCreateProjectFlow } from '../views/author/create-project.js';

export function bindWorkshopEvents({
  host, doc, overlay, nodes, views, workshopApi, projectService,
  notifyError, confirmDialog, openModal, showTab, getActiveTab, setAuth, close,
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
        buttonNode.classList.toggle('is-filter-active', buttonNode === categoryButton);
      });
      showTab('discover');
    });
  });
  nodes.discoverMore.addEventListener('click', () => void views.discover.loadMore());

  const closeAccountMenu = () => { nodes.accountMenu.hidden = true; };
  nodes.account.addEventListener('click', event => {
    event.stopPropagation();
    nodes.accountMenu.hidden = !nodes.accountMenu.hidden;
  });
  nodes.accountMenu.addEventListener('click', event => event.stopPropagation());
  overlay.addEventListener('click', closeAccountMenu);

  overlay.querySelector('[data-action="mine-menu"]').addEventListener('click', () => {
    closeAccountMenu();
    showTab('mine');
  });
  nodes.adminTab.addEventListener('click', () => {
    closeAccountMenu();
    showTab('admin');
  });
  overlay.querySelector('[data-action="upload-menu"]').addEventListener('click', () => {
    closeAccountMenu();
    showTab('mine');
    overlay.querySelector('[data-action="create-project-open"]')?.click();
  });

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
    closeAccountMenu();
    nodes.logout.disabled = true;
    try {
      await workshopApi.logout();
      setAuth(null);
    } catch (error) { notifyError(error); }
    finally { nodes.logout.disabled = false; }
  });

  const createProjectFlow = bindCreateProjectFlow({
    host,
    doc,
    overlay,
    nodes,
    workshopApi,
    notifyError,
    confirmDialog,
    openModal,
    refreshMine: () => views.author.refresh(),
  });

  return () => createProjectFlow.destroy();
}
