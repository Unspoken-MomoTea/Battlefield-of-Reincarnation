import { MARKET_KIND_LABELS } from '../services/market-service.js';
import { createMarketBrowseStore } from './market-browse-store.js';
import { createMarketDealView } from './market-deal-view.js';
import {
  marketAssetDetailEntries,
  marketAssetFieldDisplay,
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
  let catalogItems = [];
  let catalogCounts = {};
  let catalogFacets = { qualities: [], subtypes: [] };
  const browseStore = createMarketBrowseStore({ marketService });
  let detailTimer = null;
  let selectedKey = '';
  let selectedDetail = null;
  let loading = false;
  let currentKind = '';
  let currentMode = 'browse';
  let currentMineView = 'active';
  const MARKET_VIEW_CACHE_MS = 15_000;
  let mineStateCache = null;
  let mineStateLoadedAt = 0;
  let mineStatePending = null;
  let mineRequestSerial = 0;
  let sellEditorSerial = 0;
  let sellQuoteTimer = null;
  let sellInventory = null;
  let selectedSellIndex = -1;
  const expandedSellKinds = new Set(['equipment']);
  const MAX_ACTIVE_LISTINGS = 10;
  const dealView = createMarketDealView({
    nodes,element,button,empty,notifyError,confirmDialog,marketService,getAuth,
  });

  const currentUserId = () => Number(getAuth()?.user?.id || 0);

  const requireLogin = () => {
    const user = getAuth()?.user;
    if (!user) throw new Error('请先登录 Discord 后再进行空间集市交易');
    return user;
  };

  const kindLabel = kind => MARKET_KIND_LABELS[kind] || '资产';

  const dataValue = (value, depth = 0, decorateQuality = false) => {
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
          const chip = element('span', 'rw-ah-data-chip', item == null ? '—' : String(item));
          if (decorateQuality && qualityRank({ quality: item }) !== 'NONE') qualityName(chip, { quality: item });
          list.append(chip);
        }
        return list;
      }
      value.forEach((item, index) => {
        const row = element('div', 'rw-ah-data-nested');
        row.append(element('span', 'rw-ah-data-key', String(index + 1)), dataValue(item, depth + 1, decorateQuality));
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
        row.append(
          element('span', 'rw-ah-data-key', key),
          dataValue(nested, depth + 1, decorateQuality || key === '品质' || key === '原始属性'),
        );
        group.append(row);
      }
      return group;
    }

    const text = element('span', 'rw-ah-data-value', String(value));
    return decorateQuality && qualityRank({ quality: value }) !== 'NONE'
      ? qualityName(text, { quality: value })
      : text;
  };

  const rawAttributeChips = attributes => {
    const wrap = element('span', 'rw-ah-teammate-raw');
    for (const attr of attributes || []) {
      const chip = element('span', 'rw-ah-teammate-raw-item');
      chip.append(
        element('span', '', attr.name + '：'),
        qualityRank({ quality: attr.value }) !== 'NONE'
          ? qualityName(element('strong', '', attr.value), { quality: attr.value })
          : element('strong', '', attr.value),
      );
      wrap.append(chip);
    }
    return wrap;
  };

  const teammateChips = (items, { occupations = false } = {}) => {
    const wrap = element('div', 'rw-ah-teammate-chips');
    for (const item of items || []) {
      const chip = element('span', 'rw-ah-teammate-chip');
      chip.append(element('strong', '', item.name || String(item)));
      if (occupations && item.meta) chip.append(element('small', '', item.meta));
      else if (!occupations && item.rank) chip.append(
        qualityName(element('small', '', item.rank), { quality: item.rank }),
      );
      if (!occupations && Number(item.quantity || 1) > 1) {
        chip.append(element('em', '', '×' + Number(item.quantity)));
      }
      if (!occupations && item.rawAttributes?.length) {
        chip.classList.add('has-raw');
        chip.append(rawAttributeChips(item.rawAttributes));
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

    if (model.rawAttributes?.length) {
      const row = element('div', 'rw-ah-teammate-meta-row');
      row.append(
        element('span', 'rw-ah-teammate-meta-label', '原始属性'),
        rawAttributeChips(model.rawAttributes),
      );
      summary.append(row);
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
      row.append(
        element('span', 'rw-ah-data-key', key),
        dataValue(displayValue, 0, key === '品质' || key === '原始属性'),
      );
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

  const invalidateMineState = () => {
    mineStateCache = null;
    mineStateLoadedAt = 0;
    mineStatePending = null;
    mineRequestSerial += 1;
  };

  const invalidateTradingViews = () => {
    invalidateMineState();
  };

  async function loadMineState({ force = false } = {}) {
    const fresh = mineStateCache && Date.now() - mineStateLoadedAt <= MARKET_VIEW_CACHE_MS;
    if (!force && fresh) return mineStateCache;
    if (!force && mineStatePending) return mineStatePending;
    const serial = ++mineRequestSerial;
    const request = marketService.mine().then(state => {
      if (serial === mineRequestSerial) {
        mineStateCache = state;
        mineStateLoadedAt = Date.now();
      }
      return state;
    }).finally(() => {
      if (mineStatePending === request) mineStatePending = null;
    });
    mineStatePending = request;
    return request;
  }

  async function setMode(mode) {
    if (!['browse', 'sell', 'orders', 'mine'].includes(mode)) return;
    if (mode !== 'browse') requireLogin();
    currentMode = mode;
    setModeVisuals();
    if (mode === 'browse' && !browseStore.pageQuery(browseFilters()).loaded_at) await refresh();
    if (mode === 'sell' && !browseStore.query().loaded_at) {
      void browseStore.ensureSnapshot().catch(() => {});
    }
    if (mode === 'sell') await renderSellMode();
    if (mode === 'orders') await dealView.render();
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

  const syncSubtypeOptions = () => {
    if (!nodes.marketSubtype) return;
    const selected = nodes.marketSubtype.value;
    const options = [element('option', '', '全部子类型')];
    options[0].value = '';
    for (const item of catalogFacets.subtypes || []) {
      const label = currentKind
        ? marketAssetFieldDisplay({ kind: currentKind }, '类型', item.value)
        : item.value;
      const option = element('option', '', String(label) + ' · ' + item.count);
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
      selectedDetail = browseStore.peekDetail(item.key);
      renderCatalogRows();
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
      const cached = browseStore.peekDetail(selectedKey);
      if (cached) {
        selectedDetail = cached;
        renderInspector(cached);
      } else {
        selectedDetail = null;
        renderInspectorPreview(selected);
        scheduleCatalogDetail(selectedKey);
      }
    }
    const listingCount = Object.values(catalogCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    nodes.marketCount.textContent = catalogItems.length + ' 种商品 · ' + listingCount + ' 个当前挂单';
    const page=browseStore.pageQuery(browseFilters());
    if (nodes.marketMore) nodes.marketMore.hidden = page.next_offset == null;
    if (nodes.marketPrev) nodes.marketPrev.hidden = !page.offset;
    if (nodes.marketPage) nodes.marketPage.textContent = '第 '+(Math.floor((page.offset||0)/50)+1)+' 页 · 每页最多 50 种';
    renderCategoryCounts();
  }

  async function loadCatalog({ force = false } = {}) {
    const filters = browseFilters();
    if (force) await browseStore.refreshPage(filters);
    else await browseStore.ensurePage(filters);

    const result = browseStore.pageQuery(filters);
    catalogItems = result.items;
    catalogCounts = result.counts;
    catalogFacets = result.facets;
    syncSubtypeOptions();
    renderCatalogRows();
    return result;
  }

  function renderInspectorPreview(item) {
    if (!nodes.marketInspector || !item) {
      renderInspector(null);
      return;
    }
    const wrap = element('div', 'rw-ah-inspector-body');
    const head = element('div', 'rw-ah-detail-head');
    head.append(element('div', 'rw-ah-inspector-title', '详情'));
    wrap.append(head, assetDetail(item.asset));

    const live = element('div', 'rw-ah-ladder');
    live.append(
      element('div', 'rw-ah-section-label', '当前市场'),
      element(
        'div',
        'rw-ah-muted-line',
        (Number(item.lowest_price || 0) > 0
          ? '当前最低价 ' + coin(item.lowest_price) + ' 空间币 · 库存 ' + Number(item.total_stock || 0)
          : '当前暂无公开库存')
          + ' · 实时价格梯度正在后台同步…',
      ),
    );
    wrap.append(live);

    const purchase = element('div', 'rw-ah-purchase-box');
    purchase.append(
      element('strong', '', '实时库存同步中'),
      element('p', '', '资产详情已从本地目录快照立即显示；购买按钮会在实时价格档位同步后启用。'),
    );
    wrap.append(purchase);
    nodes.marketInspector.replaceChildren(wrap);
  }

  function scheduleCatalogDetail(catalogKey) {
    if (detailTimer != null) clearTimeout(detailTimer);
    const key = String(catalogKey || '');
    detailTimer = setTimeout(() => {
      detailTimer = null;
      if (!key || selectedKey !== key) return;
      void loadCatalogDetail(key).catch(notifyError);
    }, 120);
  }

  async function loadCatalogDetail(catalogKey, { force = false } = {}) {
    const detail = await browseStore.detail(catalogKey, { force });
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
    head.append(element('div', 'rw-ah-inspector-title', '详情'));
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
      const max = Math.max(1, Number(quantity.max) || 1);
      const requested = catalog.kind === 'item'
        ? Math.max(1, Math.min(max, Math.floor(Number(quantity.value) || 1)))
        : 1;
      const quote = await marketService.quoteCatalogPurchase(catalog.key, requested);
      if (!quote?.total_price) throw new Error('当前没有可购买库存');

      const local = await marketService.inventory();
      if (Number(local.coin || 0) < Number(quote.total_price)) {
        throw new Error(
          '空间币不足：需要 ' + coin(quote.total_price) + '，当前只有 ' + coin(local.coin),
        );
      }
      const breakdown = (quote.levels || []).length > 1
        ? '\n' + quote.levels.map(level => (
            coin(level.price) + ' × ' + level.quantity
          )).join('\n')
        : '';
      const ok = await confirmDialog({
        title: '确认购买',
        message: '购买“' + catalog.name + '” ×' + quote.quantity
          + '，合计 ' + coin(quote.total_price) + ' 空间币？' + breakdown,
        confirmText: '确认购买',
      });
      if (!ok) return;

      try {
        await marketService.buyCatalog(catalog, quote.quantity, quote);
        invalidateTradingViews();
      } catch (error) {
        if ([
          'market_catalog_unavailable',
          'market_quantity_unavailable',
          'market_price_changed',
          'market_purchase_changed',
        ].includes(error?.code)) {
          browseStore.invalidate();
          try {
            await loadCatalog({ force: true });
            if (selectedKey) await loadCatalogDetail(selectedKey);
          } catch {}
          try {
            host.toastr?.warning?.(
              '库存或价格刚刚发生变化，本次未扣款；列表已刷新，请重新确认。',
              '空间集市',
            );
          } catch {}
          return;
        }
        throw error;
      }

      try { host.toastr?.success?.('购买完成，资产已写入当前存档', '空间集市'); } catch {}
      browseStore.invalidate();
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
          ? '按 WoW 商品撮合方式由服务器一次性从最低价开始成交；确认前若价格或库存变化会整笔取消并刷新。'
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
      cells.push(['区域', local.inHub ? '主神空间' : '任务世界']);
    } catch {
      cells.push(['当前存档', '未读取']);
    }

    if (getAuth()?.user && mineStateCache) {
      cells.push(['待领货款', coin(mineStateCache.wallet?.balance)]);
    }

    nodes.marketSummary.replaceChildren(...cells.map(([label, value]) => {
      const cell = element('div', 'rw-ah-account-cell');
      cell.append(element('span', '', label), element('strong', '', value));
      return cell;
    }));

    if (getAuth()?.user && !mineStateCache) {
      void loadMineState()
        .then(() => refreshSummary())
        .catch(() => {});
    }
  }

  const sellRow = (asset, index) => {
    const row = element('button', 'rw-ah-inventory-row');
    row.type = 'button';
    row.classList.toggle('is-selected', selectedSellIndex === index);
    const copy = element('span', 'rw-ah-inventory-copy');
    copy.append(
      qualityName(element('strong', '', asset.name), asset),
      qualityName(element('small', '', kindLabel(asset.kind) + (quality(asset) ? ' · ' + quality(asset) : '')), asset),
    );
    row.append(
      copy,
      element('span', 'rw-ah-inventory-qty', asset.kind === 'item' ? '×' + asset.quantity : '1'),
    );
    row.addEventListener('click', () => {
      selectedSellIndex = index;
      for (const item of nodes.marketSellList.querySelectorAll('.rw-ah-inventory-row')) {
        item.classList.toggle('is-selected', item === row);
      }
      void renderSellEditor(asset).catch(notifyError);
    });
    return row;
  };

  function renderSellList() {
    const assets = sellInventory?.assets || [];
    if (!assets.length) {
      empty(nodes.marketSellList, '当前角色没有可出售资产。');
    } else {
      const groups = new Map();
      assets.forEach((asset, index) => {
        if (!groups.has(asset.kind)) groups.set(asset.kind, []);
        groups.get(asset.kind).push({ asset, index });
      });
      const sections = [];
      for (const kind of Object.keys(MARKET_KIND_LABELS)) {
        const entries = groups.get(kind) || [];
        if (!entries.length) continue;
        const section = element('details', 'rw-ah-inventory-group');
        section.open = expandedSellKinds.has(kind)
          || entries.some(entry => entry.index === selectedSellIndex);
        const summary = element('summary', 'rw-ah-inventory-group-head');
        summary.append(
          element('span', '', kindLabel(kind)),
          element('small', '', entries.length + ' 项'),
        );
        const body = element('div', 'rw-ah-inventory-group-content');
        body.append(...entries.map(({ asset, index }) => sellRow(asset, index)));
        section.append(summary, body);
        section.addEventListener('toggle', () => {
          if (section.open) expandedSellKinds.add(kind);
          else expandedSellKinds.delete(kind);
        });
        sections.push(section);
      }
      nodes.marketSellList.replaceChildren(...sections);
    }
    nodes.marketSellCount.textContent = assets.length + ' 项';
  }

  async function renderSellEditor(asset) {
    const serial = ++sellEditorSerial;
    if (sellQuoteTimer != null) {
      clearTimeout(sellQuoteTimer);
      sellQuoteTimer = null;
    }
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

    // Category and quality are already visible in the left inventory row
    // and the right-hand asset data. A second header repeats them.
    const editor = element('div', 'rw-ah-sell-editor-body');
    editor.append(assetDetail(asset));
    if (asset.kind === 'teammate') {
      editor.append(element(
        'p',
        'rw-market-notice warning',
        '角色一旦成功上架，好感度会归零（原本为负数则保留负值），态度重置为“被交易的货物，对原主失去一切信任”。撤回拍卖时也会保留该交易状态。',
      ));
    }

    // Asset selection reads only the in-memory market snapshot. No HTTP round-trip
    // may delay the right-hand editor, even when no market snapshot exists yet.
    const referenceResult = browseStore.query({
      query: asset.name,
      kind: asset.kind,
      sort: 'price_asc',
    });
    const referenceItem = referenceResult.items.find(item => (
      item.name === asset.name
      && (!quality(asset) || qualityRank(item.asset) === qualityRank(asset))
    )) || referenceResult.items.find(item => item.name === asset.name);
    const referenceDetail = referenceItem?.key ? browseStore.peekDetail(referenceItem.key) : null;
    const referencePrice = Number(referenceItem?.lowest_price || 0);
    const referenceBox = element('div', 'rw-ah-sell-market');
    const referenceHead = element('div', 'rw-ah-sell-market-head');
    referenceHead.append(
      element('span', '', '当前市场'),
      element('strong', '', referencePrice ? coin(referencePrice) + ' 空间币 / 件' : '暂无本地参考价'),
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
    const cachedMine = mineStateCache;
    const slots = element('div', 'rw-ah-listing-slots', '正在同步账号挂单名额…');
    const limitNotice = element('p', 'rw-market-notice warning');
    limitNotice.hidden = true;
    editor.append(slots, limitNotice);

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
        ? '预计成交额 ' + coin(gross) + ' 空间币 · 成交后不再扣费'
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
    const scheduleSellQuotes = () => {
      if (sellQuoteTimer != null) clearTimeout(sellQuoteTimer);
      sellQuoteTimer = setTimeout(() => {
        sellQuoteTimer = null;
        if (serial !== sellEditorSerial) return;
        void refreshQuote().catch(() => {});
        void refreshBuyback().catch(() => {});
      }, 180);
    };
    qty.addEventListener('change', scheduleSellQuotes);
    price.addEventListener('input', syncGross);
    duration.addEventListener('change', scheduleSellQuotes);
    syncGross();

    const submit = button('创建拍卖', 'primary', async () => {
      const latestMine = await marketService.mine();
      if (Number(latestMine?.active_listing_count || 0) >= Number(latestMine?.active_listing_limit || MAX_ACTIVE_LISTINGS)) {
        throw new Error('在售挂单已达到 10 个上限，请先撤回或等待售完');
      }
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
          + ' 空间币；成交后全额结算，不再额外扣费。到期后有 72 小时取回期，逾期由系统自动回收。',
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
      invalidateTradingViews();
      try { host.toastr?.success?.('已创建拍卖', '空间集市'); } catch {}
      selectedSellIndex = -1;
      await renderSellMode();
      await refresh();
    });

    const updateSlots = mine => {
      if (serial !== sellEditorSerial) return;
      const count = Number(mine?.active_listing_count || 0);
      const limit = Number(mine?.active_listing_limit || MAX_ACTIVE_LISTINGS);
      slots.textContent = '在售挂单 ' + count + ' / ' + limit;
      slots.classList.toggle('is-full', count >= limit);
      submit.disabled = count >= limit;
      const full = count >= limit;
      limitNotice.hidden = !full;
      limitNotice.textContent = full
        ? '当前存档最多同时上架 ' + limit + ' 个商品，请先撤回或等待售完。'
        : '';
    };
    if (cachedMine) updateSlots(cachedMine);
    // The server remains authoritative; the visual quota is filled asynchronously.
    void loadMineState().then(updateSlots).catch(() => {
      if (serial === sellEditorSerial) slots.textContent = '挂单名额暂不可用，上架时将重新校验';
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
      invalidateTradingViews();
      try { host.toastr?.success?.('资产已由系统回收，空间币已写入当前存档', '空间集市'); } catch {}
      selectedSellIndex = -1;
      await renderSellMode();
      await refreshSummary();
    });
    buyback.append(buybackCopy, buybackButton);
    editor.append(buyback);

    async function refreshBuyback() {
      try {
        const quote = await marketService.quoteBuyback(asset, amountValue());
        if (serial !== sellEditorSerial) return null;
        buybackValue.textContent = quote ? coin(quote.total_price) + ' 空间币' : '暂时无法估价';
        buybackButton.disabled = !quote;
        return quote;
      } catch {
        if (serial === sellEditorSerial) {
          buybackValue.textContent = '暂时无法估价';
          buybackButton.disabled = true;
        }
        return null;
      }
    }
    buybackButton.disabled = true;
    scheduleSellQuotes();

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
        invalidateTradingViews();
        try { host.toastr?.success?.('货款已写入当前存档', '空间集市'); } catch {}
        await renderMineMode();
        await refreshSummary();
      }));
    }
    content.append(wallet);
  };

  async function renderMineMode({ force = false } = {}) {
    requireLogin();
    const state = await loadMineState({ force });
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
            browseStore.invalidate();
            invalidateTradingViews();
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
            browseStore.invalidate();
            invalidateTradingViews();
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
        .concat((state.pending_swap_transfers || []).map(value => ({ type: 'swap', value })))
        .concat((state.pending_deal_transfers || []).map(value => ({ type: 'deal', value })))
        .concat((state.pending_local_deal_escrows || []).map(value => ({ type: 'deal-check', value })));
      const recovery = section('待领取 / 待恢复', String(pending.length));
      if (!pending.length) recovery.append(element('div', 'rw-ah-muted-line', '没有待恢复事务。'));
      if (pending.length) {
        if(pending.some(entry=>entry.type!=='deal-check'))recovery.append(button('全部领取', 'primary', async () => {
          for (const entry of pending) {
            if (entry.type === 'trade') await marketService.deliverTrade(entry.value);
            else if (entry.type === 'return') await marketService.receiveReturn(entry.value);
            else if (entry.type === 'payout') await marketService.receivePayout(entry.value);
            else if (entry.type === 'order') await marketService.deliverOrderFill(entry.value);
            else if (entry.type === 'swap') await marketService.receiveSwapTransfer(entry.value);
            else if (entry.type === 'deal') await marketService.receiveDealTransfer(entry.value);
          }
          invalidateTradingViews();
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
          deal: '自由订单待领取／退还',
          'deal-check': '托管状态待核对',
        }[entry.type];
        const offered = (value.offer?.assets || []).map(asset =>
          (asset.name || '资产') + ' ×' + (asset.quantity || 1)).join(' + ');
        const dealCoins = Number(value.offer?.coins || 0);
        const assetName = entry.type === 'deal-check'
          ? (value.description || value.dealId || '托管订单')
          : entry.type === 'deal'
            ? [offered,dealCoins ? coin(dealCoins)+' 空间币' : ''].filter(Boolean).join(' + ')
          : (value.asset?.name || (entry.type === 'payout' ? coin(value.amount) + ' 空间币' : '资产'));
        recovery.append(transactionRow(
          title + ' · ' + assetName + (value.asset ? ' ×' + (value.quantity || value.asset.quantity || 1) : ''),
          when(value.created_at),
          [button(entry.type==='deal-check'?'核对托管':'领取', 'primary', async () => {
            if(entry.type==='deal-check')await marketService.reconcilePendingDealEscrow(value.id);
            else if (entry.type === 'trade') await marketService.deliverTrade(value);
            else if (entry.type === 'return') await marketService.receiveReturn(value);
            else if (entry.type === 'payout') await marketService.receivePayout(value);
            else if (entry.type === 'order') await marketService.deliverOrderFill(value);
            else if (entry.type === 'swap') await marketService.receiveSwapTransfer(value);
            else if (entry.type === 'deal') await marketService.receiveDealTransfer(value);
            invalidateTradingViews();
            await renderMineMode();
            await refreshSummary();
          })],
        ));
      }
      content.append(recovery);
    } else if (currentMineView === 'orders') {
      const block=section('自由交易订单');
      block.append(element('p','rw-ah-order-help',
        '统一订单已移至顶部「订单 → 我的订单」，可在那里查看收到的报价、接受交易、撤回报价及领取资产。'));
      content.append(block);
    }

    nodes.marketMineContent.replaceChildren(content);
  }

  const applyBrowseFilters = () => {
    selectedKey = '';
    selectedDetail = null;
    void loadCatalog().catch(notifyError);
  };

  nodes.marketSearchButton?.addEventListener('click', applyBrowseFilters);
  nodes.marketSearch?.addEventListener('keydown', event => {
    if (event.key === 'Enter') applyBrowseFilters();
  });
  nodes.marketSort?.addEventListener('change', applyBrowseFilters);
  nodes.marketQuality?.addEventListener('change', applyBrowseFilters);
  nodes.marketSubtype?.addEventListener('change', applyBrowseFilters);
  nodes.marketMinPrice?.addEventListener('change', applyBrowseFilters);
  nodes.marketMaxPrice?.addEventListener('change', applyBrowseFilters);
  nodes.marketMore?.addEventListener('click', () => {
    void browseStore.nextPage(browseFilters()).then(() => {
      const result = browseStore.pageQuery(browseFilters());
      selectedKey='';selectedDetail=null;
      catalogItems = result.items;
      catalogCounts = result.counts;
      catalogFacets = result.facets;
      renderCatalogRows();
    }).catch(notifyError);
  });
  nodes.marketPrev?.addEventListener('click', () => {
    void browseStore.previousPage(browseFilters()).then(() => {
      const result=browseStore.pageQuery(browseFilters());
      selectedKey='';selectedDetail=null;
      catalogItems=result.items;catalogCounts=result.counts;catalogFacets=result.facets;
      syncSubtypeOptions();renderCatalogRows();
    }).catch(notifyError);
  });
  nodes.marketMineRefresh?.addEventListener('click', () => {
    invalidateMineState();
    void renderMineMode({ force: true }).catch(notifyError);
  });
  dealView.bind();
  for (const tab of nodes.marketMineViews || []) {
    tab.addEventListener('click', () => {
      currentMineView = tab.dataset.marketMineView || 'active';
      void renderMineMode().catch(notifyError);
    });
  }
  for (const tab of nodes.marketModes || []) {
    tab.addEventListener('click', () => void setMode(tab.dataset.marketMode).catch(notifyError));
  }
  for (const category of nodes.marketCategories || []) {
    category.addEventListener('click', () => {
      currentKind = category.dataset.marketKind || '';
      if (nodes.marketSubtype) nodes.marketSubtype.value = '';
      selectedKey = '';
      selectedDetail = null;
      for (const candidate of nodes.marketCategories || []) {
        candidate.classList.toggle('is-active', candidate === category);
      }
      void loadCatalog().catch(notifyError);
    });
  }

  setModeVisuals();

  return {
    refresh,
    openSell: () => setMode('sell'),
    openOrders: () => setMode('orders'),
    openMine: () => setMode('mine'),
  };
}
