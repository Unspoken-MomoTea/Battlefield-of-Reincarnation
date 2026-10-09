const KIND_FIELDS = {
  equipment: '装备',
  item: '道具',
  skill: '技能',
};

export const MARKET_KIND_LABELS = {
  equipment: '装备',
  item: '道具',
  skill: '技能',
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

  return {
    inHub: statData?.系统状态?.是否在主神空间 === true,
    coin: Math.max(0, Number(character.空间币 || 0)),
    assets,
  };
}

function findAsset(character, kind, key) {
  const field = KIND_FIELDS[kind];
  const bucket = field ? character?.[field] : null;
  const value = bucket?.[key];
  if (!field || !value || typeof value !== 'object') {
    throw new Error('待交易资产已经不在当前存档中，请刷新后重试');
  }
  return { field, bucket, value };
}

function removeAsset(character, selection) {
  const { kind, key } = selection;
  const { bucket, value } = findAsset(character, kind, key);
  if (kind === 'item') {
    const current = assetQuantity(kind, value);
    const quantity = Math.max(1, Math.floor(Number(selection.quantity) || 1));
    if (quantity > current) throw new Error('道具数量不足');
    if (quantity === current) delete bucket[key];
    else value.数量 = current - quantity;
    return { quantity, data: deepClone({ ...value, 数量: quantity }) };
  }

  delete bucket[key];
  return { quantity: 1, data: deepClone(value) };
}

function addAsset(character, asset) {
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
  const field = KIND_FIELDS[kind];
  if (!field) throw new Error('不支持的集市资产类型');

  if (!character[field] || typeof character[field] !== 'object' || Array.isArray(character[field])) {
    character[field] = {};
  }
  const bucket = character[field];
  const key = String(asset.name || '').trim();
  if (!key) throw new Error('待领取资产缺少名称');

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

  if (bucket[key]) {
    throw new Error(`当前存档已经存在同名${MARKET_KIND_LABELS[kind]}“${key}”，请先处理重名资产再领取`);
  }
  const next = deepClone(asset.data || {});
  if (!next.名称 && Object.prototype.hasOwnProperty.call(next, '名称')) next.名称 = key;
  bucket[key] = next;
}

function collisionFor(character, asset) {
  if (credentialGrade(asset)) return false;
  const field = KIND_FIELDS[asset?.kind];
  if (!field || asset?.kind === 'item') return false;
  return Boolean(character?.[field]?.[asset?.name]);
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

  async function quoteAuction(asset, quantity = 1, durationHours = 24) {
    return (await api.quoteMarketAction({
      action: 'auction',
      asset: assetPayload(asset, quantity),
      duration_hours: durationHours,
    }))?.quote;
  }

  async function quoteBuyback(asset) {
    return (await api.quoteMarketAction({
      action: 'buyback',
      asset: assetPayload(asset, 1),
    }))?.quote;
  }

  async function mine() {
    return api.getMarketMe();
  }

  async function sell(selection) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);

    const located = findAsset(snapshot.data.stat_data.角色, selection.kind, selection.key);
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
      removed = removeAsset(next.stat_data.角色, {
        ...selection,
        quantity: requestedQuantity,
      });
      next.stat_data.角色.空间币 = currentCoin - listingFee;
    });

    const asset = {
      kind: selection.kind,
      name: sourceAsset.name,
      quantity: removed.quantity,
      data: removed.data,
    };

    try {
      return await api.createMarketListing({
        id: listingId,
        asset,
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
          addAsset(next.stat_data.角色, asset);
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
    if (selection?.kind !== 'equipment') throw new Error('当前系统回收只支持装备');

    const located = findAsset(snapshot.data.stat_data.角色, selection.kind, selection.key);
    const asset = assetPayload({
      kind: selection.kind,
      key: selection.key,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: 1,
      data: deepClone(located.value),
    }, 1);
    const buybackId = randomId(host, 'buyback');

    await mutateLatest(host, next => {
      assertHub(next.stat_data);
      removeAsset(next.stat_data.角色, {
        kind: selection.kind,
        key: selection.key,
        quantity: 1,
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
          addAsset(next.stat_data.角色, asset);
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
      if (collisionFor(next.stat_data.角色, trade.asset)) {
        throw new Error(`无法领取“${trade.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data.角色, trade.asset);
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
    if (collisionFor(snapshot.data.stat_data.角色, listing.asset)) {
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
      if (collisionFor(next.stat_data.角色, returnRecord.asset)) {
        throw new Error(`无法返还“${returnRecord.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data.角色, returnRecord.asset);
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
    quoteAuction,
    quoteBuyback,
    mine,
    sell,
    sellToSystem,
    buy,
    cancel,
    deliverTrade,
    receiveReturn,
    claimProceeds,
    receivePayout,
  };
}
