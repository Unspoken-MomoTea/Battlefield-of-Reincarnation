import { createAdminProjectsView } from './admin/projects.js';
import { createAdminReportsView } from './admin/reports.js';
import { createAdminUpdatesView } from './admin/updates.js';
import { createAdminUsersView } from './admin/users.js';
import { createAdminStorageView } from './admin/storage.js';

export function createAdminView(context) {
  const { nodes, empty, getAuth } = context;
  const projects = createAdminProjectsView(context);
  const views = {
    projects,
    updates: createAdminUpdatesView({ ...context, showProject: projects.showReview }),
    reports: createAdminReportsView(context),
    users: createAdminUsersView(context),
    storage: createAdminStorageView(context),
  };
  let active = 'projects';

  function show(name) {
    if (!views[name]) return;
    active = name;
    nodes.adminViewButtons.forEach(button => {
      button.classList.toggle('is-active', button.dataset.adminView === name);
    });
    nodes.adminSections.forEach(section => {
      section.hidden = section.dataset.adminSection !== name;
    });
    return views[name].refresh();
  }

  nodes.adminViewButtons.forEach(button => {
    button.addEventListener('click', () => void show(button.dataset.adminView));
  });

  const refreshProjectsIfActive = () => {
    if (active === 'projects') void views.projects.refresh();
  };
  const refreshUpdatesIfActive = () => {
    if (active === 'updates') void views.updates.refresh();
  };
  const refreshReportsIfActive = () => {
    if (active === 'reports') void views.reports.refresh();
  };
  const refreshUsersIfActive = () => {
    if (active === 'users') void views.users.refresh();
  };
  const refreshStorageIfActive = () => {
    if (active === 'storage') void views.storage.refresh();
  };

  nodes.adminSearchButton.addEventListener('click', refreshProjectsIfActive);
  nodes.adminSearch.addEventListener('keydown', event => {
    if (event.key === 'Enter') refreshProjectsIfActive();
  });
  nodes.adminStatus.addEventListener('change', refreshProjectsIfActive);
  nodes.adminCategory.addEventListener('change', refreshProjectsIfActive);

  nodes.adminUpdateRefreshButton.addEventListener('click', refreshUpdatesIfActive);
  nodes.adminReportRefreshButton.addEventListener('click', refreshReportsIfActive);
  nodes.reportStatus.addEventListener('change', refreshReportsIfActive);

  nodes.adminUserSearchButton.addEventListener('click', refreshUsersIfActive);
  nodes.userSearch.addEventListener('keydown', event => {
    if (event.key === 'Enter') refreshUsersIfActive();
  });
  nodes.userBanned.addEventListener('change', refreshUsersIfActive);
  nodes.adminStorageRefreshButton?.addEventListener('click', refreshStorageIfActive);

  async function refreshAdmin() {
    const user = getAuth()?.user;
    const canReview = Number(user?.is_admin) || Number(user?.is_moderator);
    if (!canReview) {
      empty(nodes.pendingList, '需要管理员或审核员权限');
      return;
    }

    const storageButton = nodes.adminViewButtons.find(button => button.dataset.adminView === 'storage');
    if (storageButton) storageButton.hidden = !Number(user?.is_admin);
    if (active === 'storage' && !Number(user?.is_admin)) active = 'projects';
    await show(active);
  }

  return { refresh: refreshAdmin, show };
}
