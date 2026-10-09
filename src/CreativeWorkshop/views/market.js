import { MARKET_KIND_LABELS } from '../services/market-service.js';
import {
  buildCatalogRows,
  buildMarketRows,
  filterMarketRows,
  marketAssetDetailEntries,
  marketAssetFieldDisplay,
  marketPriceLadder,
  marketTeammateDetailModel,
  planMarketPurchase,
} from './market-model.js';

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const coin = value => Math.max(0, Math.trunc(num(value))).toLocaleString('zh-CN');
const quality = asset => String(
  asset?.quality || asset?.data?.品质 || asset?.data?.层级 || asset?.data?.等级 || '',
).trim();
const RANK_QUALITY = {
  'Ⅰ': 'F', 'Ⅱ': 'E', 'Ⅲ': 'D', 'Ⅳ': 'C', 'Ⅴ': 'B',
  'Ⅵ': 'A', 'Ⅶ': 'S', 'Ⅷ': 'SS', 'Ⅸ': 'SSS',
};
const qualityRank = asset => {
  const raw = quality(asset);
  if (RANK_QUALITY[raw]) return RANK_QUALITY[raw];
  return raw.toUpperCase().match(/^(SSS|SS|S|A|B|C|D|E|F)$/u)?.[0] || 'NONE';
};
const qualityName = (node, asset) => {
  node.classList.add('rw-ah-quality-name');
  node.dataset.quality = qualityRank(asset);
  return node;
};
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
  let products = [];
  let allRows = [];
  let rows = [];
  let loading = false;
  let selectedKey = '';
  let selectedProductDetails = null;
  const productDetailsCache = new Map();
  let currentKind = '';
  let currentMode = 'browse';
  let currentMineView = 'active';
  let sellInventory = null;
  let selectedSellIndex = -1;
  let barters = [];
  let selectedBarterId = '';

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

  const teammateChips = (items, { occupations = false } = {}) => {
    const wrap = element('div', 'rw-ah-teammate-chips');
    for (const item of items || []) {
      const chip = element('span', 'rw-ah-teammate-chip');
      chip.append(element('strong', '', item.name || String(item)));
      if (occupations && item.meta) chip.append(element('small', '', item.meta));
      else if (!occupations && item.rank) chip.append(element('small', '', item.rank));
      if (!occupations && Number(item.quantity || 1) > 1) {
        chip.append(element('em', '', '×' + Number(item.quantity)));
      }
      wrap.append(chip);
    }
    return wrap;
  };

  const teammateDetail = asset => {
    const model = marketTeammateDetailModel(asset);
    const box = element('div', 'rw-ah-teammate-detail');
    if (!model) return box;

    const summary = element('section', 'rw-ah-teammate-card');
    const summaryHead = element('div', 'rw-ah-teammate-card-head');
    summaryHead.append(
      element('strong', '', '人物概览'),
      model.currentForm ? element('span', 'rw-ah-teammate-active-form', '当前形态 · ' + model.currentForm) : element('span'),
    );
    summary.append(summaryHead);

    if (model.overview.length) {
      const grid = element('div', 'rw-ah-teammate-overview');
      for (const [key, value] of model.overview) {
        const cell = element('div', 'rw-ah-teammate-overview-cell');
        cell.append(element('span', '', key), element('strong', '', value));
        grid.append(cell);
      }
      summary.append(grid);
    }

    if (model.identity.length) {
      const row = element('div', 'rw-ah-teammate-meta-row');
      row.append(
        element('span', 'rw-ah-teammate-meta-label', '身份'),
        teammateChips(model.identity.map(name => ({ name }))),
      );
      summary.append(row);
    }

    if (model.occupations.length) {
      const row = element('div', 'rw-ah-teammate-meta-row');
      row.append(
        element('span', 'rw-ah-teammate-meta-label', '职业'),
        teammateChips(model.occupations, { occupations: true }),
      );
      summary.append(row);
    }
    box.append(summary);

    if (model.builds.length) {
      const section = element('section', 'rw-ah-teammate-card');
      section.append(element('div', 'rw-ah-teammate-card-title', '能力构筑'));
      const list = element('div', 'rw-ah-teammate-build-list');
      for (const [label, items] of model.builds) {
        const row = element('div', 'rw-ah-teammate-build-row');
        row.append(
          element('span', 'rw-ah-teammate-meta-label', label),
          teammateChips(items),
        );
        list.append(row);
      }
      section.append(list);
      box.append(section);
    }

    if (model.profile.length) {
      const section = element('section', 'rw-ah-teammate-card');
      section.append(element('div', 'rw-ah-teammate-card-title', '人物档案'));
      const list = element('div', 'rw-ah-teammate-profile');
      for (const [label, value] of model.profile) {
        const row = element('div', 'rw-ah-teammate-profile-row');
        row.append(
          element('span', 'rw-ah-teammate-meta-label', label),
          element('p', '', value),
        );
        list.append(row);
      }
      section.append(list);
      box.append(section);
    }

    if (model.relation.length) {
      const section = element('section', 'rw-ah-teammate-card rw-ah-teammate-relation-card');
      section.append(element('div', 'rw-ah-teammate-card-title', '交易状态'));
      const grid = element('div', 'rw-ah-teammate-relation');
      for (const [label, value] of model.relation) {
        const row = element('div', 'rw-ah-teammate-relation-row');
        row.append(element('span', '', label), element('strong', '', value));
        grid.append(row);
      }
      section.append(grid);
      box.append(section);
    }

    return box;
  };

  const assetDetail = asset => {
    if (asset?.kind === 'teammate') return teammateDetail(asset);

    const box = element('div', 'rw-ah-asset-detail');
    const entries = marketAssetDetailEntries(asset);
    if (!entries.length) return box;

    const dataSection = element('section', 'rw-ah-data-section');
    dataSection.append(element('div', 'rw-ah-section-label', '资产数据'));
    const dataBody = element('div', 'rw-ah-data-object');
    for (const [key, value] of entries) {
      const row = element('div', 'rw-ah-data-row');
      const displayValue = marketAssetFieldDisplay(asset, key, value);
      row.append(element('span', 'rw-ah-data-key', key), dataValue(displayValue));
      dataBody.append(row);
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
    if (!['browse', 'sell', 'barter', 'mine'].includes(mode)) return;
    if (mode !== 'browse') requireLogin();
    currentMode = mode;
    setModeVisuals();
    if (!products.length) await refresh();
    if (mode === 'sell') await renderSellMode();
    if (mode === 'barter') await renderBarterMode();
    if (mode === 'mine') await renderMineMode();
    await refreshSummary();
  }

  const resultRow = marketRow => {
    const node = element('button', 'rw-ah-result-row');
    node.type = 'button';
    node.classList.toggle('is-selected', selectedKey === marketRow.key);

    const itemCell = element('span', 'rw-ah-result-item');
    const itemCopy = element('span', 'rw-ah-result-item-copy');
    itemCopy.append(
      qualityName(element('strong', '', marketRow.name), marketRow.asset),
      element(
        'small',
        '',
        (marketRow.sellerCount || 0) + ' 位卖家 · '
          + (marketRow.listingCount || marketRow.listings?.length || 0) + ' 个挂单',
      ),
    );
    itemCell.append(itemCopy);

    const kindCell = element('span', 'rw-ah-result-kind');
    kindCell.append(element('span', 'rw-ah-type-tag', kindLabel(marketRow.kind)));
    const qualityCell = element('span', 'rw-ah-result-quality', marketRow.quality || quality(marketRow.asset) || '—');
    const stockCell = element('span', 'rw-ah-result-stock', String(marketRow.totalStock || 0));
    const priceCell = element('span', 'rw-ah-result-price');
    priceCell.append(element('strong', '', coin(marketRow.buyPrice ?? marketRow.lowestPrice)));

    node.append(itemCell, kindCell, qualityCell, stockCell, priceCell);
    node.addEventListener('click', () => {
      selectedKey = marketRow.key;
      renderRows({ preserveInspector: true });
      void renderInspector(marketRow).catch(notifyError);
    });
    return node;
  };

  function refreshSubtypeOptions() {
    if (!nodes.marketSubtype) return;
    const previous = nodes.marketSubtype.value;
    const values = [...new Set(
      allRows
        .filter(row => !currentKind || row.kind === currentKind)
        .map(row => String(row.subtype || '').trim())
        .filter(Boolean),
    )].sort((left, right) => left.localeCompare(right, 'zh-CN'));
    nodes.marketSubtype.replaceChildren();
    const allOption = element('option', '', '全部子类型');
    allOption.value = '';
    nodes.marketSubtype.append(allOption);
    for (const value of values) {
      const option = element('option', '', value);
      option.value = value;
      nodes.marketSubtype.append(option);
    }
    nodes.marketSubtype.value = values.includes(previous) ? previous : '';
  }

  function renderRows({ preserveInspector = false } = {}) {
    allRows = buildCatalogRows(products);
    refreshSubtypeOptions();

    for (const category of nodes.marketCategories || []) {
      const kind = category.dataset.marketKind || '';
      const matching = kind ? allRows.filter(row => row.kind === kind) : allRows;
      const count = matching.reduce(
        (sum, row) => sum + Math.max(0, Number(row.listingCount || 0)),
        0,
      );
      const badge = category.querySelector?.('[data-market-kind-count]');
      if (badge) badge.textContent = String(count);
    }

    rows = filterMarketRows(allRows, {
      kind: currentKind,
      query: nodes.marketSearch?.value || '',
      quality: nodes.marketQuality?.value || '',
      subtype: nodes.marketSubtype?.value || '',
      minPrice: nodes.marketMinPrice?.value || '',
      maxPrice: nodes.marketMaxPrice?.value || '',
      sort: nodes.marketSort?.value || 'price_asc',
    });

    if (!rows.length) {
      empty(nodes.marketList, '当前没有符合条件的商品。');
      selectedKey = '';
      selectedProductDetails = null;
      renderInspector(null);
    } else {
      nodes.marketList.replaceChildren(...rows.map(resultRow));
      let selected = rows.find(row => row.key === selectedKey);
      if (!selected) {
        selected = rows[0];
        selectedKey = selected.key;
        nodes.marketList.firstElementChild?.classList.add('is-selected');
        if (!preserveInspector) void renderInspector(selected).catch(notifyError);
      } else if (!preserveInspector) {
        void renderInspector(selected).catch(notifyError);
      }
    }
    const listingCount = rows.reduce((sum, row) => sum + Number(row.listingCount || 0), 0);
    nodes.marketCount.textContent = rows.length + ' 种商品 · ' + listingCount + ' 个挂单';
  }

  function purchaseSummary(marketRow, quantity) {
    try {
      return planMarketPurchase(marketRow, quantity, currentUserId());
    } catch {
      return null;
    }
  }

  const marketChangedError = error => [
    'market_listing_unavailable',
    'market_quantity_unavailable',
    'market_product_not_found',
  ].includes(String(error?.code || ''));

  async function loadProductDetails(marketRow, { force = false } = {}) {
    if (!marketRow?.key) return null;
    if (!force && productDetailsCache.has(marketRow.key)) {
      return productDetailsCache.get(marketRow.key);
    }
    const details = await marketService.product(marketRow.key);
    productDetailsCache.set(marketRow.key, details);
    return details;
  }

  function auctionRowFromDetails(marketRow, details) {
    const listingRows = Array.isArray(details?.listings) ? details.listings : [];
    const buyable = listingRows.filter(
      listing => Number(listing.seller?.id || 0) !== currentUserId(),
    );
    return {
      ...marketRow,
      listings: listingRows,
      totalStock: listingRows.reduce((sum, listing) => sum + Math.max(0, Number(listing.remaining_quantity || 0)), 0),
      buyableStock: buyable.reduce((sum, listing) => sum + Math.max(0, Number(listing.remaining_quantity || 0)), 0),
      lowestPrice: listingRows.length ? Math.min(...listingRows.map(listing => Number(listing.unit_price || 0))) : null,
      buyPrice: buyable.length ? Math.min(...buyable.map(listing => Number(listing.unit_price || 0))) : null,
      ownedOnly: listingRows.length > 0 && buyable.length === 0,
    };
  }

  function historyPanel(history = []) {
    const box = element('section', 'rw-ah-history');
    box.append(element('div', 'rw-ah-section-label', '近期成交'));
    if (!history.length) {
      box.append(element('div', 'rw-ah-muted-line', '暂无成交历史。'));
      return box;
    }
    const head = element('div', 'rw-ah-history-row rw-ah-history-head');
    for (const label of ['日期', '均价', '最低', '最高', '数量']) head.append(element('span', '', label));
    box.append(head);
    for (const point of history.slice(-7).reverse()) {
      const row = element('div', 'rw-ah-history-row');
      row.append(
        element('span', '', point.day || '—'),
        element('span', '', coin(point.average)),
        element('span', '', coin(point.low)),
        element('span', '', coin(point.high)),
        element('span', '', String(point.volume || 0)),
      );
      box.append(row);
    }
    return box;
  }

  async function renderInspector(marketRow, { force = false } = {}) {
    if (!nodes.marketInspector) return;
    if (!marketRow) {
      const blank = element('div', 'rw-ah-empty-inspector');
      blank.append(
        element('div', 'rw-ah-empty-icon', '◇'),
        element('strong', '', '选择一个商品'),
        element('span', '', '右侧会显示详情、价格阶梯、成交历史与购买数量。'),
      );
      nodes.marketInspector.replaceChildren(blank);
      return;
    }

    const loadingNode = element('div', 'rw-ah-empty-inspector');
    loadingNode.append(element('strong', '', '读取市场详情…'));
    nodes.marketInspector.replaceChildren(loadingNode);

    let details;
    try {
      details = await loadProductDetails(marketRow, { force });
    } catch (error) {
      if (String(error?.code || '') === 'market_product_not_found') {
        await refresh();
        return;
      }
      throw error;
    }
    if (selectedKey !== marketRow.key) return;
    selectedProductDetails = details;

    const tradeRow = auctionRowFromDetails(marketRow, details);
    const wrap = element('div', 'rw-ah-inspector-body');
    const head = element('div', 'rw-ah-detail-head');
    head.append(
      element('div', 'rw-ah-inspector-title', '商品详情'),
      qualityName(element('h3', '', marketRow.name), marketRow.asset),
    );
    wrap.append(head, assetDetail(marketRow.asset));

    const ladder = marketPriceLadder(tradeRow, currentUserId());
    const ladderBox = element('div', 'rw-ah-ladder');
    ladderBox.append(element('div', 'rw-ah-section-label', '当前价格阶梯'));
    if (!ladder.length) {
      ladderBox.append(element('div', 'rw-ah-muted-line', '当前没有可购买的他人挂单。'));
    } else {
      for (const level of ladder.slice(0, 8)) {
        const line = element('div', 'rw-ah-ladder-row');
        line.append(
          element('span', '', coin(level.price) + ' 空间币'),
          element('span', '', level.stock + ' 件 · ' + level.sellerCount + ' 位卖家'),
        );
        ladderBox.append(line);
      }
    }
    wrap.append(ladderBox, historyPanel(details?.history || []));

    const purchase = element('div', 'rw-ah-purchase-box');
    if (tradeRow.ownedOnly || tradeRow.buyableStock <= 0) {
      purchase.append(
        element('strong', '', '当前没有可购买的他人挂单'),
        element('p', '', '如果只有自己的挂单，可以前往“我的交易”撤回；也可以创建求购单等待其他玩家出售。'),
      );
    } else {
      const quantityLabel = element('label', 'rw-ah-quantity-field');
      quantityLabel.append(element('span', '', '购买数量'));
      const quantity = element('input', 'rw-input');
      quantity.type = 'number';
      quantity.min = '1';
      quantity.step = '1';
      quantity.max = String(tradeRow.kind === 'item' ? tradeRow.buyableStock : 1);
      quantity.value = '1';
      quantity.disabled = tradeRow.kind !== 'item';
      quantityLabel.append(quantity);

      const total = element('div', 'rw-ah-buy-total');
      const action = button('购买', 'primary', async () => {
        requireLogin();
        const plan = purchaseSummary(tradeRow, quantity.value);
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

        try {
          for (const line of plan.lines) await marketService.buy(line.listing, line.quantity);
        } catch (error) {
          if (marketChangedError(error)) {
            productDetailsCache.delete(marketRow.key);
            try { host.toastr?.warning?.('市场库存或价格刚刚发生变化，已刷新当前商品。', '空间集市'); } catch {}
            await refresh({ preserveSelection: true });
            const current = allRows.find(row => row.key === marketRow.key);
            if (current) await renderInspector(current, { force: true });
            return;
          }
          throw error;
        }
        try { host.toastr?.success?.('购买完成，资产已写入当前存档', '空间集市'); } catch {}
        productDetailsCache.delete(marketRow.key);
        await refresh({ preserveSelection: true });
      });

      const updateTotal = () => {
        const max = Math.max(1, Number(quantity.max) || 1);
        const requested = tradeRow.kind === 'item'
          ? Math.max(1, Math.min(max, Math.floor(Number(quantity.value) || 1)))
          : 1;
        quantity.value = String(requested);
        const plan = purchaseSummary(tradeRow, requested);
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
        element('small', 'rw-ah-purchase-help', tradeRow.kind === 'item'
          ? '像 WoW 大宗商品一样：系统自动从最低价档开始依次成交。'
          : '非堆叠资产按最低有效挂单成交。'),
      );
    }
    wrap.append(purchase);

    if (getAuth()?.user) {
      const orderBox = element('div', 'rw-ah-order-box');
      orderBox.append(element('div', 'rw-ah-section-label', '创建求购'));
      const orderGrid = element('div', 'rw-ah-order-grid');
      const orderQty = element('input', 'rw-input');
      orderQty.type = 'number';
      orderQty.min = '1';
      orderQty.step = '1';
      orderQty.value = '1';
      orderQty.disabled = marketRow.kind !== 'item';
      const orderPrice = element('input', 'rw-input');
      orderPrice.type = 'number';
      orderPrice.min = '1';
      orderPrice.step = '1';
      orderPrice.value = String(Math.max(1, Number(marketRow.lowestPrice || 1)));
      const orderDuration = element('select', 'rw-select');
      for (const hours of [24, 48, 72]) {
        const option = element('option', '', hours + ' 小时');
        option.value = String(hours);
        orderDuration.append(option);
      }
      orderGrid.append(
        element('span', '', '数量'), orderQty,
        element('span', '', '最高单价'), orderPrice,
        element('span', '', '有效期'), orderDuration,
      );
      const createOrderButton = button('发布求购', '', async () => {
        requireLogin();
        const resolvedQty = marketRow.kind === 'item'
          ? Math.max(1, Math.floor(Number(orderQty.value) || 1))
          : 1;
        const resolvedPrice = Math.max(1, Math.floor(Number(orderPrice.value) || 0));
        const total = resolvedQty * resolvedPrice;
        const ok = await confirmDialog({
          title: '确认求购',
          message: '求购“' + marketRow.name + '” ×' + resolvedQty + '，最高单价 '
            + coin(resolvedPrice) + '，将先托管 ' + coin(total) + ' 空间币。',
          confirmText: '托管并发布',
        });
        if (!ok) return;
        await marketService.createOrder(marketRow, {
          quantity: resolvedQty,
          unitPrice: resolvedPrice,
          durationHours: Number(orderDuration.value) || 24,
        });
        try { host.toastr?.success?.('求购单已发布', '空间集市'); } catch {}
        await refreshSummary();
      });
      orderBox.append(orderGrid, createOrderButton);
      wrap.append(orderBox);
    }

    nodes.marketInspector.replaceChildren(wrap);
  }

  async function refresh({ preserveSelection = false } = {}) {
    if (loading) return;
    loading = true;
    try {
      empty(nodes.marketList, '正在读取商品目录…');
      if (!preserveSelection) selectedKey = '';
      products = await marketService.catalogAll();
      productDetailsCache.clear();
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
      qualityName(element('strong', '', asset.name), asset),
      element('small', '', kindLabel(asset.kind) + (quality(asset) ? ' · ' + quality(asset) : '')),
    );
    row.append(
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
    headCopy.append(tags, qualityName(element('h3', '', asset.name), asset));
    head.append(headCopy);
    editor.append(head, assetDetail(asset));
    if (asset.kind === 'teammate') {
      editor.append(element(
        'p',
        'rw-market-notice warning',
        '队友一旦成功上架，好感度会归零（原本为负数则保留负值），态度重置为“被交易的货物，对原主失去一切信任”。撤回拍卖时也会保留该交易状态。',
      ));
    }

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
    qty.addEventListener('change', () => {
      void refreshQuote().catch(notifyError);
      void refreshBuyback().catch(notifyError);
    });
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

    const buyback = element('div', 'rw-ah-buyback-box');
    const buybackCopy = element('div', 'rw-ah-buyback-copy');
    const buybackValue = element('strong', '', '计算中…');
    buybackCopy.append(
      element('span', '', '系统回收'),
      buybackValue,
      element('small', '', '按该品质商城最低价 × 野货最低收购比例结算；不区分是否带主神空间标签。'),
    );
    const buybackButton = button('直接卖给系统', '', async () => {
      const amount = amountValue();
      const quote = await marketService.quoteBuyback(asset, amount);
      if (!quote) throw new Error('系统暂时无法估价');
      await marketService.sellToSystem({
        kind: asset.kind,
        key: asset.key,
        name: asset.name,
        quantity: amount,
      });
      try { host.toastr?.success?.('资产已由系统回收，空间币已写入当前存档', '空间集市'); } catch {}
      selectedSellIndex = -1;
      await renderSellMode();
      await refreshSummary();
    });
    buyback.append(buybackCopy, buybackButton);
    editor.append(buyback);

    async function refreshBuyback() {
      const quote = await marketService.quoteBuyback(asset, amountValue());
      buybackValue.textContent = quote
        ? coin(quote.total_price) + ' 空间币'
        : '暂时无法估价';
      buybackButton.disabled = !quote;
      return quote;
    }
    await refreshBuyback().catch(() => {
      buybackValue.textContent = '暂时无法估价';
      buybackButton.disabled = true;
    });

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
