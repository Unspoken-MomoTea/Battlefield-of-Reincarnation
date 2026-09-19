import { json } from '../http.js';
import {
  getAdminProjectCover, getAdminProjectDiff, getPendingProjectReview,
  listAdminAuditLogs, listAdminProjects, listPendingProjects, reviewProject,
  setAdminProjectState,
} from '../projects.js';
import { authenticatedUser } from './context.js';
import { adminProjectIdFrom } from './match.js';

export async function routeAdmin(request, env, pathname) {
  if (request.method === 'GET' && pathname === '/api/admin/projects') {
    return listAdminProjects(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/admin/pending') {
    return listPendingProjects(env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/admin/logs') {
    return listAdminAuditLogs(request, env, await authenticatedUser(request, env));
  }

  const coverId = adminProjectIdFrom(pathname, 'cover');
  if (request.method === 'GET' && coverId) {
    return getAdminProjectCover(env, await authenticatedUser(request, env), coverId);
  }

  const diffId = adminProjectIdFrom(pathname, 'diff');
  if (request.method === 'GET' && diffId) {
    return json(await getAdminProjectDiff(env, await authenticatedUser(request, env), diffId));
  }

  const reviewId = adminProjectIdFrom(pathname, 'review');
  if (request.method === 'GET' && reviewId) {
    return getPendingProjectReview(env, await authenticatedUser(request, env), reviewId);
  }
  if (request.method === 'POST' && reviewId) {
    return reviewProject(request, env, await authenticatedUser(request, env), reviewId);
  }

  const stateId = adminProjectIdFrom(pathname, 'state');
  if (request.method === 'POST' && stateId) {
    return setAdminProjectState(request, env, await authenticatedUser(request, env), stateId);
  }
  return null;
}
