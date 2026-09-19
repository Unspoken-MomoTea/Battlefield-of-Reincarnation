import { HttpError } from './http.js';

export function isValidLoginId(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

export function normalizeOpenerOrigin(value) {
  if (!value) throw new HttpError(400, 'invalid_opener_origin', '缺少 opener_origin');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, 'invalid_opener_origin', 'opener_origin 无效');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpError(400, 'invalid_opener_origin', 'opener_origin 仅支持 HTTP/HTTPS');
  }
  return url.origin;
}

export function parseBearerToken(request) {
  const authorization = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+([^\s]+)$/iu.exec(authorization);
  if (!match) throw new HttpError(401, 'unauthorized', '缺少有效登录凭证');
  return match[1];
}

export function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

export async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
