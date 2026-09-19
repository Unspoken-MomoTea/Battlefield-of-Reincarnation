import { json } from './http.js';
import { routeAdmin } from './routes/admin.js';
import { routeAuth } from './routes/auth.js';
import { routeProjects } from './routes/projects.js';
import { routeSystem } from './routes/system.js';

export async function routeRequest(request, env, serviceVersion) {
  const pathname = new URL(request.url).pathname;
  return (
    routeSystem(request, pathname, serviceVersion) ??
    (await routeAuth(request, env, pathname)) ??
    (await routeProjects(request, env, pathname)) ??
    (await routeAdmin(request, env, pathname)) ??
    json({ error: 'not_found', code: 'not_found' }, 404)
  );
}
