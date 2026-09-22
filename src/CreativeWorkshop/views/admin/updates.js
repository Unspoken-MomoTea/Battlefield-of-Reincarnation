export function createAdminUpdatesView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  getAuth,
  categoryLabels,
  showProject,
}) {
  function formatTime(seconds) {
    if (!seconds) return '—';
    return new Date(Number(seconds) * 1000).toLocaleString();
  }

  function updateCard(item) {
    const card = element('article', 'rw-card rw-admin-project-card');
    const head = element('div', 'rw-local-card-head');
    const title = element('div', 'rw-local-titlebox');
    title.append(
      element('h3', '', `${item.name} · v${item.version}`),
      element('div', 'rw-project-author', `${item.owner_name} · Discord ${item.owner_discord_id}`),
    );
    head.append(
      title,
      element('span', 'rw-local-state rw-local-state--update', '作者自助更新'),
    );
    card.appendChild(head);

    const meta = element('div', 'rw-meta');
    meta.append(
      element('span', 'rw-pill', categoryLabels[item.category] || item.category),
      element('span', 'rw-pill', `公开 v${item.published_version}`),
      element('span', 'rw-pill', `更新：${formatTime(item.version_created_at)}`),
    );
    if (item.project_status === 'archived') meta.appendChild(element('span', 'rw-pill', '管理员已下架'));
    if (item.owner_hidden) meta.appendChild(element('span', 'rw-pill rw-pill--warning', '作者已下架'));
    card.appendChild(meta);

    card.appendChild(element(
      'div',
      'rw-muted',
      item.changelog || '作者没有填写版本更新说明。',
    ));

    const actions = element('div', 'rw-local-actions');
    actions.appendChild(button('查看更新内容', 'primary rw-local-primary', () => showProject(item)));
    card.appendChild(actions);
    return card;
  }

  async function refreshUpdates() {
    if (!Number(getAuth()?.user?.is_admin)) return empty(nodes.updateList, '需要管理员权限');
    try {
      const result = await workshopApi.listAdminUpdates();
      if (!result.items.length) {
        return empty(nodes.updateList, '暂无作者自助更新。首次审核通过后的新版本会显示在这里。');
      }
      nodes.updateList.replaceChildren(...result.items.map(updateCard));
    } catch (error) {
      empty(nodes.updateList, `加载失败：${error.message}`);
    }
  }

  return { refresh: refreshUpdates };
}
