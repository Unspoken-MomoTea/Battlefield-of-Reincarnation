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
  function projectCard(project) {
    const card = element('article', 'rw-card rw-project-card');
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

    const top = element('div', 'rw-project-card-top');
    top.appendChild(element('h3', '', project.name));
    if (project.owner_name) top.appendChild(element('div', 'rw-project-author', project.owner_name));
    card.appendChild(top);

    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', categoryLabels[project.category] || project.category));
    meta.append(element('span', 'rw-pill', `v${project.version}`));
    for (const tag of (project.tags || []).slice(0, 3)) meta.append(element('span', 'rw-pill', `#${tag}`));
    card.appendChild(meta);

    const summary = element('div', 'rw-muted rw-project-summary', project.summary || '暂无简介');
    card.appendChild(summary);

    const footer = element('div', 'rw-project-footer');
    const stats = element('div', 'rw-project-stats');
    stats.append(
      element('span', '', `↓ ${project.downloads_count || 0}`),
      element('span', '', `♥ ${project.likes_count || 0}`),
      element('span', '', `★ ${project.favorites_count || 0}`),
    );
    footer.appendChild(stats);
    footer.appendChild(button('下载', 'primary', async () => {
      const cached = await projectService.cache(project.id);
      try { host.toastr?.success?.(`已缓存 ${cached.name} v${cached.version}`, '创意工坊'); } catch {}
    }));
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

  async function refreshDiscover() {
    empty(nodes.discoverList, '正在加载作品...');
    try {
      const result = await projectService.list(nodes.search.value, nodes.category.value, 0, nodes.tag.value);
      if (!result.items.length) return empty(nodes.discoverList, '暂时没有符合条件的已发布作品');
      nodes.discoverList.replaceChildren(...result.items.map(projectCard));
    } catch (error) {
      empty(nodes.discoverList, `加载失败：${error.message}`);
    }
  }

  async function showDetail(projectId) {
    const modal = openModal('作品详情', { wide: true });
    empty(modal.body, '正在加载作品详情...');

    try {
      const detail = await projectService.detail(projectId);
      const project = detail.project;
      modal.body.replaceChildren();

      if (project.has_cover) {
        const cover = element('img', 'rw-detail-cover');
        cover.src = workshopApi.getProjectCoverUrl(project.id);
        cover.alt = `${project.name} 封面`;
        modal.body.appendChild(cover);
      }

      const heading = element('div', 'rw-detail-heading');
      heading.append(
        element('h3', '', project.name),
        element('div', 'rw-project-author', project.owner_name ? `作者 · ${project.owner_name}` : ''),
      );
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
        const list = element(
          'div',
          'rw-muted',
          project.dependencies.map(item => `${item.project_id}@${item.min_version}`).join('、'),
        );
        dependencies.appendChild(list);
        modal.body.appendChild(dependencies);
      }

      const actions = element('div', 'rw-row rw-detail-actions');
      actions.appendChild(button('下载到本地', 'primary', async () => {
        const cached = await projectService.cache(project.id);
        try { host.toastr?.success?.(`已缓存 ${cached.name} v${cached.version}`, '创意工坊'); } catch {}
      }));

      if (getAuth()?.user) {
        actions.appendChild(button('点赞', '', async () => {
          const state = await workshopApi.getProjectEngagement(project.id);
          await workshopApi.setProjectEngagement(project.id, 'like', !state.user_liked);
          try { host.toastr?.success?.(state.user_liked ? '已取消点赞' : '已点赞', '创意工坊'); } catch {}
          await refreshDiscover();
        }));
        actions.appendChild(button('收藏', '', async () => {
          const state = await workshopApi.getProjectEngagement(project.id);
          await workshopApi.setProjectEngagement(project.id, 'favorite', !state.user_favorited);
          try { host.toastr?.success?.(state.user_favorited ? '已取消收藏' : '已收藏', '创意工坊'); } catch {}
          await refreshDiscover();
        }));
        actions.appendChild(button('举报', '', async () => {
          const report = promptProjectReport(host);
          if (!report) return;
          await workshopApi.reportProject(project.id, report.reason, report.details);
          try { host.toastr?.success?.('举报已提交，管理员会进行人工处理', '创意工坊'); } catch {}
        }));
      }
      modal.body.appendChild(actions);

      const technical = docDetails(detail.manifest);
      modal.body.appendChild(technical);
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
    refresh: refreshDiscover,
    showDetail,
  };
}
