import { json } from '../http.js';

const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const CACHE_TTL_SECONDS = 300;
const COMPONENTS = Object.freeze({
  workshop: {
    id: 'workshop',
    entryPath: '/src/CreativeWorkshop/index.js',
    sourcePath: 'src/CreativeWorkshop',
    tagPrefix: 'workshop-v',
    legacyStableRef: 'workshop-stable',
  },
  'world-engine': {
    id: 'world-engine',
    entryPath: '/script/世界推进系统.js',
    sourcePath: 'script/世界推进系统.js',
    tagPrefix: 'world-engine-v',
    legacyStableRef: '',
  },
});

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

function validSha(value) {
  return /^[0-9a-f]{40}$/iu.test(String(value || '').trim());
}

function parseVersion(tag, prefix) {
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(new RegExp(`^${escaped}(\\d+)\\.(\\d+)\\.(\\d+)$`, 'u'));
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), version: `${match[1]}.${match[2]}.${match[3]}` };
}

function compareVersion(left, right) {
  return (left.major - right.major) || (left.minor - right.minor) || (left.patch - right.patch);
}

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'reincarnation-workshop-worker',
    },
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.json();
}

async function latestPathCommit(component, ref) {
  const query = new URLSearchParams({ sha: ref, path: component.sourcePath, per_page: '1' });
  const payload = await githubJson(`https://api.github.com/repos/${REPOSITORY}/commits?${query}`);
  const sha = String(Array.isArray(payload) ? payload[0]?.sha : payload?.sha || '').trim();
  if (!validSha(sha)) throw new Error(`GitHub returned invalid ${component.id} commit for ${ref}`);
  return sha;
}

async function refHead(ref) {
  const payload = await githubJson(`https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(ref)}`);
  const sha = String(payload?.sha || '').trim();
  if (!validSha(sha)) throw new Error(`GitHub returned invalid ref head for ${ref}`);
  return sha;
}

async function latestTaggedRelease(component) {
  const rows = await githubJson(`https://api.github.com/repos/${REPOSITORY}/tags?per_page=100`);
  const candidates = (Array.isArray(rows) ? rows : [])
    .map(row => {
      const parsed = parseVersion(row?.name, component.tagPrefix);
      const sha = String(row?.commit?.sha || '').trim();
      return parsed && validSha(sha) ? { ...parsed, tag: String(row.name), sha } : null;
    })
    .filter(Boolean)
    .sort((a, b) => compareVersion(b, a));
  return candidates[0] || null;
}

function cacheKey(env, component) {
  return `public:core-component:v1:${component.id}:${updateChannel(env)}:${updateRef(env)}`;
}

async function fetchLatestComponent(env, componentId) {
  const component = COMPONENTS[componentId];
  if (!component) {
    const error = new Error(`unknown component: ${componentId}`);
    error.status = 404;
    error.code = 'component_not_found';
    throw error;
  }
  const channel = updateChannel(env);
  const ref = updateRef(env);
  const key = cacheKey(env, component);
  const cached = await env.SESSION_KV?.get?.(key, 'json');
  if (
    cached?.component === component.id &&
    validSha(cached?.sha) &&
    cached?.channel === channel &&
    cached?.ref === ref
  ) {
    return { ...cached, cached: true };
  }

  let sha = '';
  let version = '';
  let tag = '';
  let releaseSource = 'branch';
  if (channel === 'testing') {
    sha = await latestPathCommit(component, ref);
  } else {
    const tagged = await latestTaggedRelease(component);
    if (component.id === 'workshop') {
      const stableRef = component.legacyStableRef || ref;
      const stableHead = await refHead(stableRef);
      if (tagged && tagged.sha === stableHead) {
        sha = tagged.sha;
        version = tagged.version;
        tag = tagged.tag;
        releaseSource = 'tag';
      } else {
        sha = await latestPathCommit(component, stableRef);
        releaseSource = 'legacy-ref';
      }
    } else if (tagged) {
      sha = tagged.sha;
      version = tagged.version;
      tag = tagged.tag;
      releaseSource = 'tag';
    } else {
      const error = new Error(`No formal ${component.tagPrefix}X.Y.Z release exists yet`);
      error.status = 404;
      error.code = 'component_release_unavailable';
      throw error;
    }
  }

  const result = {
    component: component.id,
    channel,
    ref,
    sha,
    short_sha: sha.slice(0, 8),
    version,
    tag,
    release_source: releaseSource,
    repository: REPOSITORY,
    entry_path: component.entryPath,
    source_path: component.sourcePath,
    checked_at: Math.floor(Date.now() / 1000),
  };
  await env.SESSION_KV?.put?.(key, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS });
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
      return json(await fetchLatestComponent(env, 'workshop'));
    } catch (error) {
      return json({
        error: error.code || 'client_update_check_failed',
        code: error.code || 'client_update_check_failed',
        message: error instanceof Error ? error.message : String(error),
      }, error.status || 502);
    }
  }
  if (request.method === 'GET' && pathname === '/api/components/latest') {
    const component = new URL(request.url).searchParams.get('component') || '';
    try {
      return json(await fetchLatestComponent(env, component));
    } catch (error) {
      return json({
        error: error.code || 'component_update_check_failed',
        code: error.code || 'component_update_check_failed',
        message: error instanceof Error ? error.message : String(error),
      }, error.status || 502);
    }
  }
  return null;
}
