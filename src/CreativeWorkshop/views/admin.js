import { createAdminProjectsView } from './admin/projects.js';
import { createAdminReportsView } from './admin/reports.js';
import { createAdminUsersView } from './admin/users.js';

export function createAdminView(context) {
  const { nodes, empty, getAuth } = context;
  const views = {
    projects: createAdminProjectsView(context),
    reports: createAdminReportsView(context),
    users: createAdminUsersView(context),
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
  const refreshReportsIfActive = () => {
    if (active === 'reports') void views.reports.refresh();
  };
  const refreshUsersIfActive = () => {
    if (active === 'users') void views.users.refresh();
  };

  context.overlay?.querySelector('[data-action="admin-search"]')?.addEventListener('click', refreshProjectsIfActive);
  nodes.adminSearch.addEventListener('keydown', event => {
    if (event.key === 'Enter') refreshProjectsIfActive();
  });
  nodes.adminStatus.addEventListener('change', refreshProjectsIfActive);
  nodes.adminCategory.addEventListener('change', refreshProjectsIfActive);

  context.overlay?.querySelector('[data-action="admin-report-refresh"]')?.addEventListener('click', refreshReportsIfActive);
  nodes.reportStatus.addEventListener('change', refreshReportsIfActive);

  context.overlay?.querySelector('[data-action="admin-user-search"]')?.addEventListener('click', refreshUsersIfActive);
  nodes.userSearch.addEventListener('keydown', event => {
    if (event.key === 'Enter') refreshUsersIfActive();
  });
  nodes.userBanned.addEventListener('change', refreshUsersIfActive);

  async function refreshAdmin() {
    if (!Number(getAuth()?.user?.is_admin)) {
      empty(nodes.pendingList, '需要管理员权限');
      return;
    }
    await show(active);
  }

  return { refresh: refreshAdmin, show };
}
