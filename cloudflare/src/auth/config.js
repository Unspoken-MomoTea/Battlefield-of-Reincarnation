import { HttpError } from '../http.js';

export function required(env, key) {
  const value = env[key];
  if (!value || String(value).startsWith('REPLACE_')) {
    throw new HttpError(503, 'server_not_configured', `服务器尚未配置 ${key}`);
  }
  return String(value);
}

export function discordCallbackUrl(env) {
  return new URL('/api/auth/discord/callback', required(env, 'PUBLIC_BASE_URL')).toString();
}
