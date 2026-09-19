export function projectIdFrom(pathname, suffix = '') {
  const escapedSuffix = suffix.replace(/[.*+?^$()|[\]\\]/gu, '\\$&');
  const match = new RegExp('^/api/projects/([^/]+)' + escapedSuffix + '$', 'u').exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

export function adminEntityIdFrom(pathname, entity, suffix = '') {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'admin' || parts[2] !== entity || !parts[3]) return null;
  if (suffix) {
    if (parts.length !== 5 || parts[4] !== suffix) return null;
  } else if (parts.length !== 4) {
    return null;
  }
  return decodeURIComponent(parts[3]);
}

export function adminProjectIdFrom(pathname, suffix) {
  return adminEntityIdFrom(pathname, 'projects', suffix);
}
