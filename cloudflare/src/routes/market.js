import {
  buyMarketListing,
  cancelMarketListing,
  claimMarketPayout,
  confirmMarketDelivery,
  confirmMarketPayout,
  confirmMarketReturn,
  createMarketListing,
  getMarketMe,
  getMarketTrade,
  listMarketListings,
} from '../market.js';
import { authenticatedUser } from './context.js';

function marketEnabled(env) {
  return String(env.CLIENT_UPDATE_CHANNEL || '').trim().toLowerCase() === 'testing';
}

function entityId(pathname, entity, suffix = '') {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'market' || parts[2] !== entity || !parts[3]) return null;
  if (suffix) {
    if (parts.length !== 5 || parts[4] !== suffix) return null;
  } else if (parts.length !== 4) {
    return null;
  }
  return decodeURIComponent(parts[3]);
}

export async function routeMarket(request, env, pathname) {
  if (!marketEnabled(env)) return null;

  if (request.method === 'GET' && pathname === '/api/market/listings') {
    return listMarketListings(request, env);
  }
  if (request.method === 'POST' && pathname === '/api/market/listings') {
    return createMarketListing(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/market/me') {
    return getMarketMe(env, await authenticatedUser(request, env));
  }
  if (request.method === 'POST' && pathname === '/api/market/payouts/claim') {
    return claimMarketPayout(request, env, await authenticatedUser(request, env));
  }

  const buyId = entityId(pathname, 'listings', 'buy');
  if (request.method === 'POST' && buyId) {
    return buyMarketListing(request, env, await authenticatedUser(request, env), buyId);
  }

  const cancelId = entityId(pathname, 'listings', 'cancel');
  if (request.method === 'POST' && cancelId) {
    return cancelMarketListing(env, await authenticatedUser(request, env), cancelId);
  }

  const tradeId = entityId(pathname, 'trades');
  if (request.method === 'GET' && tradeId) {
    return getMarketTrade(env, await authenticatedUser(request, env), tradeId);
  }

  const deliveredId = entityId(pathname, 'trades', 'delivered');
  if (request.method === 'POST' && deliveredId) {
    return confirmMarketDelivery(env, await authenticatedUser(request, env), deliveredId);
  }

  const returnId = entityId(pathname, 'returns', 'confirmed');
  if (request.method === 'POST' && returnId) {
    return confirmMarketReturn(env, await authenticatedUser(request, env), returnId);
  }

  const payoutId = entityId(pathname, 'payouts', 'confirmed');
  if (request.method === 'POST' && payoutId) {
    return confirmMarketPayout(env, await authenticatedUser(request, env), payoutId);
  }

  return null;
}
