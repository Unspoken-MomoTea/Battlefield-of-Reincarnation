const KIND_FIELDS = {
  equipment: '装备',
  item: '道具',
  skill: '技能',
  bloodline: '血统',
  form: '形态库',
};

const CREDENTIAL_KEY_PREFIX = '__credential:';

export const MARKET_KIND_LABELS = {
  equipment: '装备',
  item: '道具',
  skill: '技能',
  bloodline: '血统',
  form: '形态',
  teammate: '角色',
};

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function rootsFor(host) {
  const roots = [];
  for (const value of [
    host,
    (() => { try { return host?.parent; } catch { return null; } })(),
    (() => { try { return host?.top; } catch { return null; } })(),
  ]) {
    if (value && !roots.includes(value)) roots.push(value);
  }
  return roots;
}

function runtimeFor(host) {
  for (const root of rootsFor(host)) {
    try {
      const mvu = root?.Mvu;
      if (mvu?.getMvuData && mvu?.replaceMvuData) return { root, mvu };
    } catch {}
  }
  throw new Error('空间集市未读取到 MVU 存档；请先进入有效存档');
}

function readLatest(host) {
  const runtime = runtimeFor(host);
  const data = runtime.mvu.getMvuData({ type: 'message', message_id: 'latest' });
  if (!data?.stat_data?.角色) throw new Error('当前楼层没有可交易的角色数据');
  return { ...runtime, data };
}

function assertHub(statData) {
  if (statData?.系统状态?.是否在主神空间 !== true) {
    throw new Error('空间集市只允许在主神空间执行上架、购买与领取操作');
  }
}

