import { MARKET_KIND_LABELS } from '../services/market-service.js';

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const coin = value => Math.max(0, Math.trunc(num(value))).toLocaleString('zh-CN');
const quality = asset => String(asset?.data?.品质 || asset?.data?.层级 || asset?.data?.等级 || '').trim();
const when = value => {
  const date = new Date(Number(value) || 0);
  return Number.isFinite(date.getTime()) && date.getTime() > 0
    ? date.toLocaleString('zh-CN', { hour12: false })
    : '—';
};
const summary = asset => String(
  asset?.data?.描述 || asset?.data?.说明 || asset?.data?.简介 || '',
).trim().slice(0, 160);

export function createMarketView({
  nodes, element, button, empty, notifyError, confirmDialog, openModal,
  host, doc, marketService, getAuth,
}) {
  let items = [];
  let nextOffset = null;
  let loading = false;

  const requireLogin = () => {
    if (!getAuth()?.user) throw new Error('请先登录 Discord 后再进行空间集市交易');
  };

  const detail = asset => {
    const box = element('div', 'rw-market-detail');
    const rows = [
      ['类型', MARKET_KIND_LABELS[asset?.kind] || '资产'],
      ['名称', asset?.name || '未命名'],
      ['品质 / 层级', quality(asset) || '未标注'],
      ['数量', String(asset?.quantity || 1)],
    ];
    for (const entry of rows) {
      const row = element('div', 'rw-market-detail-row');
      row.append(element('span', '', entry[0]), element('strong', '', entry[1]));
      box.append(row);
    }
    const copy = summary(asset);
    if (copy) box.append(element('p', 'rw-market-card-copy', copy));
    const more = element('details', 'rw-market-json');
    more.append(element('summary', '', '查看完整资产数据'));
    const pre = element('pre');
    pre.textContent = JSON.stringify(asset?.data || {}, null, 2);
    more.append(pre);
    box.append(more);
    return box;
  };

  const card = listing => {
    const node = element('article', 'rw-market-card');
    const top = element('div', 'rw-market-card-head');
    const badges = element('div', 'rw-market-badges');
    badges.append(element('span', 'rw-market-kind', MARKET_KIND_LABELS[listing.asset?.kind] || '资产'));
    if (quality(listing.asset)) badges.append(element('span', 'rw-market-quality', quality(listing.asset)));
    top.append(badges, element('span', 'rw-market-qty', '剩余 ' + listing.remaining_quantity));

    node.append(
      top,
      element('h3', '', listing.asset?.name || '未命名资产'),
      element('p', 'rw-market-card-copy', summary(listing.asset) || '卖家未提供额外说明'),
      element('div', 'rw-market-card-meta', '卖家 · ' + (listing.seller?.display_name || listing.seller?.username || '匿名轮回者')),
    );

    const foot = element('div', 'rw-market-card-foot');
    const price = element('div', 'rw-market-price');
    price.append(element('strong', '', coin(listing.unit_price)), element('span', '', ' 空间币 / 件'));
    const mine = Number(getAuth()?.user?.id) === Number(listing.seller?.id);
    foot.append(price, button(mine ? '我的挂单' : '购买', mine ? '' : 'primary', async () => {
      if (mine) return openMine();
      return openBuy(listing);
    }));
    node.append(foot);
    return node;
  };

  const render = () => {
    if (!items.length) empty(nodes.marketList, '当前没有符合条件的挂单。');
    else nodes.marketList.replaceChildren(...items.map(card));
    nodes.marketCount.textContent = items.length + ' 个挂单';
    nodes.marketMore.hidden = nextOffset == null;
  };

  async function refresh({ append = false } = {}) {
    if (loading) return;
    loading = true;
    try {
      if (!append) empty(nodes.marketList, '正在读取空间集市…');
      const offset = append && nextOffset != null ? nextOffset : 0;
      const page = await marketService.list({
        query: nodes.marketSearch.value,
        kind: nodes.marketKind.value,
        sort: nodes.marketSort.value,
        offset,
        limit: 24,
      });
      items = append ? items.concat(page.items || []) : (page.items || []);
      nextOffset = page.next_offset ?? null;
      render();
      await refreshSummary();
    } finally {
      loading = false;
    }
  }

  async function refreshSummary() {
    const cells = [];
    try {
      const local = await marketService.inventory();
      cells.push(['当前空间币', coin(local.coin)]);
      cells.push(['可交易资产', String(local.assets.length)]);
      cells.push(['交易区域', local.inHub ? '主神空间 · 可交易' : '任务世界 · 仅浏览']);
    } catch {
      cells.push(['当前存档', '未读取 MVU']);
    }
    if (getAuth()?.user) {
      try {
        const mine = await marketService.mine();
        cells.push(['待领货款', coin(mine.wallet?.balance)]);
        cells.push([
          '待恢复事务',
          String((mine.pending_deliveries?.length || 0) + (mine.pending_returns?.length || 0) + (mine.pending_payouts?.length || 0)),
        ]);
      } catch {}
    }
    nodes.marketSummary.replaceChildren(...cells.map(entry => {
      const cell = element('div', 'rw-market-stat');
      cell.append(element('span', '', entry[0]), element('strong', '', entry[1]));
      return cell;
    }));
  }

  async function openBuy(listing) {
    requireLogin();
    const modal = openModal('购买 · ' + (listing.asset?.name || '资产'), { wide: true });
    modal.body.append(detail({ ...listing.asset, quantity: listing.remaining_quantity }));

    const field = element('label', 'rw-field');
    field.append(element('span', '', '购买数量'));
    const qty = element('input', 'rw-input');
    qty.type = 'number';
    qty.min = '1';
    qty.max = String(Math.max(1, Number(listing.remaining_quantity) || 1));
    qty.step = '1';
    qty.value = '1';
    qty.disabled = listing.asset?.kind !== 'item';
    field.append(qty);

    const total = element('div', 'rw-market-total');
    const syncTotal = () => {
      const amount = listing.asset?.kind === 'item'
        ? Math.max(1, Math.min(Number(qty.max), Math.floor(Number(qty.value) || 1)))
        : 1;
      qty.value = String(amount);
      total.textContent = '合计：' + coin(Number(listing.unit_price) * amount) + ' 空间币';
    };
    qty.addEventListener('input', syncTotal);
    syncTotal();

    const notice = element('p', 'rw-market-notice',
      '购买会先从当前存档扣除空间币，再由服务器锁定挂单；写回失败的资产会保留在“我的交易”中等待再次领取。');
    const actions = element('div', 'rw-page-actions');
    actions.append(button('确认购买', 'primary', async () => {
      const amount = listing.asset?.kind === 'item' ? Number(qty.value) : 1;
      const ok = await confirmDialog({
        title: '确认空间集市交易',
        message: '购买“' + listing.asset?.name + '” ×' + amount + '，支付 ' + coin(Number(listing.unit_price) * amount) + ' 空间币？',
        confirmText: '确认购买',
      });
      if (!ok) return;
      await marketService.buy(listing, amount);
      try { host.toastr?.success?.('交易完成，资产已写入当前存档', '空间集市'); } catch {}
      modal.close({ force: true });
      await refresh();
    }));
    modal.body.append(field, total, notice, actions);
  }

  async function openSell() {
    requireLogin();
    const local = await marketService.inventory();
    if (!local.inHub) throw new Error('请回到主神空间后再上架资产');
    if (!local.assets.length) throw new Error('当前角色没有可上架的装备、道具或技能');

    const modal = openModal('上架资产 · 空间集市', { wide: true, confirmDiscard: true });
    const selectField = element('label', 'rw-field');
    selectField.append(element('span', '', '选择资产'));
    const select = element('select', 'rw-select');
    local.assets.forEach((asset, index) => {
      const option = doc.createElement('option');
      option.value = String(index);
      option.textContent = MARKET_KIND_LABELS[asset.kind] + ' · ' + asset.name
        + (asset.quality ? ' · ' + asset.quality : '')
        + (asset.kind === 'item' ? ' ×' + asset.quantity : '');
      select.append(option);
    });
    selectField.append(select);

    const qtyField = element('label', 'rw-field');
    qtyField.append(element('span', '', '上架数量'));
    const qty = element('input', 'rw-input');
    qty.type = 'number';
    qty.min = '1';
    qty.step = '1';
    qty.value = '1';
    qtyField.append(qty);

    const priceField = element('label', 'rw-field');
    priceField.append(element('span', '', '单价 · 空间币'));
    const price = element('input', 'rw-input');
    price.type = 'number';
    price.min = '1';
    price.max = '1000000000';
    price.required = true;
    price.placeholder = '例如 500';
    priceField.append(price);

    const preview = element('div', 'rw-market-sell-preview');
    const selected = () => local.assets[Math.max(0, Number(select.value) || 0)];
    const sync = () => {
      const asset = selected();
      const max = asset.kind === 'item' ? asset.quantity : 1;
      qty.max = String(max);
      qty.disabled = asset.kind !== 'item';
      qty.value = String(Math.max(1, Math.min(max, Math.floor(Number(qty.value) || 1))));
      preview.replaceChildren(detail({ ...asset, quantity: Number(qty.value) }));
    };
    select.addEventListener('change', sync);
    qty.addEventListener('input', sync);
    sync();

    const warning = element('p', 'rw-market-notice warning',
      '测试版说明：商品属于玩家本地存档资产，不作为官方防作弊认证。上架成功后，资产会从当前存档移出。');
    const actions = element('div', 'rw-page-actions');
    actions.append(button('确认上架', 'primary', async () => {
      const asset = selected();
      const amount = asset.kind === 'item' ? Math.floor(Number(qty.value) || 1) : 1;
      const unitPrice = Math.floor(Number(price.value) || 0);
      if (unitPrice <= 0) throw new Error('请输入有效的空间币单价');
      const ok = await confirmDialog({
        title: '确认上架',
        message: '将“' + asset.name + '” ×' + amount + ' 移入空间集市，单价 ' + coin(unitPrice) + ' 空间币？',
        confirmText: '确认上架',
      });
      if (!ok) return;
      await marketService.sell({
        kind: asset.kind,
        key: asset.key,
        name: asset.name,
        quantity: amount,
        unitPrice,
      });
      modal.markClean();
      modal.close({ force: true });
      try { host.toastr?.success?.('资产已上架空间集市', '空间集市'); } catch {}
      await refresh();
    }));

    modal.body.append(selectField, qtyField, priceField, preview, warning, actions);
  }

  const txRow = (title, meta, actions = []) => {
    const row = element('div', 'rw-market-tx-row');
    const copy = element('div', 'rw-market-tx-copy');
    copy.append(element('strong', '', title), element('span', '', meta));
    const buttons = element('div', 'rw-market-tx-actions');
    buttons.append(...actions);
    row.append(copy, buttons);
    return row;
  };

  async function openMine() {
    requireLogin();
    const state = await marketService.mine();
    const modal = openModal('我的交易 · 空间集市', { extraWide: true });

    const wallet = element('section', 'rw-market-wallet');
    const walletCopy = element('div');
    walletCopy.append(
      element('span', '', '服务器待领货款'),
      element('strong', '', coin(state.wallet?.balance) + ' 空间币'),
    );
    wallet.append(walletCopy);
    if (Number(state.wallet?.balance) > 0) {
      wallet.append(button('领取到当前存档', 'primary', async () => {
        await marketService.claimProceeds();
        modal.close({ force: true });
        try { host.toastr?.success?.('货款已写入当前存档', '空间集市'); } catch {}
        await openMine();
        await refreshSummary();
      }));
    }

    const recovery = element('section', 'rw-market-mine-section');
    recovery.append(element('h3', '', '待恢复 / 待领取'));
    let recoveryCount = 0;
    for (const trade of state.pending_deliveries || []) {
      recoveryCount += 1;
      recovery.append(txRow(
        '待领取 · ' + (trade.asset?.name || '资产') + ' ×' + (trade.quantity || 1),
        coin(trade.total_price) + ' 空间币 · ' + when(trade.created_at),
        [button('写入当前存档', 'primary', async () => {
          await marketService.deliverTrade(trade);
          modal.close({ force: true });
          await openMine();
        })],
      ));
    }
    for (const returned of state.pending_returns || []) {
      recoveryCount += 1;
      recovery.append(txRow(
        '撤回返还 · ' + (returned.asset?.name || '资产') + ' ×' + (returned.quantity || 1),
        when(returned.created_at),
        [button('返还当前存档', 'primary', async () => {
          await marketService.receiveReturn(returned);
          modal.close({ force: true });
          await openMine();
        })],
      ));
    }
    for (const payout of state.pending_payouts || []) {
      recoveryCount += 1;
      recovery.append(txRow(
        '待写入货款 · ' + coin(payout.amount) + ' 空间币',
        when(payout.created_at),
        [button('写入当前存档', 'primary', async () => {
          await marketService.receivePayout(payout);
          modal.close({ force: true });
          await openMine();
          await refreshSummary();
        })],
      ));
    }
    if (!recoveryCount) recovery.append(element('p', 'rw-muted', '没有待恢复事务。'));

    const listings = element('section', 'rw-market-mine-section');
    listings.append(element('h3', '', '我的挂单'));
    const active = (state.listings || []).filter(value => value.status === 'active');
    if (!active.length) listings.append(element('p', 'rw-muted', '当前没有在售挂单。'));
    for (const listing of active) {
      listings.append(txRow(
        (listing.asset?.name || '资产') + ' · 剩余 ' + listing.remaining_quantity,
        coin(listing.unit_price) + ' 空间币 / 件',
        [button('撤回', 'danger', async () => {
          const ok = await confirmDialog({
            title: '撤回挂单',
            message: '撤回“' + listing.asset?.name + '”剩余 ' + listing.remaining_quantity + ' 件？',
            confirmText: '撤回',
            danger: true,
          });
          if (!ok) return;
          await marketService.cancel(listing.id);
          modal.close({ force: true });
          await openMine();
          await refresh();
        })],
      ));
    }

    const history = element('section', 'rw-market-mine-section');
    history.append(element('h3', '', '最近成交'));
    const records = []
      .concat((state.purchases || []).map(value => ({ ...value, side: '买入' })))
      .concat((state.sales || []).map(value => ({ ...value, side: '卖出' })))
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .slice(0, 30);
    if (!records.length) history.append(element('p', 'rw-muted', '还没有成交记录。'));
    for (const trade of records) {
      history.append(txRow(
        trade.side + ' · ' + (trade.asset?.name || '资产') + ' ×' + (trade.quantity || 1),
        coin(trade.total_price) + ' 空间币 · ' + when(trade.created_at),
      ));
    }

    modal.body.append(wallet, recovery, listings, history);
  }

  nodes.marketSearchButton?.addEventListener('click', () => void refresh().catch(notifyError));
  nodes.marketSearch?.addEventListener('keydown', event => {
    if (event.key === 'Enter') void refresh().catch(notifyError);
  });
  nodes.marketKind?.addEventListener('change', () => void refresh().catch(notifyError));
  nodes.marketSort?.addEventListener('change', () => void refresh().catch(notifyError));
  nodes.marketMore?.addEventListener('click', () => void refresh({ append: true }).catch(notifyError));
  nodes.marketSell?.addEventListener('click', () => void openSell().catch(notifyError));
  nodes.marketMine?.addEventListener('click', () => void openMine().catch(notifyError));

  return { refresh, openSell, openMine };
}
