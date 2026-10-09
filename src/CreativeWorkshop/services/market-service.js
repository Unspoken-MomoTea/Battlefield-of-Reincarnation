import { currentMarketSaveId } from './api/market.js';
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
  const saveId = currentMarketSaveId(host);
  const runtime = runtimeFor(host);
  const data = runtime.mvu.getMvuData({ type: 'message', message_id: 'latest' });
  if (!data?.stat_data?.角色) throw new Error('当前楼层没有可交易的角色数据');
  return { ...runtime, data, saveId };
}

function assertCurrentSave(host, expectedSaveId) {
  if (currentMarketSaveId(host) !== expectedSaveId) {
    throw new Error('交易期间切换了存档，请返回原存档核对本次操作');
  }
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

function receiptAsset(asset, quantity) {
  const label = MARKET_KIND_LABELS[asset?.kind] || '资产';
  const name = String(asset?.name || '未知资产').replace(/[\r\n]+/gu, ' ').trim();
  return label + '「' + name + '」×' + Math.max(1, Number(quantity ?? asset?.quantity) || 1);
}

function coin(value) {
  return Math.max(0, Math.floor(Number(value) || 0)) + '空间币';
}

// One-shot narrative notice, NOT a permanent trade history. The same server
// receipt ID must never be appended twice during a delivery retry.
export function appendMarketBroadcast(next, eventId, line) {
  const id = String(eventId || '').trim();
  const message = String(line || '').replace(/[\r\n]+/gu, ' ').trim();
  if (!id || !message || !next?.stat_data) return false;
  const events = ledgerBucket(next, 'broadcasts');
  if (events[id]) return false;
  const state = next.stat_data.系统状态 ||= {};
  const previous = String(state.待播报记录 || '').trim();
  state.待播报记录 = previous ? previous + '\n' + message : message;
  events[id] = Date.now();
  // Only replay keys are kept. Retain a bounded set, not a second history log.
  const keys = Object.keys(events);
  if (keys.length > 256) {
    keys.sort((a, b) => Number(events[a] || 0) - Number(events[b] || 0));
    for (const key of keys.slice(0, keys.length - 192)) delete events[key];
  }
  return true;
}

const pendingMvuMutations = new WeakMap();

function mutateLatest(host, mutator, expectedSaveId = '') {
  const previous = pendingMvuMutations.get(host) || Promise.resolve();
  // All market operations sharing a host must write MVU sequentially; otherwise
  // two concurrent actions could overwrite each other's coin/asset changes.
  const task = previous.catch(() => {}).then(() => mutateLatestUnlocked(host, mutator, expectedSaveId));
  pendingMvuMutations.set(host, task);
  void task.finally(() => {
    if (pendingMvuMutations.get(host) === task) pendingMvuMutations.delete(host);
  }).catch(() => {});
  return task;
}

async function mutateLatestUnlocked(host, mutator, expectedSaveId = '') {
  const { root, mvu, data, saveId } = readLatest(host);
  if (expectedSaveId && expectedSaveId !== saveId) {
    throw new Error('交易期间切换了存档；请返回原存档处理未完成的交易');
  }
  const before = deepClone(data);
  const next = deepClone(data);
  const result = mutator(next);
  if (result?.then) await result;
  if (currentMarketSaveId(host) !== saveId) {
    throw new Error('交易期间切换了存档，本次本地写入已取消');
  }

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

function comparableItem(value) {
  if (Array.isArray(value)) return value.map(comparableItem);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (key === '数量') continue;
    output[key] = comparableItem(value[key]);
  }
  return output;
}

// Item names are the MVU dictionary keys. Different item definitions with the
// same name cannot share one key or one stack; keep the original payload intact.
export function marketItemStorageSlot(bucket, asset) {
  const name = String(asset?.name || '').trim();
  const incoming = JSON.stringify(comparableItem(asset?.data || {}));
  for (const [key, value] of Object.entries(bucket || {})) {
    if (!value || typeof value !== 'object') continue;
    if (String(value.名称 || key).trim() !== name) continue;
    if (JSON.stringify(comparableItem(value)) === incoming) return key;
  }
  if (!Object.prototype.hasOwnProperty.call(bucket, name)) return name;
  const quality = String(asset?.data?.品质 || '不同属性').trim();
  const base = name + '（' + quality + '·集市）';
  let key = base;
  for (let index = 2; Object.prototype.hasOwnProperty.call(bucket, key); index += 1) {
    key = base + '#' + index;
  }
  return key;
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
      throw new Error('当前存档已经存在同名角色“' + key + '”，请先处理重名角色再领取');
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
    const storageKey = marketItemStorageSlot(bucket, asset);
    const existing = bucket[storageKey];
    if (existing && typeof existing === 'object') {
      existing.数量 = assetQuantity('item', existing) + quantity;
      return;
    }
    const next = deepClone(asset.data || {});
    next.数量 = quantity;
    if (!next.名称) next.名称 = key;
    bucket[storageKey] = next;
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
  async function broadcast(saveId, id, line) {
    return mutateLatest(host, next => {
      appendMarketBroadcast(next, id, line);
    }, saveId);
  }

  async function collectPendingSales(state) {
    if (!Array.isArray(state?.pending_sale_broadcasts) || !state.pending_sale_broadcasts.length) return state;
    const saveId = currentMarketSaveId(host);
    for (const sale of state.pending_sale_broadcasts) {
      if (!sale?.id) continue;
      await broadcast(saveId, 'sale:' + sale.id,
        '[空间集市成交][角色] ' + receiptAsset(sale.asset, sale.quantity)
        + ' 已被其他轮回者购买｜成交 ' + coin(sale.total_price)
        + '｜实收待领取 ' + coin(sale.seller_proceeds));
      await api.confirmMarketSaleBroadcast(sale.id);
    }
    return state;
  }

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

  async function catalog(filters = {}) {
    return api.listMarketCatalog(filters);
  }

  async function catalogSnapshot() {
    const items = [];
    const byKey = new Map();
    const seenOffsets = new Set();
    let counts = {};
    let offset = 0;

    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset);
      const page = await api.listMarketCatalog({
        sort: 'price_asc',
        offset,
        limit: 80,
      });
      if (!Object.keys(counts).length && page?.counts) counts = { ...page.counts };
      for (const item of Array.isArray(page?.items) ? page.items : []) {
        const key = String(item?.key || '');
        if (!key) continue;
        if (byKey.has(key)) {
          items[byKey.get(key)] = item;
        } else {
          byKey.set(key, items.length);
          items.push(item);
        }
      }
      if (page?.next_offset == null) break;
      const nextOffset = Math.max(0, Number(page.next_offset) || 0);
      if (nextOffset === offset) break;
      offset = nextOffset;
    }

    return { items, counts };
  }

  async function catalogDetail(catalogKey) {
    return api.getMarketCatalog(catalogKey);
  }

  async function listBuyOrders(filters = {}) {
    return api.listMarketBuyOrders(filters);
  }

  async function listSwaps(filters = {}) {
    return api.listMarketSwaps(filters);
  }

  async function quoteAuction(asset, quantity = 1, durationHours = 24) {
    return (await api.quoteMarketAction({
      action: 'auction',
      asset: assetPayload(asset, quantity),
      duration_hours: durationHours,
    }))?.quote;
  }

  async function quoteBuyback(asset, quantity = 1) {
    return (await api.quoteMarketAction({
      action: 'buyback',
      asset: assetPayload(asset, quantity),
    }))?.quote;
  }

  async function mine() {
    const state = await api.getMarketMe();
    return collectPendingSales(state);
  }

  async function sell(selection) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
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
    await mutateBound(next => {
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

    let created;
    try {
      assertCurrentSave(host, snapshot.saveId);
      created = await api.createMarketListing({
        id: listingId,
        asset: listingAsset,
        unit_price: Math.max(1, Math.floor(Number(selection.unitPrice) || 0)),
        duration_hours: durationHours,
      });
    } catch (error) {
      try {
        const state = await api.getMarketMe();
        const recovered = state?.listings?.find(item => item.id === listingId);
        if (recovered) created = { listing: recovered, quote };
      } catch {}

      if (!created) {
        try {
          await mutateBound(next => {
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
    await broadcast(snapshot.saveId, 'list:' + listingId,
      '[空间集市上架][角色] ' + receiptAsset(listingAsset, requestedQuantity)
      + '｜一口价 ' + coin(selection.unitPrice) + '/件｜上架税 ' + coin(listingFee)
      + '｜余额 ' + coin(readLatest(host).data.stat_data.角色.空间币));
    return created;
  }

  async function sellToSystem(selection) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
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

    await mutateBound(next => {
      assertHub(next.stat_data);
      removeAsset(next.stat_data, {
        kind: selection.kind,
        key: selection.key,
        quantity: requestedQuantity,
      });
    });

    let result;
    try {
      assertCurrentSave(host, snapshot.saveId);
      result = await api.createMarketBuyback({ id: buybackId, asset });
    } catch (error) {
      try {
        result = await api.getMarketBuyback(buybackId);
      } catch {}

      if (!result?.buyback) {
        await mutateBound(next => {
          addAsset(next.stat_data, asset);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }

    await broadcast(snapshot.saveId, 'buyback:' + buybackId,
      '[空间集市系统回收][角色] ' + receiptAsset(asset, requestedQuantity)
      + '｜回收收入 ' + coin(result?.buyback?.amount ?? result?.payout?.amount));
    if (result?.payout) await receivePayout(result.payout);
    return result;
  }

  async function createBuyOrder({
    kind,
    name,
    quality = '',
    subtype = '',
    quantity = 1,
    unitPrice,
    durationHours = 24,
  }) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
    assertHub(snapshot.data.stat_data);
    const resolvedQuantity = kind === 'item'
      ? Math.max(1, Math.floor(Number(quantity) || 1))
      : 1;
    const price = Math.max(1, Math.floor(Number(unitPrice) || 0));
    const total = price * resolvedQuantity;
    if (Number(snapshot.data.stat_data.角色.空间币 || 0) < total) {
      throw new Error('空间币不足：求购托管需要 ' + total);
    }

    const id = randomId(host, 'order');
    await mutateBound(next => {
      assertHub(next.stat_data);
      const current = Number(next.stat_data.角色.空间币 || 0);
      if (current < total) throw new Error('空间币不足');
      next.stat_data.角色.空间币 = current - total;
    });

    let result;
    try {
      assertCurrentSave(host, snapshot.saveId);
      result = await api.createMarketBuyOrder({
        id,
        kind,
        name,
        quality,
        subtype,
        quantity: resolvedQuantity,
        unit_price: price,
        duration_hours: durationHours,
      });
    } catch (error) {
      try { result = await api.getMarketBuyOrder(id); } catch {}
      if (!result?.order) {
        await mutateBound(next => {
          next.stat_data.角色.空间币 = Number(next.stat_data.角色.空间币 || 0) + total;
        });
        throw error;
      }
    }
    await broadcast(snapshot.saveId, 'order:' + id,
      '[空间集市发布求购][角色] 求购' + (MARKET_KIND_LABELS[kind] || '资产')
      + '「' + String(name || '') + '」×' + resolvedQuantity
      + '｜托管 ' + coin(total) + '｜余额 ' + coin(readLatest(host).data.stat_data.角色.空间币));
    return result;
  }

  async function fillBuyOrder(order, selection) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
    assertHub(snapshot.data.stat_data);
    const located = findAsset(snapshot.data.stat_data, selection.kind, selection.key);
    const available = assetQuantity(selection.kind, located.value);
    const requested = selection.kind === 'item'
      ? Math.max(1, Math.min(
          available,
          Number(order?.remaining_quantity || 1),
          Math.floor(Number(selection.quantity) || 1),
        ))
      : 1;
    if (requested <= 0) throw new Error('没有可成交的资产');

    const original = {
      kind: selection.kind,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: requested,
      data: deepClone(located.value),
    };
    const outgoing = listingAssetSnapshot(original);
    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, selection);
    const fillId = randomId(host, 'orderfill');

    await mutateBound(next => {
      removeAsset(next.stat_data, { ...selection, quantity: requested });
    });

    let result;
    try {
      assertCurrentSave(host, snapshot.saveId);
      result = await api.fillMarketBuyOrder(order.id, {
        fill_id: fillId,
        asset: assetPayload(outgoing, requested),
      });
    } catch (error) {
      const state = await api.getMarketMe().catch(() => null);
      const recovered = state?.order_fills?.find(item => item.id === fillId);
      if (recovered) result = { fill: recovered };
      if (!result) {
        await mutateBound(next => {
          addAsset(next.stat_data, original);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }
    await broadcast(snapshot.saveId, 'fill:' + fillId,
      '[空间集市完成求购][角色] 出售' + receiptAsset(original, requested)
      + '｜成交额 ' + coin(result?.fill?.total_price || Number(order.unit_price || 0) * requested)
      + '｜货款待领取');
    return result;
  }

  async function cancelBuyOrder(orderId) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const result = await api.cancelMarketBuyOrder(orderId);
    if (result?.order?.status === 'cancelled') {
      await broadcast(snapshot.saveId, 'order-cancel:' + orderId,
        '[空间集市取消求购][角色] 求购单已取消｜未成交托管空间币退回待领取');
    }
    if (result?.payout) await receivePayout(result.payout);
    return result;
  }

  async function deliverOrderFill(fill) {
    if (!fill?.id) throw new Error('求购交付记录无效');
    const receiptSaveId = currentMarketSaveId(host);
    if (fill.buyer_save_id && fill.buyer_save_id !== receiptSaveId) {
      throw new Error('这笔待领取交易属于另一个存档，请切换回原存档领取');
    }
    const mutateBound = mutator => mutateLatest(host, mutator, receiptSaveId);
    await mutateBound(next => {
      assertHub(next.stat_data);
      const deliveries = ledgerBucket(next, 'orderDeliveries');
      if (deliveries[fill.id]) return;
      if (collisionFor(next.stat_data, fill.asset)) {
        throw new Error(`无法领取“${fill.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, fill.asset);
      deliveries[fill.id] = Date.now();
      appendMarketBroadcast(next, 'order-receive:' + fill.id,
        '[空间集市求购到账][角色] 领取' + receiptAsset(fill.asset, fill.quantity)
        + '｜原求购托管成交 ' + coin(fill.total_price));
    });
    await api.confirmMarketOrderDelivery(fill.id);
    return fill;
  }

  async function createSwap({
    offered,
    wanted,
    durationHours = 24,
  }) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
    assertHub(snapshot.data.stat_data);
    const located = findAsset(snapshot.data.stat_data, offered.kind, offered.key);
    const available = assetQuantity(offered.kind, located.value);
    const offeredQuantity = offered.kind === 'item'
      ? Math.max(1, Math.min(available, Math.floor(Number(offered.quantity) || 1)))
      : 1;
    const original = {
      kind: offered.kind,
      name: String(offered.name || assetName(offered.key, located.value)).trim(),
      quantity: offeredQuantity,
      data: deepClone(located.value),
    };
    const outgoing = listingAssetSnapshot(original);
    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, offered);
    const id = randomId(host, 'swap');

    await mutateBound(next => {
      removeAsset(next.stat_data, { ...offered, quantity: offeredQuantity });
    });

    let result;
    try {
      assertCurrentSave(host, snapshot.saveId);
      result = await api.createMarketSwap({
        id,
        offered: assetPayload(outgoing, offeredQuantity),
        wanted,
        duration_hours: durationHours,
      });
    } catch (error) {
      try { result = await api.getMarketSwap(id); } catch {}
      if (!result?.swap) {
        await mutateBound(next => {
          addAsset(next.stat_data, original);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }
    await broadcast(snapshot.saveId, 'swap:' + id,
      '[空间集市发布交换][角色] 提供' + receiptAsset(outgoing, offeredQuantity)
      + '｜希望换取「' + String(wanted?.name || '资产') + '」×' + Number(wanted?.quantity || 1));
    return result;
  }

  async function acceptSwap(swap, selection) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
    assertHub(snapshot.data.stat_data);
    const located = findAsset(snapshot.data.stat_data, selection.kind, selection.key);
    const available = assetQuantity(selection.kind, located.value);
    const requested = selection.kind === 'item'
      ? Math.max(1, Math.min(
          available,
          Number(swap?.wanted?.quantity || 1),
          Math.floor(Number(selection.quantity) || 1),
        ))
      : 1;
    const original = {
      kind: selection.kind,
      name: String(selection.name || assetName(selection.key, located.value)).trim(),
      quantity: requested,
      data: deepClone(located.value),
    };
    const outgoing = listingAssetSnapshot(original);
    const activeFormSnapshot = formActivationSnapshot(snapshot.data.stat_data, selection);

    await mutateBound(next => {
      removeAsset(next.stat_data, { ...selection, quantity: requested });
    });

    let result;
    try {
      assertCurrentSave(host, snapshot.saveId);
      result = await api.acceptMarketSwap(swap.id, {
        asset: assetPayload(outgoing, requested),
      });
    } catch (error) {
      const state = await api.getMarketMe().catch(() => null);
      const recovered = state?.swaps?.find(item => item.id === swap.id && item.status === 'completed');
      if (recovered) result = { swap: recovered };
      if (!result) {
        await mutateBound(next => {
          addAsset(next.stat_data, original);
          restoreFormActivation(next.stat_data, activeFormSnapshot);
        });
        throw error;
      }
    }
    await broadcast(snapshot.saveId, 'swap-accept:' + swap.id,
      '[空间集市完成交换][角色] 交出' + receiptAsset(outgoing, requested)
      + '｜换取「' + String(swap?.offered?.name || '资产') + '」待领取');
    return result;
  }

  async function cancelSwap(swapId) {
    const snapshot = readLatest(host);
    assertHub(snapshot.data.stat_data);
    const result = await api.cancelMarketSwap(swapId);
    if (result?.swap?.status === 'cancelled') {
      await broadcast(snapshot.saveId, 'swap-cancel:' + swapId,
        '[空间集市取消交换][角色] 交换单已撤销｜待取回提供的资产');
    }
    return result;
  }

  async function receiveSwapTransfer(transfer) {
    if (!transfer?.id) throw new Error('交换交付记录无效');
    const receiptSaveId = currentMarketSaveId(host);
    if (transfer.save_id && transfer.save_id !== receiptSaveId) {
      throw new Error('这笔待领取交易属于另一个存档，请切换回原存档领取');
    }
    const mutateBound = mutator => mutateLatest(host, mutator, receiptSaveId);
    await mutateBound(next => {
      assertHub(next.stat_data);
      const transfers = ledgerBucket(next, 'swapTransfers');
      if (transfers[transfer.id]) return;
      if (collisionFor(next.stat_data, transfer.asset)) {
        throw new Error(`无法领取“${transfer.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, transfer.asset);
      transfers[transfer.id] = Date.now();
      appendMarketBroadcast(next, 'swap-receive:' + transfer.id,
        '[空间集市交换领取][角色] 领取' + receiptAsset(transfer.asset, transfer.quantity));
    });
    await api.confirmMarketSwapTransfer(transfer.id);
    return transfer;
  }

  async function deliverTrade(trade) {
    if (!trade?.id) throw new Error('交易记录无效');
    const receiptSaveId = currentMarketSaveId(host);
    if (trade.buyer_save_id && trade.buyer_save_id !== receiptSaveId) {
      throw new Error('这笔待领取交易属于另一个存档，请切换回原存档领取');
    }
    const mutateBound = mutator => mutateLatest(host, mutator, receiptSaveId);
    await mutateBound(next => {
      assertHub(next.stat_data);
      const deliveries = ledgerBucket(next, 'deliveries');
      if (deliveries[trade.id]) return;
      if (collisionFor(next.stat_data, trade.asset)) {
        throw new Error(`无法领取“${trade.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, trade.asset);
      deliveries[trade.id] = Date.now();
      appendMarketBroadcast(next, 'purchase:' + trade.id,
        '[空间集市买入][角色] 获得' + receiptAsset(trade.asset, trade.quantity)
        + '｜支付 ' + coin(trade.total_price)
        + '｜余额 ' + coin(next.stat_data.角色.空间币));
    });
    await api.confirmMarketDelivery(trade.id);
    return trade;
  }

  async function quoteCatalogPurchase(catalogKey, quantity = 1) {
    return (await api.quoteMarketCatalogPurchase(catalogKey, quantity))?.quote;
  }

  async function buyCatalog(catalogItem, quantity = 1, suppliedQuote = null) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
    assertHub(snapshot.data.stat_data);

    const catalogKey = String(catalogItem?.key || catalogItem?.catalog_key || '').trim();
    const asset = catalogItem?.asset;
    if (!catalogKey || !asset) throw new Error('商品目录数据无效');

    const resolvedQuantity = asset.kind === 'item'
      ? Math.max(1, Math.floor(Number(quantity) || 1))
      : 1;
    if (collisionFor(snapshot.data.stat_data, asset)) {
      throw new Error(`当前存档已有同名${MARKET_KIND_LABELS[asset.kind]}，暂不能购买`);
    }

    const quote = suppliedQuote || await quoteCatalogPurchase(catalogKey, resolvedQuantity);
    const total = Number(quote?.total_price || 0);
    const quotedQuantity = Number(quote?.quantity || resolvedQuantity);
    if (!Number.isFinite(total) || total <= 0) throw new Error('市场报价无效');
    if (Number(snapshot.data.stat_data.角色.空间币 || 0) < total) {
      throw new Error('空间币不足：需要 ' + total);
    }

    const purchaseId = randomId(host, 'purchase');
    await mutateBound(next => {
      assertHub(next.stat_data);
      const current = Number(next.stat_data.角色.空间币 || 0);
      if (current < total) throw new Error('空间币不足');
      next.stat_data.角色.空间币 = current - total;
    });

    let result;
    try {
      assertCurrentSave(host, snapshot.saveId);
      result = await api.buyMarketCatalog(catalogKey, {
        purchase_id: purchaseId,
        quantity: quotedQuantity,
        expected_total: total,
      });
    } catch (error) {
      try {
        result = await api.getMarketPurchase(purchaseId);
      } catch {}

      if (!result?.purchase || result.purchase.status !== 'completed') {
        await mutateBound(next => {
          next.stat_data.角色.空间币 = Number(next.stat_data.角色.空间币 || 0) + total;
        });
        throw error;
      }
    }

    for (const trade of result.trades || []) {
      await deliverTrade(trade);
    }
    return result;
  }

  async function buy(listing, quantity = 1) {
    const snapshot = readLatest(host);
    const mutateBound = mutator => mutateLatest(host, mutator, snapshot.saveId);
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
    await mutateBound(next => {
      assertHub(next.stat_data);
      const current = Number(next.stat_data.角色.空间币 || 0);
      if (current < total) throw new Error('空间币不足');
      next.stat_data.角色.空间币 = current - total;
    });

    let trade;
    try {
      assertCurrentSave(host, snapshot.saveId);
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
        await mutateBound(next => {
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
    if (result?.listing?.status === 'cancelled' || result?.return) {
      await broadcast(snapshot.saveId, 'listing-cancel:' + listingId,
        '[空间集市撤回拍卖][角色] 挂单已取消或到期撤回｜未售出资产待取回');
    }
    if (result?.return) await receiveReturn(result.return);
    return result;
  }

  async function receiveReturn(returnRecord) {
    if (!returnRecord?.id) throw new Error('返还记录无效');
    const receiptSaveId = currentMarketSaveId(host);
    if (returnRecord.save_id && returnRecord.save_id !== receiptSaveId) {
      throw new Error('这笔待领取交易属于另一个存档，请切换回原存档领取');
    }
    const mutateBound = mutator => mutateLatest(host, mutator, receiptSaveId);
    await mutateBound(next => {
      assertHub(next.stat_data);
      const returns = ledgerBucket(next, 'returns');
      if (returns[returnRecord.id]) return;
      if (collisionFor(next.stat_data, returnRecord.asset)) {
        throw new Error(`无法返还“${returnRecord.asset.name}”：当前存档已有同名资产`);
      }
      addAsset(next.stat_data, returnRecord.asset);
      returns[returnRecord.id] = Date.now();
      appendMarketBroadcast(next, 'return:' + returnRecord.id,
        '[空间集市取回资产][角色] ' + receiptAsset(returnRecord.asset, returnRecord.quantity));
    });
    await api.confirmMarketReturn(returnRecord.id);
    return returnRecord;
  }

  async function receivePayout(payout) {
    if (!payout?.id) throw new Error('货款领取记录无效');
    const receiptSaveId = currentMarketSaveId(host);
    if (payout.save_id && payout.save_id !== receiptSaveId) {
      throw new Error('这笔待领取交易属于另一个存档，请切换回原存档领取');
    }
    const mutateBound = mutator => mutateLatest(host, mutator, receiptSaveId);
    await mutateBound(next => {
      assertHub(next.stat_data);
      const payouts = ledgerBucket(next, 'payouts');
      if (payouts[payout.id]) return;
      next.stat_data.角色.空间币 = Number(next.stat_data.角色.空间币 || 0) + Number(payout.amount || 0);
      payouts[payout.id] = Date.now();
      appendMarketBroadcast(next, 'payout:' + payout.id,
        '[空间集市领取空间币][角色] 入账 ' + coin(payout.amount)
        + '｜余额 ' + coin(next.stat_data.角色.空间币));
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
      assertCurrentSave(host, snapshot.saveId);
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
    catalog,
    catalogSnapshot,
    catalogDetail,
    listBuyOrders,
    listSwaps,
    quoteAuction,
    quoteBuyback,
    mine,
    sell,
    sellToSystem,
    createBuyOrder,
    fillBuyOrder,
    cancelBuyOrder,
    deliverOrderFill,
    createSwap,
    acceptSwap,
    cancelSwap,
    receiveSwapTransfer,
    quoteCatalogPurchase,
    buyCatalog,
    buy,
    cancel,
    deliverTrade,
    receiveReturn,
    claimProceeds,
    receivePayout,
  };
}
