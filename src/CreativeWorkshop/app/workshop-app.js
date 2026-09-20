import { resolveHostWindow } from '../config.js';
import { workshopApi } from '../services/api.js';
import { projectService } from '../services/project-service.js';
import { workshopSelfUpdater } from '../services/self-update.js';
import { createUiHelpers } from '../ui/helpers.js';
import { createWorkshopShell } from '../ui/shell.js';
import { createWorkshopBridge } from './bridge.js';
import { bindWorkshopEvents } from './events.js';
import { createWorkshopViews } from './views.js';

export const GLOBAL_NAME = 'ReincarnationWorkshop';
export const WORKSHOP_VERSION = '1.5.4';

let booted = false;

export function bootWorkshop() {
  if (booted) return;
  const host = resolveHostWindow();
  if (host[GLOBAL_NAME]?.version === WORKSHOP_VERSION) return;
  booted = true;

  const doc = host.document;
  const { style, launcher, overlay, nodes } = createWorkshopShell(doc, WORKSHOP_VERSION);
  const ui = createUiHelpers(doc, host, overlay);
  let auth = null;
  let activeTab = 'discover';

  const views = createWorkshopViews({
    host, doc, nodes, ui, workshopApi, projectService,
    selfUpdater: workshopSelfUpdater,
    version: WORKSHOP_VERSION,
    getAuth: () => auth,
  });

  function showTab(name) {
    if (name === 'admin' && !Number(auth?.user?.is_admin)) return;
    activeTab = name;
    overlay.querySelectorAll('.rw-tab[data-tab]').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === name));
    overlay.querySelectorAll('.rw-section').forEach(section => { section.hidden = section.dataset.section !== name; });
    nodes.discoverHeadTools.hidden = name !== 'discover';
    const view = { discover: views.discover, installed: views.installed, mine: views.author, admin: views.admin }[name];
    if (view) void view.refresh();
  }

  function setAuth(next) {
    auth = next;
    const user = auth?.user;
    nodes.account.textContent = user
      ? `${user.display_name || user.username}${Number(user.is_admin) ? ' · 管理员' : ''} ▾`
      : '账户';
    nodes.account.hidden = !user;
    nodes.accountMenu.hidden = true;
    nodes.login.hidden = Boolean(user);
    nodes.logout.hidden = !user;
    nodes.adminTab.hidden = !Number(user?.is_admin);
    if (!user && (activeTab === 'mine' || activeTab === 'admin')) showTab('discover');
  }

  async function refreshHealth() {
    try {
      const result = await workshopApi.health();
      nodes.health.textContent = `在线 · ${result.version}`;
      nodes.health.className = 'rw-health-chip ok';
    } catch (error) {
      nodes.health.textContent = `未连接 · ${error.message}`;
      nodes.health.className = 'rw-health-chip bad';
    }
  }

  async function refreshAuth() {
    try {
      const stored = await workshopApi.getStoredAuth();
      if (!stored) return setAuth(null);
      const current = await workshopApi.me();
      setAuth({ ...stored, user: current.user });
    } catch { setAuth(null); }
  }

  const close = () => overlay.classList.remove('is-open');
  const open = () => {
    overlay.classList.add('is-open');
    void refreshHealth();
    void refreshAuth().then(() => showTab(activeTab));
  };
  launcher.addEventListener('click', open);

  bindWorkshopEvents({
    host, doc, overlay, nodes, views, workshopApi, projectService,
    notifyError: ui.notifyError, confirmDialog: ui.confirmDialog, openModal: ui.openModal,
    showTab, getActiveTab: () => activeTab, setAuth, close,
  });

  const refresh = async () => {
    await Promise.allSettled([refreshHealth(), refreshAuth()]);
    showTab(activeTab);
  };
  const bridge = createWorkshopBridge({
    version: WORKSHOP_VERSION,
    open,
    close,
    refresh,
    workshopApi,
    projectService,
    selfUpdater: workshopSelfUpdater,
  });
  host[GLOBAL_NAME] = bridge;
  host.dispatchEvent(new CustomEvent('reincarnation-workshop-ready', { detail: { version: WORKSHOP_VERSION } }));
  void views.discover.refresh();

  window.addEventListener('pagehide', () => {
    try { if (host[GLOBAL_NAME] === bridge) delete host[GLOBAL_NAME]; } catch {}
    launcher.remove(); overlay.remove(); style.remove(); booted = false;
  }, { once: true });
}
