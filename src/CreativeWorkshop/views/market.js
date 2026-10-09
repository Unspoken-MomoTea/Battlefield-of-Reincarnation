import { MARKET_KIND_LABELS } from '../services/market-service.js';
import {
  buildMarketRows,
  filterMarketRows,
  marketAssetDetailEntries,
  marketAssetFieldDisplay,
  marketInventoryMatchesWanted,
  marketRowFromCatalogDetail,
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
  let catalogItems = [];
  let catalogCounts = {};
  let catalogNextOffset = null;
  let catalogFacets = { qualities: [], subtypes: [] };
  const catalogCache = new Map();
  let selectedKey = '';
  let selectedDetail = null;
  let loading = false;
  let currentKind = '';
  let currentMode = 'browse';
  let currentOrderView = 'buy';
  let currentMineView = 'active';
  let selectedOrderId = '';
  let orderDraft = null;
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
    if (!['browse', 'sell', 'orders', 'mine'].includes(mode)) return;
    if (mode !== 'browse') requireLogin();
    currentMode = mode;
    setModeVisuals();
    if (!catalogItems.length) await refresh();
    if (mode === 'sell') await renderSellMode();
    if (mode === 'orders') await renderOrderMode();
    if (mode === 'mine') await renderMineMode();
    await refreshSummary();
  }

  const browseFilters = () => ({
    query: nodes.marketSearch?.value || '',
    kind: currentKind,
    quality: nodes.marketQuality?.value || '',
    subtype: nodes.marketSubtype?.value || '',
    minPrice: Math.max(0, Math.floor(Number(nodes.marketMinPrice?.value) || 0)),
    maxPrice: Math.max(0, Math.floor(Number(nodes.marketMaxPrice?.value) || 0)),
    sort: nodes.marketSort?.value || 'price_asc',
    limit: 40,
  });

  const browseCacheKey = filters => JSON.stringify({
    query: filters.query || '',
    kind: filters.kind || '',
    quality: filters.quality || '',
    subtype: filters.subtype || '',
    minPrice: filters.minPrice || 0,
    maxPrice: filters.maxPrice || 0,
    sort: filters.sort || 'price_asc',
  });

  const syncSubtypeOptions = () => {
    if (!nodes.marketSubtype) return;
    const selected = nodes.marketSubtype.value;
    const options = [element('option', '', '全部子类型')];
    options[0].value = '';
    for (const item of catalogFacets.subtypes || []) {
      const option = element('option', '', item.value + ' · ' + item.count);
      option.value = item.value;
      options.push(option);
    }
    nodes.marketSubtype.replaceChildren(...options);
    if ([...nodes.marketSubtype.options].some(option => option.value === selected)) {
      nodes.marketSubtype.value = selected;
    }
  };

  const renderCategoryCounts = () => {
    const total = Object.values(catalogCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    for (const category of nodes.marketCategories || []) {
      const kind = category.dataset.marketKind || '';
      const badge = category.querySelector?.('[data-market-kind-count]');
      if (badge) badge.textContent = String(kind ? Number(catalogCounts?.[kind] || 0) : total);
    }
  };

  const resultRow = item => {
    const node = element('button', 'rw-ah-result-row');
    node.type = 'button';
    node.classList.toggle('is-selected', selectedKey === item.key);

    const itemCell = element('span', 'rw-ah-result-item');
    const copy = element('span', 'rw-ah-result-item-copy');
    copy.append(
      qualityName(element('strong', '', item.name), item.asset),
      element(
        'small',
        '',
        item.kind === 'item'
          ? item.seller_count + ' 位卖家 · ' + item.listing_count + ' 个挂单'
          : item.listing_count + ' 个挂单',
      ),
    );
    itemCell.append(copy);

    const kindCell = element('span', 'rw-ah-result-kind');
    kindCell.append(element('span', 'rw-ah-type-tag', kindLabel(item.kind)));
    const qualityCell = element('span', 'rw-ah-result-quality', item.quality || quality(item.asset) || '—');
    const stockCell = element('span', 'rw-ah-result-stock', String(item.total_stock || 0));
    const priceCell = element('span', 'rw-ah-result-price');
    priceCell.append(element('strong', '', coin(item.lowest_price)));

    node.append(itemCell, kindCell, qualityCell, stockCell, priceCell);
    node.addEventListener('click', () => {
      selectedKey = item.key;
      renderCatalogRows();
      void loadCatalogDetail(item.key).catch(notifyError);
    });
    return node;
  };

  function renderCatalogRows() {
    if (!catalogItems.length) {
      empty(nodes.marketList, '当前没有符合条件的商品。');
      selectedKey = '';
      selectedDetail = null;
      renderInspector(null);
    } else {
      nodes.marketList.replaceChildren(...catalogItems.map(resultRow));
      const selected = catalogItems.find(item => item.key === selectedKey) || catalogItems[0];
      selectedKey = selected.key;
      for (const child of nodes.marketList.children) {
        child.classList.toggle('is-selected', child === nodes.marketList.children[catalogItems.indexOf(selected)]);
      }
      if (!selectedDetail || selectedDetail.catalog?.key !== selectedKey) {
        void loadCatalogDetail(selectedKey).catch(notifyError);
      } else {
        renderInspector(selectedDetail);
      }
    }
    const listingCount = Object.values(catalogCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    nodes.marketCount.textContent = catalogItems.length + ' 种商品 · ' + listingCount + ' 个当前挂单';
    if (nodes.marketMore) nodes.marketMore.hidden = catalogNextOffset == null;
    renderCategoryCounts();
  }

  async function loadCatalog({ force = false, append = false } = {}) {
    const filters = browseFilters();
    const key = browseCacheKey(filters);
    if (!append && !force && catalogCache.has(key)) {
      const cached = catalogCache.get(key);
      catalogItems = cached.items.slice();
      catalogCounts = { ...cached.counts };
      catalogNextOffset = cached.next_offset;
      catalogFacets = cached.facets || catalogFacets;
      syncSubtypeOptions();
      renderCatalogRows();
      return cached;
    }

    const offset = append ? Number(catalogNextOffset || 0) : 0;
    const result = await marketService.catalog({ ...filters, offset });
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    catalogItems = append ? catalogItems.concat(nextItems) : nextItems;
    catalogCounts = result?.counts || catalogCounts;
    catalogNextOffset = result?.next_offset ?? null;
    catalogFacets = result?.facets || catalogFacets;
    syncSubtypeOptions();
    catalogCache.set(key, {
      items: catalogItems.slice(),
      counts: { ...catalogCounts },
      next_offset: catalogNextOffset,
      facets: catalogFacets,
    });
    renderCatalogRows();
    return result;
  }

  async function loadCatalogDetail(catalogKey) {
    const detail = await marketService.catalogDetail(catalogKey);
    if (selectedKey !== catalogKey) return detail;
    selectedDetail = detail;
    renderInspector(detail);
    return detail;
  }

  function purchaseSummary(detail, quantity) {
    try {
      const row = marketRowFromCatalogDetail(detail, currentUserId());
      return row ? planMarketPurchase(row, quantity, currentUserId()) : null;
    } catch {
      return null;
    }
  }

  function renderInspector(detail) {
    if (!nodes.marketInspector) return;
    if (!detail?.catalog) {
      const blank = element('div', 'rw-ah-empty-inspector');
      blank.append(
        element('div', 'rw-ah-empty-icon', '◇'),
        element('strong', '', '选择一个商品'),
        element('span', '', '右侧会显示详情、价格梯度与成交历史。'),
      );
      nodes.marketInspector.replaceChildren(blank);
      return;
    }

    const marketRow = marketRowFromCatalogDetail(detail, currentUserId());
    const catalog = detail.catalog;
    const wrap = element('div', 'rw-ah-inspector-body');
    const head = element('div', 'rw-ah-detail-head');
    head.append(
      element('div', 'rw-ah-inspector-title', '详情'),
      qualityName(element('h3', '', catalog.name), catalog.asset),
    );
    wrap.append(head, assetDetail(catalog.asset));

    const ladder = element('div', 'rw-ah-ladder');
    ladder.append(element('div', 'rw-ah-section-label', '当前市场'));
    if (!detail.ladder?.length) {
      ladder.append(element('div', 'rw-ah-muted-line', '没有其他玩家可购买的挂单。'));
    } else {
      for (const level of detail.ladder.slice(0, 8)) {
        const line = element('div', 'rw-ah-ladder-row');
        line.append(
          element('span', '', coin(level.price) + ' 空间币'),
          element('span', '', level.stock + ' 件 · ' + level.seller_count + ' 位卖家'),
        );
        ladder.append(line);
      }
    }
    wrap.append(ladder);

    if (detail.history?.length) {
      const history = element('div', 'rw-ah-price-history');
      history.append(element('div', 'rw-ah-section-label', '最近成交'));
      const table = element('div', 'rw-ah-price-history-table');
      for (const point of detail.history.slice(-7)) {
        const line = element('div', 'rw-ah-price-history-row');
        line.append(
          element('span', '', point.day.slice(5)),
          element('span', '', '均 ' + coin(point.average)),
          element('span', '', coin(point.low) + ' - ' + coin(point.high)),
          element('span', '', '量 ' + point.volume),
        );
        table.append(line);
      }
      history.append(table);
      wrap.append(history);
    }

    const purchase = element('div', 'rw-ah-purchase-box');
    if (!marketRow || marketRow.ownedOnly || marketRow.buyableStock <= 0) {
      purchase.append(
        element('strong', '', marketRow?.ownedOnly ? '只有你自己的挂单' : '当前没有可购买库存'),
        element('p', '', marketRow?.ownedOnly
          ? '不能购买自己的商品，可以前往“我的拍卖”查看或撤回。'
          : '市场库存刚刚发生变化，请刷新后再试。'),
      );
      if (marketRow?.ownedOnly) purchase.append(button('查看我的拍卖', 'primary', () => setMode('mine')));
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
    quantity.max = String(catalog.kind === 'item' ? marketRow.buyableStock : 1);
    quantity.value = '1';
    quantity.disabled = catalog.kind !== 'item';
    quantityLabel.append(quantity);

    const total = element('div', 'rw-ah-buy-total');
    const action = button('购买', 'primary', async () => {
      requireLogin();
      const plan = purchaseSummary(detail, quantity.value);
      if (!plan) throw new Error('可购买库存不足');
      const local = await marketService.inventory();
      if (Number(local.coin || 0) < plan.total) {
        throw new Error('空间币不足：需要 ' + coin(plan.total) + '，当前只有 ' + coin(local.coin));
      }
      const breakdown = plan.lines.length > 1
        ? '\n' + plan.lines.map(line => (
            coin(line.listing.unit_price) + ' × ' + line.quantity + ' = ' + coin(line.subtotal)
          )).join('\n')
        : '';
      const ok = await confirmDialog({
        title: '确认购买',
        message: '购买“' + catalog.name + '” ×' + plan.quantity
          + '，合计 ' + coin(plan.total) + ' 空间币？' + breakdown,
        confirmText: '确认购买',
      });
      if (!ok) return;

      let completed = 0;
      try {
        for (const line of plan.lines) {
          await marketService.buy(line.listing, line.quantity);
          completed += line.quantity;
        }
      } catch (error) {
        if (['market_listing_unavailable', 'market_quantity_unavailable'].includes(error?.code)) {
          catalogCache.clear();
          try {
            await loadCatalog({ force: true });
            if (selectedKey) await loadCatalogDetail(selectedKey);
          } catch {}
          try {
            host.toastr?.warning?.(
              completed
                ? '市场在购买过程中发生变化，已完成 ' + completed + ' 件，其余未扣款；列表已刷新。'
                : '库存或价格刚刚发生变化，已刷新当前商品，请重新确认。',
              '空间集市',
            );
          } catch {}
          return;
        }
        throw error;
      }

      try { host.toastr?.success?.('购买完成，资产已写入当前存档', '空间集市'); } catch {}
      catalogCache.clear();
      await loadCatalog({ force: true });
      if (selectedKey) await loadCatalogDetail(selectedKey).catch(() => {});
      await refreshSummary();
    });

    const updateTotal = () => {
      const max = Math.max(1, Number(quantity.max) || 1);
      const requested = catalog.kind === 'item'
        ? Math.max(1, Math.min(max, Math.floor(Number(quantity.value) || 1)))
        : 1;
      quantity.value = String(requested);
      const plan = purchaseSummary(detail, requested);
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
      element(
        'small',
        'rw-ah-purchase-help',
        catalog.kind === 'item'
          ? '按 WoW 商品撮合方式自动从最低价开始购买；同价挂单优先最新上架。'
          : '非堆叠资产购买当前最低价挂单。',
      ),
    );
    wrap.append(purchase);
    nodes.marketInspector.replaceChildren(wrap);
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      empty(nodes.marketList, '正在读取空间集市…');
      selectedDetail = null;
      await loadCatalog({ force: true });
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

    let referenceDetail = null;
    let referencePrice = 0;
    try {
      const result = await marketService.catalog({
        query: asset.name,
        kind: asset.kind,
        sort: 'price_asc',
        limit: 20,
      });
      const same = (result?.items || []).find(item => (
        item.name === asset.name
        && (!quality(asset) || qualityRank(item.asset) === qualityRank(asset))
      )) || (result?.items || []).find(item => item.name === asset.name);
      if (same?.key) {
        referenceDetail = await marketService.catalogDetail(same.key);
        referencePrice = Number(referenceDetail?.catalog?.lowest_price || 0);
      }
    } catch {}

    const referenceBox = element('div', 'rw-ah-sell-market');
    const referenceHead = element('div', 'rw-ah-sell-market-head');
    referenceHead.append(
      element('span', '', '当前市场'),
      element('strong', '', referencePrice ? coin(referencePrice) + ' 空间币 / 件' : '暂无同名商品'),
    );
    referenceBox.append(referenceHead);
    if (referenceDetail?.ladder?.length) {
      const ladder = element('div', 'rw-ah-sell-market-ladder');
      for (const level of referenceDetail.ladder.slice(0, 5)) {
        const row = element('div', 'rw-ah-sell-market-row');
        row.append(
          element('span', '', coin(level.price)),
          element('span', '', level.stock + ' 件'),
          element('span', '', level.seller_count + ' 位卖家'),
        );
        ladder.append(row);
      }
      referenceBox.append(ladder);
    }
    if (referenceDetail?.history?.length) {
      const latest = referenceDetail.history[referenceDetail.history.length - 1];
      referenceBox.append(element(
        'small',
        'rw-ah-sell-market-history',
        '最近成交：均价 ' + coin(latest.average) + ' · '
          + '最低 ' + coin(latest.low) + ' · 最高 ' + coin(latest.high)
          + ' · 成交量 ' + latest.volume,
      ));
    }
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
    if (referencePrice) {
      const follow = button('跟随最低价', '', () => {
        price.value = String(referencePrice);
        price.dispatchEvent(new Event('input', { bubbles: true }));
      });
      follow.type = 'button';
      follow.title = 'WoW式同价竞争：不必刻意压低价格；同价时后上架优先成交。';
      priceField.append(follow);
    }

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

  const marketKindSelect = value => {
    const select = element('select', 'rw-select');
    for (const [kind, label] of Object.entries(MARKET_KIND_LABELS)) {
      const option = element('option', '', label);
      option.value = kind;
      option.selected = kind === value;
      select.append(option);
    }
    return select;
  };

  const marketQualitySelect = value => {
    const select = element('select', 'rw-select');
    const blank = element('option', '', '不限品质');
    blank.value = '';
    select.append(blank);
    for (const rank of ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']) {
      const option = element('option', '', rank);
      option.value = rank;
      option.selected = rank === value;
      select.append(option);
    }
    return select;
  };

  const field = (label, control) => {
    const node = element('label', 'rw-ah-order-field');
    node.append(element('span', '', label), control);
    return node;
  };

  async function renderCreateBuyOrder() {
    requireLogin();
    const editor = element('div', 'rw-ah-order-form');
    editor.append(
      element('div', 'rw-ah-section-label', '创建求购'),
      element('p', 'rw-ah-order-help', '空间币会先从当前存档扣除并作为求购托管；成交后自动支付给卖家，取消或到期会退回未使用金额。'),
    );

    const kind = marketKindSelect(orderDraft?.kind || 'item');
    const name = element('input', 'rw-input');
    name.placeholder = '准确商品名称';
    name.value = orderDraft?.name || '';
    const qualitySelect = marketQualitySelect(orderDraft?.quality || '');
    const subtype = element('input', 'rw-input');
    subtype.placeholder = '可选，例如 材料 / 消耗品';
    subtype.value = orderDraft?.subtype || '';
    const quantity = element('input', 'rw-input');
    quantity.type = 'number';
    quantity.min = '1';
    quantity.max = '9999';
    quantity.value = String(orderDraft?.quantity || 1);
    const unitPrice = element('input', 'rw-input');
    unitPrice.type = 'number';
    unitPrice.min = '1';
    unitPrice.max = '1000000000';
    unitPrice.placeholder = '每件愿意支付多少空间币';
    unitPrice.value = orderDraft?.unitPrice ? String(orderDraft.unitPrice) : '';
    const duration = element('select', 'rw-select');
    for (const hours of [24, 48, 72]) {
      const option = element('option', '', hours + ' 小时');
      option.value = String(hours);
      duration.append(option);
    }

    const syncQuantity = () => {
      const stackable = kind.value === 'item';
      quantity.disabled = !stackable;
      if (!stackable) quantity.value = '1';
    };
    kind.addEventListener('change', syncQuantity);
    syncQuantity();

    const grid = element('div', 'rw-ah-order-form-grid');
    grid.append(
      field('类型', kind),
      field('商品名称', name),
      field('品质', qualitySelect),
      field('子类型', subtype),
      field('数量', quantity),
      field('求购单价', unitPrice),
      field('有效期', duration),
    );
    editor.append(grid);

    const total = element('div', 'rw-ah-order-total');
    const updateTotal = () => {
      const amount = kind.value === 'item' ? Math.max(1, Math.floor(Number(quantity.value) || 1)) : 1;
      const price = Math.max(0, Math.floor(Number(unitPrice.value) || 0));
      total.textContent = price ? '需要托管 ' + coin(price * amount) + ' 空间币' : '设置求购单价后计算托管金额';
    };
    quantity.addEventListener('input', updateTotal);
    unitPrice.addEventListener('input', updateTotal);
    kind.addEventListener('change', updateTotal);
    updateTotal();
    editor.append(total);

    editor.append(button('创建求购单', 'primary', async () => {
      const productName = name.value.trim();
      const price = Math.floor(Number(unitPrice.value) || 0);
      const amount = kind.value === 'item' ? Math.max(1, Math.floor(Number(quantity.value) || 1)) : 1;
      if (!productName) throw new Error('请输入准确商品名称');
      if (price <= 0) throw new Error('请输入有效求购单价');
      await marketService.createBuyOrder({
        kind: kind.value,
        name: productName,
        quality: qualitySelect.value,
        subtype: subtype.value.trim(),
        quantity: amount,
        unitPrice: price,
        durationHours: Number(duration.value) || 24,
      });
      orderDraft = null;
      try { host.toastr?.success?.('求购单已创建，空间币已进入托管', '空间集市'); } catch {}
      await renderOrderMode();
      await refreshSummary();
    }));
    nodes.marketOrdersEditor.replaceChildren(editor);
  }

  async function renderCreateSwap() {
    requireLogin();
    const inventory = await marketService.inventory();
    if (!inventory.inHub) throw new Error('请回到主神空间后再创建交换');
    const assets = inventory.assets || [];
    if (!assets.length) {
      empty(nodes.marketOrdersEditor, '当前没有可用于交换的资产。');
      return;
    }

    const editor = element('div', 'rw-ah-order-form');
    editor.append(
      element('div', 'rw-ah-section-label', '创建交换'),
      element('p', 'rw-ah-order-help', '你提供的资产会先进入交换托管；成交后双方各自领取对方资产。取消或到期时原资产返还。'),
    );

    const offered = element('select', 'rw-select');
    assets.forEach((asset, index) => {
      const option = element('option', '', kindLabel(asset.kind) + ' · ' + asset.name + (asset.kind === 'item' ? ' ×' + asset.quantity : ''));
      option.value = String(index);
      offered.append(option);
    });
    const offeredQuantity = element('input', 'rw-input');
    offeredQuantity.type = 'number';
    offeredQuantity.min = '1';
    offeredQuantity.value = '1';

    const wantedKind = marketKindSelect('item');
    const wantedName = element('input', 'rw-input');
    wantedName.placeholder = '希望获得的准确商品名称';
    const wantedQuality = marketQualitySelect('');
    const wantedSubtype = element('input', 'rw-input');
    wantedSubtype.placeholder = '可选子类型';
    const wantedQuantity = element('input', 'rw-input');
    wantedQuantity.type = 'number';
    wantedQuantity.min = '1';
    wantedQuantity.value = '1';
    const duration = element('select', 'rw-select');
    for (const hours of [24, 48, 72]) {
      const option = element('option', '', hours + ' 小时');
      option.value = String(hours);
      duration.append(option);
    }

    const syncOffer = () => {
      const asset = assets[Number(offered.value) || 0];
      const stackable = asset?.kind === 'item';
      offeredQuantity.disabled = !stackable;
      offeredQuantity.max = String(stackable ? Math.max(1, Number(asset.quantity) || 1) : 1);
      if (!stackable) offeredQuantity.value = '1';
    };
    const syncWanted = () => {
      const stackable = wantedKind.value === 'item';
      wantedQuantity.disabled = !stackable;
      if (!stackable) wantedQuantity.value = '1';
    };
    offered.addEventListener('change', syncOffer);
    wantedKind.addEventListener('change', syncWanted);
    syncOffer();
    syncWanted();

    const grid = element('div', 'rw-ah-order-form-grid');
    grid.append(
      field('我提供', offered),
      field('提供数量', offeredQuantity),
      field('我需要', wantedKind),
      field('商品名称', wantedName),
      field('品质', wantedQuality),
      field('子类型', wantedSubtype),
      field('需要数量', wantedQuantity),
      field('有效期', duration),
    );
    editor.append(grid);

    editor.append(button('发布交换单', 'primary', async () => {
      const asset = assets[Number(offered.value) || 0];
      const productName = wantedName.value.trim();
      if (!asset) throw new Error('请选择用于交换的资产');
      if (!productName) throw new Error('请输入希望获得的商品名称');
      await marketService.createSwap({
        offered: {
          kind: asset.kind,
          key: asset.key,
          name: asset.name,
          quantity: asset.kind === 'item'
            ? Math.max(1, Math.min(Number(asset.quantity) || 1, Math.floor(Number(offeredQuantity.value) || 1)))
            : 1,
        },
        wanted: {
          kind: wantedKind.value,
          name: productName,
          quality: wantedQuality.value,
          subtype: wantedSubtype.value.trim(),
          quantity: wantedKind.value === 'item'
            ? Math.max(1, Math.floor(Number(wantedQuantity.value) || 1))
            : 1,
        },
        durationHours: Number(duration.value) || 24,
      });
      try { host.toastr?.success?.('交换单已发布，提供资产已进入托管', '空间集市'); } catch {}
      await renderOrderMode();
    }));
    nodes.marketOrdersEditor.replaceChildren(editor);
  }

  async function renderBuyOrderDetail(order) {
    const editor = element('div', 'rw-ah-order-detail');
    editor.append(
      element('div', 'rw-ah-section-label', '求购详情'),
      element('h3', '', order.asset_name),
    );
    const facts = element('div', 'rw-ah-order-facts');
    facts.append(
      element('span', '', kindLabel(order.asset_kind)),
      element('span', '', order.quality || '不限品质'),
      element('span', '', coin(order.unit_price) + ' 空间币 / 件'),
      element('span', '', '剩余 ' + order.remaining_quantity),
      element('span', '', until(order.expires_at) + '后到期'),
    );
    editor.append(facts);

    const inventory = await marketService.inventory();
    const matches = marketInventoryMatchesWanted(inventory.assets, {
      kind: order.asset_kind,
      name: order.asset_name,
      quality: order.quality,
      subtype: order.subtype,
    });
    const mine = Number(order.buyer?.id || 0) === currentUserId();
    if (mine) {
      editor.append(element('p', 'rw-ah-order-help', '这是你的求购单。可以在“我的拍卖 → 订单”里取消并取回剩余托管金额。'));
    } else if (!inventory.inHub) {
      editor.append(element('p', 'rw-market-notice warning', '当前在任务世界，只能浏览订单；回到主神空间后才能交付。'));
    } else if (!matches.length) {
      editor.append(element('p', 'rw-ah-order-help', '当前存档没有符合该求购条件的资产。'));
    } else {
      editor.append(element('div', 'rw-ah-section-label', '可交付资产'));
      const list = element('div', 'rw-ah-order-match-list');
      for (const asset of matches) {
        const row = element('div', 'rw-ah-order-match');
        const copy = element('div', 'rw-ah-order-match-copy');
        copy.append(
          qualityName(element('strong', '', asset.name), asset),
          element('span', '', kindLabel(asset.kind) + (quality(asset) ? ' · ' + quality(asset) : '')),
        );
        const qty = element('input', 'rw-input');
        qty.type = 'number';
        qty.min = '1';
        qty.max = String(asset.kind === 'item'
          ? Math.min(Number(asset.quantity) || 1, Number(order.remaining_quantity) || 1)
          : 1);
        qty.value = '1';
        qty.disabled = asset.kind !== 'item';
        const action = button('交付', 'primary', async () => {
          const amount = asset.kind === 'item' ? Math.max(1, Math.floor(Number(qty.value) || 1)) : 1;
          await marketService.fillBuyOrder(order, {
            kind: asset.kind,
            key: asset.key,
            name: asset.name,
            quantity: amount,
          });
          try { host.toastr?.success?.('已完成求购交付，货款进入待领取余额', '空间集市'); } catch {}
          await renderOrderMode();
          await refreshSummary();
        });
        row.append(copy, qty, action);
        list.append(row);
      }
      editor.append(list);
    }
    nodes.marketOrdersEditor.replaceChildren(editor);
  }

  async function renderSwapDetail(swap) {
    const editor = element('div', 'rw-ah-order-detail');
    editor.append(
      element('div', 'rw-ah-section-label', '交换详情'),
      element('h3', '', swap.offered?.name || '交换单'),
    );
    const exchange = element('div', 'rw-ah-swap-exchange');
    const offered = element('div', 'rw-ah-swap-side');
    offered.append(
      element('span', '', '对方提供'),
      element('strong', '', (swap.offered?.name || '资产') + ' ×' + (swap.offered?.quantity || 1)),
      element('small', '', kindLabel(swap.offered?.kind)),
    );
    const wanted = element('div', 'rw-ah-swap-side');
    wanted.append(
      element('span', '', '对方需要'),
      element('strong', '', (swap.wanted?.name || '资产') + ' ×' + (swap.wanted?.quantity || 1)),
      element('small', '', kindLabel(swap.wanted?.kind) + (swap.wanted?.quality ? ' · ' + swap.wanted.quality : '')),
    );
    exchange.append(offered, element('div', 'rw-ah-swap-arrow', '⇄'), wanted);
    editor.append(exchange, element('p', 'rw-ah-order-help', until(swap.expires_at) + '后到期'));

    const mine = Number(swap.owner?.id || 0) === currentUserId();
    if (mine) {
      editor.append(element('p', 'rw-ah-order-help', '这是你的交换单。可以在“我的拍卖 → 订单”中取消。'));
      nodes.marketOrdersEditor.replaceChildren(editor);
      return;
    }

    const inventory = await marketService.inventory();
    const matches = marketInventoryMatchesWanted(inventory.assets, swap.wanted);
    if (!inventory.inHub) {
      editor.append(element('p', 'rw-market-notice warning', '回到主神空间后才能接受交换。'));
    } else if (!matches.length) {
      editor.append(element('p', 'rw-ah-order-help', '当前存档没有符合交换要求的资产。'));
    } else {
      editor.append(element('div', 'rw-ah-section-label', '选择用于交换的资产'));
      const list = element('div', 'rw-ah-order-match-list');
      for (const asset of matches) {
        const row = element('div', 'rw-ah-order-match');
        const copy = element('div', 'rw-ah-order-match-copy');
        copy.append(
          qualityName(element('strong', '', asset.name), asset),
          element('span', '', kindLabel(asset.kind) + (quality(asset) ? ' · ' + quality(asset) : '')),
        );
        const qty = element('input', 'rw-input');
        qty.type = 'number';
        qty.min = '1';
        qty.max = String(asset.kind === 'item'
          ? Math.min(Number(asset.quantity) || 1, Number(swap.wanted?.quantity) || 1)
          : 1);
        qty.value = String(asset.kind === 'item' ? Math.min(Number(swap.wanted?.quantity) || 1, Number(asset.quantity) || 1) : 1);
        qty.disabled = asset.kind !== 'item';
        row.append(copy, qty, button('接受交换', 'primary', async () => {
          const amount = asset.kind === 'item' ? Math.max(1, Math.floor(Number(qty.value) || 1)) : 1;
          await marketService.acceptSwap(swap, {
            kind: asset.kind,
            key: asset.key,
            name: asset.name,
            quantity: amount,
          });
          try { host.toastr?.success?.('交换完成，请到“我的拍卖 → 待领取”领取对方资产', '空间集市'); } catch {}
          await renderOrderMode();
        }));
        list.append(row);
      }
      editor.append(list);
    }
    nodes.marketOrdersEditor.replaceChildren(editor);
  }

  async function renderOrderMode() {
    requireLogin();
    const result = currentOrderView === 'swap'
      ? await marketService.listSwaps({ limit: 60 })
      : await marketService.listBuyOrders({ limit: 60 });
    const items = result?.items || [];
    for (const tab of nodes.marketOrderViews || []) {
      tab.classList.toggle('is-active', tab.dataset.marketOrderView === currentOrderView);
    }
    if (nodes.marketOrderCreate) nodes.marketOrderCreate.hidden = currentOrderView !== 'buy';
    if (nodes.marketSwapCreate) nodes.marketSwapCreate.hidden = currentOrderView !== 'swap';

    if (!items.length) {
      empty(nodes.marketOrdersList, currentOrderView === 'swap' ? '当前没有公开交换单。' : '当前没有公开求购单。');
      selectedOrderId = '';
      if (!orderDraft) {
        empty(nodes.marketOrdersEditor, currentOrderView === 'swap' ? '可以创建第一条交换单。' : '可以创建第一条求购单。');
      }
      return;
    }

    const cards = items.map(item => {
      const row = element('button', 'rw-ah-order-row');
      row.type = 'button';
      row.classList.toggle('is-selected', item.id === selectedOrderId);
      if (currentOrderView === 'swap') {
        row.append(
          element('strong', '', (item.offered?.name || '资产') + ' ⇄ ' + (item.wanted?.name || '资产')),
          element('span', '', '提供 ×' + (item.offered?.quantity || 1) + ' · 需要 ×' + (item.wanted?.quantity || 1)),
          element('small', '', (item.owner?.display_name || '匿名轮回者') + ' · ' + until(item.expires_at)),
        );
      } else {
        row.append(
          qualityName(element('strong', '', item.asset_name), { quality: item.quality }),
          element('span', '', coin(item.unit_price) + ' 空间币 / 件 · 剩余 ' + item.remaining_quantity),
          element('small', '', (item.buyer?.display_name || '匿名轮回者') + ' · ' + until(item.expires_at)),
        );
      }
      row.addEventListener('click', () => {
        selectedOrderId = item.id;
        void renderOrderMode().then(() => (
          currentOrderView === 'swap' ? renderSwapDetail(item) : renderBuyOrderDetail(item)
        )).catch(notifyError);
      });
      return row;
    });
    nodes.marketOrdersList.replaceChildren(...cards);

    const selected = items.find(item => item.id === selectedOrderId) || items[0];
    selectedOrderId = selected.id;
    for (const [index, child] of [...nodes.marketOrdersList.children].entries()) {
      child.classList.toggle('is-selected', items[index]?.id === selectedOrderId);
    }
    if (!orderDraft) {
      if (currentOrderView === 'swap') await renderSwapDetail(selected);
      else await renderBuyOrderDetail(selected);
    }
  }

  const renderWallet = (state, content) => {
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
  };

  async function renderMineMode() {
    requireLogin();
    const state = await marketService.mine();
    for (const tab of nodes.marketMineViews || []) {
      tab.classList.toggle('is-active', tab.dataset.marketMineView === currentMineView);
    }
    const content = element('div', 'rw-ah-mine-stack');
    renderWallet(state, content);

    if (currentMineView === 'active') {
      const active = (state.listings || []).filter(value => value.status === 'active' && !value.expired);
      const activeSection = section('正在出售', String(active.length));
      if (!active.length) activeSection.append(element('div', 'rw-ah-muted-line', '当前没有在售拍卖。'));
      for (const listing of active) {
        const expiryText = listing.expires_at ? until(listing.expires_at) + '后到期' : '无到期时间';
        const marketLow = Number(listing.market_lowest_price || 0);
        const position = marketLow > 0
          ? Number(listing.unit_price) <= marketLow
            ? '当前最低价'
            : '高于最低价 ' + coin(Number(listing.unit_price) - marketLow)
          : '暂无可比市场价';
        activeSection.append(transactionRow(
          (listing.asset?.name || '资产') + ' · 剩余 ' + listing.remaining_quantity,
          coin(listing.unit_price) + ' / 件 · ' + position + ' · ' + expiryText,
          [button('取消拍卖', 'danger', async () => {
            const ok = await confirmDialog({
              title: '取消拍卖',
              message: '撤回“' + listing.asset?.name + '”剩余 ' + listing.remaining_quantity + ' 件？上架税不会退还。',
              confirmText: '取消拍卖',
              danger: true,
            });
            if (!ok) return;
            await marketService.cancel(listing.id);
            catalogCache.clear();
            await renderMineMode();
          })],
        ));
      }
      content.append(activeSection);
    } else if (currentMineView === 'expired') {
      const expired = (state.listings || []).filter(
        value => value.status === 'active' && value.expired && Number(value.remaining_quantity || 0) > 0,
      );
      const expiredSection = section('已到期 · 待取回', String(expired.length));
      if (!expired.length) expiredSection.append(element('div', 'rw-ah-muted-line', '没有等待取回的到期拍卖。'));
      for (const listing of expired) {
        expiredSection.append(transactionRow(
          (listing.asset?.name || '资产') + ' · 剩余 ' + listing.remaining_quantity,
          '已下架 · ' + until(listing.recycle_at) + '后系统自动回收',
          [button('取回资产', 'primary', async () => {
            await marketService.cancel(listing.id);
            await renderMineMode();
          })],
        ));
      }
      content.append(expiredSection);
    } else if (currentMineView === 'recovery') {
      const pending = []
        .concat((state.pending_deliveries || []).map(value => ({ type: 'trade', value })))
        .concat((state.pending_returns || []).map(value => ({ type: 'return', value })))
        .concat((state.pending_payouts || []).map(value => ({ type: 'payout', value })))
        .concat((state.pending_order_deliveries || []).map(value => ({ type: 'order', value })))
        .concat((state.pending_swap_transfers || []).map(value => ({ type: 'swap', value })));
      const recovery = section('待领取 / 待恢复', String(pending.length));
      if (!pending.length) recovery.append(element('div', 'rw-ah-muted-line', '没有待恢复事务。'));
      if (pending.length) {
        recovery.append(button('全部领取', 'primary', async () => {
          for (const entry of pending) {
            if (entry.type === 'trade') await marketService.deliverTrade(entry.value);
            else if (entry.type === 'return') await marketService.receiveReturn(entry.value);
            else if (entry.type === 'payout') await marketService.receivePayout(entry.value);
            else if (entry.type === 'order') await marketService.deliverOrderFill(entry.value);
            else if (entry.type === 'swap') await marketService.receiveSwapTransfer(entry.value);
          }
          await renderMineMode();
          await refreshSummary();
        }));
      }
      for (const entry of pending) {
        const value = entry.value;
        const title = {
          trade: '购买待领取',
          return: '撤回待返还',
          payout: '货款待写入',
          order: '求购待领取',
          swap: '交换待领取',
        }[entry.type];
        const assetName = value.asset?.name || (entry.type === 'payout' ? coin(value.amount) + ' 空间币' : '资产');
        recovery.append(transactionRow(
          title + ' · ' + assetName + (value.asset ? ' ×' + (value.quantity || value.asset.quantity || 1) : ''),
          when(value.created_at),
          [button('领取', 'primary', async () => {
            if (entry.type === 'trade') await marketService.deliverTrade(value);
            else if (entry.type === 'return') await marketService.receiveReturn(value);
            else if (entry.type === 'payout') await marketService.receivePayout(value);
            else if (entry.type === 'order') await marketService.deliverOrderFill(value);
            else if (entry.type === 'swap') await marketService.receiveSwapTransfer(value);
            await renderMineMode();
            await refreshSummary();
          })],
        ));
      }
      content.append(recovery);
    } else if (currentMineView === 'history') {
      const recycleRecords = []
        .concat((state.buybacks || []).map(value => ({ ...value, side: '主动回收', amount: Number(value.amount || 0) })))
        .concat((state.recycles || []).map(value => ({ ...value, side: '到期自动回收', amount: Number(value.amount || 0) })))
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
        .slice(0, 30);
      const recycleHistory = section('系统回收记录', String(recycleRecords.length));
      if (!recycleRecords.length) recycleHistory.append(element('div', 'rw-ah-muted-line', '还没有系统回收记录。'));
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
        .concat((state.order_fills || []).map(value => ({
          ...value,
          side: Number(value.buyer?.id || 0) === currentUserId() ? '求购获得' : '完成求购',
        })))
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
        .slice(0, 50);
      const history = section('成交记录', String(records.length));
      if (!records.length) history.append(element('div', 'rw-ah-muted-line', '还没有成交记录。'));
      for (const trade of records) {
        let settlement = '成交 ' + coin(trade.total_price) + ' 空间币';
        if (trade.side === '卖出') {
          settlement = '成交 ' + coin(trade.total_price) + ' · 公证费 ' + coin(trade.market_fee) + ' · 实收 ' + coin(trade.seller_proceeds);
        }
        history.append(transactionRow(
          trade.side + ' · ' + (trade.asset?.name || '资产') + ' ×' + (trade.quantity || 1),
          settlement + ' · ' + when(trade.created_at),
        ));
      }
      content.append(history);
    } else if (currentMineView === 'orders') {
      const activeOrders = (state.buy_orders || []).filter(value => value.status === 'active');
      const orderSection = section('我的求购', String(activeOrders.length));
      if (!activeOrders.length) orderSection.append(element('div', 'rw-ah-muted-line', '当前没有进行中的求购单。'));
      for (const order of activeOrders) {
        orderSection.append(transactionRow(
          order.asset_name + ' · 剩余 ' + order.remaining_quantity,
          coin(order.unit_price) + ' / 件 · 托管余额 ' + coin(order.escrow_balance) + ' · ' + until(order.expires_at),
          [button('取消求购', 'danger', async () => {
            await marketService.cancelBuyOrder(order.id);
            await renderMineMode();
            await refreshSummary();
          })],
        ));
      }
      content.append(orderSection);

      const activeSwaps = (state.swaps || []).filter(value => value.status === 'active' && Number(value.owner?.id || 0) === currentUserId());
      const swapSection = section('我的交换', String(activeSwaps.length));
      if (!activeSwaps.length) swapSection.append(element('div', 'rw-ah-muted-line', '当前没有进行中的交换单。'));
      for (const swap of activeSwaps) {
        swapSection.append(transactionRow(
          (swap.offered?.name || '资产') + ' ⇄ ' + (swap.wanted?.name || '资产'),
          until(swap.expires_at) + '后到期',
          [button('取消交换', 'danger', async () => {
            await marketService.cancelSwap(swap.id);
            await renderMineMode();
          })],
        ));
      }
      content.append(swapSection);
    }

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
