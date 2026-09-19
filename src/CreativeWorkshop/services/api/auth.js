import { getApiBase, resolveHostWindow } from '../../config.js';
import { clearAuthRecord, getAuthRecord, putAuthRecord } from '../storage.js';
import { WorkshopApiError } from './transport.js';

function createLoginId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
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

  const waitForExchange = (popup, expectedOrigin, loginId) => {
    const host = resolveHostWindow();
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let settled = false;
      let polling = false;
      let closedAt = null;

      const finish = callback => {
        if (settled) return;
        settled = true;
        host.clearInterval(timer);
        host.removeEventListener('message', onMessage);
        callback();
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
        if (event.origin !== expectedOrigin) return;
        if (event.data?.type !== 'reincarnation-workshop-oauth') return;
        if (event.data?.loginId !== loginId) return;
        void exchange();
      };

      const tick = () => {
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          finish(() => reject(new WorkshopApiError('Discord 登录等待超时，请重新登录', 408, 'login_timeout')));
          return;
        }
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
        void exchange();
      };

      host.addEventListener('message', onMessage);
      const timer = host.setInterval(tick, 1000);
      tick();
    });
  };

  const login = async () => {
    const base = getApiBase();
    const host = resolveHostWindow();
    const loginId = createLoginId();
    const openerOrigin = host.location.origin;
    const url = new URL('/api/auth/discord/start', base);
    url.searchParams.set('login_id', loginId);
    url.searchParams.set('opener_origin', openerOrigin);

    const popup = host.open(url.toString(), 'reincarnation-workshop-oauth', 'popup,width=560,height=760');
    if (!popup) {
      throw new WorkshopApiError('浏览器阻止了 Discord 登录弹窗，请允许弹窗后重试', 0, 'popup_blocked');
    }

    const exchange = await waitForExchange(popup, new URL(base).origin, loginId);
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

  const logout = async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' }, true);
    } finally {
      await clearAuthRecord();
    }
  };

  return { getStoredAuth, me, login, logout };
}
