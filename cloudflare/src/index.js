import {
  exchangeLogin,
  finishDiscordLogin,
  getMe,
  logout,
  requireUser,
  startDiscordLogin,
} from './auth.js';
import { HttpError, json, withCors } from './http.js';
import {
  createProject,
  downloadPublicProject,
  getPublicProject,
  getPublicProjectVersion,
  getPendingProjectReview,
  listAdminProjects,
  listOwnProjects,
  listPendingProjects,
  listPublicProjects,
  reviewProject,
  submitProjectForReview,
  updateProject,
  uploadProjectVersion,
} from './projects.js';

export const SERVICE_VERSION = '0.4.0';

function projectIdFrom(pathname, suffix = '') {
  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(`^/api/projects/([^/]+)${escapedSuffix}$`, 'u').exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

function adminProjectIdFrom(pathname) {
  const match = /^\/api\/admin\/projects\/([^/]+)\/review$/u.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

async function authenticatedUser(request, env) {
  return (await requireUser(request, env)).user;
}

export async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }), request);
  }

  try {
    const url = new URL(request.url);
    const { pathname } = url;
    let response;

    if (request.method === 'GET' && pathname === '/') {
      response = json({ service: 'reincarnation-workshop', version: SERVICE_VERSION, status: 'ok' });
    } else if (request.method === 'GET' && pathname === '/api/health') {
      response = json({ ok: true, service: 'reincarnation-workshop', version: SERVICE_VERSION });
    } else if (request.method === 'GET' && pathname === '/api/auth/discord/start') {
      response = await startDiscordLogin(request, env);
    } else if (request.method === 'GET' && pathname === '/api/auth/discord/callback') {
      response = await finishDiscordLogin(request, env);
    } else if (request.method === 'POST' && pathname === '/api/auth/exchange') {
      response = await exchangeLogin(request, env);
    } else if (request.method === 'GET' && pathname === '/api/auth/me') {
      response = await getMe(request, env);
    } else if (request.method === 'POST' && pathname === '/api/auth/logout') {
      response = await logout(request, env);
    } else if (request.method === 'GET' && pathname === '/api/projects') {
      response = await listPublicProjects(request, env);
    } else if (request.method === 'POST' && pathname === '/api/projects') {
      response = await createProject(request, env, await authenticatedUser(request, env));
    } else if (request.method === 'GET' && pathname === '/api/my/projects') {
      response = await listOwnProjects(env, await authenticatedUser(request, env));
    } else if (request.method === 'GET' && pathname === '/api/admin/projects') {
      response = await listAdminProjects(request, env, await authenticatedUser(request, env));
    } else if (request.method === 'GET' && pathname === '/api/admin/pending') {
      response = await listPendingProjects(env, await authenticatedUser(request, env));
    } else {
      const versionProjectId = projectIdFrom(pathname, '/version');
      const downloadProjectId = projectIdFrom(pathname, '/download');
      const versionsProjectId = projectIdFrom(pathname, '/versions');
      const submitProjectId = projectIdFrom(pathname, '/submit');
      const reviewProjectId = adminProjectIdFrom(pathname);
      const plainProjectId = projectIdFrom(pathname);

      if (request.method === 'GET' && versionProjectId) {
        response = await getPublicProjectVersion(versionProjectId, env);
      } else if (request.method === 'GET' && downloadProjectId) {
        response = await downloadPublicProject(downloadProjectId, env);
      } else if (request.method === 'POST' && versionsProjectId) {
        response = await uploadProjectVersion(request, env, await authenticatedUser(request, env), versionsProjectId);
      } else if (request.method === 'POST' && submitProjectId) {
        response = await submitProjectForReview(env, await authenticatedUser(request, env), submitProjectId);
      } else if (request.method === 'GET' && reviewProjectId) {
        response = await getPendingProjectReview(env, await authenticatedUser(request, env), reviewProjectId);
      } else if (request.method === 'POST' && reviewProjectId) {
        response = await reviewProject(request, env, await authenticatedUser(request, env), reviewProjectId);
      } else if (request.method === 'GET' && plainProjectId) {
        response = await getPublicProject(plainProjectId, env);
      } else if (request.method === 'PATCH' && plainProjectId) {
        response = await updateProject(request, env, await authenticatedUser(request, env), plainProjectId);
      } else {
        response = json({ error: 'not_found', code: 'not_found' }, 404);
      }
    }

    return withCors(response, request);
  } catch (error) {
    if (error instanceof HttpError) {
      return withCors(json({ error: error.message, code: error.code }, error.status), request);
    }
    console.error('[workshop] unhandled error:', error);
    return withCors(json({ error: '服务器内部错误', code: 'internal_error' }, 500), request);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
