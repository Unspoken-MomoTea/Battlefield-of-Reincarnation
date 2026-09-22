import { json } from '../http.js';

const WORKSHOP_REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const WORKSHOP_ENTRY_PATH = '/src/CreativeWorkshop/index.js';
const CACHE_TTL_SECONDS = 300;

function updateChannel(env) {
  return String(env.CLIENT_UPDATE_CHANNEL || 'stable').trim().toLowerCase() === 'testing'
    ? 'testing'
    : 'stable';
}

function updateRef(env) {
  const configured = String(env.CLIENT_UPDATE_REF || '').trim();
  if (configured) return configured;
  return updateChannel(env) === 'testing' ? 'main' : 'workshop-stable';
}

function cacheKey(env) {
  return `public:workshop-client:${updateChannel(env)}:${updateRef(env)}`;
}

async function fetchLatestClient(env) {
  const channel = updateChannel(env);
  const ref = updateRef(env);
  const key = cacheKey(env);
  const cached = await env.SESSION_KV?.get?.(key, 'json');
  if (
    cached?.sha &&
    /^[0-9a-f]{40}$/iu.test(String(cached.sha)) &&
    String(cached.channel || '') === channel &&
    String(cached.ref || '') === ref
  ) {
    return { ...cached, cached: true };
  }

  const response = await fetch(
    `https://api.github.com/repos/${WORKSHOP_REPOSITORY}/commits/${encodeURIComponent(ref)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'reincarnation-workshop-worker',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub ${ref} commit request failed: ${response.status}`);
  }
  const payload = await response.json();
  const sha = String(payload?.sha || '').trim();
  if (!/^[0-9a-f]{40}$/iu.test(sha)) throw new Error(`GitHub returned invalid commit sha for ${ref}`);

  const result = {
    channel,
    ref,
    sha,
    short_sha: sha.slice(0, 8),
    repository: WORKSHOP_REPOSITORY,
    entry_path: WORKSHOP_ENTRY_PATH,
    checked_at: Math.floor(Date.now() / 1000),
  };
  await env.SESSION_KV?.put?.(key, JSON.stringify(result), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return { ...result, cached: false };
}

export async function routeSystem(request, env, pathname, serviceVersion) {
  if (request.method === 'GET' && pathname === '/') {
    return json({
      service: 'reincarnation-workshop',
      version: serviceVersion,
      status: 'ok',
      update_channel: updateChannel(env),
      update_ref: updateRef(env),
    });
  }
  if (request.method === 'GET' && pathname === '/api/health') {
    return json({
      ok: true,
      service: 'reincarnation-workshop',
      version: serviceVersion,
      update_channel: updateChannel(env),
      update_ref: updateRef(env),
    });
  }
  if (request.method === 'GET' && pathname === '/api/client/latest') {
    try {
      return json(await fetchLatestClient(env));
    } catch (error) {
      return json({
        error: 'client_update_check_failed',
        code: 'client_update_check_failed',
        message: error instanceof Error ? error.message : String(error),
      }, 502);
    }
  }
  return null;
}
