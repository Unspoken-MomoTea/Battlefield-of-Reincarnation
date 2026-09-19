import {
  exchangeLogin,
  finishDiscordLogin,
  getMe,
  logout,
  startDiscordLogin,
} from './auth.js';
import { HttpError, json, withCors } from './http.js';

export const SERVICE_VERSION = '0.1.0';

export async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }), request);
  }

  try {
    const url = new URL(request.url);
    let response;

    if (request.method === 'GET' && url.pathname === '/') {
      response = json({
        service: 'reincarnation-workshop',
        version: SERVICE_VERSION,
        status: 'ok',
      });
    } else if (request.method === 'GET' && url.pathname === '/api/health') {
      response = json({
        ok: true,
        service: 'reincarnation-workshop',
        version: SERVICE_VERSION,
      });
    } else if (request.method === 'GET' && url.pathname === '/api/auth/discord/start') {
      response = await startDiscordLogin(request, env);
    } else if (request.method === 'GET' && url.pathname === '/api/auth/discord/callback') {
      response = await finishDiscordLogin(request, env);
    } else if (request.method === 'POST' && url.pathname === '/api/auth/exchange') {
      response = await exchangeLogin(request, env);
    } else if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      response = await getMe(request, env);
    } else if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      response = await logout(request, env);
    } else {
      response = json({ error: 'not_found', code: 'not_found' }, 404);
    }

    return withCors(response, request);
  } catch (error) {
    if (error instanceof HttpError) {
      return withCors(json({ error: error.message, code: error.code }, error.status), request);
    }
    console.error('[workshop] unhandled error:', error);
    return withCors(json({ error: '服务器内部错误', code: 'internal_error' }, 500), request);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
