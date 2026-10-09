const HIDDEN_MARKET_DETAIL_KEYS = new Set([
  '真属性',
  '系统商品',
  '凭证品质',
  '最终属性',
  'HP_MAX',
  'HP',
  'THP',
  'EP_MAX',
  'EP',
]);

function pruneMarketDetailValue(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value.trim() ? value : undefined;
  if (Array.isArray(value)) {
    const items = value
      .map(pruneMarketDetailValue)
      .filter(item => item !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (HIDDEN_MARKET_DETAIL_KEYS.has(key)) continue;
      const pruned = pruneMarketDetailValue(nested);
      if (pruned !== undefined) out[key] = pruned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

export function marketAssetDetailEntries(asset) {
  const entries = [];
  for (const [key, value] of Object.entries(asset?.data || {})) {
    if (HIDDEN_MARKET_DETAIL_KEYS.has(key)) continue;
    const pruned = pruneMarketDetailValue(value);
    if (pruned !== undefined) entries.push([key, pruned]);
  }
  return entries;
}

const TEAMMATE_DETAIL_OMIT = new Set([
  ...HIDDEN_MARKET_DETAIL_KEYS,
  '在场',
  '是否队友',
  '数量',
]);

function compactNamedAssets(bucket, { quantity = false } = {}) {
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return [];
  return Object.entries(bucket)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    .map(([name, value]) => ({
      name: String(name || '').trim(),
      rank: String(value.品质 || value.层级 || '').trim(),
      quantity: quantity ? Math.max(1, Math.floor(Number(value.数量) || 1)) : 1,
    }))
    .filter(item => item.name);
}

function compactOccupations(bucket) {
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return [];
  return Object.entries(bucket)
    .map(([name, value]) => ({
      name: String(name || '').trim(),
      meta: String(value?.类型 || '').trim(),
    }))
    .filter(item => item.name);
}

export function marketTeammateDetailModel(asset) {
  if (String(asset?.kind || '') !== 'teammate') return null;
  const data = asset?.data && typeof asset.data === 'object' && !Array.isArray(asset.data)
    ? asset.data
    : {};

  const identity = Array.isArray(data.身份)
    ? data.身份.map(value => String(value || '').trim()).filter(Boolean)
    : [];
  const currentForm = data.当前形态?.激活 && String(data.当前形态?.名称 || '').trim()
    ? String(data.当前形态.名称).trim()
    : '';

  return {
    overview: [
      ['层级', String(data.层级 || data.品质 || '').trim()],
      ['种族', String(data.种族 || '').trim()],
    ].filter(([, value]) => value),
    identity,
    occupations: compactOccupations(data.职业),
    builds: [
      ['血统', compactNamedAssets(data.血统)],
      ['技能', compactNamedAssets(data.技能)],
      ['装备', compactNamedAssets(data.装备)],
      ['道具', compactNamedAssets(data.道具, { quantity: true })],
      ['形态', compactNamedAssets(data.形态库)],
      ['状态', compactNamedAssets(data.状态)],
    ].filter(([, items]) => items.length),
    currentForm,
    profile: [
      ['性格', String(data.性格 || '').trim()],
      ['喜爱', String(data.喜爱 || '').trim()],
      ['外貌', String(data.外貌 || '').trim()],
      ['着装', String(data.着装 || '').trim()],
      ['背景故事', String(data.背景故事 || '').trim()],
    ].filter(([, value]) => value),
    relation: [
      ['好感度', Number.isFinite(Number(data.好感度)) ? String(Number(data.好感度)) : '0'],
      ['态度', String(data.态度 || '').trim()],
    ].filter(([, value]) => value),
    extra: Object.entries(data)
      .filter(([key]) => !TEAMMATE_DETAIL_OMIT.has(key))
      .filter(([key]) => ![
        '层级', '品质', '种族', '身份', '职业', '血统', '技能', '装备', '道具',
        '形态库', '当前形态', '状态', '性格', '喜爱', '外貌', '着装', '背景故事',
        '好感度', '态度',
      ].includes(key))
      .map(([key, value]) => [key, pruneMarketDetailValue(value)])
      .filter(([, value]) => value !== undefined),
  };
}

const EQUIPMENT_TYPE_LABELS = ['武器', '手部', '头部', '胸部', '腿部', '鞋子', '披风', '饰品', '世界遗物'];
const EQUIPMENT_STATUS_LABELS = ['未装备', '已装备', '仓库'];
const SKILL_TYPE_LABELS = ['主动', '被动', '特殊'];

export function marketAssetFieldDisplay(asset, key, value) {
  const kind = String(asset?.kind || '');
  if (key === '类型') {
    const index = Number(value);
    if (kind === 'equipment' && Number.isInteger(index) && EQUIPMENT_TYPE_LABELS[index]) {
      return EQUIPMENT_TYPE_LABELS[index];
    }
    if (kind === 'skill' && Number.isInteger(index) && SKILL_TYPE_LABELS[index]) {
      return SKILL_TYPE_LABELS[index];
    }
  }

  if (key === '状态') {
    const index = Number(value);
    if ((kind === 'equipment' || kind === 'item') && Number.isInteger(index) && EQUIPMENT_STATUS_LABELS[index]) {
      return EQUIPMENT_STATUS_LABELS[index];
    }
  }

  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (key === '数量') continue;
    out[key] = canonical(value[key]);
  }
  return out;
}

function commodityKey(asset) {
  return 'item:' + String(asset?.name || '')
    + ':' + JSON.stringify(canonical(asset?.data || {}));
}

export function buildMarketRows(listings = [], currentUserId = null) {
  const rows = [];
  const grouped = new Map();

  for (const listing of Array.isArray(listings) ? listings : []) {
    if (!listing?.id || !listing?.asset) continue;
    const kind = String(listing.asset.kind || '');
    const name = String(listing.asset.name || '未命名资产');
    const key = kind === 'item' ? commodityKey(listing.asset) : 'listing:' + listing.id;

    let row = grouped.get(key);
    if (!row) {
      row = {
        key,
        kind,
        name,
        asset: listing.asset,
        listings: [],
        totalStock: 0,
        buyableStock: 0,
        lowestPrice: null,
        buyPrice: null,
        sellerCount: 0,
        ownedOnly: false,
      };
      grouped.set(key, row);
      rows.push(row);
    }
    row.listings.push(listing);
  }

  for (const row of rows) {
    row.listings.sort((a, b) => (
      Number(a.unit_price || 0) - Number(b.unit_price || 0)
      || Number(a.created_at || 0) - Number(b.created_at || 0)
    ));
    row.totalStock = row.listings.reduce(
      (sum, listing) => sum + Math.max(0, Number(listing.remaining_quantity || 0)),
      0,
    );
    row.lowestPrice = row.listings.length ? Number(row.listings[0].unit_price || 0) : null;
    row.sellerCount = new Set(row.listings.map(listing => Number(listing.seller?.id || 0))).size;

    const buyable = row.listings.filter(
      listing => Number(listing.seller?.id || 0) !== Number(currentUserId || 0),
    );
    row.buyableStock = buyable.reduce(
      (sum, listing) => sum + Math.max(0, Number(listing.remaining_quantity || 0)),
      0,
    );
    row.buyPrice = buyable.length ? Number(buyable[0].unit_price || 0) : null;
    row.ownedOnly = row.listings.length > 0 && buyable.length === 0;
    row.asset = (buyable[0] || row.listings[0])?.asset || row.asset;
  }

  return rows;
}

export function planMarketPurchase(row, requestedQuantity, currentUserId = null) {
  if (!row?.listings?.length) throw new Error('没有可购买的挂单');

  const isCommodity = row.kind === 'item';
  const wanted = isCommodity
    ? Math.max(1, Math.floor(Number(requestedQuantity) || 1))
    : 1;

  const buyable = row.listings.filter(
    listing => Number(listing.seller?.id || 0) !== Number(currentUserId || 0),
  );
  const stock = buyable.reduce(
    (sum, listing) => sum + Math.max(0, Number(listing.remaining_quantity || 0)),
    0,
  );
  if (wanted > stock) throw new Error('可购买库存不足');

  let remaining = wanted;
  const lines = [];
  for (const listing of buyable) {
    if (remaining <= 0) break;
    const listingStock = Math.max(0, Number(listing.remaining_quantity || 0));
    if (!listingStock) continue;
    const quantity = isCommodity ? Math.min(listingStock, remaining) : 1;
    const subtotal = quantity * Number(listing.unit_price || 0);
    lines.push({ listing, quantity, subtotal });
    remaining -= quantity;
  }

  if (remaining > 0) throw new Error('可购买库存不足');

  return {
    quantity: wanted,
    lines,
    total: lines.reduce((sum, line) => sum + line.subtotal, 0),
  };
}

export function marketPriceLadder(row, currentUserId = null) {
  const levels = new Map();
  for (const listing of row?.listings || []) {
    if (Number(listing.seller?.id || 0) === Number(currentUserId || 0)) continue;
    const price = Number(listing.unit_price || 0);
    const stock = Math.max(0, Number(listing.remaining_quantity || 0));
    if (!stock) continue;
    const current = levels.get(price) || { price, stock: 0, sellers: new Set() };
    current.stock += stock;
    current.sellers.add(Number(listing.seller?.id || 0));
    levels.set(price, current);
  }
  return [...levels.values()]
    .sort((a, b) => a.price - b.price)
    .map(level => ({ price: level.price, stock: level.stock, sellerCount: level.sellers.size }));
}


function marketRowTime(row) {
  return Math.max(0, ...(row?.listings || []).map(listing => Number(listing.created_at || 0)));
}

function marketRowPrice(row) {
  const value = row?.buyPrice ?? row?.lowestPrice;
  return Number.isFinite(Number(value)) ? Number(value) : Number.MAX_SAFE_INTEGER;
}

export function filterMarketRows(rows = [], { kind = '', query = '', sort = 'price_asc' } = {}) {
  const needle = String(query || '').trim().toLocaleLowerCase('zh-CN');
  const filtered = (Array.isArray(rows) ? rows : []).filter(row => {
    if (kind && row?.kind !== kind) return false;
    if (needle && !String(row?.name || '').toLocaleLowerCase('zh-CN').includes(needle)) return false;
    return true;
  });

  return filtered.sort((left, right) => {
    if (sort === 'latest') {
      return marketRowTime(right) - marketRowTime(left)
        || String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN');
    }
    if (sort === 'price_desc') {
      return marketRowPrice(right) - marketRowPrice(left)
        || String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN');
    }
    return marketRowPrice(left) - marketRowPrice(right)
      || String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN');
  });
}
