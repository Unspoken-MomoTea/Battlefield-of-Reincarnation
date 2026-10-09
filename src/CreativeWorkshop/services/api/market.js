export function createMarketApi(request) {
  return {
    listMarketCatalog({ offset = 0, limit = 200 } = {}) {
      const params = new URLSearchParams({
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(500, Number(limit) || 200))),
      });
      return request(`/api/market/catalog?${params}`, { cache: 'no-store' });
    },

    getMarketProduct(marketKey) {
      return request(
        `/api/market/catalog/${encodeURIComponent(marketKey)}`,
        { cache: 'no-store' },
      );
    },

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

    createMarketOrder(input) {
      return request('/api/market/orders', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    getMarketOrder(orderId) {
      return request(`/api/market/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' }, true);
    },

    cancelMarketOrder(orderId) {
      return request(
        `/api/market/orders/${encodeURIComponent(orderId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    fillMarketOrder(orderId, input) {
      return request(
        `/api/market/orders/${encodeURIComponent(orderId)}/fill`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    getMarketOrderFill(fillId) {
      return request(`/api/market/order-fills/${encodeURIComponent(fillId)}`, { cache: 'no-store' }, true);
    },

    confirmMarketOrderDelivery(fillId) {
      return request(
        `/api/market/order-fills/${encodeURIComponent(fillId)}/delivered`,
        { method: 'POST' },
        true,
      );
    },

    listMarketBarters({ offset = 0, limit = 60 } = {}) {
      const params = new URLSearchParams({
        offset: String(Math.max(0, Number(offset) || 0)),
        limit: String(Math.max(1, Math.min(100, Number(limit) || 60))),
      });
      return request(`/api/market/barters?${params}`, { cache: 'no-store' });
    },

    createMarketBarter(input) {
      return request('/api/market/barters', { method: 'POST', body: JSON.stringify(input) }, true);
    },

    getMarketBarter(barterId) {
      return request(`/api/market/barters/${encodeURIComponent(barterId)}`, { cache: 'no-store' }, true);
    },

    acceptMarketBarter(barterId, input) {
      return request(
        `/api/market/barters/${encodeURIComponent(barterId)}/accept`,
        { method: 'POST', body: JSON.stringify(input) },
        true,
      );
    },

    cancelMarketBarter(barterId) {
      return request(
        `/api/market/barters/${encodeURIComponent(barterId)}/cancel`,
        { method: 'POST' },
        true,
      );
    },

    confirmMarketBarterDelivery(deliveryId) {
      return request(
        `/api/market/barter-deliveries/${encodeURIComponent(deliveryId)}/confirmed`,
        { method: 'POST' },
        true,
      );
    },
  };
}
