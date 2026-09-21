import { formatInstallConflicts } from '../ui/install-messages.js';
import { promptProjectReport } from './discover/report.js';
import {
  renderChangePreview,
  renderContentPreview,
  renderVersionHistory,
} from './discover/content-preview.js';

export function createDiscoverView({
  nodes,
  element,
  button,
  empty,
  projectService,
  workshopApi,
  host,
  doc,
  categoryLabels,
  artifactLabels,
  getAuth,
  openModal,
  confirmDialog,
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
      const confirmed = await confirmDialog({
        title: '安装前发现冲突',
        message: formatInstallConflicts(preflight.warnings),
        confirmText: '继续安装',
        cancelText: '取消',
      });
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

  function detailFact(label, value) {
    const fact = element('div', 'rw-workshop-fact');
    fact.append(
      element('span', '', label),
      element('strong', '', value),
    );
    return fact;
  }

  function formatPublishedTime(seconds) {
    const value = Number(seconds || 0);
    return value ? new Date(value * 1000).toLocaleString() : '—';
  }

  function protectedTargets(artifacts) {
    const worldbooks = [];
    const scripts = [];
    for (const artifact of artifacts || []) {
      for (const conflict of artifact.original_conflicts || []) {
        const target = conflict.target || {};
        if (artifact.kind === 'worldbook') {
          worldbooks.push({
            name: target.name || (target.uid ? `UID ${target.uid}` : '未命名条目'),
            meta: [
              target.worldbook ? `世界书：${target.worldbook}` : '',
              target.uid ? `UID：${target.uid}` : '',
              artifact.name ? `由：${artifact.name}` : '',
            ].filter(Boolean).join(' · '),
          });
        }
        if (artifact.kind === 'script') {
          scripts.push({
            name: target.folder ? `${target.folder} / ${target.name || target.id || '未命名脚本'}` : (target.name || target.id || '未命名脚本'),
            meta: [
              ({ character: '当前角色', preset: '当前预设', global: '全局' })[target.scope] || target.scope || '',
              target.id ? `ID：${target.id}` : '',
              artifact.name ? `由：${artifact.name}` : '',
            ].filter(Boolean).join(' · '),
          });
        }
      }
    }
    return { worldbooks, scripts };
  }

  function renderProtectedTargets(artifacts) {
    const targets = protectedTargets(artifacts);
    if (!targets.worldbooks.length && !targets.scripts.length) return null;

    const section = element('section', 'rw-workshop-rail-section rw-workshop-protected');
    section.appendChild(element('div', 'rw-workshop-rail-label', '原版替换 / 屏蔽'));
    section.appendChild(element(
      'div',
      'rw-workshop-protected-note',
      '安装后这些原版内容会临时关闭；停用作品时按安装前状态恢复。',
    ));

    for (const item of targets.worldbooks) {
      const row = element('div', 'rw-workshop-protected-row');
      row.append(
        element('span', 'rw-workshop-protected-icon', '书'),
        element('div', 'rw-workshop-protected-copy'),
      );
      row.lastElementChild.append(
        element('strong', '', item.name),
        element('small', '', item.meta),
      );
      section.appendChild(row);
    }
    for (const item of targets.scripts) {
      const row = element('div', 'rw-workshop-protected-row');
      row.append(
        element('span', 'rw-workshop-protected-icon script', 'JS'),
        element('div', 'rw-workshop-protected-copy'),
      );
      row.lastElementChild.append(
        element('strong', '', item.name),
        element('small', '', item.meta),
      );
      section.appendChild(row);
    }
    return section;
  }

  async function showDetail(projectId) {
    const modal = openModal('作品详情', { extraWide: true });
    empty(modal.body, '正在加载作品详情...');

    try {
      const [detail] = await Promise.all([
        projectService.detail(projectId),
        syncLocalProjects(),
      ]);
      const project = detail.project;
      const signedIn = Boolean(getAuth()?.user);
      let engagementState = {
        likes_count: Number(project.likes_count || 0),
        favorites_count: Number(project.favorites_count || 0),
        downloads_count: Number(project.downloads_count || 0),
        user_liked: false,
        user_favorited: false,
      };
      if (signedIn) {
        try {
          engagementState = {
            ...engagementState,
            ...(await workshopApi.getProjectEngagement(project.id)),
          };
        } catch {}
      }

      modal.body.replaceChildren();

      const shell = element('div', 'rw-workshop-detail-shell');
      const header = element('header', 'rw-workshop-detail-header');
      const headerCopy = element('div', 'rw-workshop-detail-title');
      headerCopy.append(
        element('h2', '', project.name),
        element(
          'div',
          'rw-workshop-detail-identity',
          [project.owner_name ? `作者 · ${project.owner_name}` : '', categoryLabels[project.category] || project.category]
            .filter(Boolean)
            .join(' · '),
        ),
      );
      const headerTags = element('div', 'rw-meta');
      headerTags.append(element('span', 'rw-pill', `v${project.version}`));
      for (const tag of project.tags || []) headerTags.append(element('span', 'rw-pill', `#${tag}`));
      header.append(headerCopy, headerTags);
      shell.appendChild(header);

      const grid = element('div', 'rw-workshop-detail-grid');
      const reading = element('main', 'rw-workshop-reading');
      const rail = element('aside', 'rw-workshop-rail');

      if (project.has_cover) {
        const cover = element('img', 'rw-workshop-hero');
        cover.src = workshopApi.getProjectCoverUrl(project.id);
        cover.alt = `${project.name} 封面`;
        reading.appendChild(cover);
      }

      const overview = element('section', 'rw-detail-content-section rw-workshop-overview');
      const overviewHeading = element('div', 'rw-detail-content-heading');
      const overviewCopy = element('div', '');
      overviewCopy.append(
        element('strong', '', '简介'),
        element('span', '', '作者提供的作品说明'),
      );
      overviewHeading.appendChild(overviewCopy);
      overview.append(
        overviewHeading,
        element('div', 'rw-detail-description', project.summary || '这个作品暂时没有提供简介。'),
      );
      reading.appendChild(overview);

      reading.appendChild(renderChangePreview(doc, detail.change_preview, detail.changelog || ''));
      reading.appendChild(renderVersionHistory(doc, detail.version_history || []));
      reading.appendChild(renderContentPreview(doc, detail));

      const counts = detail.content_preview?.counts || {};
      const facts = element('section', 'rw-workshop-rail-section');
      facts.appendChild(element('div', 'rw-workshop-rail-label', '项目资料'));
      const factGrid = element('div', 'rw-workshop-facts');
      factGrid.append(
        detailFact('版本', `v${project.version}`),
        detailFact('更新', formatPublishedTime(project.updated_at)),
        detailFact('世界书', `${counts.worldbook_entries || 0} 条`),
        detailFact('正则', `${counts.regex_entries || 0} 条`),
        detailFact('脚本', `${counts.scripts || 0} 项`),
        detailFact('其他', `${(counts.presets || 0) + (counts.data || 0)} 项`),
      );
      facts.appendChild(factGrid);

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

      const actionPanel = element('section', 'rw-workshop-action-panel');
      const installStatus = local?.applied
        ? element('div', 'rw-workshop-install-badge', `✓ 已安装 v${local.appliedVersion || local.version}`)
        : element('div', 'rw-workshop-install-badge muted', local ? `已下载 v${local.version}` : '尚未下载');
      actionPanel.appendChild(installStatus);

      installButton = button('', 'primary rw-install-cta rw-workshop-install-button', async () => {
        local = localProject(project.id);
        if (!local) {
          const cached = await projectService.cache(project.id);
          localProjects.set(project.id, cached);
          local = cached;
          try { host.toastr?.success?.(`已下载 ${cached.name} v${cached.version}，可继续安装`, '创意工坊'); } catch {}
          updateCardLocalState(project);
          installStatus.textContent = `已下载 v${cached.version}`;
          installStatus.classList.add('muted');
          renderInstallButton();
          return;
        }
        if (Number(local.version) < Number(project.version)) {
          if (local.applied) {
            const updated = await projectService.updateLatest(project.id);
            localProjects.set(project.id, updated);
            local = updated;
            try { host.toastr?.success?.(`已一键升级并应用到 v${updated.version}`, project.name); } catch {}
          } else {
            const cached = await projectService.cache(project.id);
            localProjects.set(project.id, cached);
            local = cached;
            try { host.toastr?.success?.(`已下载新版 v${cached.version}`, project.name); } catch {}
          }
          updateCardLocalState(project);
          installStatus.textContent = local.applied
            ? `✓ 已安装 v${local.appliedVersion || local.version}`
            : `已下载 v${local.version}`;
          installStatus.classList.toggle('muted', !local.applied);
          renderInstallButton();
          return;
        }
        if (local.applied && Number(local.appliedVersion || 0) >= Number(local.version)) {
          try { host.toastr?.info?.(`已安装 v${local.appliedVersion}`, project.name); } catch {}
          return;
        }
        await applyCachedProject(project, local, next => {
          local = next;
          installStatus.textContent = `✓ 已安装 v${next.appliedVersion || next.version}`;
          installStatus.classList.remove('muted');
          renderInstallButton();
        });
      });
      renderInstallButton();
      actionPanel.appendChild(installButton);

      const interactionGrid = element('div', 'rw-workshop-interactions');
      const likeButton = button('', 'rw-workshop-interaction', async () => {
        if (!signedIn) {
          try { host.toastr?.info?.('Discord 登录后即可点赞作品', '创意工坊'); } catch {}
          return;
        }
        engagementState = await workshopApi.setProjectEngagement(
          project.id,
          'like',
          !engagementState.user_liked,
        );
        renderEngagement();
      });
      const favoriteButton = button('', 'rw-workshop-interaction', async () => {
        if (!signedIn) {
          try { host.toastr?.info?.('Discord 登录后即可收藏作品', '创意工坊'); } catch {}
          return;
        }
        engagementState = await workshopApi.setProjectEngagement(
          project.id,
          'favorite',
          !engagementState.user_favorited,
        );
        renderEngagement();
      });
      const downloadStat = element('div', 'rw-workshop-interaction rw-workshop-interaction--stat');
      downloadStat.append(
        element('strong', '', String(engagementState.downloads_count || 0)),
        element('span', '', '下载'),
      );

      const renderEngagement = () => {
        likeButton.replaceChildren(
          element('strong', '', `${engagementState.user_liked ? '♥' : '♡'} ${engagementState.likes_count || 0}`),
          element('span', '', engagementState.user_liked ? '已点赞' : '点赞'),
        );
        favoriteButton.replaceChildren(
          element('strong', '', `${engagementState.user_favorited ? '★' : '☆'} ${engagementState.favorites_count || 0}`),
          element('span', '', engagementState.user_favorited ? '已收藏' : '收藏'),
        );
        likeButton.classList.toggle('is-active', Boolean(engagementState.user_liked));
        favoriteButton.classList.toggle('is-active', Boolean(engagementState.user_favorited));
        likeButton.title = signedIn ? '点赞 / 取消点赞' : '登录后可点赞';
        favoriteButton.title = signedIn ? '收藏 / 取消收藏' : '登录后可收藏';
        updateCardEngagement(project.id, engagementState);
      };
      renderEngagement();
      interactionGrid.append(likeButton, favoriteButton, downloadStat);
      actionPanel.appendChild(interactionGrid);

      if (signedIn) {
        actionPanel.appendChild(button('举报这个作品', 'rw-secondary-action rw-workshop-report', async () => {
          const report = promptProjectReport(host);
          if (!report) return;
          await workshopApi.reportProject(project.id, report.reason, report.details);
          try { host.toastr?.success?.('举报已提交，管理员会进行人工处理', '创意工坊'); } catch {}
        }));
      }

      rail.append(actionPanel, facts);

      const artifacts = Array.isArray(detail.manifest?.artifacts) ? detail.manifest.artifacts : [];
      const protection = renderProtectedTargets(artifacts);
      if (protection) rail.appendChild(protection);

      if (project.dependencies?.length) {
        const dependencies = element('section', 'rw-workshop-rail-section');
        dependencies.appendChild(element('div', 'rw-workshop-rail-label', '依赖项目'));
        const list = element('div', 'rw-workshop-dependency-list');
        for (const dependency of project.dependencies) {
          list.appendChild(element(
            'div',
            'rw-workshop-dependency',
            `${dependency.project_id} · 最低 v${dependency.min_version}`,
          ));
        }
        dependencies.appendChild(list);
        rail.appendChild(dependencies);
      }

      const technical = docDetails(detail.manifest);
      technical.classList.add('rw-workshop-rail-section');
      rail.appendChild(technical);

      grid.append(reading, rail);
      shell.appendChild(grid);
      modal.body.appendChild(shell);
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
