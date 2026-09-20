import { json } from '../http.js';

const WORKSHOP_REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const WORKSHOP_ENTRY_PATH = '/src/CreativeWorkshop/index.js';
const CACHE_KEY = 'public:workshop-client-main';
const CACHE_TTL_SECONDS = 300;

async function fetchLatestClient(env) {
  const cached = await env.SESSION_KV?.get?.(CACHE_KEY, 'json');
  if (cached?.sha && /^[0-9a-f]{40}$/iu.test(String(cached.sha))) {
    return { ...cached, cached: true };
  }

  const response = await fetch(
    `https://api.github.com/repos/${WORKSHOP_REPOSITORY}/commits/main`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'reincarnation-workshop-worker',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub latest commit request failed: ${response.status}`);
  }
  const payload = await response.json();
  const sha = String(payload?.sha || '').trim();
  if (!/^[0-9a-f]{40}$/iu.test(sha)) throw new Error('GitHub returned invalid commit sha');

  const result = {
    sha,
    short_sha: sha.slice(0, 8),
    repository: WORKSHOP_REPOSITORY,
    entry_path: WORKSHOP_ENTRY_PATH,
    checked_at: Math.floor(Date.now() / 1000),
  };
  await env.SESSION_KV?.put?.(CACHE_KEY, JSON.stringify(result), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return { ...result, cached: false };
}

export async function routeSystem(request, env, pathname, serviceVersion) {
  if (request.method === 'GET' && pathname === '/') {
    return json({ service: 'reincarnation-workshop', version: serviceVersion, status: 'ok' });
  }
  if (request.method === 'GET' && pathname === '/api/health') {
    return json({ ok: true, service: 'reincarnation-workshop', version: serviceVersion });
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
