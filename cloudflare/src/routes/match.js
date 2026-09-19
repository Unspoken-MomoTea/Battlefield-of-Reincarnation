export function projectIdFrom(pathname, suffix = '') {
  const escapedSuffix = suffix.replace(/[.*+?^$()|[\]\\]/gu, '\\$&');
  const match = new RegExp('^/api/projects/([^/]+)' + escapedSuffix + '$', 'u').exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

export function adminProjectIdFrom(pathname, suffix) {
  const match = /^\/api\/admin\/projects\/([^/]+)\/([^/]+)$/u.exec(pathname);
  if (!match || match[2] !== suffix) return null;
  return decodeURIComponent(match[1]);
}
