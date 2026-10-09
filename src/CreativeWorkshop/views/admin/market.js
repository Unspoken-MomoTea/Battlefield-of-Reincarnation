function when(value) {
  const time = Number(value || 0);
  return time > 0 ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : '—';
}

function coin(value) {
  return Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString('zh-CN');
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
  async function refresh() {
    if (!nodes.adminMarketContent) return;
    empty(nodes.adminMarketContent, '正在读取市场状态…');
    const result = await workshopApi.listAdminMarket(nodes.adminMarketSearch?.value || '');

    const wrap = element('div', 'rw-admin-market-wrap');

    const suspicious = element('section', 'rw-admin-market-section');
    suspicious.append(element('h3', '', '异常成交'));
    if (!result.suspicious_trades?.length) {
      suspicious.append(element('div', 'rw-muted', '当前没有命中高价异常规则的成交。'));
    } else {
      for (const trade of result.suspicious_trades) {
        const card = element('article', 'rw-card');
        card.append(
          element('strong', '', (trade.asset?.name || '资产') + ' · ' + coin(trade.unit_price) + ' / 件'),
          element(
            'div',
            'rw-muted',
            '卖家：' + trade.seller.display_name
              + ' · 买家：' + trade.buyer.display_name
              + ' · ' + trade.risk.reason
              + ' · ' + when(trade.created_at),
          ),
        );
        const actions = element('div', 'rw-row');
        actions.append(
          button('冻结卖家市场权限', 'danger', async () => {
            const reason = host.prompt?.('请输入市场冻结原因', trade.risk.reason || '异常交易人工冻结') || '';
            if (!reason.trim()) throw new Error('冻结市场权限必须填写原因');
            const ok = await confirmDialog({
              title: '冻结该用户的空间集市交易权限？',
              message: trade.seller.display_name + ' 将不能继续上架、购买、求购或交换，但不会影响工坊其他功能。',
              confirmText: '冻结市场',
              danger: true,
            });
            if (!ok) return;
            await workshopApi.setMarketUserBlock(trade.seller.id, true, reason);
            await refresh();
          }),
        );
        card.append(actions);
        suspicious.append(card);
      }
    }
    wrap.append(suspicious);

    const listings = element('section', 'rw-admin-market-section');
    listings.append(element('h3', '', '有效挂单'));
    if (!result.listings?.length) {
      listings.append(element('div', 'rw-muted', '当前没有有效挂单。'));
    } else {
      for (const listing of result.listings) {
        const row = element('article', 'rw-card');
        row.append(
          element('strong', '', listing.asset?.name || '资产'),
          element(
            'div',
            'rw-muted',
            '卖家：' + listing.seller.display_name
              + ' · 剩余 ' + listing.remaining_quantity
              + ' · 单价 ' + coin(listing.unit_price)
              + ' · ' + when(listing.created_at),
          ),
        );
        row.append(
          button('强制下架并返还', 'danger', async () => {
            const note = host.prompt?.('处理备注（可选）', '') || '';
            const ok = await confirmDialog({
              title: '强制下架该挂单？',
              message: '剩余资产会进入卖家的待返还队列，不会直接销毁。',
              confirmText: '强制下架',
              danger: true,
            });
            if (!ok) return;
            await workshopApi.forceCancelMarketListing(listing.id, note);
            await refresh();
          }),
        );
        listings.append(row);
      }
    }
    wrap.append(listings);

    const blocks = element('section', 'rw-admin-market-section');
    blocks.append(element('h3', '', '市场冻结账号'));
    if (!result.blocks?.length) {
      blocks.append(element('div', 'rw-muted', '当前没有单独冻结空间集市权限的用户。'));
    } else {
      for (const item of result.blocks) {
        const row = element('article', 'rw-card');
        row.append(
          element('strong', '', item.display_name),
          element('div', 'rw-muted', (item.reason || '无原因') + ' · ' + when(item.created_at)),
          button('解除市场冻结', 'good', async () => {
            await workshopApi.setMarketUserBlock(item.user_id, false, '');
            await refresh();
          }),
        );
        blocks.append(row);
      }
    }
    wrap.append(blocks);

    const audit = element('section', 'rw-admin-market-section');
    audit.append(element('h3', '', '市场管理记录'));
    if (!result.actions?.length) {
      audit.append(element('div', 'rw-muted', '还没有市场管理操作。'));
    } else {
      for (const action of result.actions.slice(0, 30)) {
        audit.append(element(
          'div',
          'rw-admin-market-audit',
          action.actor + ' · ' + action.action + ' · ' + action.target_type + ':' + action.target_id
            + (action.note ? '\n' + action.note : '')
            + '\n' + when(action.created_at),
        ));
      }
    }
    wrap.append(audit);

    nodes.adminMarketContent.replaceChildren(wrap);
  }

  return { refresh };
}