function randomId(host, prefix) {
  const uuid = host?.crypto?.randomUUID?.()
    || globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${uuid}`;
}

function assetQuantity(kind, value) {
  if (kind !== 'item') return 1;
  const quantity = Number(value?.数量 ?? 1);
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
}

function assetName(key, value) {
  return String(value?.名称 || value?.name || key || '').trim();
}

function credentialGrade(asset) {
  const data = asset?.data || {};
  const legacy = data.系统商品 === 'permission_credential';
  const typed = String(data.类型 || '').trim() === '权限凭证';
  const tagged = Array.isArray(data.标签) && data.标签.includes('权限凭证');
  if (!legacy && !typed && !tagged) return '';
  return String(data.凭证品质 || data.品质 || '').trim().toUpperCase();
}

function assetPayload(asset, quantity = null) {
  const kind = String(asset?.kind || '');
  const resolvedQuantity = kind === 'item'
    ? Math.max(1, Math.floor(Number(quantity ?? asset?.quantity ?? 1) || 1))
    : 1;
  const data = deepClone(asset?.data || {});
  if (kind === 'item') data.数量 = resolvedQuantity;
  return {
    kind,
    name: String(asset?.name || asset?.key || '').trim(),
    quantity: resolvedQuantity,
    data,
  };
}

function ledger(data) {
  const root = data.__reincarnationMarketLedger;
  if (root && typeof root === 'object') return root;
  data.__reincarnationMarketLedger = {
    deliveries: {},
    returns: {},
    payouts: {},
  };
  return data.__reincarnationMarketLedger;
}

function ledgerBucket(data, key) {
  const root = ledger(data);
  if (!root[key] || typeof root[key] !== 'object') root[key] = {};
  return root[key];
}

async function mutateLatest(host, mutator) {
  const { root, mvu, data } = readLatest(host);
  const before = deepClone(data);
  const next = deepClone(data);
  await mutator(next);

  const touchedRoots = rootsFor(host);
  for (const target of touchedRoots) {
    try { target.__samsaraUIMutation = true; } catch {}
  }

  try {
    const writes = [];
    const primary = mvu.replaceMvuData(next, { type: 'message', message_id: 'latest' });
    if (primary?.then) writes.push(Promise.resolve(primary));
    try {
      const secondary = mvu.replaceMvuData(next, { type: 'chat' });
      if (secondary?.then) writes.push(Promise.resolve(secondary));
    } catch {}

    try {
      const eventName = mvu.events?.VARIABLE_UPDATE_ENDED;
      const emit = root?.eventEmit || host?.eventEmit;
      if (eventName && typeof emit === 'function') emit.call(root, eventName, next, before);
    } catch {}

    const results = await Promise.allSettled(writes);
    const rejected = results.find(result => result.status === 'rejected');
    if (rejected) throw rejected.reason;
    return next;
  } finally {
    for (const target of touchedRoots) {
      try { target.__samsaraUIMutation = false; } catch {}
    }
  }
}

export function marketInventoryFromData(data) {
  const statData = data?.stat_data || data;
  const character = statData?.角色 || {};
  const assets = [];

  for (const [kind, field] of Object.entries(KIND_FIELDS)) {
    const bucket = character[field];
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue;
    for (const [key, value] of Object.entries(bucket)) {
      if (!value || typeof value !== 'object') continue;
      if (kind === 'equipment' && ![0, 2].includes(Number(value.状态))) continue;
      const quantity = assetQuantity(kind, value);
      if (quantity <= 0) continue;
      assets.push({
        kind,
        key,
        name: assetName(key, value),
        quantity,
        quality: String(value.品质 || value.层级 || ''),
        data: deepClone(value),
      });
    }
  }

  const credentials = character.权限凭证;
  if (credentials && typeof credentials === 'object' && !Array.isArray(credentials)) {
    for (const [grade, rawQuantity] of Object.entries(credentials)) {
      const quantity = Math.max(0, Math.floor(Number(rawQuantity) || 0));
      if (!quantity) continue;
      const quality = String(grade || '').trim().toUpperCase();
      assets.push({
        kind: 'item',
        key: CREDENTIAL_KEY_PREFIX + quality,
        name: quality + '级权限凭证',
        quantity,
        quality,
        data: {
          品质: quality,
          类型: '权限凭证',
          数量: quantity,
          标签: ['权限凭证'],
          描述: '角色账户持有的权限凭证。',
        },
      });
    }
  }

  const relations = statData?.关系列表;
  if (relations && typeof relations === 'object' && !Array.isArray(relations)) {
    for (const [key, value] of Object.entries(relations)) {
      if (!value || typeof value !== 'object' || value.是否队友 !== true) continue;
      assets.push({
        kind: 'teammate',
        key,
        name: key,
        quantity: 1,
        quality: String(value.层级 || value.品质 || ''),
        data: deepClone(value),
      });
    }
  }

  return {
    inHub: statData?.系统状态?.是否在主神空间 === true,
    coin: Math.max(0, Number(character.空间币 || 0)),
    assets,
  };
}

function credentialKeyGrade(key) {
  const value = String(key || '');
  return value.startsWith(CREDENTIAL_KEY_PREFIX)
    ? value.slice(CREDENTIAL_KEY_PREFIX.length).trim().toUpperCase()
    : '';
}

function findAsset(statData, kind, key) {
  const character = statData?.角色 || {};
  const credential = kind === 'item' ? credentialKeyGrade(key) : '';
  if (credential) {
    const quantity = Math.max(0, Math.floor(Number(character?.权限凭证?.[credential]) || 0));
    if (!quantity) throw new Error('待交易权限凭证已经不在当前存档中，请刷新后重试');
    return {
      value: {
        品质: credential,
        类型: '权限凭证',
        数量: quantity,
        标签: ['权限凭证'],
        描述: '角色账户持有的权限凭证。',
      },
      credential,
    };
  }

  if (kind === 'teammate') {
    const value = statData?.关系列表?.[key];
    if (!value || typeof value !== 'object' || value.是否队友 !== true) {
      throw new Error('待交易队友已经不在当前存档中，请刷新后重试');
    }
    return { bucket: statData.关系列表, value };
  }

  const field = KIND_FIELDS[kind];
  const bucket = field ? character?.[field] : null;
  const value = bucket?.[key];
  if (!field || !value || typeof value !== 'object') {
    throw new Error('待交易资产已经不在当前存档中，请刷新后重试');
  }
  if (kind === 'equipment' && ![0, 2].includes(Number(value.状态))) {
    throw new Error('已装备中的装备不能交易，请先卸下或放入仓库');
  }
  return { field, bucket, value };
}

function removeAsset(statData, selection) {
  const { kind, key } = selection;
  const located = findAsset(statData, kind, key);
  const value = located.value;

  if (located.credential) {
    const character = statData.角色;
    const current = Math.max(0, Math.floor(Number(character.权限凭证[located.credential]) || 0));
    const quantity = Math.max(1, Math.floor(Number(selection.quantity) || 1));
    if (quantity > current) throw new Error('权限凭证数量不足');
    const left = current - quantity;
    if (left > 0) character.权限凭证[located.credential] = left;
    else delete character.权限凭证[located.credential];
    return { quantity, data: deepClone({ ...value, 数量: quantity }) };
  }

  if (kind === 'item') {
    const current = assetQuantity(kind, value);
    const quantity = Math.max(1, Math.floor(Number(selection.quantity) || 1));
    if (quantity > current) throw new Error('道具数量不足');
    if (quantity === current) delete located.bucket[key];
    else value.数量 = current - quantity;
    return { quantity, data: deepClone({ ...value, 数量: quantity }) };
  }

  delete located.bucket[key];
  if (
    kind === 'form'
    && statData?.角色?.当前形态?.激活 === true
    && String(statData.角色.当前形态.名称 || '') === String(key)
  ) {
    statData.角色.当前形态 = { 激活: false, 名称: '' };
  }
  return { quantity: 1, data: deepClone(value) };
}

function addAsset(statData, asset) {
  const character = statData.角色 || (statData.角色 = {});
  const credential = credentialGrade(asset);
  if (credential) {
    if (!character.权限凭证 || typeof character.权限凭证 !== 'object' || Array.isArray(character.权限凭证)) {
      character.权限凭证 = {};
    }
    const quantity = Math.max(1, Math.floor(Number(asset?.quantity) || 1));
    character.权限凭证[credential] = Math.max(0, Number(character.权限凭证[credential] || 0)) + quantity;
    return;
  }

  const kind = asset?.kind;
  const key = String(asset.name || '').trim();
  if (!key) throw new Error('待领取资产缺少名称');

  if (kind === 'teammate') {
    if (!statData.关系列表 || typeof statData.关系列表 !== 'object' || Array.isArray(statData.关系列表)) {
      statData.关系列表 = {};
    }
    if (statData.关系列表[key]) {
      throw new Error('当前存档已经存在同名队友“' + key + '”，请先处理重名角色再领取');
    }
    const next = deepClone(asset.data || {});
    next.是否队友 = true;
    statData.关系列表[key] = next;
    return;
  }

  const field = KIND_FIELDS[kind];
  if (!field) throw new Error('不支持的集市资产类型');

  if (!character[field] || typeof character[field] !== 'object' || Array.isArray(character[field])) {
    character[field] = {};
  }
  const bucket = character[field];

  if (kind === 'item') {
    const quantity = Math.max(1, Math.floor(Number(asset.quantity) || 1));
    const existing = bucket[key];
    if (existing && typeof existing === 'object') {
      existing.数量 = assetQuantity('item', existing) + quantity;
      return;
    }
    const next = deepClone(asset.data || {});
    next.数量 = quantity;
    if (!next.名称) next.名称 = key;
    bucket[key] = next;
    return;
  }

  if (kind === 'bloodline' && Object.keys(bucket).length > 0) {
    throw new Error('当前存档已经持有血统，请先处理现有血统再领取');
  }
  if (bucket[key]) {
    throw new Error(`当前存档已经存在同名${MARKET_KIND_LABELS[kind]}“${key}”，请先处理重名资产再领取`);
  }
  const next = deepClone(asset.data || {});
  if (!next.名称 && Object.prototype.hasOwnProperty.call(next, '名称')) next.名称 = key;
  bucket[key] = next;
}

const TEAMMATE_TRADE_ATTITUDE = '被交易的货物，对原主失去一切信任';

function listingAssetSnapshot(asset) {
  const next = deepClone(asset);
  if (String(next?.kind || '') !== 'teammate') return next;
  const data = next.data && typeof next.data === 'object' && !Array.isArray(next.data)
    ? next.data
    : (next.data = {});
  const favor = Number(data.好感度);
  data.好感度 = Number.isFinite(favor) ? Math.min(0, favor) : 0;
  data.态度 = TEAMMATE_TRADE_ATTITUDE;
  return next;
}

function formActivationSnapshot(statData, selection) {
  if (
    selection?.kind === 'form'
    && statData?.角色?.当前形态?.激活 === true
    && String(statData.角色.当前形态.名称 || '') === String(selection.key || '')
  ) {
    return { 激活: true, 名称: String(selection.key || '') };
  }
  return null;
}

function restoreFormActivation(statData, snapshot) {
  if (!snapshot || !statData?.角色) return;
  if (statData.角色.形态库?.[snapshot.名称]) {
    statData.角色.当前形态 = deepClone(snapshot);
  }
}

function collisionFor(statData, asset) {
  if (credentialGrade(asset)) return false;
  const kind = asset?.kind;
  if (kind === 'item') return false;
  if (kind === 'teammate') return Boolean(statData?.关系列表?.[asset?.name]);
  const field = KIND_FIELDS[kind];
  const bucket = field ? statData?.角色?.[field] : null;
  if (!field) return false;
  if (kind === 'bloodline') return Boolean(bucket && Object.keys(bucket).length);
  return Boolean(bucket?.[asset?.name]);
}

export function createMarketService({ host, api }) {
  async function inventory() {
    return marketInventoryFromData(readLatest(host).data);
  }

  async function list(filters = {}) {
    return api.listMarketListings(filters);
  }

  async function listAll() {
    const items = [];
    const seenOffsets = new Set();
    let offset = 0;

    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset);
      const page = await api.listMarketListings({
        sort: 'latest',
        offset,
        limit: 60,
      });
      items.push(...(Array.isArray(page?.items) ? page.items : []));
      if (page?.next_offset == null) break;
      const nextOffset = Math.max(0, Number(page.next_offset) || 0);
      if (nextOffset === offset) break;
      offset = nextOffset;
    }

    return items;
  }

  async function catalogAll() {
    const items = [];
    const seenOffsets = new Set();
    let offset = 0;
    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset);
      const page = await api.listMarketCatalog({ offset, limit: 200 });
      items.push(...(Array.isArray(page?.items) ? page.items : []));
      if (page?.next_offset == null) break;
      const next = Math.max(0, Number(page.next_offset) || 0);
      if (next === offset) break;
      offset = next;
    }
    return items;
  }

  async function product(marketKey) {
    return api.getMarketProduct(marketKey);
  }

  async function auctionQuote(asset, quantity = 1, durationHours = 24) {
    return api.quoteMarketAction({
      action: 'auction',
      asset: assetPayload(asset, quantity),
      duration_hours: durationHours,
    });
  }

  async function quoteAuction(asset, quantity = 1, durationHours = 24) {
    return (await auctionQuote(asset, quantity, durationHours))?.quote;
  }

  async function buybackQuote(asset, quantity = 1) {
    return api.quoteMarketAction({
      action: 'buyback',
      asset: assetPayload(asset, quantity),
    });
  }

  async function quoteBuyback(asset, quantity = 1) {
    return (await buybackQuote(asset, quantity))?.quote;
  }

  async function listAllBarters() {
    const items = [];
    const seenOffsets = new Set();
    let offset = 0;
    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset);
      const page = await api.listMarketBarters({ offset, limit: 60 });
      items.push(...(Array.isArray(page?.items) ? page.items : []));
      if (page?.next_offset == null) break;
      const next = Math.max(0, Number(page.next_offset) || 0);
      if (next === offset) break;
      offset = next;
    }
    return items;
  }

  async function mine() {
    return api.getMarketMe();
  }

  async function sell(selection) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);

    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, selection);
    const located = findAsset(snapshot.data.stat_data, selection.kind, selection.key);
    const available = assetQuantity(selection.kind, located.value);
    const requestedQuantity = selection.kind === 'item'
      ? Math.max(1, Math.floor(Number(selection.quantity) || 1))
      : 1;
    if (requestedQuantity > available) throw new Error('待交易资产数量不足');

    const sourceAsset = {
      kind: selection.kind,
      key: selection.key,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: requestedQuantity,
      data: deepClone(located.value),
    };
    const durationHours = Math.max(24, Math.floor(Number(selection.durationHours) || 24));
    const quote = await quoteAuction(sourceAsset, requestedQuantity, durationHours);
    const listingFee = Math.max(0, Number(quote?.listing_fee || 0));
    if (Number(snapshot.data.stat_data.角色.空间币 || 0) < listingFee) {
      throw new Error(`空间币不足：上架税需要 ${listingFee}`);
    }

    const listingId = randomId(host, 'listing');
    let removed;
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const currentCoin = Number(next.stat_data.角色.空间币 || 0);
      if (currentCoin < listingFee) throw new Error('空间币不足，无法支付上架税');
      removed = removeAsset(next.stat_data, {
        ...selection,
        quantity: requestedQuantity,
      });
      next.stat_data.角色.空间币 = currentCoin - listingFee;
    });

    const restoreAsset = {
      kind: selection.kind,
      name: sourceAsset.name,
      quantity: removed.quantity,
      data: removed.data,
    };
    const listingAsset = listingAssetSnapshot(restoreAsset);

    try {
      return await api.createMarketListing({
        id: listingId,
        asset: listingAsset,
        unit_price: Math.max(1, Math.floor(Number(selection.unitPrice) || 0)),
        duration_hours: durationHours,
      });
    } catch (error) {
      try {
        const state = await api.getMarketMe();
        const recovered = state?.listings?.find(item => item.id === listingId);
        if (recovered) return { listing: recovered, quote };
      } catch {}

      try {
        await mutateLatest(host, next => {
          addAsset(next.stat_data, restoreAsset);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
          next.stat_data.角色.空间币 = Number(next.stat_data.角色.空间币 || 0) + listingFee;
        });
      } catch (restoreError) {
        const combined = new Error(`上架请求失败，而且本地资产/上架税自动恢复也失败：${restoreError.message}`);
        combined.cause = error;
        throw combined;
      }
      throw error;
    }
  }

  async function sellToSystem(selection) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);

    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, selection);
    const located = findAsset(snapshot.data.stat_data, selection.kind, selection.key);
    const available = assetQuantity(selection.kind, located.value);
    const requestedQuantity = selection.kind === 'item'
      ? Math.max(1, Math.floor(Number(selection.quantity) || 1))
      : 1;
    if (requestedQuantity > available) throw new Error('待回收资产数量不足');

    const asset = assetPayload({
      kind: selection.kind,
      key: selection.key,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: requestedQuantity,
      data: deepClone(located.value),
    }, requestedQuantity);
    const buybackId = randomId(host, 'buyback');

    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      removeAsset(next.stat_data, {
        kind: selection.kind,
        key: selection.key,
        quantity: requestedQuantity,
      });
    });

    let result;
    try {
      result = await api.createMarketBuyback({ id: buybackId, asset });
    } catch (error) {
      try {
        result = await api.getMarketBuyback(buybackId);
      } catch {}

      if (!result?.buyback) {
        await mutateLatest(host, next => {
          addAsset(next.stat_data, asset);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }

    if (result?.payout) await receivePayout(result.payout);
    return result;
  }

  async function deliverTrade(trade) {
    if (!trade?.id) throw new Error('交易记录无效');
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const deliveries = ledgerBucket(next, 'deliveries');
      if (deliveries[trade.id]) return;
      if (collisionFor(next.stat_data, trade.asset)) {
        throw new Error(`无法领取“${trade.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, trade.asset);
      deliveries[trade.id] = Date.now();
    });
    await api.confirmMarketDelivery(trade.id);
    return trade;
  }

  async function buy(listing, quantity = 1) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const resolvedQuantity = listing?.asset?.kind === 'item'
      ? Math.max(1, Math.floor(Number(quantity) || 1))
      : 1;
    const total = Number(listing?.unit_price || 0) * resolvedQuantity;
    if (!Number.isFinite(total) || total <= 0) throw new Error('挂单价格无效');
    if (Number(snapshot.data.stat_data.角色.空间币 || 0) < total) throw new Error('空间币不足');
    if (collisionFor(snapshot.data.stat_data, listing.asset)) {
      throw new Error(`当前存档已有同名${MARKET_KIND_LABELS[listing.asset.kind]}，暂不能购买`);
    }

    const tradeId = randomId(host, 'trade');
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const current = Number(next.stat_data.角色.空间币 || 0);
      if (current < total) throw new Error('空间币不足');
      next.stat_data.角色.空间币 = current - total;
    });

    let trade;
    try {
      const result = await api.buyMarketListing(listing.id, {
        trade_id: tradeId,
        quantity: resolvedQuantity,
      });
      trade = result.trade;
    } catch (error) {
      try {
        trade = (await api.getMarketTrade(tradeId))?.trade || null;
      } catch {}

      if (!trade) {
        await mutateLatest(host, next => {
          next.stat_data.角色.空间币 = Number(next.stat_data.角色.空间币 || 0) + total;
        });
        throw error;
      }
    }

    await deliverTrade(trade);
    return trade;
  }

  async function cancel(listingId) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const result = await api.cancelMarketListing(listingId);
    if (result?.return) await receiveReturn(result.return);
    return result;
  }

  async function receiveReturn(returnRecord) {
    if (!returnRecord?.id) throw new Error('返还记录无效');
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const returns = ledgerBucket(next, 'returns');
      if (returns[returnRecord.id]) return;
      if (collisionFor(next.stat_data, returnRecord.asset)) {
        throw new Error(`无法返还“${returnRecord.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, returnRecord.asset);
      returns[returnRecord.id] = Date.now();
    });
    await api.confirmMarketReturn(returnRecord.id);
    return returnRecord;
  }

  async function receivePayout(payout) {
    if (!payout?.id) throw new Error('货款领取记录无效');
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const payouts = ledgerBucket(next, 'payouts');
      if (payouts[payout.id]) return;
      next.stat_data.角色.空间币 = Number(next.stat_data.角色.空间币 || 0) + Number(payout.amount || 0);
      payouts[payout.id] = Date.now();
    });
    await api.confirmMarketPayout(payout.id);
    return payout;
  }

  async function createOrder(productValue, { quantity = 1, unitPrice, durationHours = 24 } = {}) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const asset = productValue?.asset || productValue;
    if (!asset?.kind || !asset?.name) throw new Error('求购目标无效');
    const resolvedQuantity = asset.kind === 'item'
      ? Math.max(1, Math.floor(Number(quantity) || 1))
      : 1;
    const price = Math.max(1, Math.floor(Number(unitPrice) || 0));
    const total = price * resolvedQuantity;
    if (Number(snapshot.data.stat_data.角色.空间币 || 0) < total) {
      throw new Error('空间币不足：求购托管需要 ' + total);
    }

    const orderId = randomId(host, 'order');
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const current = Number(next.stat_data.角色.空间币 || 0);
      if (current < total) throw new Error('空间币不足');
      next.stat_data.角色.空间币 = current - total;
    });

    let result;
    try {
      result = await api.createMarketOrder({
        id: orderId,
        asset: assetPayload(asset, resolvedQuantity),
        quantity: resolvedQuantity,
        unit_price: price,
        duration_hours: durationHours,
      });
    } catch (error) {
      try { result = await api.getMarketOrder(orderId); } catch {}
      if (!result?.order) {
        await mutateLatest(host, next => {
          next.stat_data.角色.空间币 = Number(next.stat_data.角色.空间币 || 0) + total;
        });
        throw error;
      }
    }
    return result.order;
  }

  async function cancelOrder(orderId) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const result = await api.cancelMarketOrder(orderId);
    if (result?.payout) await receivePayout(result.payout);
    return result;
  }

  async function deliverOrderFill(fill) {
    if (!fill?.id) throw new Error('求购成交记录无效');
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const deliveries = ledgerBucket(next, 'orderDeliveries');
      if (deliveries[fill.id]) return;
      if (collisionFor(next.stat_data, fill.asset)) {
        throw new Error(`无法领取“${fill.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, fill.asset);
      deliveries[fill.id] = Date.now();
    });
    await api.confirmMarketOrderDelivery(fill.id);
    return fill;
  }

  async function fillOrder(selection, order, quantity = 1) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, selection);
    const located = findAsset(snapshot.data.stat_data, selection.kind, selection.key);
    const available = assetQuantity(selection.kind, located.value);
    const resolvedQuantity = selection.kind === 'item'
      ? Math.max(1, Math.min(available, Math.floor(Number(quantity) || 1)))
      : 1;
    const fillId = randomId(host, 'fill');
    let removed;
    await mutateLatest(host, next => {
      removed = removeAsset(next.stat_data, { ...selection, quantity: resolvedQuantity });
    });
    const restoreAsset = {
      kind: selection.kind,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: removed.quantity,
      data: removed.data,
    };
    const tradeAsset = listingAssetSnapshot(restoreAsset);

    let result;
    try {
      result = await api.fillMarketOrder(order.id, {
        fill_id: fillId,
        asset: assetPayload(tradeAsset, resolvedQuantity),
        quantity: resolvedQuantity,
      });
    } catch (error) {
      try { result = { fill: (await api.getMarketOrderFill(fillId))?.fill }; } catch {}
      if (!result?.fill) {
        await mutateLatest(host, next => {
          addAsset(next.stat_data, restoreAsset);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }
    return result.fill;
  }

  async function createBarter(selection, wantedProduct, {
    offeredQuantity = 1,
    wantedQuantity = 1,
    durationHours = 24,
  } = {}) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const wanted = wantedProduct?.asset || wantedProduct;
    if (!wanted?.kind || !wanted?.name) throw new Error('交换目标无效');

    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, selection);
    const located = findAsset(snapshot.data.stat_data, selection.kind, selection.key);
    const available = assetQuantity(selection.kind, located.value);
    const resolvedOffered = selection.kind === 'item'
      ? Math.max(1, Math.min(available, Math.floor(Number(offeredQuantity) || 1)))
      : 1;
    const resolvedWanted = wanted.kind === 'item'
      ? Math.max(1, Math.floor(Number(wantedQuantity) || 1))
      : 1;
    const barterId = randomId(host, 'barter');
    let removed;
    await mutateLatest(host, next => {
      removed = removeAsset(next.stat_data, { ...selection, quantity: resolvedOffered });
    });
    const restoreAsset = {
      kind: selection.kind,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: removed.quantity,
      data: removed.data,
    };
    const offeredAsset = listingAssetSnapshot(restoreAsset);

    let result;
    try {
      result = await api.createMarketBarter({
        id: barterId,
        offered_asset: assetPayload(offeredAsset, resolvedOffered),
        offered_quantity: resolvedOffered,
        wanted_asset: assetPayload(wanted, resolvedWanted),
        wanted_quantity: resolvedWanted,
        duration_hours: durationHours,
      });
    } catch (error) {
      try { result = await api.getMarketBarter(barterId); } catch {}
      if (!result?.barter) {
        await mutateLatest(host, next => {
          addAsset(next.stat_data, restoreAsset);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }
    return result.barter;
  }

  async function receiveBarterDelivery(delivery) {
    if (!delivery?.id) throw new Error('交换领取记录无效');
    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      const deliveries = ledgerBucket(next, 'barterDeliveries');
      if (deliveries[delivery.id]) return;
      if (collisionFor(next.stat_data, delivery.asset)) {
        throw new Error(`无法领取“${delivery.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, delivery.asset);
      deliveries[delivery.id] = Date.now();
    });
    await api.confirmMarketBarterDelivery(delivery.id);
    return delivery;
  }

  async function cancelBarter(barterId) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const result = await api.cancelMarketBarter(barterId);
    if (result?.delivery) await receiveBarterDelivery(result.delivery);
    return result;
  }

  async function acceptBarter(barter, selection) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, selection);
    const located = findAsset(snapshot.data.stat_data, selection.kind, selection.key);
    const needed = Math.max(1, Number(barter?.wanted?.quantity || 1));
    const available = assetQuantity(selection.kind, located.value);
    if (selection.kind === 'item' && available < needed) throw new Error('用于交换的资产数量不足');
    let removed;
    await mutateLatest(host, next => {
      removed = removeAsset(next.stat_data, { ...selection, quantity: needed });
    });
    const restoreAsset = {
      kind: selection.kind,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: removed.quantity,
      data: removed.data,
    };
    const tradeAsset = listingAssetSnapshot(restoreAsset);

    let result;
    try {
      result = await api.acceptMarketBarter(barter.id, {
        asset: assetPayload(tradeAsset, needed),
        quantity: needed,
      });
    } catch (error) {
      let recovered = null;
      try { recovered = await api.getMarketBarter(barter.id); } catch {}
      if (recovered?.barter?.status === 'completed') result = recovered;
      else {
        await mutateLatest(host, next => {
          addAsset(next.stat_data, restoreAsset);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }

    let delivery = result?.delivery || null;
    if (!delivery) {
      const state = await api.getMarketMe().catch(() => null);
      delivery = state?.barters?.pending_deliveries?.find(item => item.barter_id === barter.id) || null;
    }
    if (delivery) await receiveBarterDelivery(delivery);
    return result?.barter || barter;
  }

  async function recoverAll(stateValue = null) {
    const state = stateValue || await mine();
    for (const trade of state.pending_deliveries || []) await deliverTrade(trade);
    for (const fill of state.orders?.pending_deliveries || []) await deliverOrderFill(fill);
    for (const returned of state.pending_returns || []) await receiveReturn(returned);
    for (const delivery of state.barters?.pending_deliveries || []) await receiveBarterDelivery(delivery);
    for (const payout of state.pending_payouts || []) await receivePayout(payout);
    if (Number(state.wallet?.balance || 0) > 0) await claimProceeds();
    return mine();
  }

  async function claimProceeds() {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const payoutId = randomId(host, 'payout');
    let payout;
    try {
      payout = (await api.claimMarketPayout(payoutId))?.payout;
    } catch (error) {
      const state = await api.getMarketMe().catch(() => null);
      payout = state?.pending_payouts?.find(item => item.id === payoutId) || null;
      if (!payout) throw error;
    }
    await receivePayout(payout);
    return payout;
  }

  return {
    inventory,
    list,
    listAll,
    catalogAll,
    product,
    auctionQuote,
    quoteAuction,
    buybackQuote,
    quoteBuyback,
    listAllBarters,
    mine,
    sell,
    sellToSystem,
    buy,
    cancel,
    deliverTrade,
    receiveReturn,
    createOrder,
    cancelOrder,
    fillOrder,
    deliverOrderFill,
    createBarter,
    cancelBarter,
    acceptBarter,
    receiveBarterDelivery,
    recoverAll,
    claimProceeds,
    receivePayout,
  };
}
