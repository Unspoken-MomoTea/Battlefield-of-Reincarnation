import { bindCreateProjectFlow } from '../views/author/create-project.js';
import { bindHereticPublishFlow } from '../views/author/create-heretic.js';

export function bindWorkshopEvents({
  host, doc, overlay, nodes, views, workshopApi, projectService,
  notifyError, confirmDialog, openModal, showTab, getActiveTab, setAuth, close,
}) {
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelectorAll('.rw-tab[data-tab]').forEach(tab => tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'discover') {
      nodes.discoverHeadTools.hidden = true;
      nodes.discoverCatalog.hidden = true;
      nodes.discoverHome.hidden = false;
      if (nodes.characterHome) nodes.characterHome.hidden = true;
      nodes.discoverCategories.forEach(buttonNode => buttonNode.classList.remove('is-filter-active'));
      nodes.characterHomeButton?.classList.remove('is-filter-active');
      showTab('discover');
      return;
    }
    showTab(tab.dataset.tab);
  }));

  overlay.querySelector('[data-action="maintenance"]').addEventListener('click', () => void views.maintenance.open());

  overlay.querySelector('[data-action="search"]').addEventListener('click', () => void views.discover.refresh());
  nodes.search.addEventListener('keydown', event => { if (event.key === 'Enter') void views.discover.refresh(); });
  nodes.sort.addEventListener('change', () => void views.discover.refresh());
  nodes.discoverCategories.forEach(categoryButton => {
    categoryButton.addEventListener('click', () => {
      nodes.category.value = categoryButton.dataset.categoryFilter || '';
      if (nodes.kind) nodes.kind.value = categoryButton.dataset.kindFilter || '';
      nodes.discoverCategories.forEach(buttonNode => {
        buttonNode.classList.toggle('is-filter-active', buttonNode === categoryButton);
      });
      nodes.characterHomeButton?.classList.remove('is-filter-active');
      showTab('discover');
      overlay.querySelector('.rw-tab[data-tab="discover"]')?.classList.remove('is-active');
      nodes.discoverHeadTools.hidden = false;
      void views.discover.catalog({
        category: nodes.category.value,
        kind: nodes.kind?.value || '',
      });
    });
  });
  nodes.characterHomeButton?.addEventListener('click', () => {
    nodes.discoverHeadTools.hidden = true;
    nodes.discoverCatalog.hidden = true;
    nodes.discoverHome.hidden = true;
    if (nodes.characterHome) nodes.characterHome.hidden = false;
    nodes.discoverCategories.forEach(buttonNode => buttonNode.classList.remove('is-filter-active'));
    nodes.characterHomeButton.classList.add('is-filter-active');
    showTab('discover');
    overlay.querySelector('.rw-tab[data-tab="discover"]')?.classList.remove('is-active');
    void views.discover.characters();
  });

  nodes.discoverShowcaseMore.forEach(moreButton => {
    moreButton.addEventListener('click', () => {
      nodes.discoverHeadTools.hidden = false;
      nodes.category.value = '';
      void views.discover.catalog({ category: '', sort: moreButton.dataset.discoverMoreSort || 'latest' });
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

  async function loginWithDiscordCompat() {
    const pending = workshopApi.beginLogin();
    const controller = new AbortController();
    let completed = false;

    let popup = null;
    try {
      popup = host.open?.(
        pending.url,
        'reincarnation-workshop-oauth',
        'popup,width=560,height=760',
      ) || null;
    } catch {}

    const modal = openModal('Discord 登录', {
      onClose: () => {
        if (!completed) controller.abort();
      },
    });

    const intro = doc.createElement('p');
    intro.className = 'rw-muted';
    intro.textContent = popup
      ? 'Discord 授权页已尝试打开。完成授权后回到这里，创意工坊会自动完成登录。'
      : '当前客户端没有可用的登录弹窗。TT 等酒馆客户端可使用下面的授权页或复制链接到系统浏览器，授权后再返回这里。';

    const status = doc.createElement('div');
    status.className = 'rw-rule-section';
    status.textContent = '等待 Discord 授权…';

    const direct = doc.createElement('a');
    direct.className = 'rw-button primary';
    direct.href = pending.url;
    direct.target = '_blank';
    direct.rel = 'noopener noreferrer';
    direct.textContent = '打开 Discord 授权页';

    const link = doc.createElement('input');
    link.className = 'rw-input';
    link.type = 'text';
    link.readOnly = true;
    link.value = pending.url;
    link.setAttribute('aria-label', 'Discord 授权链接');

    const copy = doc.createElement('button');
    copy.className = 'rw-button';
    copy.type = 'button';
    copy.textContent = '复制授权链接';
    copy.addEventListener('click', async () => {
      try {
        if (host.navigator?.clipboard?.writeText) {
          await host.navigator.clipboard.writeText(pending.url);
        } else {
          link.focus();
          link.select();
          if (!doc.execCommand?.('copy')) throw new Error('copy unavailable');
        }
        status.textContent = '授权链接已复制。请在系统浏览器打开，完成 Discord 授权后返回 TT。';
      } catch {
        link.focus();
        link.select();
        status.textContent = '无法自动复制，已选中授权链接，请手动复制后在系统浏览器打开。';
      }
    });

    const actions = doc.createElement('div');
    actions.className = 'rw-page-actions';
    actions.append(direct, copy);

    const note = doc.createElement('p');
    note.className = 'rw-muted';
    note.textContent = '不需要把 Discord Token 粘贴回酒馆；授权结果会通过创意工坊服务器自动交换。等待时间最长 5 分钟。';

    modal.body.append(intro, status, actions, link, note);

    try {
      const auth = await workshopApi.waitForLogin(pending, {
        popup,
        signal: controller.signal,
      });
      completed = true;
      status.textContent = 'Discord 登录成功。';
      modal.close({ force: true });
      return auth;
    } catch (error) {
      if (controller.signal.aborted) return null;
      status.textContent = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  nodes.login.addEventListener('click', async () => {
    nodes.login.disabled = true;
    nodes.login.textContent = '等待授权...';
    try {
      const auth = await loginWithDiscordCompat();
      if (!auth) return;
      setAuth(auth);
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

  let createProjectFlow = { destroy() {} };
  try {
    createProjectFlow = bindCreateProjectFlow({
      host,
      doc,
      overlay,
      nodes,
      workshopApi,
      projectService,
      notifyError,
      confirmDialog,
      openModal,
      refreshMine: () => views.author.refresh(),
    });
  } catch (error) {
    console.error('[轮回战场创意工坊] 作品发布模块初始化失败；其余工坊功能继续运行', error);
    notifyError(error);
  }

  let hereticPublishFlow = { destroy() {} };
  try {
    hereticPublishFlow = bindHereticPublishFlow({
      host,
      overlay,
      workshopApi,
      notifyError,
      refreshMine: () => views.author.refresh(),
    });
  } catch (error) {
    console.error('[轮回战场创意工坊] 异端库发布模块初始化失败；其余工坊功能继续运行', error);
    notifyError(error);
  }

  return () => {
    createProjectFlow.destroy();
    hereticPublishFlow.destroy();
  };
}
