export function createAdminReportsView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  host,
  confirmDialog,
}) {
  const reasonLabels = {
    malicious: '恶意内容',
    broken: '内容损坏',
    inappropriate: '不当内容',
    stolen: '疑似盗用',
    other: '其他',
  };

  function formatTime(seconds) {
    if (!seconds) return '—';
    return new Date(Number(seconds) * 1000).toLocaleString();
  }

  async function refreshReports() {
    try {
      const result = await workshopApi.listAdminReports({ status: nodes.reportStatus.value });
      if (!result.items.length) return empty(nodes.reportList, '没有符合条件的举报');

      const cards = result.items.map(item => {
        const card = element('article', 'rw-card');
        card.appendChild(element('h3', '', `${item.project_name} · v${item.project_version}`));

        const meta = element('div', 'rw-meta');
        meta.append(element('span', 'rw-pill', reasonLabels[item.reason] || item.reason));
        meta.append(element('span', 'rw-pill', item.status === 'open' ? '待处理' : item.status === 'resolved' ? '已处理' : '已忽略'));
        if (item.project_status === 'archived') meta.append(element('span', 'rw-pill', '作品已下架'));
        card.appendChild(meta);

        card.appendChild(
          element(
            'div',
            'rw-muted',
            `作品作者：${item.owner_name || '未知'}\n` +
              `举报人：${item.reporter_name || '未知'}（Discord: ${item.reporter_discord_id || '—'}）\n` +
              `举报时间：${formatTime(item.created_at)}\n` +
              `说明：${item.details || '无'}`,
          ),
        );

        if (item.status !== 'open') {
          card.appendChild(
            element(
              'div',
              item.status === 'resolved' ? 'rw-status ok' : 'rw-muted',
              `${item.status === 'resolved' ? '已处理' : '已忽略'} · ${item.resolver_name || '管理员'} · ${item.resolution_note || '无备注'} · ${formatTime(item.resolved_at)}`,
            ),
          );
        }

        const actions = element('div', 'rw-row');
        if (item.status === 'open') {
          actions.appendChild(button('标记已处理', 'good', async () => {
            const note = host.prompt?.('处理备注（可留空）', '') ?? '';
            await workshopApi.resolveProjectReport(item.id, 'resolved', note);
            await refreshReports();
          }));
          actions.appendChild(button('忽略举报', '', async () => {
            const note = host.prompt?.('忽略原因（可留空）', '') ?? '';
            await workshopApi.resolveProjectReport(item.id, 'dismissed', note);
            await refreshReports();
          }));
        }
        if (item.project_status !== 'archived') {
          actions.appendChild(button('下架作品', 'danger', async () => {
            const note = host.prompt?.('下架原因（建议填写）', item.details || '') ?? '';
            const confirmed = await confirmDialog({
              title: '下架被举报作品？',
              message: '下架只影响公开展示，不会删除作品文件和审核记录。',
              confirmText: '确认下架',
              cancelText: '取消',
              danger: true,
            });
            if (!confirmed) return;
            await workshopApi.setAdminProjectState(item.project_id, 'archive', note);
            await refreshReports();
          }));
        }
        card.appendChild(actions);
        return card;
      });
      nodes.reportList.replaceChildren(...cards);
    } catch (error) {
      empty(nodes.reportList, `加载失败：${error.message}`);
    }
  }

  return { refresh: refreshReports };
}
