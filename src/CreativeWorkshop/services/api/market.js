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

    createMarketListing(input) {
      return request(
        '/api/market/listings',
        { method: 'POST', body: JSON.stringify(input) },
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
