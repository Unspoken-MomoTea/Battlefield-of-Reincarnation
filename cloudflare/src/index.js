import { HttpError, json, withCors } from './http.js';
import { guardRequest } from './middleware/request-guard.js';
import { routeRequest } from './router.js';
import { settleExpiredMarketListings } from './market.js';
import { settleExpiredMarketOrders } from './market-orders.js';
import { settleExpiredMarketDeals } from './market-deals.js';
import { cleanupCompletedMarketRecords } from './market-cleanup.js';

export const SERVICE_VERSION = '0.13.22';

export async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }), request);
  }

  try {
    guardRequest(request);
    return withCors(await routeRequest(request, env, SERVICE_VERSION), request);
  } catch (error) {
    if (error instanceof HttpError) {
      return withCors(json({
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      }, error.status), request);
    }
    console.error('[workshop] unhandled error:', error);
    return withCors(json({ error: '服务器内部错误', code: 'internal_error' }, 500), request);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
  scheduled(controller, env, ctx) {
    void controller;
    if (String(env.CLIENT_UPDATE_CHANNEL || '').trim().toLowerCase() !== 'testing') return;
    const task = (async () => {
      await Promise.all([
        settleExpiredMarketListings(env, { limit: 500 }),
        settleExpiredMarketOrders(env, { limit: 500 }),
        settleExpiredMarketDeals(env, { limit: 500 }),
      ]);
      return cleanupCompletedMarketRecords(env, { limit: 500 });
    })();
    if (ctx?.waitUntil) ctx.waitUntil(task);
    return task;
  },
};
