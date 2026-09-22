import { json } from '../http.js';
import { listAdminReports, resolveProjectReport } from '../moderation/reports.js';
import { listAdminUsers, setUserBan, setUserModerator } from '../moderation/users.js';
import {
  deleteAdminProject, getAdminProjectCover, getAdminProjectDiff, getPendingProjectReview,
  listAdminAuditLogs, listAdminProjectUpdates, listAdminProjects, reviewProject,
  setAdminProjectState,
} from '../projects.js';
import { authenticatedUser } from './context.js';
import { adminEntityIdFrom, adminProjectIdFrom } from './match.js';

export async function routeAdmin(request, env, pathname) {
  if (request.method === 'GET' && pathname === '/api/admin/projects') {
    return listAdminProjects(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/admin/updates') {
    return listAdminProjectUpdates(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/admin/logs') {
    return listAdminAuditLogs(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/admin/users') {
    return listAdminUsers(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/admin/reports') {
    return listAdminReports(request, env, await authenticatedUser(request, env));
  }

  const userRoleId = adminEntityIdFrom(pathname, 'users', 'role');
  if (request.method === 'POST' && userRoleId) {
    return setUserModerator(request, env, await authenticatedUser(request, env), userRoleId);
  }

  const userStateId = adminEntityIdFrom(pathname, 'users', 'state');
  if (request.method === 'POST' && userStateId) {
    return setUserBan(request, env, await authenticatedUser(request, env), userStateId);
  }

  const reportId = adminEntityIdFrom(pathname, 'reports');
  if (request.method === 'POST' && reportId) {
    return resolveProjectReport(request, env, await authenticatedUser(request, env), reportId);
  }

  const deleteId = adminProjectIdFrom(pathname);
  if (request.method === 'DELETE' && deleteId) {
    return deleteAdminProject(env, await authenticatedUser(request, env), deleteId);
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
