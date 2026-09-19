import { HttpError, html } from '../http.js';
import { isValidLoginId, normalizeOpenerOrigin, randomToken } from '../security.js';
import { discordCallbackUrl, required } from './config.js';
import { upsertDiscordUser } from './users.js';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_ME_URL = 'https://discord.com/api/users/@me';

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
  authorize.searchParams.set('redirect_uri', discordCallbackUrl(env));
  authorize.searchParams.set('scope', 'identify');
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), 'Cache-Control': 'no-store' },
  });
}

async function fetchDiscordUser(env, code) {
  const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required(env, 'DISCORD_CLIENT_ID'),
      client_secret: required(env, 'DISCORD_CLIENT_SECRET'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: discordCallbackUrl(env),
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
  return userResponse.json();
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
  if (!isValidLoginId(pending.loginId)) throw new HttpError(400, 'oauth_state_invalid', '登录请求状态无效');

  const user = await upsertDiscordUser(env, await fetchDiscordUser(env, code));
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
