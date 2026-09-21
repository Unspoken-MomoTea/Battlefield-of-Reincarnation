import { resolveHostWindow } from '../config.js';
import { workshopApi } from '../services/api.js';
import { projectService } from '../services/project-service.js';
import { workshopSelfUpdater } from '../services/self-update.js';
import { createUiHelpers } from '../ui/helpers.js';
import { createWorkshopShell } from '../ui/shell.js';
import { createWorkshopUpdateNotice } from '../views/update-notice.js';
import { createWorkshopBridge } from './bridge.js';
import { bindWorkshopEvents } from './events.js';
import { createWorkshopViews } from './views.js';

export const GLOBAL_NAME = 'ReincarnationWorkshop';
export const WORKSHOP_VERSION = '1.7.0';

let booted = false;

function removeLegacyShell(doc) {
  doc
    .querySelectorAll('.rw-launcher,.rw-overlay,style[data-reincarnation-workshop="style"]')
    .forEach(node => node.remove());
}

export function bootWorkshop() {
  if (booted) return;

  const host = resolveHostWindow();
  const existing = host[GLOBAL_NAME];
  if (existing) {
    try {
      existing.destroy?.({ reason: 'replace-client' });
    } catch (error) {
      console.warn('[轮回战场创意工坊] 清理旧客户端失败，将执行 DOM 兜底清理', error);
    }
    if (host[GLOBAL_NAME] === existing) {
      try { delete host[GLOBAL_NAME]; } catch {}
      removeLegacyShell(host.document);
    }
  }

  booted = true;

  const doc = host.document;
  const { style, launcher, overlay, nodes } = createWorkshopShell(doc, WORKSHOP_VERSION);
  const ui = createUiHelpers(doc, host, overlay);
  let auth = null;
  let activeTab = 'discover';
  let disposed = false;
  let bridge = null;
  let updateNotice = null;
  let cleanupEvents = () => {};

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

  async function checkWorkshopUpdateAfterConnection() {
    try {
      await updateNotice?.check();
    } catch (error) {
      console.warn('[轮回战场创意工坊] 自动更新检查失败', error);
    }
  }

  async function refreshHealth({ checkUpdate = true } = {}) {
    try {
      const result = await workshopApi.health();
      nodes.health.textContent = `在线 · ${result.version}`;
      nodes.health.className = 'rw-health-chip ok';
      if (checkUpdate) void checkWorkshopUpdateAfterConnection();
      return true;
    } catch (error) {
      nodes.health.textContent = `未连接 · ${error.message}`;
      nodes.health.className = 'rw-health-chip bad';
      return false;
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

  const close = () => overlay.classList.remove('is-open');
  const open = () => {
    overlay.classList.add('is-open');
    void refreshHealth();
    void refreshAuth().then(() => showTab(activeTab));
  };

  function destroy() {
    if (disposed) return;
    disposed = true;

    try { updateNotice?.destroy?.(); } catch {}
    try { cleanupEvents?.(); } catch {}
    launcher.removeEventListener('click', open);
    window.removeEventListener('pagehide', onPageHide);

    try {
      if (host[GLOBAL_NAME] === bridge) delete host[GLOBAL_NAME];
    } catch {}

    launcher.remove();
    overlay.remove();
    style.remove();
    booted = false;
  }

  async function hotReload(updated) {
    const url = String(updated?.latestImportUrl || '').trim();
    if (!/^https:\/\/(?:testingcf\.)?jsdelivr\.net\/gh\/Unspoken-MomoTea\/Battlefield-of-Reincarnation@[0-9a-f]{40}\/src\/CreativeWorkshop\/index\.js$/iu.test(url)) {
      throw new Error('服务器返回的新版工坊地址无效');
    }

    const previousBridge = bridge;
    const hotUrl = `${url}?rw_hot=${Date.now()}`;
    try {
      await import(hotUrl);
    } catch (error) {
      throw new Error(`新版载入失败：${error instanceof Error ? error.message : String(error)}`);
    }

    const nextBridge = host[GLOBAL_NAME];
    if (!nextBridge || nextBridge === previousBridge) {
      throw new Error('新版脚本已经下载，但没有完成客户端接管；请刷新一次酒馆');
    }
  }

  updateNotice = createWorkshopUpdateNotice({
    element: ui.element,
    button: ui.button,
    openModal: ui.openModal,
    host,
    selfUpdater: workshopSelfUpdater,
    currentVersion: WORKSHOP_VERSION,
    onHotReload: hotReload,
  });

  launcher.addEventListener('click', open);

  cleanupEvents = bindWorkshopEvents({
    host, doc, overlay, nodes, views, workshopApi, projectService,
    notifyError: ui.notifyError, confirmDialog: ui.confirmDialog, openModal: ui.openModal,
    showTab, getActiveTab: () => activeTab, setAuth, close,
  });

  const refresh = async () => {
    const results = await Promise.allSettled([
      refreshHealth(),
      refreshAuth(),
    ]);
    showTab(activeTab);
    return results;
  };

  bridge = createWorkshopBridge({
    version: WORKSHOP_VERSION,
    open,
    close,
    refresh,
    destroy,
    workshopApi,
    projectService,
    selfUpdater: workshopSelfUpdater,
  });
  host[GLOBAL_NAME] = bridge;
  host.dispatchEvent(new CustomEvent('reincarnation-workshop-ready', {
    detail: { version: WORKSHOP_VERSION },
  }));
  void views.discover.refresh();

  function onPageHide() {
    destroy();
  }
  window.addEventListener('pagehide', onPageHide, { once: true });
}
