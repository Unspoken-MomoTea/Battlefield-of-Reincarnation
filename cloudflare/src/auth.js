import { HttpError, html, json, readJson } from './http.js';
import {
  isValidLoginId,
  normalizeOpenerOrigin,
  parseBearerToken,
  positiveInt,
  randomToken,
  sha256Hex,
} from './security.js';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_ME_URL = 'https://discord.com/api/users/@me';

function required(env, key) {
  const value = env[key];
  if (!value || String(value).startsWith('REPLACE_')) {
    throw new HttpError(503, 'server_not_configured', `服务器尚未配置 ${key}`);
  }
  return String(value);
}

function callbackUrl(env) {
  return new URL('/api/auth/discord/callback', required(env, 'PUBLIC_BASE_URL')).toString();
}

export async function startDiscordLogin(request, env) {
  const url = new URL(request.url);
  const loginId = url.searchParams.get('login_id') || '';
  if (!isValidLoginId(loginId)) {
    throw new HttpError(400, 'invalid_login_id', 'login_id 必须是 64 位十六进制随机值');
  }

  const openerOrigin = normalizeOpenerOrigin(url.searchParams.get('opener_origin'));
  const state = randomToken(24);
  await env.SESSION_KV.put(
    `oauth:${state}`,
    JSON.stringify({ loginId, openerOrigin, createdAt: Date.now() }),
    { expirationTtl: 600 },
  );

  const authorize = new URL(DISCORD_AUTHORIZE_URL);
  authorize.searchParams.set('client_id', required(env, 'DISCORD_CLIENT_ID'));
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', callbackUrl(env));
  authorize.searchParams.set('scope', 'identify');
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Cache-Control': 'no-store',
    },
  });
}

export async function finishDiscordLogin(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) throw new HttpError(400, 'oauth_callback_invalid', 'Discord 回调缺少 code 或 state');

  const stateKey = `oauth:${state}`;
  const pendingRaw = await env.SESSION_KV.get(stateKey);
  if (!pendingRaw) throw new HttpError(400, 'oauth_state_expired', '登录请求已过期，请重新登录');
  await env.SESSION_KV.delete(stateKey);

  const pending = JSON.parse(pendingRaw);
  if (!isValidLoginId(pending.loginId)) {
    throw new HttpError(400, 'oauth_state_invalid', '登录请求状态无效');
  }

  const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required(env, 'DISCORD_CLIENT_ID'),
      client_secret: required(env, 'DISCORD_CLIENT_SECRET'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(env),
    }),
  });
  if (!tokenResponse.ok) {
    console.error('[workshop] Discord token exchange failed:', tokenResponse.status);
    throw new HttpError(502, 'discord_token_failed', 'Discord 授权交换失败');
  }
  const discordToken = await tokenResponse.json();

  const userResponse = await fetch(DISCORD_ME_URL, {
    headers: { Authorization: `Bearer ${discordToken.access_token}` },
  });
  if (!userResponse.ok) {
    console.error('[workshop] Discord user request failed:', userResponse.status);
    throw new HttpError(502, 'discord_user_failed', '无法读取 Discord 用户信息');
  }
  const discordUser = await userResponse.json();
  const now = Math.floor(Date.now() / 1000);
  const displayName = discordUser.global_name || discordUser.username;
  const adminIds = new Set(
    String(env.ADMIN_DISCORD_IDS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  );
  const isAdmin = adminIds.has(String(discordUser.id)) ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO users (discord_id, username, display_name, avatar, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(discord_id) DO UPDATE SET
       username = excluded.username,
       display_name = excluded.display_name,
       avatar = excluded.avatar,
       is_admin = excluded.is_admin,
       updated_at = excluded.updated_at`,
  )
    .bind(
      String(discordUser.id),
      String(discordUser.username),
      String(displayName),
      discordUser.avatar ? String(discordUser.avatar) : null,
      isAdmin,
      now,
      now,
    )
    .run();

  const user = await env.DB.prepare(
    'SELECT id, discord_id, username, display_name, avatar, is_admin, created_at, updated_at FROM users WHERE discord_id = ?',
  )
    .bind(String(discordUser.id))
    .first();
  if (!user) throw new HttpError(500, 'user_upsert_failed', '用户资料保存失败');

  await env.SESSION_KV.put(
    `login_result:${pending.loginId}`,
    JSON.stringify({ userId: user.id, createdAt: Date.now() }),
    { expirationTtl: 120 },
  );

  const targetOrigin = normalizeOpenerOrigin(pending.openerOrigin);
  const loginIdJson = JSON.stringify(pending.loginId);
  const originJson = JSON.stringify(targetOrigin);
  return html(`<!doctype html>
<meta charset="utf-8">
<title>轮回战场创意工坊</title>
<style>body{font-family:system-ui;background:#151218;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center;padding:24px}</style>
<main><h2>Discord 登录成功</h2><p>正在返回创意工坊，此窗口会自动关闭。</p></main>
<script>
try {
  if (window.opener) window.opener.postMessage({type:'reincarnation-workshop-oauth',loginId:${loginIdJson}}, ${originJson});
} finally {
  setTimeout(() => window.close(), 250);
}
</script>`);
}

export async function exchangeLogin(request, env) {
  const body = await readJson(request);
  const loginId = body?.login_id || '';
  if (!isValidLoginId(loginId)) {
    throw new HttpError(400, 'invalid_login_id', 'login_id 无效');
  }

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
  const sessionRaw = await env.SESSION_KV.get(`session:${tokenHash}`);
  if (!sessionRaw) throw new HttpError(401, 'unauthorized', '登录状态已失效');

  const session = JSON.parse(sessionRaw);
  if (!session?.userId || session.expiresAt <= Math.floor(Date.now() / 1000)) {
    await env.SESSION_KV.delete(`session:${tokenHash}`);
    throw new HttpError(401, 'session_expired', '登录状态已过期');
  }

  const user = await env.DB.prepare(
    'SELECT id, discord_id, username, display_name, avatar, is_admin, created_at, updated_at FROM users WHERE id = ?',
  )
    .bind(session.userId)
    .first();
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
