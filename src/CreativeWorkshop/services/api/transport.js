import { getApiBase } from '../../config.js';
import { clearAuthRecord, getAuthRecord } from '../storage.js';

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
    return new WorkshopApiError(
      body.error || body.message || `请求失败（${response.status}）`,
      response.status,
      body.code,
    );
  } catch {
    return new WorkshopApiError(`请求失败（${response.status}）`, response.status);
  }
}

function isBinaryBody(body) {
  return (
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof URLSearchParams
  );
}

async function buildHeaders(init, authenticated) {
  const headers = new Headers(init.headers);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !isBinaryBody(init.body) &&
    !headers.has('Content-Type')
  ) {
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
  return headers;
}

export async function requestRaw(path, init = {}, authenticated = false) {
  const headers = await buildHeaders(init, authenticated);
  const response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401) await clearAuthRecord();
    throw await readError(response);
  }
  return response;
}

export async function request(path, init = {}, authenticated = false) {
  const response = await requestRaw(path, init, authenticated);
  if (response.status === 204) return undefined;
  return response.json();
}
