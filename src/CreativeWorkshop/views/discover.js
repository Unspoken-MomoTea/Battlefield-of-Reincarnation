export function createDiscoverView({
  nodes,
  element,
  button,
  empty,
  projectService,
  host,
  categoryLabels,
}) {
  function projectCard(project) {
    const card = element('article', 'rw-card');
    card.appendChild(element('h3', '', project.name));
    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', categoryLabels[project.category] || project.category));
    meta.append(element('span', 'rw-pill', `v${project.version}`));
    if (project.owner_name) meta.append(element('span', 'rw-pill', `作者：${project.owner_name}`));
    card.appendChild(meta);
    card.appendChild(element('div', 'rw-muted', project.summary || '暂无简介'));
    const actions = element('div', 'rw-row');
    actions.appendChild(button('详情', '', () => showDetail(project.id)));
    actions.appendChild(button('下载到本地', 'primary', async () => {
      const cached = await projectService.cache(project.id);
      try { host.toastr?.success?.(`已缓存 ${cached.name} v${cached.version}`, '创意工坊'); } catch {}
    }));
    card.appendChild(actions);
    return card;
  }

  async function refreshDiscover() {
    empty(nodes.discoverList, '正在加载作品...');
    try {
      const result = await projectService.list(nodes.search.value, nodes.category.value, 0);
      if (!result.items.length) return empty(nodes.discoverList, '暂时没有符合条件的已发布作品');
      nodes.discoverList.replaceChildren(...result.items.map(projectCard));
    } catch (error) {
      empty(nodes.discoverList, `加载失败：${error.message}`);
    }
  }

  async function showDetail(projectId) {
    const detail = await projectService.detail(projectId);
    nodes.detailTitle.textContent = `${detail.project.name} · v${detail.project.version}`;
    nodes.detailSummary.textContent = `${detail.project.summary || '暂无简介'}\n更新说明：${detail.changelog || '无'}`;
    nodes.detailManifest.textContent = JSON.stringify(detail.manifest, null, 2);
    nodes.detailCard.hidden = false;
    nodes.detailCard.scrollIntoView({ block: 'nearest' });
  }
  return {
    refresh: refreshDiscover,
    showDetail,
  };
}
