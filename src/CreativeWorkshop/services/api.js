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

    if (authenticated && !headers.has('Authorization')) {
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

  health() {
    return this.request('/api/health');
  }

  me() {
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

  listProjects(query = '', category = '', offset = 0) {
    const params = new URLSearchParams({ limit: '24', offset: String(offset) });
    if (query.trim()) params.set('query', query.trim());
    if (category) params.set('category', category);
    return this.request(`/api/projects?${params}`);
  }

  getProject(projectId) {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}`);
  }

  getProjectVersion(projectId) {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/version`);
  }

  downloadProject(projectId) {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/download`);
  }

  listOwnProjects() {
    return this.request('/api/my/projects', {}, true);
  }

  createProject(input) {
    return this.request('/api/projects', { method: 'POST', body: JSON.stringify(input) }, true);
  }

  updateProject(projectId, input) {
    return this.request(
      `/api/projects/${encodeURIComponent(projectId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
      true,
    );
  }

  uploadProjectVersion(projectId, input) {
    return this.request(
      `/api/projects/${encodeURIComponent(projectId)}/versions`,
      { method: 'POST', body: JSON.stringify(input) },
      true,
    );
  }

  submitProject(projectId) {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/submit`, { method: 'POST' }, true);
  }

  listAdminProjects({ query = '', category = '', reviewStatus = '', offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: '48', offset: String(offset) });
    if (query.trim()) params.set('query', query.trim());
    if (category) params.set('category', category);
    if (reviewStatus) params.set('review_status', reviewStatus);
    return this.request(`/api/admin/projects?${params}`, {}, true);
  }

  listPendingProjects() {
    return this.request('/api/admin/pending', {}, true);
  }

  getPendingReview(projectId) {
    return this.request(`/api/admin/projects/${encodeURIComponent(projectId)}/review`, {}, true);
  }

  reviewProject(projectId, decision, note = '') {
    return this.request(
      `/api/admin/projects/${encodeURIComponent(projectId)}/review`,
      { method: 'POST', body: JSON.stringify({ decision, note }) },
      true,
    );
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
        } catch {}
        void exchange();
      };

      host.addEventListener('message', onMessage);
      const timer = host.setInterval(tick, 1000);
      tick();
    });
  }
}

export const workshopApi = new WorkshopApi();
