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
  getMarketMe,
  getMarketTrade,
  listMarketListings,
  prepareMarketBrowse,
  quoteMarketAction,
} from '../market.js';
import { getMarketCatalogDetail, listMarketCatalog } from '../market-catalog.js';
import {
  buyMarketCatalog,
  getMarketPurchase,
  quoteMarketCatalogPurchase,
} from '../market-purchases.js';
import {
  acceptMarketSwap,
  cancelMarketBuyOrder,
  cancelMarketSwap,
  confirmMarketOrderFill,
  confirmMarketSwapTransfer,
  createMarketBuyOrder,
  createMarketSwap,
  fillMarketBuyOrder,
  getMarketBuyOrder,
  getMarketSwap,
  listMarketBuyOrders,
  listMarketSwaps,
} from '../market-orders.js';
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
    await prepareMarketBrowse(env);
    return listMarketCatalog(request, env);
  }
  if (request.method === 'GET' && pathname === '/api/market/orders') {
    return listMarketBuyOrders(request, env);
  }
  if (request.method === 'POST' && pathname === '/api/market/orders') {
    return createMarketBuyOrder(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/market/swaps') {
    return listMarketSwaps(request, env);
  }
  if (request.method === 'POST' && pathname === '/api/market/swaps') {
    return createMarketSwap(request, env, await authenticatedUser(request, env));
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

  const catalogId = entityId(pathname, 'catalog');
  if (request.method === 'GET' && catalogId) {
    await prepareMarketBrowse(env);
    return getMarketCatalogDetail(env, catalogId);
  }
  const catalogQuoteId = entityId(pathname, 'catalog', 'quote');
  if (request.method === 'GET' && catalogQuoteId) {
    await prepareMarketBrowse(env);
    return quoteMarketCatalogPurchase(
      request,
      env,
      await authenticatedUser(request, env),
      catalogQuoteId,
    );
  }
  const catalogBuyId = entityId(pathname, 'catalog', 'buy');
  if (request.method === 'POST' && catalogBuyId) {
    await prepareMarketBrowse(env);
    return buyMarketCatalog(
      request,
      env,
      await authenticatedUser(request, env),
      catalogBuyId,
    );
  }

  const purchaseId = entityId(pathname, 'purchases');
  if (request.method === 'GET' && purchaseId) {
    return getMarketPurchase(env, await authenticatedUser(request, env), purchaseId);
  }

  const orderId = entityId(pathname, 'orders');
  if (request.method === 'GET' && orderId) {
    return getMarketBuyOrder(env, await authenticatedUser(request, env), orderId);
  }
  const orderFillId = entityId(pathname, 'orders', 'fill');
  if (request.method === 'POST' && orderFillId) {
    return fillMarketBuyOrder(request, env, await authenticatedUser(request, env), orderFillId);
  }
  const orderCancelId = entityId(pathname, 'orders', 'cancel');
  if (request.method === 'POST' && orderCancelId) {
    return cancelMarketBuyOrder(env, await authenticatedUser(request, env), orderCancelId);
  }
  const orderDeliveryId = entityId(pathname, 'order-fills', 'delivered');
  if (request.method === 'POST' && orderDeliveryId) {
    return confirmMarketOrderFill(env, await authenticatedUser(request, env), orderDeliveryId);
  }

  const swapId = entityId(pathname, 'swaps');
  if (request.method === 'GET' && swapId) {
    return getMarketSwap(env, await authenticatedUser(request, env), swapId);
  }
  const swapAcceptId = entityId(pathname, 'swaps', 'accept');
  if (request.method === 'POST' && swapAcceptId) {
    return acceptMarketSwap(request, env, await authenticatedUser(request, env), swapAcceptId);
  }
  const swapCancelId = entityId(pathname, 'swaps', 'cancel');
  if (request.method === 'POST' && swapCancelId) {
    return cancelMarketSwap(env, await authenticatedUser(request, env), swapCancelId);
  }
  const swapTransferId = entityId(pathname, 'swap-transfers', 'confirmed');
  if (request.method === 'POST' && swapTransferId) {
    return confirmMarketSwapTransfer(env, await authenticatedUser(request, env), swapTransferId);
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
