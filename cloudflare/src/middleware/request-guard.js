import { HttpError } from '../http.js';

export const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

export function guardRequest(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return;
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw new HttpError(413, 'request_too_large', '请求体超过 6 MB 限制');
  }
}
