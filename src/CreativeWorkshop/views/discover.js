import { formatInstallConflicts } from '../ui/install-messages.js';
import { promptProjectReport } from './discover/report.js';

export function createDiscoverView({
  nodes,
  element,
  button,
  empty,
  projectService,
  workshopApi,
  host,
  categoryLabels,
  artifactLabels,
  getAuth,
  openModal,
  notifyError,
}) {
  let nextOffset = null;
  let loadedCount = 0;
  let requestSerial = 0;
  let localProjects = new Map();

  function localProject(projectId) {
    return localProjects.get(projectId) || null;
  }

  async function syncLocalProjects() {
    const installed = await projectService.installed();
    localProjects = new Map(installed.map(item => [item.id, item]));
    return localProjects;
  }

  function cardFor(projectId) {
    return [...nodes.discoverList.querySelectorAll('.rw-project-card')]
      .find(card => card.dataset.projectId === String(projectId)) || null;
  }

  function localActionLabel(project, local) {
    if (!local) return '下载';
    if (Number(local.version) < Number(project.version)) return '有更新';
    if (local.applied && Number(local.appliedVersion || 0) >= Number(local.version)) return '已安装';
    return '已下载';
  }

  function updateCardLocalState(project) {
    const card = cardFor(project.id);
    const action = card?.querySelector('.rw-card-primary');
    if (!action) return;
    const local = localProject(project.id);
    action.textContent = localActionLabel(project, local);
    action.classList.toggle('is-installed', Boolean(local?.applied));
    action.classList.toggle('is-cached', Boolean(local && !local.applied));
    action.classList.toggle('has-update', Boolean(local && Number(local.version) < Number(project.version)));
  }

  function updateCardEngagement(projectId, state) {
    const card = cardFor(projectId);
    if (!card) return;
    const likes = card.querySelector('[data-stat="likes"]');
    const favorites = card.querySelector('[data-stat="favorites"]');
    if (likes) likes.textContent = `♥ ${state.likes_count || 0}`;
    if (favorites) favorites.textContent = `★ ${state.favorites_count || 0}`;
  }

  function projectCard(project) {
    const card = element('article', 'rw-card rw-project-card');
    card.dataset.projectId = project.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `查看作品：${project.name}`);

    if (project.has_cover) {
      const cover = element('img', 'rw-cover');
      cover.src = workshopApi.getProjectCoverUrl(project.id);
      cover.alt = `${project.name} 封面`;
      cover.loading = 'lazy';
      card.appendChild(cover);
    } else {
      const placeholder = element('div', 'rw-cover rw-cover-placeholder');
      placeholder.textContent = categoryLabels[project.category] || '创意工坊';
      card.appendChild(placeholder);
    }

    const typeBadge = element(
      'span',
      `rw-cover-badge rw-cover-badge--${project.category}`,
      categoryLabels[project.category] || project.category,
    );
    card.appendChild(typeBadge);

    const top = element('div', 'rw-project-card-top');
    top.appendChild(element('h3', '', project.name));
    if (project.owner_name) top.appendChild(element('div', 'rw-project-author', project.owner_name));
    card.appendChild(top);

    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', `v${project.version}`));
    for (const tag of (project.tags || []).slice(0, 3)) meta.append(element('span', 'rw-pill', `#${tag}`));
    card.appendChild(meta);

    card.appendChild(element('div', 'rw-muted rw-project-summary', project.summary || '暂无简介'));

    const footer = element('div', 'rw-project-footer');
    const stats = element('div', 'rw-project-stats');
    const downloads = element('span', '', `↓ ${project.downloads_count || 0}`);
    const likes = element('span', '', `♥ ${project.likes_count || 0}`);
    const favorites = element('span', '', `★ ${project.favorites_count || 0}`);
    downloads.dataset.stat = 'downloads';
    likes.dataset.stat = 'likes';
    favorites.dataset.stat = 'favorites';
    stats.append(downloads, likes, favorites);
    footer.appendChild(stats);

    let quickAction = null;
    const renderQuickAction = () => {
      if (!quickAction) return;
      const local = localProject(project.id);
      quickAction.textContent = localActionLabel(project, local);
      quickAction.classList.toggle('is-installed', Boolean(local?.applied));
      quickAction.classList.toggle('is-cached', Boolean(local && !local.applied));
      quickAction.classList.toggle('has-update', Boolean(local && Number(local.version) < Number(project.version)));
    };
    quickAction = button('', 'primary rw-card-primary', async () => {
      const local = localProject(project.id);
      if (local) {
        await showDetail(project.id);
        return;
      }
      const cached = await projectService.cache(project.id);
      localProjects.set(project.id, cached);
      renderQuickAction();
      try { host.toastr?.success?.(`已下载 ${cached.name} v${cached.version}，可继续安装到酒馆`, '创意工坊'); } catch {}
    });
    renderQuickAction();
    footer.appendChild(quickAction);
    card.appendChild(footer);

    const open = () => void showDetail(project.id);
    card.addEventListener('click', event => {
      if (event.target.closest('button,input,select,textarea,a')) return;
      open();
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    return card;
  }

  async function loadPage({ append = false } = {}) {
    const serial = ++requestSerial;
    const offset = append ? nextOffset : 0;
    if (append && offset === null) return;

    if (!append) {
      nextOffset = null;
      loadedCount = 0;
      nodes.discoverMore.hidden = true;
      empty(nodes.discoverList, '正在加载作品...');
      nodes.discoverCount.textContent = '正在载入';
      await syncLocalProjects();
    } else {
      nodes.discoverMore.disabled = true;
      nodes.discoverMore.textContent = '加载中...';
    }

    try {
      const result = await projectService.list(
        nodes.search.value,
        nodes.category.value,
        offset || 0,
        nodes.tag.value,
        nodes.sort.value,
      );
      if (serial !== requestSerial) return;

      const items = Array.isArray(result.items) ? result.items : [];
      if (!append && !items.length) {
        empty(nodes.discoverList, '暂时没有符合条件的已发布作品');
        nodes.discoverCount.textContent = '0 个作品';
        nodes.discoverMore.hidden = true;
        return;
      }

      const cards = items.map(projectCard);
      if (append) nodes.discoverList.append(...cards);
      else nodes.discoverList.replaceChildren(...cards);

      loadedCount += items.length;
      nextOffset = result.next_offset ?? null;
      nodes.discoverCount.textContent = nextOffset === null
        ? `已显示 ${loadedCount} 个作品`
        : `已加载 ${loadedCount} 个 · 还有更多`;
      nodes.discoverMore.hidden = nextOffset === null;
    } catch (error) {
      if (append) notifyError(error);
      else {
        empty(nodes.discoverList, `加载失败：${error.message}`);
        nodes.discoverCount.textContent = '加载失败';
      }
    } finally {
      nodes.discoverMore.disabled = false;
      nodes.discoverMore.textContent = '加载更多';
    }
  }

  async function applyCachedProject(project, local, onChanged) {
    const preflight = await projectService.preflight(project.id);
    if (preflight.blocking.length) {
      throw new Error(`当前无法安装：\n${formatInstallConflicts(preflight.blocking)}`);
    }
    if (preflight.warnings.length) {
      const confirmed = host.confirm?.(
        `安装前发现以下冲突：\n\n${formatInstallConflicts(preflight.warnings)}\n\n是否继续？`,
      );
      if (!confirmed) return local;
    }
    const result = await projectService.apply(project.id);
    const installed = (await projectService.installed()).find(item => item.id === project.id) || local;
    localProjects.set(project.id, installed);
    try { host.toastr?.success?.(`已安装 ${result.name} v${result.appliedVersion}`, '创意工坊'); } catch {}
    updateCardLocalState(project);
    onChanged?.(installed);
    return installed;
  }

  async function showDetail(projectId) {
    const modal = openModal('作品详情', { wide: true });
    empty(modal.body, '正在加载作品详情...');

    try {
      const [detail] = await Promise.all([
        projectService.detail(projectId),
        syncLocalProjects(),
      ]);
      const project = detail.project;
      let engagement = null;
      if (getAuth()?.user) {
        try { engagement = await workshopApi.getProjectEngagement(project.id); } catch {}
      }

      modal.body.replaceChildren();

      if (project.has_cover) {
        const cover = element('img', 'rw-detail-cover');
        cover.src = workshopApi.getProjectCoverUrl(project.id);
        cover.alt = `${project.name} 封面`;
        modal.body.appendChild(cover);
      }

      const heading = element('div', 'rw-detail-heading');
      const titleBox = element('div', 'rw-detail-titlebox');
      titleBox.append(
        element('h3', '', project.name),
        element('div', 'rw-project-author', project.owner_name ? `作者 · ${project.owner_name}` : ''),
      );
      const stats = element('div', 'rw-detail-stats');
      const downloadsStat = element('span', '', `↓ ${project.downloads_count || 0}`);
      const likesStat = element('span', '', `♥ ${engagement?.likes_count ?? project.likes_count ?? 0}`);
      const favoritesStat = element('span', '', `★ ${engagement?.favorites_count ?? project.favorites_count ?? 0}`);
      stats.append(downloadsStat, likesStat, favoritesStat);
      heading.append(titleBox, stats);
      modal.body.appendChild(heading);

      const meta = element('div', 'rw-meta');
      meta.append(element('span', 'rw-pill', categoryLabels[project.category] || project.category));
      meta.append(element('span', 'rw-pill', `v${project.version}`));
      for (const tag of project.tags || []) meta.append(element('span', 'rw-pill', `#${tag}`));
      modal.body.appendChild(meta);
      modal.body.appendChild(element('div', 'rw-detail-description', project.summary || '暂无简介'));

      if (detail.changelog) {
        const changelog = element('section', 'rw-detail-section');
        changelog.append(element('strong', '', '版本说明'), element('div', 'rw-muted', detail.changelog));
        modal.body.appendChild(changelog);
      }

      const artifacts = Array.isArray(detail.manifest?.artifacts) ? detail.manifest.artifacts : [];
      if (artifacts.length) {
        const contents = element('section', 'rw-detail-section');
        contents.appendChild(element('strong', '', '包含内容'));
        const pills = element('div', 'rw-meta');
        for (const artifact of artifacts) {
          let label = artifactLabels[artifact.kind] || artifact.kind;
          if (artifact.kind === 'script') {
            const scope = ({ character: '角色', preset: '预设', global: '全局' })[artifact.scope || 'character'];
            label += ` · ${scope}`;
          }
          pills.appendChild(element('span', 'rw-pill', label));
        }
        contents.appendChild(pills);

        const scriptCount = artifacts.filter(artifact => artifact.kind === 'script').length;
        const conflictCount = artifacts.reduce(
          (sum, artifact) => sum + (Array.isArray(artifact.original_conflicts) ? artifact.original_conflicts.length : 0),
          0,
        );
        if (scriptCount) {
          contents.appendChild(element(
            'div',
            'rw-status',
            `包含 ${scriptCount} 项酒馆助手脚本：下载与查看不会执行，只有主动安装后才会写入并启用。`,
          ));
        }
        if (conflictCount) {
          contents.appendChild(element(
            'div',
            'rw-status',
            `安装时会按作者声明临时关闭 ${conflictCount} 个原版世界书条目；卸载时按安全恢复规则处理。`,
          ));
        }
        modal.body.appendChild(contents);
      }

      if (project.dependencies?.length) {
        const dependencies = element('section', 'rw-detail-section');
        dependencies.appendChild(element('strong', '', '依赖'));
        dependencies.appendChild(element(
          'div',
          'rw-muted',
          project.dependencies.map(item => `${item.project_id}@${item.min_version}`).join('、'),
        ));
        modal.body.appendChild(dependencies);
      }

      const actions = element('div', 'rw-row rw-detail-actions');
      let local = localProject(project.id);
      let installButton = null;

      const renderInstallButton = () => {
        if (!installButton) return;
        local = localProject(project.id);
        installButton.classList.remove('is-installed');
        if (!local) {
          installButton.textContent = '下载到本地';
        } else if (Number(local.version) < Number(project.version)) {
          installButton.textContent = local.applied ? `一键升级到 v${project.version}` : `下载新版 v${project.version}`;
        } else if (!local.applied) {
          installButton.textContent = `安装本地 v${local.version}`;
        } else if (Number(local.appliedVersion || 0) < Number(local.version)) {
          installButton.textContent = `应用本地 v${local.version}`;
        } else {
          installButton.textContent = `已安装 v${local.appliedVersion}`;
          installButton.classList.add('is-installed');
        }
      };

      installButton = button('', 'primary rw-install-cta', async () => {
        local = localProject(project.id);
        if (!local) {
          const cached = await projectService.cache(project.id);
          localProjects.set(project.id, cached);
          try { host.toastr?.success?.(`已下载 ${cached.name} v${cached.version}，可继续安装`, '创意工坊'); } catch {}
          updateCardLocalState(project);
          renderInstallButton();
          return;
        }
        if (Number(local.version) < Number(project.version)) {
          if (local.applied) {
            const updated = await projectService.updateLatest(project.id);
            localProjects.set(project.id, updated);
            try { host.toastr?.success?.(`已一键升级并应用到 v${updated.version}`, project.name); } catch {}
          } else {
            const cached = await projectService.cache(project.id);
            localProjects.set(project.id, cached);
            try { host.toastr?.success?.(`已下载新版 v${cached.version}`, project.name); } catch {}
          }
          updateCardLocalState(project);
          renderInstallButton();
          return;
        }
        if (local.applied && Number(local.appliedVersion || 0) >= Number(local.version)) {
          try { host.toastr?.info?.(`已安装 v${local.appliedVersion}`, project.name); } catch {}
          return;
        }
        await applyCachedProject(project, local, next => { local = next; renderInstallButton(); });
      });
      renderInstallButton();
      actions.appendChild(installButton);

      if (getAuth()?.user && engagement) {
        let engagementState = engagement;
        let likeButton = null;
        let favoriteButton = null;

        const renderEngagement = () => {
          likeButton.textContent = engagementState.user_liked
            ? `♥ 已赞 ${engagementState.likes_count}`
            : `♥ 点赞 ${engagementState.likes_count}`;
          favoriteButton.textContent = engagementState.user_favorited
            ? `★ 已收藏 ${engagementState.favorites_count}`
            : `★ 收藏 ${engagementState.favorites_count}`;
          likeButton.classList.toggle('is-active', engagementState.user_liked);
          favoriteButton.classList.toggle('is-active', engagementState.user_favorited);
          likesStat.textContent = `♥ ${engagementState.likes_count}`;
          favoritesStat.textContent = `★ ${engagementState.favorites_count}`;
          updateCardEngagement(project.id, engagementState);
        };

        likeButton = button('', 'rw-engagement-button', async () => {
          engagementState = await workshopApi.setProjectEngagement(
            project.id,
            'like',
            !engagementState.user_liked,
          );
          renderEngagement();
        });
        favoriteButton = button('', 'rw-engagement-button', async () => {
          engagementState = await workshopApi.setProjectEngagement(
            project.id,
            'favorite',
            !engagementState.user_favorited,
          );
          renderEngagement();
        });
        renderEngagement();
        actions.append(likeButton, favoriteButton);
        actions.appendChild(button('举报', 'rw-secondary-action', async () => {
          const report = promptProjectReport(host);
          if (!report) return;
          await workshopApi.reportProject(project.id, report.reason, report.details);
          try { host.toastr?.success?.('举报已提交，管理员会进行人工处理', '创意工坊'); } catch {}
        }));
      }
      modal.body.appendChild(actions);
      modal.body.appendChild(docDetails(detail.manifest));
    } catch (error) {
      empty(modal.body, `加载失败：${error.message}`);
      notifyError(error);
    }
  }

  function docDetails(manifest) {
    const details = element('details', 'rw-technical-details');
    const summary = element('summary', '', '查看技术清单');
    const pre = element('pre', 'rw-detail');
    pre.textContent = JSON.stringify(manifest, null, 2);
    details.append(summary, pre);
    return details;
  }

  return {
    refresh: () => loadPage({ append: false }),
    loadMore: () => loadPage({ append: true }),
    showDetail,
  };
}
