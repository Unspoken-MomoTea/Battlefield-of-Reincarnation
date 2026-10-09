const coin = value => Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString('zh-CN');

function when(value) {
  const date = new Date(Number(value) || 0);
  return Number.isFinite(date.getTime()) && date.getTime() > 0
    ? date.toLocaleString('zh-CN', { hour12: false })
    : '—';
}

export function createAdminMarketView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  host,
  confirmDialog,
}) {
  const userActions = (user, { allowRestore = false } = {}) => {
    const actions = [];
    if (!user?.id) return actions;
    if (allowRestore || user.market_suspended) {
      actions.push(button('恢复市场权限', 'good', async () => {
        await workshopApi.setAdminMarketUserState(user.id, false, '');
        await refresh();
      }));
    } else {
      actions.push(button('冻结市场权限', 'danger', async () => {
        const note = host.prompt?.('请输入冻结原因（必填）', '') ?? '';
        if (!note.trim()) throw new Error('冻结市场权限必须填写原因');
        const ok = await confirmDialog({
          title: '冻结该玩家的空间集市交易权限？',
          message: (user.display_name || '玩家') + ' 将无法继续创建挂单、购买、求购、交换或系统回收；仍可领取和撤回已有资产。',
          confirmText: '冻结',
          danger: true,
        });
        if (!ok) return;
        await workshopApi.setAdminMarketUserState(user.id, true, note.trim());
        await refresh();
      }));
    }
    return actions;
  };

  const card = item => {
    const node = element('article', 'rw-card rw-market-admin-card');
    const view = nodes.adminMarketView?.value || 'listings';

    if (view === 'orders') {
      node.append(element('h3', '', '求购 · ' + item.asset_name));
      const meta = element('div', 'rw-meta');
      meta.append(
        element('span', 'rw-pill', item.quality || '不限品质'),
        element('span', 'rw-pill', coin(item.unit_price) + ' / 件'),
        element('span', 'rw-pill', '剩余 ' + item.remaining_quantity),
        element('span', 'rw-pill', item.status),
      );
      node.append(meta);
      node.append(element('div', 'rw-muted', '买家：' + (item.buyer?.display_name || '—') + '\n到期：' + when(item.expires_at)));
      const actions = element('div', 'rw-row');
      actions.append(...userActions(item.buyer));
      node.append(actions);
      return node;
    }

    if (view === 'swaps') {
      node.append(element('h3', '', '交换 · ' + (item.offered?.name || '资产') + ' ⇄ ' + (item.wanted?.name || '资产')));
      const meta = element('div', 'rw-meta');
      meta.append(
        element('span', 'rw-pill', item.status),
        element('span', 'rw-pill', '提供 ×' + (item.offered?.quantity || 1)),
        element('span', 'rw-pill', '需要 ×' + (item.wanted?.quantity || 1)),
      );
      node.append(meta);
      node.append(element('div', 'rw-muted', '发布者：' + (item.owner?.display_name || '—') + '\n到期：' + when(item.expires_at)));
      const actions = element('div', 'rw-row');
      actions.append(...userActions(item.owner));
      node.append(actions);
      return node;
    }

    node.append(element('h3', '', item.asset?.name || '资产'));
    const meta = element('div', 'rw-meta');
    meta.append(
      element('span', 'rw-pill', item.asset?.kind || '资产'),
      element('span', 'rw-pill', coin(item.unit_price) + ' / 件'),
      element('span', 'rw-pill', '剩余 ' + item.remaining_quantity),
      element('span', 'rw-pill', item.status),
    );
    if (item.risk?.suspicious) meta.append(element('span', 'rw-pill rw-pill--warning', '异常价格'));
    if (item.seller?.market_suspended) meta.append(element('span', 'rw-pill rw-pill--warning', '市场已冻结'));
    node.append(meta);
    node.append(element(
      'div',
      'rw-muted',
      '卖家：' + (item.seller?.display_name || '—')
        + '\n创建：' + when(item.created_at)
        + '\n到期：' + when(item.expires_at)
        + (item.risk?.reasons?.length ? '\n风险：' + item.risk.reasons.join('；') : ''),
    ));

    const actions = element('div', 'rw-row');
    if (item.status === 'active' && Number(item.remaining_quantity || 0) > 0) {
      actions.append(button('强制下架', 'danger', async () => {
        const ok = await confirmDialog({
          title: '强制下架该挂单？',
          message: '剩余资产会进入卖家的待返还队列，不会直接销毁。',
          confirmText: '强制下架',
          danger: true,
        });
        if (!ok) return;
        await workshopApi.cancelAdminMarketListing(item.id);
        await refresh();
      }));
    }
    actions.append(...userActions(item.seller, { allowRestore: Boolean(item.seller?.market_suspended) }));
    node.append(actions);
    return node;
  };

  async function refresh() {
    try {
      const result = await workshopApi.listAdminMarket({
        view: nodes.adminMarketView?.value || 'listings',
        query: nodes.adminMarketSearch?.value || '',
        status: nodes.adminMarketStatus?.value || '',
        risk: Boolean(nodes.adminMarketRisk?.checked),
      });
      const items = result?.items || [];
      if (!items.length) {
        empty(nodes.adminMarketList, '没有符合条件的市场记录');
        return;
      }
      nodes.adminMarketList.replaceChildren(...items.map(card));
    } catch (error) {
      empty(nodes.adminMarketList, '市场管理加载失败：' + error.message);
    }
  }

  return { refresh };
}
