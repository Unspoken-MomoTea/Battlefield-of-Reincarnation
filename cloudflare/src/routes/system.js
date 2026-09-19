import { json } from '../http.js';

export function routeSystem(request, pathname, serviceVersion) {
  if (request.method === 'GET' && pathname === '/') {
    return json({ service: 'reincarnation-workshop', version: serviceVersion, status: 'ok' });
  }
  if (request.method === 'GET' && pathname === '/api/health') {
    return json({ ok: true, service: 'reincarnation-workshop', version: serviceVersion });
  }
  return null;
}
