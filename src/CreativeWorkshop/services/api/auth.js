import { getApiBase, resolveHostWindow } from '../../config.js';
import { clearAuthRecord, getAuthRecord, putAuthRecord } from '../storage.js';
import { WorkshopApiError } from './transport.js';

function createLoginId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

export function httpOpenerOrigin(host) {
  const raw = String(host?.location?.origin || '').trim();
  if (!raw || raw === 'null') return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
}

export function createDiscordLoginRequest({
  base = getApiBase(),
  host = resolveHostWindow(),
  loginId = createLoginId(),
} = {}) {
  const url = new URL('/api/auth/discord/start', base);
  url.searchParams.set('login_id', loginId);

  // TT / native WebView may run under file:// or another non-HTTP origin.
  // OAuth polling does not require opener_origin, so only send it when postMessage is actually usable.
  const openerOrigin = httpOpenerOrigin(host);
  if (openerOrigin) url.searchParams.set('opener_origin', openerOrigin);

  return {
    loginId,
    url: url.toString(),
    openerOrigin,
    expectedOrigin: new URL(base).origin,
  };
}

export function createAuthApi(request) {
  const getStoredAuth = async () => {
    const auth = await getAuthRecord();
    if (!auth) return null;
    if (auth.expiresAt <= Math.floor(Date.now() / 1000)) {
      await clearAuthRecord();
      return null;
    }
    return auth;
  };

  const me = () => request('/api/auth/me', {}, true);

  const waitForExchange = (popup, expectedOrigin, loginId, signal) => {
    const host = resolveHostWindow();
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let settled = false;
      let polling = false;
      let closedAt = null;
      let timer;

      const finish = callback => {
        if (settled) return;
        settled = true;
        host.clearInterval(timer);
        host.removeEventListener?.('message', onMessage);
        signal?.removeEventListener?.('abort', onAbort);
        callback();
      };

      const onAbort = () => {
        finish(() => reject(new WorkshopApiError(
          'Discord 登录已取消',
          499,
          'login_cancelled',
        )));
      };

      const exchange = async () => {
        if (settled || polling) return;
        polling = true;
        try {
          const result = await request('/api/auth/exchange', {
            method: 'POST',
            body: JSON.stringify({ login_id: loginId }),
          });
          finish(() => resolve(result));
        } catch (error) {
          if (!(error instanceof WorkshopApiError) || ![404, 409, 429].includes(error.status)) {
            if (error instanceof WorkshopApiError && error.status >= 500) {
              console.warn('[轮回战场创意工坊] 登录交换暂时失败，将继续重试:', error);
            } else {
              finish(() => reject(error));
            }
          }
        } finally {
          polling = false;
        }
      };

      const onMessage = event => {
        if (!expectedOrigin || event.origin !== expectedOrigin) return;
        if (event.data?.type !== 'reincarnation-workshop-oauth') return;
        if (event.data?.loginId !== loginId) return;
        void exchange();
      };

      const tick = () => {
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          finish(() => reject(new WorkshopApiError('Discord 登录等待超时，请重新登录', 408, 'login_timeout')));
          return;
        }

        // Native clients can authorize in the system browser and have no usable popup handle.
        // Only apply popup-close cancellation when a real popup object exists.
        if (popup) {
          try {
            if (popup.closed) {
              closedAt ??= Date.now();
              if (Date.now() - closedAt > 12_000) {
                finish(() => reject(new WorkshopApiError('Discord 登录窗口已关闭', 499, 'login_cancelled')));
                return;
              }
            } else {
              closedAt = null;
            }
          } catch {}
        }

        void exchange();
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }

      host.addEventListener?.('message', onMessage);
      signal?.addEventListener?.('abort', onAbort, { once: true });
      timer = host.setInterval(tick, 1000);
      tick();
    });
  };

  const storeExchange = async exchange => {
    const current = await request(
      '/api/auth/me',
      { headers: { Authorization: `Bearer ${exchange.token}` } },
      false,
    );
    const auth = {
      key: 'session',
      token: exchange.token,
      expiresAt: exchange.expires_at,
      user: current.user,
    };
    await putAuthRecord(auth);
    return auth;
  };

  const beginLogin = () => createDiscordLoginRequest();

  const waitForLogin = async (pending, { popup = null, signal } = {}) => {
    if (!pending?.loginId || !pending?.expectedOrigin) {
      throw new WorkshopApiError('Discord 登录请求无效，请重新登录', 0, 'login_request_invalid');
    }
    const exchange = await waitForExchange(
      popup,
      pending.expectedOrigin,
      pending.loginId,
      signal,
    );
    return storeExchange(exchange);
  };

  const login = async () => {
    const pending = beginLogin();
    const host = resolveHostWindow();
    const popup = host.open?.(
      pending.url,
      'reincarnation-workshop-oauth',
      'popup,width=560,height=760',
    );
    if (!popup) {
      const error = new WorkshopApiError(
        '当前客户端无法直接打开 Discord 登录窗口，请使用兼容登录界面的“打开授权页”或“复制授权链接”',
        0,
        'popup_blocked',
      );
      error.login = pending;
      throw error;
    }
    return waitForLogin(pending, { popup });
  };

  const logout = async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' }, true);
    } finally {
      await clearAuthRecord();
    }
  };

  return { getStoredAuth, me, beginLogin, waitForLogin, login, logout };
}
