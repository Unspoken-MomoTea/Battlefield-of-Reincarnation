import { HttpError, json, withCors } from './http.js';
import { guardRequest } from './middleware/request-guard.js';
import { routeRequest } from './router.js';

export const SERVICE_VERSION = '0.11.0';

export async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }), request);
  }

  try {
    guardRequest(request);
    return withCors(await routeRequest(request, env, SERVICE_VERSION), request);
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
