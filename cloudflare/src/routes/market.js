import {
  buyMarketListing,
  cancelMarketListing,
  createMarketBuyback,
  claimMarketPayout,
  confirmMarketDelivery,
  confirmMarketPayout,
  confirmMarketReturn,
  createMarketListing,
  getMarketBuyback,
  getMarketCatalogProduct,
  getMarketMe,
  getMarketTrade,
  listMarketCatalog,
  listMarketListings,
  quoteMarketAction,
} from '../market.js';
import {
  cancelMarketOrder,
  confirmMarketOrderDelivery,
  createMarketOrder,
  fillMarketOrder,
  getMarketOrder,
  getMarketOrderFill,
} from '../market-orders.js';
import {
  acceptMarketBarter,
  cancelMarketBarter,
  confirmMarketBarterDelivery,
  createMarketBarter,
  getMarketBarter,
  listMarketBarters,
} from '../market-barter.js';
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

  if (request.method === 'GET' && pathname === '/api/market/catalog') {
    return listMarketCatalog(request, env);
  }
  if (request.method === 'GET' && pathname === '/api/market/barters') {
    return listMarketBarters(request, env);
  }
  if (request.method === 'POST' && pathname === '/api/market/barters') {
    return createMarketBarter(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'POST' && pathname === '/api/market/orders') {
    return createMarketOrder(request, env, await authenticatedUser(request, env));
  }

  if (request.method === 'GET' && pathname === '/api/market/listings') {
    return listMarketListings(request, env);
  }
  if (request.method === 'POST' && pathname === '/api/market/listings') {
    return createMarketListing(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'POST' && pathname === '/api/market/quote') {
    return quoteMarketAction(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'POST' && pathname === '/api/market/buybacks') {
    return createMarketBuyback(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/market/me') {
    return getMarketMe(env, await authenticatedUser(request, env));
  }
  if (request.method === 'POST' && pathname === '/api/market/payouts/claim') {
    return claimMarketPayout(request, env, await authenticatedUser(request, env));
  }

  const catalogKey = entityId(pathname, 'catalog');
  if (request.method === 'GET' && catalogKey) {
    return getMarketCatalogProduct(env, catalogKey);
  }

  const orderId = entityId(pathname, 'orders');
  if (request.method === 'GET' && orderId) {
    return getMarketOrder(env, await authenticatedUser(request, env), orderId);
  }
  const orderCancelId = entityId(pathname, 'orders', 'cancel');
  if (request.method === 'POST' && orderCancelId) {
    return cancelMarketOrder(env, await authenticatedUser(request, env), orderCancelId);
  }
  const orderFillId = entityId(pathname, 'orders', 'fill');
  if (request.method === 'POST' && orderFillId) {
    return fillMarketOrder(request, env, await authenticatedUser(request, env), orderFillId);
  }

  const fillId = entityId(pathname, 'order-fills');
  if (request.method === 'GET' && fillId) {
    return getMarketOrderFill(env, await authenticatedUser(request, env), fillId);
  }
  const fillDeliveredId = entityId(pathname, 'order-fills', 'delivered');
  if (request.method === 'POST' && fillDeliveredId) {
    return confirmMarketOrderDelivery(env, await authenticatedUser(request, env), fillDeliveredId);
  }

  const barterId = entityId(pathname, 'barters');
  if (request.method === 'GET' && barterId) {
    return getMarketBarter(env, await authenticatedUser(request, env), barterId);
  }
  const barterAcceptId = entityId(pathname, 'barters', 'accept');
  if (request.method === 'POST' && barterAcceptId) {
    return acceptMarketBarter(request, env, await authenticatedUser(request, env), barterAcceptId);
  }
  const barterCancelId = entityId(pathname, 'barters', 'cancel');
  if (request.method === 'POST' && barterCancelId) {
    return cancelMarketBarter(env, await authenticatedUser(request, env), barterCancelId);
  }
  const barterDeliveryId = entityId(pathname, 'barter-deliveries', 'confirmed');
  if (request.method === 'POST' && barterDeliveryId) {
    return confirmMarketBarterDelivery(env, await authenticatedUser(request, env), barterDeliveryId);
  }

  const buyId = entityId(pathname, 'listings', 'buy');
  if (request.method === 'POST' && buyId) {
    return buyMarketListing(request, env, await authenticatedUser(request, env), buyId);
  }

  const cancelId = entityId(pathname, 'listings', 'cancel');
  if (request.method === 'POST' && cancelId) {
    return cancelMarketListing(env, await authenticatedUser(request, env), cancelId);
  }

  const buybackId = entityId(pathname, 'buybacks');
  if (request.method === 'GET' && buybackId) {
    return getMarketBuyback(env, await authenticatedUser(request, env), buybackId);
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
