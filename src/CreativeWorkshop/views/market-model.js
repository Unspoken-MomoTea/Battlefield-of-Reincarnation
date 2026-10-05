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
