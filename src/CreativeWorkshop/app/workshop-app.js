import { getUpdateChannel, resolveHostWindow } from '../config.js';
import { workshopApi } from '../services/api.js';
import { projectService } from '../services/project-service.js';
import { workshopSelfUpdater } from '../services/self-update.js';
import { createUiHelpers } from '../ui/helpers.js';
import { createWorkshopShell } from '../ui/shell.js';
import { createWorkshopUpdateNotice } from '../views/update-notice.js';
import { createWorkshopBridge } from './bridge.js';
import { bindWorkshopEvents } from './events.js';
import { bindWorkshopLauncher } from './launcher.js';
import { createWorkshopViews } from './views.js';

export const GLOBAL_NAME = 'ReincarnationWorkshop';
export const WORKSHOP_VERSION = '1.19.0';

const CURRENT_SHA = (() => {
  const match = String(import.meta.url).match(
    /@([0-9a-f]{40})\/src\/CreativeWorkshop\/app\/workshop-app\.js/iu,
  );
  return match?.[1] || '';
})();

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
  let cleanupLauncher = () => {};
  let authRefreshPromise = null;
  let lastAuthRefreshAt = 0;

  const views = createWorkshopViews({
    host, doc, nodes, ui, workshopApi, projectService,
    selfUpdater: workshopSelfUpdater,
    version: WORKSHOP_VERSION,
    currentSha: CURRENT_SHA,
    hotUpdateClient: updateLoaderOnly,
    getAuth: () => auth,
  });

  function showTab(name) {
    if (name === 'admin' && !Number(auth?.user?.is_admin) && !Number(auth?.user?.is_moderator)) return;
    activeTab = name;
    overlay.querySelectorAll('.rw-tab[data-tab]').forEach(tab => tab.classList.toggle('is-active', tab.dataset.tab === name));
    overlay.querySelectorAll('.rw-section').forEach(section => { section.hidden = section.dataset.section !== name; });
    nodes.discoverHeadTools.hidden = name !== 'discover' || !nodes.discoverCatalog || nodes.discoverCatalog.hidden;
    if (name === 'discover') {
      if (!nodes.discoverCatalog || nodes.discoverCatalog.hidden) void views.discover.home();
      else void views.discover.refresh();
      return;
    }
    const view = { installed: views.installed, mine: views.author, admin: views.admin }[name];
    if (view) void view.refresh();
  }

  function setAuth(next) {
    auth = next;
    const user = auth?.user;
    nodes.account.textContent = user
      ? `${user.display_name || user.username}${Number(user.is_admin) ? ' · 主管理员' : Number(user.is_moderator) ? ' · 审核员' : ''} ▾`
      : '账户';
    nodes.account.hidden = !user;
    nodes.accountMenu.hidden = true;
    nodes.login.hidden = Boolean(user);
    nodes.logout.hidden = !user;
    nodes.adminTab.hidden = !Number(user?.is_admin) && !Number(user?.is_moderator);
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
      const channel = result.update_channel || getUpdateChannel();
      const channelLabel = channel === 'testing' ? '测试' : '正式';
      nodes.health.textContent = `${channelLabel} · 在线 · ${result.version}`;
      nodes.health.title = `工坊服务状态 · ${channelLabel}通道 · ${result.update_ref || ''}`.trim();
      nodes.health.className = `rw-health-chip ok rw-health-chip--${channel}`;
      if (checkUpdate) void checkWorkshopUpdateAfterConnection();
      return true;
    } catch (error) {
      nodes.health.textContent = `未连接 · ${error.message}`;
      nodes.health.className = 'rw-health-chip bad';
      return false;
    }
  }

  async function refreshAuth({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastAuthRefreshAt < 3000) return auth;
    if (authRefreshPromise) return authRefreshPromise;
    authRefreshPromise = (async () => {
      try {
        const stored = await workshopApi.getStoredAuth();
        if (!stored) {
          setAuth(null);
          return null;
        }
        const current = await workshopApi.me();
        const next = { ...stored, user: current.user };
        setAuth(next);
        return next;
      } catch {
        setAuth(null);
        return null;
      } finally {
        lastAuthRefreshAt = Date.now();
        authRefreshPromise = null;
      }
    })();
    return authRefreshPromise;
  }

  const close = () => overlay.classList.remove('is-open');
  const open = () => {
    const wasOpen = overlay.classList.contains('is-open');
    overlay.classList.add('is-open');
    void refreshHealth();
    void refreshAuth({ force: true });
    if (!wasOpen) showTab(activeTab);
  };

  const syncAuthOnResume = () => {
    if (!overlay.classList.contains('is-open')) return;
    void refreshAuth();
  };

  const onVisibilityChange = () => {
    if (!doc.hidden) syncAuthOnResume();
  };

  function destroy() {
    if (disposed) return;
    disposed = true;

    try { updateNotice?.destroy?.(); } catch {}
    try { views.author?.destroy?.(); } catch {}
    try { cleanupEvents?.(); } catch {}
    try { cleanupLauncher?.(); } catch {}
    window.removeEventListener('pagehide', onPageHide);
    host.removeEventListener?.('focus', syncAuthOnResume);
    doc.removeEventListener?.('visibilitychange', onVisibilityChange);

    try {
      if (host[GLOBAL_NAME] === bridge) delete host[GLOBAL_NAME];
    } catch {}

    launcher.remove();
    overlay.remove();
    style.remove();
    booted = false;
  }

  async function updateLoaderOnly() {
    const updated = await workshopSelfUpdater.updateLoaderLink();
    if (!updated.loaderFound) {
      throw new Error('没有找到可自动更新的创意工坊载入脚本');
    }

    const alreadyRunningLatest = Boolean(CURRENT_SHA && updated.latestSha === CURRENT_SHA);
    return {
      ...updated,
      loaderUpdated: Boolean(updated.updated),
      alreadyRunningLatest,
      reloadRequired: !alreadyRunningLatest,
      hotReloaded: false,
    };
  }

  updateNotice = createWorkshopUpdateNotice({
    element: ui.element,
    button: ui.button,
    openModal: ui.openModal,
    host,
    selfUpdater: workshopSelfUpdater,
    currentVersion: WORKSHOP_VERSION,
    currentSha: CURRENT_SHA,
  });

  cleanupLauncher = bindWorkshopLauncher({ launcher, overlay, host, open, close });

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
    hotUpdate: updateLoaderOnly,
    workshopApi,
    projectService,
    selfUpdater: workshopSelfUpdater,
  });
  host[GLOBAL_NAME] = bridge;
  host.dispatchEvent(new CustomEvent('reincarnation-workshop-ready', {
    detail: { version: WORKSHOP_VERSION },
  }));
  void views.discover.home();

  function onPageHide() {
    destroy();
  }
  host.addEventListener?.('focus', syncAuthOnResume);
  doc.addEventListener?.('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide, { once: true });
}
