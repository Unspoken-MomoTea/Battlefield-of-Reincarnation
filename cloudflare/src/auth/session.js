import { HttpError, json, readJson } from '../http.js';
import { parseBearerToken, positiveInt, randomToken, sha256Hex } from '../security.js';
import { getUserById } from './users.js';

export async function exchangeLogin(request, env) {
  const body = await readJson(request);
  const loginId = body?.login_id || '';
  if (!/^[a-f0-9]{64}$/u.test(loginId)) throw new HttpError(400, 'invalid_login_id', 'login_id 无效');

  const resultKey = `login_result:${loginId}`;
  const resultRaw = await env.SESSION_KV.get(resultKey);
  if (!resultRaw) throw new HttpError(409, 'login_pending', 'Discord 登录尚未完成');

  await env.SESSION_KV.delete(resultKey);
  const result = JSON.parse(resultRaw);
  if (!result?.userId) throw new HttpError(500, 'login_result_invalid', '登录结果无效');

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const ttl = positiveInt(env.SESSION_TTL_SECONDS, 30 * 24 * 60 * 60);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  await env.SESSION_KV.put(
    `session:${tokenHash}`,
    JSON.stringify({ userId: result.userId, expiresAt }),
    { expirationTtl: ttl },
  );
  return json({ token, expires_at: expiresAt });
}

export async function requireUser(request, env) {
  const token = parseBearerToken(request);
  const tokenHash = await sha256Hex(token);
  const key = `session:${tokenHash}`;
  const sessionRaw = await env.SESSION_KV.get(key);
  if (!sessionRaw) throw new HttpError(401, 'unauthorized', '登录状态已失效');

  const session = JSON.parse(sessionRaw);
  if (!session?.userId || session.expiresAt <= Math.floor(Date.now() / 1000)) {
    await env.SESSION_KV.delete(key);
    throw new HttpError(401, 'session_expired', '登录状态已过期');
  }

  const user = await getUserById(env, session.userId);
  if (!user) throw new HttpError(401, 'user_not_found', '登录用户不存在');
  return { user, tokenHash };
}

export async function getMe(request, env) {
  const { user } = await requireUser(request, env);
  return json({ user });
}

export async function logout(request, env) {
  const token = parseBearerToken(request);
  const tokenHash = await sha256Hex(token);
  await env.SESSION_KV.delete(`session:${tokenHash}`);
  return new Response(null, { status: 204 });
}
