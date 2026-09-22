import { createAdminProjectsView } from './admin/projects.js';
import { createAdminReportsView } from './admin/reports.js';
import { createAdminUpdatesView } from './admin/updates.js';
import { createAdminUsersView } from './admin/users.js';

export function createAdminView(context) {
  const { nodes, empty, getAuth } = context;
  const projects = createAdminProjectsView(context);
  const views = {
    projects,
    updates: createAdminUpdatesView({ ...context, showProject: projects.showReview }),
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
  const refreshUpdatesIfActive = () => {
    if (active === 'updates') void views.updates.refresh();
  };
  const refreshReportsIfActive = () => {
    if (active === 'reports') void views.reports.refresh();
  };
  const refreshUsersIfActive = () => {
    if (active === 'users') void views.users.refresh();
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

  async function refreshAdmin() {
    if (!Number(getAuth()?.user?.is_admin)) {
      empty(nodes.pendingList, '需要管理员权限');
      return;
    }
    await show(active);
  }

  return { refresh: refreshAdmin, show };
}
