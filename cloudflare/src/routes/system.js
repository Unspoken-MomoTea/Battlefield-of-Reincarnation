import { json } from '../http.js';
import {
  OPENING_COMPONENT,
  getOpeningUpdateChannel,
  getOpeningUpdateRef,
  openingCdnUrl,
} from '../../../src/opening/hot-update/component.js';

const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const CACHE_TTL_SECONDS = 300;
const COMPONENTS = Object.freeze({
  workshop: {
    id: 'workshop',
    entryPath: '/src/CreativeWorkshop/index.js',
    sourcePath: 'src/CreativeWorkshop',
    tagPrefixes: ['workshop-v', 'V'],
    legacyStableRef: 'workshop-stable',
  },
  'world-engine': {
    id: 'world-engine',
    entryPath: '/script/世界推进系统.js',
    sourcePath: 'script/世界推进系统.js',
    tagPrefixes: ['world-engine-v', 'V'],
    legacyStableRef: '',
  },
  'status-bar': {
    id: 'status-bar',
    entryPath: '/script/悬浮球状态栏.js',
    sourcePath: 'script/悬浮球状态栏.js',
    tagPrefixes: ['status-bar-v'],
    legacyStableRef: '',
  },
  calculator: {
    id: 'calculator',
    entryPath: '/script/辅助计算脚本.js',
    sourcePath: 'script/辅助计算脚本.js',
    tagPrefixes: ['calculator-v'],
    legacyStableRef: '',
  },
  opening: OPENING_COMPONENT,
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

function statusBarUpdateChannel(env) {
  return String(env.STATUS_BAR_UPDATE_CHANNEL || 'stable').trim().toLowerCase() === 'testing'
    ? 'testing'
    : 'stable';
}

function statusBarUpdateRef(env) {
  const configured = String(env.STATUS_BAR_UPDATE_REF || '').trim();
  if (configured) return configured;
  return statusBarUpdateChannel(env) === 'testing' ? 'main' : 'status-bar-v*';
}

function calculatorUpdateChannel(env) {
  return String(env.CALCULATOR_UPDATE_CHANNEL || 'stable').trim().toLowerCase() === 'testing'
    ? 'testing'
    : 'stable';
}

function calculatorUpdateRef(env) {
  const configured = String(env.CALCULATOR_UPDATE_REF || '').trim();
  if (configured) return configured;
  return calculatorUpdateChannel(env) === 'testing' ? 'main' : 'calculator-v*';
}

function componentUpdateChannel(env, component) {
  if (component?.id === 'opening') return getOpeningUpdateChannel(env);
  if (component?.id === 'status-bar') return statusBarUpdateChannel(env);
  if (component?.id === 'calculator') return calculatorUpdateChannel(env);
  return updateChannel(env);
}

function componentUpdateRef(env, component) {
  if (component?.id === 'opening') return getOpeningUpdateRef(env);
  if (component?.id === 'status-bar') return statusBarUpdateRef(env);
  if (component?.id === 'calculator') return calculatorUpdateRef(env);
  return updateRef(env);
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

async function githubJson(env, url) {
  const token = String(env?.GITHUB_TOKEN || env?.GH_TOKEN || '').trim();
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'reincarnation-workshop-worker',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const error = new Error(`GitHub request failed: ${response.status}`);
    error.status = response.status;
    error.code = 'github_request_failed';
    throw error;
  }
  return response.json();
}

function shouldFallbackToAtom(error) {
  const status = Number(error?.status || 0);
  return status === 0 || status === 403 || status === 429 || status >= 500;
}

async function githubBranchHeadFromAtom(ref) {
  const url = `https://github.com/${REPOSITORY}/commits/${encodeURIComponent(ref)}.atom`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/atom+xml',
      'User-Agent': 'reincarnation-workshop-worker',
    },
  });
  if (!response.ok) {
    const error = new Error(`GitHub Atom request failed: ${response.status}`);
    error.status = response.status;
    error.code = 'github_atom_failed';
    throw error;
  }
  const xml = await response.text();
  const match = xml.match(/\/commit\/([0-9a-f]{40})(?=["<])/iu)
    || xml.match(/Commit\/([0-9a-f]{40})(?=<)/iu);
  const sha = String(match?.[1] || '').trim();
  if (!validSha(sha)) {
    const error = new Error(`GitHub Atom returned invalid ref head for ${ref}`);
    error.code = 'github_atom_invalid';
    throw error;
  }
  return sha;
}

async function latestPathCommit(env, component, ref) {
  const query = new URLSearchParams({ sha: ref, path: component.sourcePath, per_page: '1' });
  try {
    const payload = await githubJson(env, `https://api.github.com/repos/${REPOSITORY}/commits?${query}`);
    const sha = String(Array.isArray(payload) ? payload[0]?.sha : payload?.sha || '').trim();
    if (!validSha(sha)) throw new Error(`GitHub returned invalid ${component.id} commit for ${ref}`);
    return sha;
  } catch (error) {
    if (component?.id === 'workshop') throw error;
    if (!shouldFallbackToAtom(error)) throw error;
    return githubBranchHeadFromAtom(ref);
  }
}

async function refHead(env, ref) {
  try {
    const payload = await githubJson(env, `https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(ref)}`);
    const sha = String(payload?.sha || '').trim();
    if (!validSha(sha)) throw new Error(`GitHub returned invalid ref head for ${ref}`);
    return sha;
  } catch (error) {
    if (!shouldFallbackToAtom(error)) throw error;
    return githubBranchHeadFromAtom(ref);
  }
}

async function latestTaggedRelease(env, component) {
  const rows = await githubJson(env, `https://api.github.com/repos/${REPOSITORY}/tags?per_page=100`);
  const prefixes = Array.isArray(component.tagPrefixes) ? component.tagPrefixes : [];
  const candidates = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const sha = String(row?.commit?.sha || '').trim();
    if (!validSha(sha)) continue;
    for (let priority = 0; priority < prefixes.length; priority += 1) {
      const parsed = parseVersion(row?.name, prefixes[priority]);
      if (!parsed) continue;
      candidates.push({ ...parsed, tag: String(row.name), sha, priority });
      break;
    }
  }
  candidates.sort((a, b) => compareVersion(b, a) || (a.priority - b.priority));
  return candidates[0] || null;
}

function cacheGeneration(env, component) {
  return component?.id === 'workshop' && componentUpdateChannel(env, component) === 'testing'
    ? 'v4'
    : 'v3';
}

function snapshotGeneration(env, component) {
  return component?.id === 'workshop' && componentUpdateChannel(env, component) === 'testing'
    ? 'v2'
    : 'v1';
}

function cacheKey(env, component) {
  return `public:core-component:${cacheGeneration(env, component)}:${component.id}:${componentUpdateChannel(env, component)}:${componentUpdateRef(env, component)}`;
}

function snapshotKey(env, component) {
  return `public:core-component:last-known:${snapshotGeneration(env, component)}:${component.id}:${componentUpdateChannel(env, component)}:${componentUpdateRef(env, component)}`;
}

async function safeKvGet(env, key) {
  try {
    return await env.SESSION_KV?.get?.(key, 'json') ?? null;
  } catch (error) {
    console.warn('[workshop-system] KV read failed', key, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function safeKvPut(env, key, value, options) {
  try {
    await env.SESSION_KV?.put?.(key, value, options);
  } catch (error) {
    console.warn('[workshop-system] KV write failed', key, error instanceof Error ? error.message : String(error));
  }
}

function edgeCacheRequest(key) {
  return new Request(`https://workshop-component-cache.invalid/${encodeURIComponent(key)}`);
}

async function edgeCacheGet(key) {
  try {
    const cache = globalThis.caches?.default;
    if (!cache?.match) return null;
    const response = await cache.match(edgeCacheRequest(key));
    if (!response) return null;
    return await response.json();
  } catch (error) {
    console.warn('[workshop-system] edge cache read failed', key, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function edgeCachePut(key, value) {
  try {
    const cache = globalThis.caches?.default;
    if (!cache?.put) return;
    const response = new Response(JSON.stringify(value), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });
    await cache.put(edgeCacheRequest(key), response);
  } catch (error) {
    console.warn('[workshop-system] edge cache write failed', key, error instanceof Error ? error.message : String(error));
  }
}

function sameSnapshot(left, right, component, channel, ref) {
  return (
    validCachedComponent(left, component, channel, ref)
    && left.sha === right.sha
    && String(left.version || '') === String(right.version || '')
    && String(left.tag || '') === String(right.tag || '')
    && String(left.release_source || '') === String(right.release_source || '')
  );
}

function validCachedComponent(cached, component, channel, ref) {
  return (
    cached?.component === component.id
    && validSha(cached?.sha)
    && cached?.channel === channel
    && cached?.ref === ref
  );
}

async function fetchLatestComponent(env, componentId) {
  const component = COMPONENTS[componentId];
  if (!component) {
    const error = new Error(`unknown component: ${componentId}`);
    error.status = 404;
    error.code = 'component_not_found';
    throw error;
  }
  const channel = componentUpdateChannel(env, component);
  const ref = componentUpdateRef(env, component);
  const key = cacheKey(env, component);
  const fallbackKey = snapshotKey(env, component);
  const edgeCached = await edgeCacheGet(key);
  if (validCachedComponent(edgeCached, component, channel, ref)) {
    return { ...edgeCached, cached: true };
  }
  // Backward-compatible read for the old KV hot-cache key. New deployments no longer write it.
  const cached = await safeKvGet(env, key);
  if (validCachedComponent(cached, component, channel, ref)) {
    await edgeCachePut(key, cached);
    return { ...cached, cached: true };
  }
  const snapshot = await safeKvGet(env, fallbackKey);

  let sha = '';
  let version = '';
  let tag = '';
  let releaseSource = 'branch';
  try {
    if (channel === 'testing') {
      sha = await latestPathCommit(env, component, ref);
    } else {
      let tagged = null;
      try {
        tagged = await latestTaggedRelease(env, component);
      } catch (error) {
        if (component.id !== 'workshop' || !shouldFallbackToAtom(error)) throw error;
      }
      if (component.id === 'workshop') {
        const stableRef = component.legacyStableRef || ref;
        const stableHead = await refHead(env, stableRef);
        if (tagged && tagged.sha === stableHead) {
          sha = tagged.sha;
          version = tagged.version;
          tag = tagged.tag;
          releaseSource = 'tag';
        } else {
          const error = new Error('Workshop stable head is newer than the visible immutable release tag; wait for GitHub tag propagation');
          error.status = 503;
          error.code = 'component_release_pending';
          throw error;
        }
      } else if (tagged) {
        sha = tagged.sha;
        version = tagged.version;
        tag = tagged.tag;
        releaseSource = 'tag';
      } else {
        const error = new Error(`No formal ${component.tagPrefixes?.[0] || ''}X.Y.Z release exists yet`);
        error.status = 404;
        error.code = 'component_release_unavailable';
        throw error;
      }
    }
  } catch (error) {
    if (validCachedComponent(snapshot, component, channel, ref)) {
      return { ...snapshot, cached: true, stale: true };
    }
    throw error;
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
  await edgeCachePut(key, result);
  if (!sameSnapshot(snapshot, result, component, channel, ref)) {
    await safeKvPut(env, fallbackKey, JSON.stringify(result));
  }
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
  if (request.method === 'GET' && pathname === '/opening/latest') {
    try {
      const latest = await fetchLatestComponent(env, 'opening');
      const location = openingCdnUrl({
        repository: REPOSITORY,
        sha: latest.sha,
        entryPath: latest.entry_path,
      });
      return new Response(null, {
        status: 302,
        headers: {
          Location: location,
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
          'X-Opening-Channel': latest.channel,
          'X-Opening-Ref': latest.ref,
          'X-Opening-Sha': latest.sha,
          'X-Opening-Version': latest.version || '',
        },
      });
    } catch (error) {
      return json({
        error: error.code || 'opening_update_check_failed',
        code: error.code || 'opening_update_check_failed',
        message: error instanceof Error ? error.message : String(error),
      }, error.status || 502, {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      });
    }
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
