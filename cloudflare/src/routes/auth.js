import {
  exchangeLogin, finishDiscordLogin, getMe, logout, startDiscordLogin,
} from '../auth.js';

export async function routeAuth(request, env, pathname) {
  if (request.method === 'GET' && pathname === '/api/auth/discord/start') {
    return startDiscordLogin(request, env);
  }
  if (request.method === 'GET' && pathname === '/api/auth/discord/callback') {
    return finishDiscordLogin(request, env);
  }
  if (request.method === 'POST' && pathname === '/api/auth/exchange') {
    return exchangeLogin(request, env);
  }
  if (request.method === 'GET' && pathname === '/api/auth/me') {
    return getMe(request, env);
  }
  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    return logout(request, env);
  }
  return null;
}
