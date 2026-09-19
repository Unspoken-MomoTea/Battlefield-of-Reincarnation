import { getApiBase, resolveHostWindow } from '../config.js';
import { clearAuthRecord, getAuthRecord, putAuthRecord } from './storage.js';

export class WorkshopApiError extends Error {
  constructor(message, status = 0, code = 'request_failed') {
    super(message);
    this.name = 'WorkshopApiError';
    this.status = status;
    this.code = code;
  }
}

async function readError(response) {
  try {
    const body = await response.json();
    return new WorkshopApiError(body.error || body.message || `请求失败（${response.status}）`, response.status, body.code);
  } catch {
    return new WorkshopApiError(`请求失败（${response.status}）`, response.status);
  }
}

function createLoginId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

export class WorkshopApi {
  async request(path, init = {}, authenticated = false) {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (authenticated) {
      const auth = await getAuthRecord();
      if (!auth || auth.expiresAt <= Math.floor(Date.now() / 1000)) {
        await clearAuthRecord();
        throw new WorkshopApiError('登录状态已失效，请重新登录 Discord', 401, 'session_expired');
      }
      headers.set('Authorization', `Bearer ${auth.token}`);
    }

    const response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
    if (!response.ok) {
      if (response.status === 401) await clearAuthRecord();
      throw await readError(response);
    }
    if (response.status === 204) return undefined;
    return response.json();
  }

  async health() {
    return this.request('/api/health');
  }

  async me() {
    return this.request('/api/auth/me', {}, true);
  }

  async getStoredAuth() {
    const auth = await getAuthRecord();
    if (!auth) return null;
    if (auth.expiresAt <= Math.floor(Date.now() / 1000)) {
      await clearAuthRecord();
      return null;
    }
    return auth;
  }

  async login() {
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

    const exchange = await this.waitForExchange(popup, new URL(base).origin, loginId);
    const me = await this.request(
      '/api/auth/me',
      { headers: { Authorization: `Bearer ${exchange.token}` } },
      false,
    );
    const auth = {
      key: 'session',
      token: exchange.token,
      expiresAt: exchange.expires_at,
      user: me.user,
    };
    await putAuthRecord(auth);
    return auth;
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' }, true);
    } finally {
      await clearAuthRecord();
    }
  }

  waitForExchange(popup, expectedOrigin, loginId) {
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
          const result = await this.request('/api/auth/exchange', {
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
        } catch {
          // 跨域授权期间无法读取 popup 状态时，继续依赖登录交换轮询。
        }

        void exchange();
      };

      host.addEventListener('message', onMessage);
      const timer = host.setInterval(tick, 1000);
      tick();
    });
  }
}

export const workshopApi = new WorkshopApi();
