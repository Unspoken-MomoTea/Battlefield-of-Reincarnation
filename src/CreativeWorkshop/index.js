import { resolveHostWindow } from './config.js';
import { workshopApi } from './services/api.js';
import { projectService } from './services/project-service.js';
import { buildUploadBundle } from './services/upload.js';
import { CATEGORY_LABELS, STATUS_LABELS } from './ui/constants.js';
import { createUiHelpers } from './ui/helpers.js';
import { createWorkshopShell } from './ui/shell.js';
import { createAdminView } from './views/admin.js';
import { createAuthorView } from './views/author.js';
import { createDiscoverView } from './views/discover.js';
import { createInstalledView } from './views/installed.js';

const GLOBAL_NAME = 'ReincarnationWorkshop';
const VERSION = '1.1.0';
let booted = false;

boot();

function boot() {
  if (booted) return;
  booted = true;

  const host = resolveHostWindow();
  const doc = host.document;
  if (host[GLOBAL_NAME]?.version === VERSION) return;

  const { style, launcher, overlay, nodes } = createWorkshopShell(doc, VERSION);
  const { element, button, notifyError, empty } = createUiHelpers(doc, host);

  let auth = null;
  let activeTab = 'discover';

  const discoverView = createDiscoverView({
    nodes,
    element,
    button,
    empty,
    projectService,
    workshopApi,
    host,
    categoryLabels: CATEGORY_LABELS,
    getAuth: () => auth,
  });
  const installedView = createInstalledView({
    nodes,
    element,
    button,
    empty,
    projectService,
    host,
    doc,
    categoryLabels: CATEGORY_LABELS,
  });
  const authorView = createAuthorView({
    nodes,
    element,
    button,
    empty,
    workshopApi,
    buildUploadBundle,
    doc,
    host,
    categoryLabels: CATEGORY_LABELS,
    statusLabels: STATUS_LABELS,
    getAuth: () => auth,
  });
  const adminView = createAdminView({
    nodes,
    element,
    button,
    empty,
    workshopApi,
    host,
    categoryLabels: CATEGORY_LABELS,
    getAuth: () => auth,
  });

  function setAuth(next) {
    auth = next;
    const user = auth?.user;
    nodes.account.textContent = user
      ? `${user.display_name || user.username}${Number(user.is_admin) ? ' · 管理员' : ''}`
      : '未登录';
    nodes.login.hidden = Boolean(user);
    nodes.logout.hidden = !user;
    nodes.adminTab.hidden = !Number(user?.is_admin);
    if (!user && (activeTab === 'mine' || activeTab === 'admin')) showTab('discover');
  }

  function showTab(name) {
    if (name === 'admin' && !Number(auth?.user?.is_admin)) return;
    activeTab = name;
    overlay.querySelectorAll('.rw-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === name));
    overlay.querySelectorAll('.rw-section').forEach(section => {
      section.hidden = section.dataset.section !== name;
    });
    if (name === 'discover') void discoverView.refresh();
    if (name === 'installed') void installedView.refresh();
    if (name === 'mine') void authorView.refresh();
    if (name === 'admin') void adminView.refresh();
  }

  async function refreshHealth() {
    try {
      const result = await workshopApi.health();
      nodes.health.textContent = `在线 · ${result.version}`;
      nodes.health.className = 'rw-status ok';
    } catch (error) {
      nodes.health.textContent = `未连接 · ${error.message}`;
      nodes.health.className = 'rw-status bad';
    }
  }

  async function refreshAuth() {
    try {
      const stored = await workshopApi.getStoredAuth();
      if (!stored) return setAuth(null);
      const current = await workshopApi.me();
      setAuth({ ...stored, user: current.user });
    } catch {
      setAuth(null);
    }
  }

  const open = () => {
    overlay.classList.add('is-open');
    void refreshHealth();
    void refreshAuth().then(() => showTab(activeTab));
  };
  const close = () => overlay.classList.remove('is-open');

  launcher.addEventListener('click', open);
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  overlay.querySelectorAll('.rw-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

  overlay.querySelector('[data-action="search"]').addEventListener('click', () => void discoverView.refresh());
  nodes.search.addEventListener('keydown', event => {
    if (event.key === 'Enter') void discoverView.refresh();
  });
  nodes.tag.addEventListener('keydown', event => {
    if (event.key === 'Enter') void discoverView.refresh();
  });

  overlay.querySelector('[data-action="admin-search"]').addEventListener('click', () => void adminView.refresh());
  nodes.adminSearch.addEventListener('keydown', event => {
    if (event.key === 'Enter') void adminView.refresh();
  });
  nodes.adminStatus.addEventListener('change', () => void adminView.refresh());
  nodes.adminCategory.addEventListener('change', () => void adminView.refresh());

  nodes.offlineInput.addEventListener('change', async () => {
    const selected = nodes.offlineInput.files?.[0];
    nodes.offlineInput.value = '';
    if (!selected) return;
    try {
      const imported = await projectService.importOffline(selected);
      try { host.toastr?.success?.(`已导入 ${imported.name} v${imported.version}`, '创意工坊'); } catch {}
      await installedView.refresh();
    } catch (error) {
      notifyError(error);
    }
  });

  nodes.login.addEventListener('click', async () => {
    nodes.login.disabled = true;
    nodes.login.textContent = '等待授权...';
    try {
      setAuth(await workshopApi.login());
      showTab(activeTab);
    } catch (error) {
      notifyError(error);
    } finally {
      nodes.login.disabled = false;
      nodes.login.textContent = 'Discord 登录';
    }
  });

  nodes.logout.addEventListener('click', async () => {
    nodes.logout.disabled = true;
    try {
      await workshopApi.logout();
      setAuth(null);
    } catch (error) {
      notifyError(error);
    } finally {
      nodes.logout.disabled = false;
    }
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
        tags: String(form.get('tags') || '')
          .split(/[,，\n]/u)
          .map(value => value.trim())
          .filter(Boolean),
      });
      nodes.createForm.reset();
      await authorView.refresh();
    } catch (error) {
      notifyError(error);
    } finally {
      submit.disabled = false;
    }
  });

  const refresh = async () => {
    await Promise.allSettled([refreshHealth(), refreshAuth()]);
    showTab(activeTab);
  };

  const bridge = {
    version: VERSION,
    open,
    close,
    refresh,
    login: () => workshopApi.login(),
    logout: () => workshopApi.logout(),
    getSession: () => workshopApi.getStoredAuth(),
    listInstalled: () => projectService.installed(),
    cacheProject: projectId => projectService.cache(projectId),
    checkProjectUpdate: projectId => projectService.checkUpdate(projectId),
    applyProject: projectId => projectService.apply(projectId),
    uninstallProject: projectId => projectService.uninstall(projectId),
    exportProject: projectId => projectService.exportCached(projectId),
    importProject: file => projectService.importOffline(file),
  };

  host[GLOBAL_NAME] = bridge;
  host.dispatchEvent(new CustomEvent('reincarnation-workshop-ready', { detail: { version: VERSION } }));
  void discoverView.refresh();

  window.addEventListener('pagehide', () => {
    try {
      if (host[GLOBAL_NAME] === bridge) delete host[GLOBAL_NAME];
    } catch {}
    launcher.remove();
    overlay.remove();
    style.remove();
    booted = false;
  }, { once: true });
}
