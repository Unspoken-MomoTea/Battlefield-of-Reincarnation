import { createProjectReport } from '../moderation/reports.js';
import {
  getProjectEngagementResponse, setProjectEngagementFromRequest,
} from '../engagement.js';
import {
  createProject, deleteProject, downloadPublicProject, getOwnedProjectCover, getOwnedProjectEditor,
  getPublicCatalog,
  getPublicProject, getPublicProjectCover, getPublicProjectVersion, getPublicProjectVersionsBatch,
  listOwnProjects, listPublicProjects, setOwnerProjectVisibility, submitProjectForReview,
  updateProject, uploadProjectCover, uploadProjectVersion,
} from '../projects.js';
import { authenticatedUser } from './context.js';
import { projectIdFrom } from './match.js';

export async function routeProjects(request, env, pathname) {
  if (request.method === 'GET' && pathname === '/api/projects') {
    return listPublicProjects(request, env);
  }
  if (request.method === 'GET' && pathname === '/api/projects/catalog') {
    return getPublicCatalog(env);
  }
  if (request.method === 'POST' && pathname === '/api/projects') {
    return createProject(request, env, await authenticatedUser(request, env));
  }
  if (request.method === 'GET' && pathname === '/api/my/projects') {
    return listOwnProjects(env, await authenticatedUser(request, env));
  }
  if (request.method === 'POST' && pathname === '/api/projects/versions/batch') {
    return getPublicProjectVersionsBatch(request, env);
  }

  const editId = projectIdFrom(pathname, '/edit');
  if (request.method === 'GET' && editId) {
    return getOwnedProjectEditor(env, await authenticatedUser(request, env), editId);
  }

  const editCoverId = projectIdFrom(pathname, '/edit-cover');
  if (request.method === 'GET' && editCoverId) {
    return getOwnedProjectCover(env, await authenticatedUser(request, env), editCoverId);
  }

  const visibilityId = projectIdFrom(pathname, '/visibility');
  if (request.method === 'POST' && visibilityId) {
    return setOwnerProjectVisibility(request, env, await authenticatedUser(request, env), visibilityId);
  }

  const versionId = projectIdFrom(pathname, '/version');
  if (request.method === 'GET' && versionId) return getPublicProjectVersion(versionId, env);

  const downloadId = projectIdFrom(pathname, '/download');
  if (request.method === 'GET' && downloadId) {
    const requestedVersion = new URL(request.url).searchParams.get('version');
    return downloadPublicProject(downloadId, env, requestedVersion);
  }

  const coverId = projectIdFrom(pathname, '/cover');
  if (request.method === 'GET' && coverId) return getPublicProjectCover(env, coverId);
  if (request.method === 'PUT' && coverId) {
    return uploadProjectCover(request, env, await authenticatedUser(request, env), coverId);
  }

  const versionsId = projectIdFrom(pathname, '/versions');
  if (request.method === 'POST' && versionsId) {
    return uploadProjectVersion(request, env, await authenticatedUser(request, env), versionsId);
  }

  const submitId = projectIdFrom(pathname, '/submit');
  if (request.method === 'POST' && submitId) {
    let body = {};
    try { body = await request.clone().json(); } catch {}
    return submitProjectForReview(
      env,
      await authenticatedUser(request, env),
      submitId,
      { localBackupConfirmed: Boolean(body?.local_backup_confirmed) },
    );
  }

  const reportId = projectIdFrom(pathname, '/report');
  if (request.method === 'POST' && reportId) {
    return createProjectReport(request, env, await authenticatedUser(request, env), reportId);
  }

  const engagementId = projectIdFrom(pathname, '/engagement');
  if (request.method === 'GET' && engagementId) {
    return getProjectEngagementResponse(env, await authenticatedUser(request, env), engagementId);
  }
  if (request.method === 'POST' && engagementId) {
    return setProjectEngagementFromRequest(request, env, await authenticatedUser(request, env), engagementId);
  }

  const projectId = projectIdFrom(pathname);
  if (request.method === 'GET' && projectId) return getPublicProject(projectId, env);
  if (request.method === 'PATCH' && projectId) {
    return updateProject(request, env, await authenticatedUser(request, env), projectId);
  }
  if (request.method === 'DELETE' && projectId) {
    return deleteProject(env, await authenticatedUser(request, env), projectId);
  }
  return null;
}
