// Bind authenticated marketplace operations to a stable chat/save scope instead
// of a changing message index. The header is a routing guard, not anti-cheat.
export function currentMarketSaveId(host = globalThis) {
  const roots = [host];
  try { if (host?.parent && !roots.includes(host.parent)) roots.push(host.parent); } catch {}
  try { if (host?.top && !roots.includes(host.top)) roots.push(host.top); } catch {}
  let chatId = '';
  for (const root of roots) {
    try {
      chatId = String(root?.getCurrentChatId?.() || root?.SillyTavern?.getContext?.()?.chatId || '').trim();
      if (chatId) break;
    } catch {}
  }
  if (!chatId) throw new Error('空间集市无法识别当前聊天存档，请先进入有效存档');
  let hash = 1469598103934665603n;
  for (const byte of new TextEncoder().encode(chatId)) {
    hash ^= BigInt(byte);
    hash = (hash * 1099511628211n) & ((1n << 64n) - 1n);
  }
  return 'save:' + hash.toString(16).padStart(16, '0');
}

export function createMarketApi(request) {
  const scopedRequest = (url, init = {}, requireAuth = false) => {
    if (!requireAuth) return request(url, init, false);
    const headers = { ...(init.headers || {}), 'X-Market-Save': currentMarketSaveId() };
    return request(url, { ...init, headers }, true);
  };
  return {
    listMarketListings({ query = '', kind = '', sort = 'latest', offset = 0, limit = 24 } = {}) {
      const params = new URLSearchParams({
        sort,
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(60, Number(limit) || 24))),
      });
      if (String(query).trim()) params.set('q', String(query).trim());
      if (kind) params.set('kind', kind);
      return scopedRequest(`/api/market/listings?${params}`, { cache: 'no-store' });
    },

    listMarketCatalog({
      query = '',
      kind = '',
      quality = '',
      subtype = '',
      minPrice = 0,
      maxPrice = 0,
      sort = 'price_asc',
      offset = 0,
      limit = 40,
    } = {}) {
      const params = new URLSearchParams({
        sort,
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(80, Number(limit) || 40))),
      });
      if (String(query).trim()) params.set('q', String(query).trim());
      if (kind) params.set('kind', kind);
      if (quality) params.set('quality', quality);
      if (subtype) params.set('subtype', subtype);
      if (Number(minPrice) > 0) params.set('min_price', String(Math.floor(Number(minPrice))));
      if (Number(maxPrice) > 0) params.set('max_price', String(Math.floor(Number(maxPrice))));
      return scopedRequest(`/api/market/catalog?${params}`, { cache: 'no-store' });
    },

    getMarketCatalog(catalogKey) {
      return scopedRequest(
        `/api/market/catalog/${encodeURIComponent(catalogKey)}`,
        { cache: 'no-store' },
      );
    },

    quoteMarketCatalogPurchase(catalogKey, quantity) {
      const params = new URLSearchParams({
        quantity: String(Math.max(1, Math.floor(Number(quantity) || 1))),
      });
      return scopedRequest(
        `/api/market/catalog/${encodeURIComponent(catalogKey)}/quote?${params}`,
        { cache: 'no-store' },
        true,
      );
    },

    buyMarketCatalog(catalogKey, input) {
      return scopedRequest(
        `/api/market/catalog/${encodeURIComponent(catalogKey)}/buy`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    getMarketPurchase(purchaseId) {
      return scopedRequest(
        `/api/market/purchases/${encodeURIComponent(purchaseId)}`,
        { cache: 'no-store' },
        true,
      );
    },

    listDeals(query = '') {
      return scopedRequest('/api/market/deals?q=' + encodeURIComponent(query), { cache: 'no-store' });
    },
    myDeals() {
      return scopedRequest('/api/market/deals/me', { cache: 'no-store' }, true);
    },
    getDeal(id) {
      return scopedRequest('/api/market/deals/' + encodeURIComponent(id), { cache: 'no-store' }, true);
    },
    createDeal(input) {
      return scopedRequest('/api/market/deals', { method: 'POST', body: JSON.stringify(input) }, true);
    },
    submitDealBid(id, input) {
      return scopedRequest('/api/market/deals/' + encodeURIComponent(id) + '/bids',
        { method: 'POST', body: JSON.stringify(input) }, true);
    },
    decideDealBid(id, bidId, accepted) {
      return scopedRequest('/api/market/deals/' + encodeURIComponent(id) + '/bids/'
        + encodeURIComponent(bidId) + (accepted ? '/accept' : '/reject'),
        { method: 'POST' }, true);
    },
    withdrawDealBid(bidId) {
      return scopedRequest('/api/market/deal-bids/' + encodeURIComponent(bidId) + '/withdraw',
        { method: 'POST' }, true);
    },
    cancelDeal(id) {
      return scopedRequest('/api/market/deals/' + encodeURIComponent(id) + '/cancel',
        { method: 'POST' }, true);
    },
    confirmDealTransfer(id) {
      return scopedRequest('/api/market/deal-transfers/' + encodeURIComponent(id) + '/confirmed',
        { method: 'POST' }, true);
    },

    listMarketBuyOrders({ query = '', kind = '', quality = '', offset = 0, limit = 40 } = {}) {
      const params = new URLSearchParams({
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(80, Number(limit) || 40))),
      });
      if (String(query).trim()) params.set('q', String(query).trim());
      if (kind) params.set('kind', kind);
      if (quality) params.set('quality', quality);
      return scopedRequest(`/api/market/orders?${params}`, { cache: 'no-store' });
    },

    createMarketBuyOrder(input) {
      return scopedRequest('/api/market/orders', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    getMarketBuyOrder(orderId) {
      return scopedRequest(`/api/market/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' }, true);
    },

    fillMarketBuyOrder(orderId, input) {
      return scopedRequest(
        `/api/market/orders/${encodeURIComponent(orderId)}/fill`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    cancelMarketBuyOrder(orderId) {
      return scopedRequest(
        `/api/market/orders/${encodeURIComponent(orderId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    confirmMarketOrderDelivery(fillId) {
      return scopedRequest(
        `/api/market/order-fills/${encodeURIComponent(fillId)}/delivered`,
        { method: 'POST' },
        true,
      );
    },

    listMarketSwaps({ query = '', kind = '', quality = '', offset = 0, limit = 40 } = {}) {
      const params = new URLSearchParams({
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(80, Number(limit) || 40))),
      });
      if (String(query).trim()) params.set('q', String(query).trim());
      if (kind) params.set('kind', kind);
      if (quality) params.set('quality', quality);
      return scopedRequest(`/api/market/swaps?${params}`, { cache: 'no-store' });
    },

    createMarketSwap(input) {
      return scopedRequest('/api/market/swaps', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    getMarketSwap(swapId) {
      return scopedRequest(`/api/market/swaps/${encodeURIComponent(swapId)}`, { cache: 'no-store' }, true);
    },

    acceptMarketSwap(swapId, input) {
      return scopedRequest(
        `/api/market/swaps/${encodeURIComponent(swapId)}/accept`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    cancelMarketSwap(swapId) {
      return scopedRequest(
        `/api/market/swaps/${encodeURIComponent(swapId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    confirmMarketSwapTransfer(transferId) {
      return scopedRequest(
        `/api/market/swap-transfers/${encodeURIComponent(transferId)}/confirmed`,
        { method: 'POST' },
        true,
      );
    },

    quoteMarketAction(input) {
      return scopedRequest(
        '/api/market/quote',
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    createMarketListing(input) {
      return scopedRequest(
        '/api/market/listings',
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    createMarketBuyback(input) {
      return scopedRequest(
        '/api/market/buybacks',
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    getMarketBuyback(buybackId) {
      return scopedRequest(
        `/api/market/buybacks/${encodeURIComponent(buybackId)}`,
        { cache: 'no-store' },
        true,
      );
    },

    buyMarketListing(listingId, input) {
      return scopedRequest(
        `/api/market/listings/${encodeURIComponent(listingId)}/buy`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    cancelMarketListing(listingId) {
      return scopedRequest(
        `/api/market/listings/${encodeURIComponent(listingId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    getMarketTrade(tradeId) {
      return scopedRequest(
        `/api/market/trades/${encodeURIComponent(tradeId)}`,
        { cache: 'no-store' },
        true,
      );
    },

    confirmMarketDelivery(tradeId) {
      return scopedRequest(
        `/api/market/trades/${encodeURIComponent(tradeId)}/delivered`,
        { method: 'POST' },
        true,
      );
    },

    getMarketMe() {
      return scopedRequest('/api/market/me', { cache: 'no-store' }, true);
    },

    confirmMarketReturn(returnId) {
      return scopedRequest(
        `/api/market/returns/${encodeURIComponent(returnId)}/confirmed`,
        { method: 'POST' },
        true,
      );
    },

    claimMarketPayout(payoutId) {
      return scopedRequest(
        '/api/market/payouts/claim',
        { method: 'POST', body: JSON.stringify({ payout_id: payoutId }) },
        true,
      );
    },

    confirmMarketPayout(payoutId) {
      return scopedRequest(
        `/api/market/payouts/${encodeURIComponent(payoutId)}/confirmed`,
        { method: 'POST' },
        true,
      );
    },
  };
}
