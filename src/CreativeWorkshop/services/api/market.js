export function createMarketApi(request) {
  return {
    listMarketListings({ query = '', kind = '', sort = 'latest', offset = 0, limit = 24 } = {}) {
      const params = new URLSearchParams({
        sort,
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(60, Number(limit) || 24))),
      });
      if (String(query).trim()) params.set('q', String(query).trim());
      if (kind) params.set('kind', kind);
      return request(`/api/market/listings?${params}`, { cache: 'no-store' });
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
      return request(`/api/market/catalog?${params}`, { cache: 'no-store' });
    },

    getMarketCatalog(catalogKey) {
      return request(
        `/api/market/catalog/${encodeURIComponent(catalogKey)}`,
        { cache: 'no-store' },
      );
    },

    listMarketBuyOrders({ query = '', kind = '', quality = '', offset = 0, limit = 40 } = {}) {
      const params = new URLSearchParams({
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(80, Number(limit) || 40))),
      });
      if (String(query).trim()) params.set('q', String(query).trim());
      if (kind) params.set('kind', kind);
      if (quality) params.set('quality', quality);
      return request(`/api/market/orders?${params}`, { cache: 'no-store' });
    },

    createMarketBuyOrder(input) {
      return request('/api/market/orders', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    getMarketBuyOrder(orderId) {
      return request(`/api/market/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' }, true);
    },

    fillMarketBuyOrder(orderId, input) {
      return request(
        `/api/market/orders/${encodeURIComponent(orderId)}/fill`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    cancelMarketBuyOrder(orderId) {
      return request(
        `/api/market/orders/${encodeURIComponent(orderId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    confirmMarketOrderDelivery(fillId) {
      return request(
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
      return request(`/api/market/swaps?${params}`, { cache: 'no-store' });
    },

    createMarketSwap(input) {
      return request('/api/market/swaps', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    getMarketSwap(swapId) {
      return request(`/api/market/swaps/${encodeURIComponent(swapId)}`, { cache: 'no-store' }, true);
    },

    acceptMarketSwap(swapId, input) {
      return request(
        `/api/market/swaps/${encodeURIComponent(swapId)}/accept`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    cancelMarketSwap(swapId) {
      return request(
        `/api/market/swaps/${encodeURIComponent(swapId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    confirmMarketSwapTransfer(transferId) {
      return request(
        `/api/market/swap-transfers/${encodeURIComponent(transferId)}/confirmed`,
        { method: 'POST' },
        true,
      );
    },

    quoteMarketAction(input) {
      return request(
        '/api/market/quote',
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    createMarketListing(input) {
      return request(
        '/api/market/listings',
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    createMarketBuyback(input) {
      return request(
        '/api/market/buybacks',
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    getMarketBuyback(buybackId) {
      return request(
        `/api/market/buybacks/${encodeURIComponent(buybackId)}`,
        { cache: 'no-store' },
        true,
      );
    },

    buyMarketListing(listingId, input) {
      return request(
        `/api/market/listings/${encodeURIComponent(listingId)}/buy`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    cancelMarketListing(listingId) {
      return request(
        `/api/market/listings/${encodeURIComponent(listingId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    getMarketTrade(tradeId) {
      return request(
        `/api/market/trades/${encodeURIComponent(tradeId)}`,
        { cache: 'no-store' },
        true,
      );
    },

    confirmMarketDelivery(tradeId) {
      return request(
        `/api/market/trades/${encodeURIComponent(tradeId)}/delivered`,
        { method: 'POST' },
        true,
      );
    },

    getMarketMe() {
      return request('/api/market/me', { cache: 'no-store' }, true);
    },

    confirmMarketReturn(returnId) {
      return request(
        `/api/market/returns/${encodeURIComponent(returnId)}/confirmed`,
        { method: 'POST' },
        true,
      );
    },

    claimMarketPayout(payoutId) {
      return request(
        '/api/market/payouts/claim',
        { method: 'POST', body: JSON.stringify({ payout_id: payoutId }) },
        true,
      );
    },

    confirmMarketPayout(payoutId) {
      return request(
        `/api/market/payouts/${encodeURIComponent(payoutId)}/confirmed`,
        { method: 'POST' },
        true,
      );
    },
  };
}
