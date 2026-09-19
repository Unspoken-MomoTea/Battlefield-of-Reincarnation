export function createDiscoverView({
  nodes,
  element,
  button,
  empty,
  projectService,
  workshopApi,
  host,
  categoryLabels,
  getAuth,
}) {
  function projectCard(project) {
    const card = element('article', 'rw-card');
    if (project.has_cover) {
      const cover = element('img', 'rw-cover');
      cover.src = workshopApi.getProjectCoverUrl(project.id);
      cover.alt = `${project.name} 封面`;
      cover.loading = 'lazy';
      card.appendChild(cover);
    }
    card.appendChild(element('h3', '', project.name));
    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', categoryLabels[project.category] || project.category));
    meta.append(element('span', 'rw-pill', `v${project.version}`));
    if (project.owner_name) meta.append(element('span', 'rw-pill', `作者：${project.owner_name}`));
    for (const tag of project.tags || []) meta.append(element('span', 'rw-pill', `#${tag}`));
    meta.append(element('span', 'rw-pill', `↓ ${project.downloads_count || 0}`));
    meta.append(element('span', 'rw-pill', `♥ ${project.likes_count || 0}`));
    meta.append(element('span', 'rw-pill', `★ ${project.favorites_count || 0}`));
    card.appendChild(meta);
    card.appendChild(element('div', 'rw-muted', project.summary || '暂无简介'));
    const actions = element('div', 'rw-row');
    actions.appendChild(button('详情', '', () => showDetail(project.id)));
    actions.appendChild(button('下载到本地', 'primary', async () => {
      const cached = await projectService.cache(project.id);
      try { host.toastr?.success?.(`已缓存 ${cached.name} v${cached.version}`, '创意工坊'); } catch {}
      await refreshDiscover();
    }));
    if (getAuth()?.user) {
      actions.appendChild(button('点赞', '', async () => {
        const state = await workshopApi.getProjectEngagement(project.id);
        await workshopApi.setProjectEngagement(project.id, 'like', !state.user_liked);
        await refreshDiscover();
      }));
      actions.appendChild(button('收藏', '', async () => {
        const state = await workshopApi.getProjectEngagement(project.id);
        await workshopApi.setProjectEngagement(project.id, 'favorite', !state.user_favorited);
        await refreshDiscover();
      }));
    }
    card.appendChild(actions);
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
    const detail = await projectService.detail(projectId);
    nodes.detailTitle.textContent = `${detail.project.name} · v${detail.project.version}`;
    const tags = (detail.project.tags || []).map(tag => `#${tag}`).join(' ');
    nodes.detailSummary.textContent =
      `${detail.project.summary || '暂无简介'}\n` +
      `${tags ? `标签：${tags}\n` : ''}` +
      `下载 ${detail.project.downloads_count || 0} · 点赞 ${detail.project.likes_count || 0} · 收藏 ${detail.project.favorites_count || 0}\n` +
      `更新说明：${detail.changelog || '无'}`;
    nodes.detailManifest.textContent = JSON.stringify(detail.manifest, null, 2);
    nodes.detailCard.hidden = false;
    nodes.detailCard.scrollIntoView({ block: 'nearest' });
  }
  return {
    refresh: refreshDiscover,
    showDetail,
  };
}
