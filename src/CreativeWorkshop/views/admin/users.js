export function createAdminUsersView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  host,
  confirmDialog,
}) {
  function formatTime(seconds) {
    if (!seconds) return '—';
    return new Date(Number(seconds) * 1000).toLocaleString();
  }

  async function refreshUsers() {
    try {
      const result = await workshopApi.listAdminUsers({
        query: nodes.userSearch.value,
        banned: nodes.userBanned.value,
      });
      if (!result.items.length) return empty(nodes.userList, '没有符合条件的用户');

      const cards = result.items.map(item => {
        const card = element('article', 'rw-card');
        card.appendChild(element('h3', '', item.display_name || item.username));

        const meta = element('div', 'rw-meta');
        meta.append(element('span', 'rw-pill', `Discord: ${item.discord_id}`));
        meta.append(element('span', 'rw-pill', `作品 ${item.project_count || 0}`));
        if (item.is_admin) meta.append(element('span', 'rw-pill', '主管理员'));
        else if (item.is_moderator) meta.append(element('span', 'rw-pill', '审核员'));
        if (item.is_banned) meta.append(element('span', 'rw-pill', '已封禁'));
        card.appendChild(meta);

        card.appendChild(
          element(
            'div',
            'rw-muted',
            `用户名：${item.username}\n` +
              `注册：${formatTime(item.created_at)} · 最近更新：${formatTime(item.updated_at)}` +
              (item.is_banned ? `\n封禁时间：${formatTime(item.banned_at)}\n原因：${item.ban_reason || '无'}` : ''),
          ),
        );

        const actions = element('div', 'rw-row');
        if (!item.is_admin) {
          actions.appendChild(button(item.is_moderator ? '取消审核员' : '设为审核员', item.is_moderator ? '' : 'good', async () => {
            const next = !item.is_moderator;
            const confirmed = await confirmDialog({
              title: next ? '设为审核员？' : '取消审核员？',
              message: next
                ? '审核员可以审核作品、查看作者更新和处理举报，但不能管理用户、审核员或审计日志。'
                : '取消后该用户将失去工坊管理后台权限。',
              confirmText: next ? '设为审核员' : '取消审核员',
              cancelText: '取消',
            });
            if (!confirmed) return;
            await workshopApi.setUserModerator(item.id, next);
            await refreshUsers();
          }));
          if (item.is_banned) {
            actions.appendChild(button('解除封禁', 'good', async () => {
              const confirmed = await confirmDialog({
                title: '解除用户封禁？',
                message: `用户：${item.display_name || item.username}`,
                confirmText: '解除封禁',
                cancelText: '取消',
              });
              if (!confirmed) return;
              await workshopApi.setUserBan(item.id, false, '');
              await refreshUsers();
            }));
          } else {
            actions.appendChild(button('封禁用户', 'danger', async () => {
              const reason = host.prompt?.('请输入封禁原因（必填）', '') ?? '';
              if (!reason.trim()) throw new Error('封禁用户必须填写原因');
              const confirmed = await confirmDialog({
                title: `封禁 ${item.display_name || item.username}？`,
                message: '封禁不会删除历史作品，但会阻止该用户继续使用登录态功能。',
                confirmText: '确认封禁',
                cancelText: '取消',
                danger: true,
              });
              if (!confirmed) return;
              await workshopApi.setUserBan(item.id, true, reason);
              await refreshUsers();
            }));
          }
        }
        card.appendChild(actions);
        return card;
      });
      nodes.userList.replaceChildren(...cards);
    } catch (error) {
      empty(nodes.userList, `加载失败：${error.message}`);
    }
  }

  return { refresh: refreshUsers };
}
