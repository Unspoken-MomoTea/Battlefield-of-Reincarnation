import { MARKET_KIND_LABELS } from '../services/market-service.js';
import {
  buildMarketRows,
  filterMarketRows,
  marketAssetFieldDisplay,
  marketPriceLadder,
  planMarketPurchase,
} from './market-model.js';

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const coin = value => Math.max(0, Math.trunc(num(value))).toLocaleString('zh-CN');
const quality = asset => String(
  asset?.quality || asset?.data?.品质 || asset?.data?.层级 || asset?.data?.等级 || '',
).trim();
const when = value => {
  const date = new Date(Number(value) || 0);
  return Number.isFinite(date.getTime()) && date.getTime() > 0
    ? date.toLocaleString('zh-CN', { hour12: false })
    : '—';
};
const until = value => {
  const diff = Number(value || 0) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return '已到期';
  const hours = Math.max(1, Math.ceil(diff / (60 * 60 * 1000)));
  if (hours < 24) return hours + '小时';
  const days = Math.floor(hours / 24);
  const remain = hours % 24;
  return remain ? days + '天' + remain + '小时' : days + '天';
};
export function createMarketView({
  nodes, element, button, empty, notifyError, confirmDialog,
  host, marketService, getAuth,
}) {
  let listings = [];
  let allRows = [];
  let rows = [];
  let loading = false;
  let selectedKey = '';
  let currentKind = '';
  let currentMode = 'browse';
  let sellInventory = null;
  let selectedSellIndex = -1;

  const currentUserId = () => Number(getAuth()?.user?.id || 0);

  const requireLogin = () => {
    const user = getAuth()?.user;
    if (!user) throw new Error('请先登录 Discord 后再进行空间集市交易');
    return user;
  };

  const kindLabel = kind => MARKET_KIND_LABELS[kind] || '资产';

  const dataValue = (value, depth = 0) => {
    if (value == null) return element('span', 'rw-ah-data-value muted', '—');

    if (Array.isArray(value)) {
      const list = element('div', 'rw-ah-data-list');
      if (!value.length) {
        list.append(element('span', 'rw-ah-data-value muted', '—'));
        return list;
      }
      const primitive = value.every(item => item == null || ['string', 'number', 'boolean'].includes(typeof item));
      if (primitive) {
        for (const item of value) {
          list.append(element('span', 'rw-ah-data-chip', item == null ? '—' : String(item)));
        }
        return list;
      }
      value.forEach((item, index) => {
        const row = element('div', 'rw-ah-data-nested');
        row.append(element('span', 'rw-ah-data-key', String(index + 1)), dataValue(item, depth + 1));
        list.append(row);
      });
      return list;
    }

    if (typeof value === 'object') {
      const group = element('div', depth > 0 ? 'rw-ah-data-object nested' : 'rw-ah-data-object');
      const entries = Object.entries(value);
      if (!entries.length) {
        group.append(element('span', 'rw-ah-data-value muted', '—'));
        return group;
      }
      for (const [key, nested] of entries) {
        const row = element('div', 'rw-ah-data-row');
        row.append(element('span', 'rw-ah-data-key', key), dataValue(nested, depth + 1));
        group.append(row);
      }
      return group;
    }

    return element('span', 'rw-ah-data-value', String(value));
  };

  const assetDetail = asset => {
    const box = element('div', 'rw-ah-asset-detail');

    const dataSection = element('section', 'rw-ah-data-section');
    dataSection.append(element('div', 'rw-ah-section-label', '资产数据'));
    const dataBody = element('div', 'rw-ah-data-object');
    const entries = Object.entries(asset?.data || {});
    if (!entries.length) {
      dataBody.append(element('div', 'rw-ah-muted-line', '没有额外资产字段。'));
    } else {
      for (const [key, value] of entries) {
        const row = element('div', 'rw-ah-data-row');
        const displayValue = marketAssetFieldDisplay(asset, key, value);
        row.append(element('span', 'rw-ah-data-key', key), dataValue(displayValue));
        dataBody.append(row);
      }
    }
    dataSection.append(dataBody);
    box.append(dataSection);
    return box;
  };

  const setModeVisuals = () => {
    for (const tab of nodes.marketModes || []) {
      tab.classList.toggle('is-active', tab.dataset.marketMode === currentMode);
    }
    for (const panel of nodes.marketPanels || []) {
      panel.hidden = panel.dataset.marketPanel !== currentMode;
    }
  };

  async function setMode(mode) {
    if (!['browse', 'sell', 'mine'].includes(mode)) return;
    if (mode !== 'browse') requireLogin();
    currentMode = mode;
    setModeVisuals();
    if (!listings.length) await refresh();
    if (mode === 'sell') await renderSellMode();
    if (mode === 'mine') await renderMineMode();
    await refreshSummary();
  }

  const rowIcon = subject => {
    const asset = subject?.asset || subject || {};
    const name = String(subject?.name || asset?.name || '?');
    const icon = element('span', 'rw-ah-item-icon', name.slice(0, 1) || '?');
    const rank = quality(asset).toUpperCase().match(/[A-Z]+/u)?.[0] || '';
    icon.dataset.quality = rank || 'NONE';
    return icon;
  };

  const resultRow = marketRow => {
    const node = element('button', 'rw-ah-result-row');
    node.type = 'button';
    node.classList.toggle('is-selected', selectedKey === marketRow.key);

    const itemCell = element('span', 'rw-ah-result-item');
    const itemCopy = element('span', 'rw-ah-result-item-copy');
    itemCopy.append(
      element('strong', '', marketRow.name),
      element(
        'small',
        '',
        marketRow.kind === 'item'
          ? marketRow.sellerCount + ' 位卖家 · ' + marketRow.listings.length + ' 个价格档'
          : (marketRow.listings[0]?.seller?.display_name || '匿名轮回者'),
      ),
    );
    itemCell.append(rowIcon(marketRow), itemCopy);

    const kindCell = element('span', 'rw-ah-result-kind');
    kindCell.append(element('span', 'rw-ah-type-tag', kindLabel(marketRow.kind)));
    const qualityCell = element('span', 'rw-ah-result-quality', quality(marketRow.asset) || '—');
    const stockCell = element('span', 'rw-ah-result-stock', String(marketRow.totalStock || 0));
    const priceCell = element('span', 'rw-ah-result-price');
    priceCell.append(
      element('strong', '', coin(marketRow.buyPrice ?? marketRow.lowestPrice)),
      element('small', '', ' 空间币'),
    );

    node.append(itemCell, kindCell, qualityCell, stockCell, priceCell);
    node.addEventListener('click', () => {
      selectedKey = marketRow.key;
      renderRows();
      renderInspector(marketRow);
    });
    return node;
  };

  function renderRows() {
    allRows = buildMarketRows(listings, currentUserId());
    for (const category of nodes.marketCategories || []) {
      const kind = category.dataset.marketKind || '';
      const count = kind
        ? listings.filter(listing => listing?.asset?.kind === kind).length
        : listings.length;
      const badge = category.querySelector?.('[data-market-kind-count]');
      if (badge) badge.textContent = String(count);
    }
    rows = filterMarketRows(allRows, {
      kind: currentKind,
      query: nodes.marketSearch?.value || '',
      sort: nodes.marketSort?.value || 'price_asc',
    });
    if (!rows.length) {
      empty(nodes.marketList, '当前没有符合条件的商品。');
      selectedKey = '';
      renderInspector(null);
    } else {
      nodes.marketList.replaceChildren(...rows.map(resultRow));
      const selected = rows.find(row => row.key === selectedKey);
      if (selected) renderInspector(selected);
      else {
        selectedKey = rows[0].key;
        renderInspector(rows[0]);
        nodes.marketList.firstElementChild?.classList.add('is-selected');
      }
    }
    nodes.marketCount.textContent = rows.length + ' 种商品 · 共 ' + listings.length + ' 个挂单';
  }

  function purchaseSummary(marketRow, quantity) {
    try {
      return planMarketPurchase(marketRow, quantity, currentUserId());
    } catch {
      return null;
    }
  }

  function renderInspector(marketRow) {
    if (!nodes.marketInspector) return;
    if (!marketRow) {
      const blank = element('div', 'rw-ah-empty-inspector');
      blank.append(
        element('div', 'rw-ah-empty-icon', '◇'),
        element('strong', '', '选择一个商品'),
        element('span', '', '右侧会显示详情、卖家与购买数量。'),
      );
      nodes.marketInspector.replaceChildren(blank);
      return;
    }

    const wrap = element('div', 'rw-ah-inspector-body');
    const head = element('div', 'rw-ah-detail-head');
    head.append(
      element('div', 'rw-ah-inspector-title', '详情'),
      element('h3', '', marketRow.name),
    );
    wrap.append(head, assetDetail(marketRow.asset));

    if (marketRow.kind === 'item') {
      const ladder = marketPriceLadder(marketRow, currentUserId());
      const box = element('div', 'rw-ah-ladder');
      box.append(element('div', 'rw-ah-section-label', '市场价格'));
      if (!ladder.length) {
        box.append(element('div', 'rw-ah-muted-line', '只有你自己的挂单'));
      } else {
        for (const level of ladder.slice(0, 5)) {
          const line = element('div', 'rw-ah-ladder-row');
          line.append(
            element('span', '', coin(level.price) + ' 空间币'),
            element('span', '', level.stock + ' 件'),
          );
          box.append(line);
        }
      }
      wrap.append(box);
    } else {
      const listing = marketRow.listings[0];
      const seller = element('div', 'rw-ah-seller-line');
      seller.append(
        element('span', '', listing?.is_system ? '系统柜台' : '卖家'),
        element(
          'strong',
          '',
          (listing?.seller?.display_name || listing?.seller?.username || '匿名轮回者')
            + (listing?.is_system ? ' · 每日补货' : (listing?.expires_at ? ' · ' + until(listing.expires_at) + '后到期' : '')),
        ),
      );
      wrap.append(seller);
    }

    const purchase = element('div', 'rw-ah-purchase-box');
    if (marketRow.ownedOnly || marketRow.buyableStock <= 0) {
      purchase.append(
        element('strong', '', '这是你的挂单'),
        element('p', '', '不能购买自己的商品。可以前往“我的拍卖”撤回或查看成交记录。'),
        button('查看我的拍卖', 'primary', () => setMode('mine')),
      );
      wrap.append(purchase);
      nodes.marketInspector.replaceChildren(wrap);
      return;
    }

    const quantityLabel = element('label', 'rw-ah-quantity-field');
    quantityLabel.append(element('span', '', '购买数量'));
    const quantity = element('input', 'rw-input');
    quantity.type = 'number';
    quantity.min = '1';
    quantity.step = '1';
    quantity.max = String(marketRow.kind === 'item' ? marketRow.buyableStock : 1);
    quantity.value = '1';
    quantity.disabled = marketRow.kind !== 'item';
    quantityLabel.append(quantity);

    const total = element('div', 'rw-ah-buy-total');
    const action = button('购买', 'primary', async () => {
      requireLogin();
      const plan = purchaseSummary(marketRow, quantity.value);
      if (!plan) throw new Error('可购买库存不足');

      const local = await marketService.inventory();
      if (Number(local.coin || 0) < plan.total) {
        throw new Error('空间币不足：需要 ' + coin(plan.total) + '，当前只有 ' + coin(local.coin));
      }

      const ok = await confirmDialog({
        title: '确认购买',
        message: '购买“' + marketRow.name + '” ×' + plan.quantity
          + '，合计 ' + coin(plan.total) + ' 空间币？',
        confirmText: '确认购买',
      });
      if (!ok) return;

      for (const line of plan.lines) {
        await marketService.buy(line.listing, line.quantity);
      }
      try { host.toastr?.success?.('购买完成，资产已写入当前存档', '空间集市'); } catch {}
      await refresh();
    });

    const updateTotal = () => {
      const max = Math.max(1, Number(quantity.max) || 1);
      const requested = marketRow.kind === 'item'
        ? Math.max(1, Math.min(max, Math.floor(Number(quantity.value) || 1)))
        : 1;
      quantity.value = String(requested);
      const plan = purchaseSummary(marketRow, requested);
      total.replaceChildren(
        element('span', '', '预计支付'),
        element('strong', '', plan ? coin(plan.total) + ' 空间币' : '库存不足'),
      );
    };
    quantity.addEventListener('input', updateTotal);
    updateTotal();

    purchase.append(
      quantityLabel,
      total,
      action,
      element('small', 'rw-ah-purchase-help', marketRow.kind === 'item'
        ? '系统会从最低价开始自动购买，数量不足时继续匹配下一档价格。'
        : '装备与技能按独立挂单成交。'),
    );
    wrap.append(purchase);
    nodes.marketInspector.replaceChildren(wrap);
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      empty(nodes.marketList, '正在读取空间集市…');
      selectedKey = '';
      listings = await marketService.listAll();
      renderRows();
      await refreshSummary();
    } finally {
      loading = false;
    }
  }

  async function refreshSummary() {
    if (!nodes.marketSummary) return;
    const cells = [];
    try {
      const local = await marketService.inventory();
      cells.push(['空间币', coin(local.coin)]);
      cells.push(['背包资产', String(local.assets.length)]);
      cells.push(['区域', local.inHub ? '主神空间' : '任务世界']);
    } catch {
      cells.push(['当前存档', '未读取']);
    }

    if (getAuth()?.user) {
      try {
        const mine = await marketService.mine();
        cells.push(['待领货款', coin(mine.wallet?.balance)]);
      } catch {}
    }

    nodes.marketSummary.replaceChildren(...cells.map(([label, value]) => {
      const cell = element('div', 'rw-ah-account-cell');
      cell.append(element('span', '', label), element('strong', '', value));
      return cell;
    }));
  }

  const sellRow = (asset, index) => {
    const row = element('button', 'rw-ah-inventory-row');
    row.type = 'button';
    row.classList.toggle('is-selected', selectedSellIndex === index);
    const copy = element('span', 'rw-ah-inventory-copy');
    copy.append(
      element('strong', '', asset.name),
      element('small', '', kindLabel(asset.kind) + (quality(asset) ? ' · ' + quality(asset) : '')),
    );
    row.append(
      rowIcon(asset),
      copy,
      element('span', 'rw-ah-inventory-qty', asset.kind === 'item' ? '×' + asset.quantity : '1'),
    );
    row.addEventListener('click', () => {
      selectedSellIndex = index;
      renderSellList();
      void renderSellEditor(asset).catch(notifyError);
    });
    return row;
  };

  function renderSellList() {
    const assets = sellInventory?.assets || [];
    if (!assets.length) empty(nodes.marketSellList, '当前角色没有可出售资产。');
    else nodes.marketSellList.replaceChildren(...assets.map(sellRow));
    nodes.marketSellCount.textContent = assets.length + ' 项';
  }

  async function renderSellEditor(asset) {
    if (!asset) {
      const blank = element('div', 'rw-ah-empty-inspector');
      blank.append(
        element('div', 'rw-ah-empty-icon', '＋'),
        element('strong', '', '从左侧选择资产'),
        element('span', '', '选择后设置数量与一口价。'),
      );
      nodes.marketSellEditor.replaceChildren(blank);
      return;
    }

    const editor = element('div', 'rw-ah-sell-editor-body');
    const head = element('div', 'rw-ah-inspector-head');
    const headCopy = element('div');
    const tags = element('div', 'rw-ah-inspector-kicker');
    tags.append(
      element('span', 'rw-market-kind', kindLabel(asset.kind)),
      element('span', 'rw-market-quality', quality(asset) || '未标注'),
    );
    headCopy.append(tags, element('h3', '', asset.name));
    head.append(rowIcon(asset), headCopy);
    editor.append(head, assetDetail(asset));

    const referencePrices = listings
      .filter(item => item?.asset?.kind === asset.kind && item?.asset?.name === asset.name)
      .map(item => Number(item.unit_price || 0))
      .filter(value => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);
    const referencePrice = referencePrices[0] || 0;

    const referenceBox = element('div', 'rw-ah-reference-price');
    referenceBox.append(
      element('span', '', '当前市场最低价'),
      element('strong', '', referencePrice ? coin(referencePrice) + ' 空间币' : '暂无同名商品'),
    );
    editor.append(referenceBox);

    if (!sellInventory?.inHub) {
      const block = element('div', 'rw-ah-blocked');
      block.append(
        element('strong', '', '当前只能浏览'),
        element('span', '', '请回到主神空间后再上架资产。'),
      );
      editor.append(block);
      nodes.marketSellEditor.replaceChildren(editor);
      return;
    }

    const auctionLabel = element('div', 'rw-ah-section-label', '拍卖');
    editor.append(auctionLabel);

    const form = element('div', 'rw-ah-sell-form');
    const qtyField = element('label', 'rw-ah-form-field');
    qtyField.append(element('span', '', '数量'));
    const qty = element('input', 'rw-input');
    qty.type = 'number';
    qty.min = '1';
    qty.step = '1';
    qty.max = String(asset.kind === 'item' ? asset.quantity : 1);
    qty.value = '1';
    qty.disabled = asset.kind !== 'item';
    qtyField.append(qty);

    const priceField = element('label', 'rw-ah-form-field');
    priceField.append(element('span', '', '一口价 / 件'));
    const price = element('input', 'rw-input');
    price.type = 'number';
    price.min = '1';
    price.max = '1000000000';
    price.step = '1';
    if (referencePrice) price.value = String(referencePrice);
    price.placeholder = '输入空间币';
    priceField.append(price);

    const durationField = element('label', 'rw-ah-form-field');
    durationField.append(element('span', '', '挂牌时长'));
    const duration = element('select', 'rw-select');
    for (const hours of [24, 48, 72]) {
      const option = element('option', '', hours + ' 小时');
      option.value = String(hours);
      if (hours === 24) option.selected = true;
      duration.append(option);
    }
    durationField.append(duration);

    const fee = element('div', 'rw-ah-listing-fee');
    fee.append(
      element('span', '', '上架税'),
      element('strong', '', '计算中…'),
    );
    const feeValue = fee.querySelector('strong');

    const total = element('div', 'rw-ah-sell-total');
    let lastQuote = null;
    let quoteSerial = 0;

    const amountValue = () => asset.kind === 'item'
      ? Math.max(1, Math.min(Number(qty.max), Math.floor(Number(qty.value) || 1)))
      : 1;

    const syncGross = () => {
      const amount = amountValue();
      qty.value = String(amount);
      const unitPrice = Math.max(0, Math.floor(Number(price.value) || 0));
      const gross = unitPrice * amount;
      total.textContent = unitPrice > 0
        ? '预计成交额 ' + coin(gross) + ' 空间币 · 成交后另扣 3% 公证费'
        : '设置一口价后可上架';
    };

    const refreshQuote = async () => {
      const serial = ++quoteSerial;
      const amount = amountValue();
      const hours = Number(duration.value) || 24;
      feeValue.textContent = '计算中…';
      try {
        const quote = await marketService.quoteAuction(asset, amount, hours);
        if (serial !== quoteSerial) return;
        lastQuote = quote;
        feeValue.textContent = coin(quote?.listing_fee || 0) + ' 空间币';
      } catch (error) {
        if (serial !== quoteSerial) return;
        lastQuote = null;
        feeValue.textContent = '无法计算';
        throw error;
      }
    };

    qty.addEventListener('input', syncGross);
    qty.addEventListener('change', () => void refreshQuote().catch(notifyError));
    price.addEventListener('input', syncGross);
    duration.addEventListener('change', () => void refreshQuote().catch(notifyError));
    syncGross();
    await refreshQuote();

    const submit = button('创建拍卖', 'primary', async () => {
      const amount = amountValue();
      const unitPrice = Math.floor(Number(price.value) || 0);
      const durationHours = Number(duration.value) || 24;
      if (unitPrice <= 0) throw new Error('请输入有效的一口价');

      const quote = await marketService.quoteAuction(asset, amount, durationHours);
      const listingFee = Number(quote?.listing_fee || 0);
      const local = await marketService.inventory();
      if (Number(local.coin || 0) < listingFee) {
        throw new Error('空间币不足：上架税需要 ' + coin(listingFee));
      }

      const ok = await confirmDialog({
        title: '确认上架',
        message: '上架“' + asset.name + '” ×' + amount
          + '，一口价 ' + coin(unitPrice) + ' 空间币 / 件，挂牌 ' + durationHours
          + ' 小时。立即收取上架税 ' + coin(listingFee)
          + ' 空间币；成交后再从卖家货款扣 3% 公证费。到期后有 72 小时取回期，逾期由系统自动回收。',
        confirmText: '支付上架税并拍卖',
      });
      if (!ok) return;

      await marketService.sell({
        kind: asset.kind,
        key: asset.key,
        name: asset.name,
        quantity: amount,
        unitPrice,
        durationHours,
      });
      try { host.toastr?.success?.('已创建拍卖', '空间集市'); } catch {}
      selectedSellIndex = -1;
      await renderSellMode();
      await refresh();
    });

    form.append(qtyField, priceField, durationField, fee, total, submit);
    editor.append(form);

    if (asset.kind === 'equipment') {
      const buybackQuote = await marketService.quoteBuyback(asset).catch(() => null);
      const buyback = element('div', 'rw-ah-buyback-box');
      const copy = element('div', 'rw-ah-buyback-copy');
      copy.append(
        element('span', '', '系统回收'),
        element(
          'strong',
          '',
          buybackQuote
            ? coin(buybackQuote.total_price) + ' 空间币'
            : '暂时无法估价',
        ),
        element('small', '', '按该品质商城最低价 × 野货最低收购比例结算；不区分是否带主神空间标签。'),
      );
      buyback.append(copy);
      if (buybackQuote) {
        buyback.append(button('直接卖给系统', '', async () => {
          const ok = await confirmDialog({
            title: '确认系统回收',
            message: '将“' + asset.name + '”直接出售给系统，立即获得 '
              + coin(buybackQuote.total_price) + ' 空间币？系统回收成交后不可撤销。',
            confirmText: '确认回收',
          });
          if (!ok) return;
          await marketService.sellToSystem({
            kind: asset.kind,
            key: asset.key,
            name: asset.name,
          });
          try { host.toastr?.success?.('装备已由系统回收，空间币已写入当前存档', '空间集市'); } catch {}
          selectedSellIndex = -1;
          await renderSellMode();
          await refreshSummary();
        }));
      }
      editor.append(buyback);
    }

    editor.append(element(
      'p',
      'rw-market-notice warning',
      '玩家拍卖最多 72 小时；到期立即从公开列表下架。到期后 72 小时内可从“我的拍卖”取回，逾期由服务器按系统回收价自动换成待领空间币。',
    ));
    nodes.marketSellEditor.replaceChildren(editor);
  }

  async function renderSellMode() {
    requireLogin();
    try {
      sellInventory = await marketService.inventory();
    } catch (error) {
      sellInventory = { assets: [], inHub: false, coin: 0 };
      empty(nodes.marketSellList, error.message || '无法读取当前存档');
      throw error;
    }
    renderSellList();

    const asset = sellInventory.assets?.[selectedSellIndex] || null;
    await renderSellEditor(asset);
  }

  const transactionRow = (title, meta, actions = []) => {
    const row = element('div', 'rw-ah-transaction-row');
    const copy = element('div', 'rw-ah-transaction-copy');
    copy.append(element('strong', '', title), element('span', '', meta));
    const actionBox = element('div', 'rw-ah-transaction-actions');
    actionBox.append(...actions);
    row.append(copy, actionBox);
    return row;
  };

  const section = (title, count = '') => {
    const node = element('section', 'rw-ah-mine-section');
    const head = element('div', 'rw-ah-mine-section-head');
    head.append(element('h4', '', title), element('span', '', count));
    node.append(head);
    return node;
  };

  async function renderMineMode() {
    requireLogin();
    const state = await marketService.mine();
    const content = element('div', 'rw-ah-mine-stack');

    const wallet = element('div', 'rw-ah-wallet');
    const walletCopy = element('div');
    walletCopy.append(
      element('span', '', '待领取货款'),
      element('strong', '', coin(state.wallet?.balance) + ' 空间币'),
    );
    wallet.append(walletCopy);
    if (Number(state.wallet?.balance) > 0) {
      wallet.append(button('领取到当前存档', 'primary', async () => {
        await marketService.claimProceeds();
        try { host.toastr?.success?.('货款已写入当前存档', '空间集市'); } catch {}
        await renderMineMode();
        await refreshSummary();
      }));
    }
    content.append(wallet);

    const pendingCount = (state.pending_deliveries?.length || 0)
      + (state.pending_returns?.length || 0)
      + (state.pending_payouts?.length || 0);
    const recovery = section('待领取 / 待恢复', String(pendingCount));
    if (!pendingCount) recovery.append(element('div', 'rw-ah-muted-line', '没有待恢复事务。'));

    for (const trade of state.pending_deliveries || []) {
      recovery.append(transactionRow(
        '购买待领取 · ' + (trade.asset?.name || '资产') + ' ×' + (trade.quantity || 1),
        coin(trade.total_price) + ' 空间币 · ' + when(trade.created_at),
        [button('领取', 'primary', async () => {
          await marketService.deliverTrade(trade);
          await renderMineMode();
        })],
      ));
    }
    for (const returned of state.pending_returns || []) {
      recovery.append(transactionRow(
        '撤回待返还 · ' + (returned.asset?.name || '资产') + ' ×' + (returned.quantity || 1),
        when(returned.created_at),
        [button('返还', 'primary', async () => {
          await marketService.receiveReturn(returned);
          await renderMineMode();
        })],
      ));
    }
    for (const payout of state.pending_payouts || []) {
      recovery.append(transactionRow(
        '货款待写入 · ' + coin(payout.amount) + ' 空间币',
        when(payout.created_at),
        [button('写入', 'primary', async () => {
          await marketService.receivePayout(payout);
          await renderMineMode();
          await refreshSummary();
        })],
      ));
    }
    content.append(recovery);

    const active = (state.listings || []).filter(
      value => value.status === 'active' && !value.expired,
    );
    const activeSection = section('正在出售', String(active.length));
    if (!active.length) activeSection.append(element('div', 'rw-ah-muted-line', '当前没有在售拍卖。'));
    for (const listing of active) {
      const expiryText = listing.expires_at
        ? until(listing.expires_at) + '后到期'
        : '无到期时间';
      const feeText = listing.listing_fee
        ? ' · 上架税 ' + coin(listing.listing_fee)
        : '';
      activeSection.append(transactionRow(
        (listing.asset?.name || '资产') + ' · 剩余 ' + listing.remaining_quantity,
        coin(listing.unit_price) + ' 空间币 / 件 · ' + expiryText + feeText,
        [button('取消拍卖', 'danger', async () => {
          const ok = await confirmDialog({
            title: '取消拍卖',
            message: '撤回“' + listing.asset?.name + '”剩余 ' + listing.remaining_quantity
              + ' 件？已支付的上架税不会退还。',
            confirmText: '取消拍卖',
            danger: true,
          });
          if (!ok) return;
          await marketService.cancel(listing.id);
          try { host.toastr?.success?.('拍卖已取消，剩余资产已返还', '空间集市'); } catch {}
          await renderMineMode();
          await refresh();
        })],
      ));
    }
    content.append(activeSection);

    const expired = (state.listings || []).filter(
      value => value.status === 'active' && value.expired && Number(value.remaining_quantity || 0) > 0,
    );
    const expiredSection = section('已到期 · 待取回', String(expired.length));
    if (!expired.length) {
      expiredSection.append(element('div', 'rw-ah-muted-line', '没有等待取回的到期拍卖。'));
    }
    for (const listing of expired) {
      expiredSection.append(transactionRow(
        (listing.asset?.name || '资产') + ' · 剩余 ' + listing.remaining_quantity,
        '已下架 · ' + until(listing.recycle_at) + '后系统自动回收',
        [button('取回资产', 'primary', async () => {
          const ok = await confirmDialog({
            title: '取回到期资产',
            message: '取回“' + listing.asset?.name + '”剩余 ' + listing.remaining_quantity
              + ' 件？超过回收时限后服务器会自动折算为空间币。',
            confirmText: '取回',
          });
          if (!ok) return;
          await marketService.cancel(listing.id);
          try { host.toastr?.success?.('到期资产已返还当前存档', '空间集市'); } catch {}
          await renderMineMode();
        })],
      ));
    }
    content.append(expiredSection);

    const recycleRecords = []
      .concat((state.buybacks || []).map(value => ({
        ...value,
        side: '主动回收',
        amount: Number(value.amount || 0),
      })))
      .concat((state.recycles || []).map(value => ({
        ...value,
        side: '到期自动回收',
        amount: Number(value.amount || 0),
      })))
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .slice(0, 30);
    const recycleHistory = section('系统回收记录', String(recycleRecords.length));
    if (!recycleRecords.length) {
      recycleHistory.append(element('div', 'rw-ah-muted-line', '还没有系统回收记录。'));
    }
    for (const record of recycleRecords) {
      recycleHistory.append(transactionRow(
        record.side + ' · ' + (record.asset?.name || '资产') + ' ×' + (record.quantity || 1),
        coin(record.amount) + ' 空间币 · ' + when(record.created_at),
      ));
    }
    content.append(recycleHistory);

    const records = []
      .concat((state.purchases || []).map(value => ({ ...value, side: '买入' })))
      .concat((state.sales || []).map(value => ({ ...value, side: '卖出' })))
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .slice(0, 30);
    const history = section('成交记录', String(records.length));
    if (!records.length) history.append(element('div', 'rw-ah-muted-line', '还没有成交记录。'));
    for (const trade of records) {
      const settlement = trade.side === '卖出'
        ? '成交 ' + coin(trade.total_price) + ' · 公证费 ' + coin(trade.market_fee)
          + ' · 实收 ' + coin(trade.seller_proceeds)
        : '支付 ' + coin(trade.total_price);
      history.append(transactionRow(
        trade.side + ' · ' + (trade.asset?.name || '资产') + ' ×' + (trade.quantity || 1),
        settlement + ' 空间币 · ' + when(trade.created_at),
      ));
    }
    content.append(history);

    nodes.marketMineContent.replaceChildren(content);
  }

  nodes.marketSearchButton?.addEventListener('click', renderRows);
  nodes.marketSearch?.addEventListener('keydown', event => {
    if (event.key === 'Enter') renderRows();
  });
  nodes.marketSort?.addEventListener('change', renderRows);
  nodes.marketMineRefresh?.addEventListener('click', () => void renderMineMode().catch(notifyError));

  for (const tab of nodes.marketModes || []) {
    tab.addEventListener('click', () => void setMode(tab.dataset.marketMode).catch(notifyError));
  }
  for (const category of nodes.marketCategories || []) {
    category.addEventListener('click', () => {
      currentKind = category.dataset.marketKind || '';
      for (const candidate of nodes.marketCategories || []) {
        candidate.classList.toggle('is-active', candidate === category);
      }
      renderRows();
    });
  }

  setModeVisuals();

  return {
    refresh,
    openSell: () => setMode('sell'),
    openMine: () => setMode('mine'),
  };
}
