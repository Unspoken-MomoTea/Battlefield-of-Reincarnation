import { getApiBase, getUpdateChannel, getUpdateRef, resolveHostWindow } from '../config.js';
import { createTavernAdapter } from './tavern-adapter.js';
import { latestTaggedRelease, validCommitSha } from './release-tags.js';
import { persistScriptTreeMutation, scanScriptTrees, scriptFromScan } from './script-tree-update.js';
import {
  buildWorldEngineLoaderContent,
  isLegacyWorldEngineScript,
  rewriteWorldEngineLoaderContent,
  worldEngineImportUrl,
  worldEngineLoaderRefs,
} from './world-engine-loader.js';

const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const SOURCE_PATH = 'script/世界推进系统.js';
const TAG_PREFIX = 'V';
const GITHUB_COMMITS_URL = `https://api.github.com/repos/${REPOSITORY}/commits`;
const GITHUB_COMPARE_BASE = `https://api.github.com/repos/${REPOSITORY}/compare/`;

async function githubWorldEngineSha(fetchImpl, ref) {
  const query = new URLSearchParams({ sha: String(ref), path: SOURCE_PATH, per_page: '1' });
  const response = await fetchImpl(`${GITHUB_COMMITS_URL}?${query}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`无法查询世界推进 ${ref} 更新：GitHub HTTP ${response.status}`);
  const data = await response.json();
  const sha = String(Array.isArray(data) ? data[0]?.sha : data?.sha || '').trim();
  if (!validCommitSha(sha)) throw new Error(`GitHub 返回的 ${ref} 世界推进提交无效`);
  return sha;
}

async function serverLatest(fetchImpl, channel, ref) {
  const response = await fetchImpl(`${getApiBase()}/api/components/latest?component=world-engine`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`世界推进更新服务 HTTP ${response.status}`);
  const data = await response.json();
  const sha = String(data?.sha || '').trim();
  if (!validCommitSha(sha)) throw new Error('世界推进更新服务返回了无效提交');
  if (data?.channel && String(data.channel) !== channel) throw new Error('世界推进更新通道不匹配');
  return {
    sha,
    channel,
    ref,
    version: String(data?.version || ''),
    tag: String(data?.tag || ''),
    releaseSource: String(data?.release_source || ''),
  };
}

async function resolveLatest(fetchImpl, channel, ref) {
  if (channel === 'testing') {
    const sha = await githubWorldEngineSha(fetchImpl, ref);
    return { sha, channel, ref, version: '', tag: '', releaseSource: 'branch' };
  }
  let fromServer = null;
  try { fromServer = await serverLatest(fetchImpl, channel, ref); } catch {}
  if (fromServer?.releaseSource === 'tag') return fromServer;
  try {
    const tagged = await latestTaggedRelease(fetchImpl, TAG_PREFIX);
    if (tagged) return { ...tagged, channel, ref };
  } catch {}
  return null;
}

async function refNeedsUpdate(fetchImpl, currentRef, latestSha) {
  if (!validCommitSha(currentRef) || currentRef === latestSha) return currentRef !== latestSha;
  try {
    const response = await fetchImpl(
      `${GITHUB_COMPARE_BASE}${encodeURIComponent(latestSha)}...${encodeURIComponent(currentRef)}`,
      { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' },
    );
    if (!response.ok) return true;
    const data = await response.json();
    return !['ahead', 'identical'].includes(String(data?.status || '').toLowerCase());
  } catch {
    return true;
  }
}

function classifyWorldEngineScript(script) {
  const refs = worldEngineLoaderRefs(script?.content);
  if (refs.length) return { kind: 'loader', refs };
  if (isLegacyWorldEngineScript(script)) return { kind: 'legacy', refs: [] };
  return null;
}

function currentRuntime(host) {
  const engine = host?.Samsara?.worldEngine;
  const info = host?.Samsara?.WorldEngineInfo || {};
  const loader = host?.SamsaraWorldEngineLoader || {};
  return {
    installed: Boolean(engine || loader.sha),
    version: String(engine?.version || info.version || ''),
    sha: String(info.sha || loader.sha || ''),
    busy: engine?.busy === true || engine?.committing === true,
  };
}

export function createWorldEngineUpdater({
  adapter = createTavernAdapter(),
  fetchImpl = globalThis.fetch?.bind(globalThis),
  channel = getUpdateChannel(),
  ref = getUpdateRef(),
  host = resolveHostWindow(),
  loadScript = url => import(url),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前环境缺少 fetch，无法检查世界推进更新');

  const scan = () => scanScriptTrees(adapter, classifyWorldEngineScript);

  async function check() {
    const treeScan = await scan();
    const latest = await resolveLatest(fetchImpl, channel, ref);
    const loaders = treeScan.matches.filter(item => item.kind === 'loader');
    const legacy = treeScan.matches.filter(item => item.kind === 'legacy');
    let updateAvailable = legacy.length > 0 && Boolean(latest);
    if (latest) {
      for (const item of loaders) {
        const checks = await Promise.all(item.refs.map(currentRef => refNeedsUpdate(fetchImpl, currentRef, latest.sha)));
        if (checks.some(Boolean)) updateAvailable = true;
      }
    }
    const runtime = currentRuntime(host);
    return {
      channel,
      ref,
      current: runtime,
      installed: runtime.installed || treeScan.matches.length > 0,
      managed: loaders.length > 0,
      legacyFound: legacy.length > 0,
      loaderFound: loaders.length > 0,
      loaders,
      releaseAvailable: Boolean(latest),
      latestSha: latest?.sha || '',
      latestShortSha: latest?.sha?.slice(0, 8) || '',
      latestVersion: latest?.version || '',
      latestTag: latest?.tag || '',
      releaseSource: latest?.releaseSource || '',
      latestImportUrl: latest ? worldEngineImportUrl(latest.sha) : '',
      updateAvailable,
    };
  }

  async function updateLoaderLink() {
    const treeScan = await scan();
    const latest = await resolveLatest(fetchImpl, channel, ref);
    if (!latest) throw new Error('当前正式通道尚未发布 VX.Y.Z Tag');
    if (!treeScan.matches.length) throw new Error('没有找到已安装的世界推进脚本');

    const changedScopes = new Set();
    let changedScripts = 0;
    for (const item of treeScan.matches) {
      const script = scriptFromScan(treeScan, item);
      if (!script || typeof script.content !== 'string') continue;
      let next = script.content;
      if (item.kind === 'legacy') {
        next = buildWorldEngineLoaderContent(latest.sha);
      } else {
        const checks = await Promise.all(item.refs.map(currentRef => refNeedsUpdate(fetchImpl, currentRef, latest.sha)));
        if (!checks.some(Boolean)) continue;
        next = rewriteWorldEngineLoaderContent(script.content, latest.sha);
      }
      if (next === script.content) continue;
      script.content = next;
      changedScopes.add(item.scope);
      changedScripts += 1;
    }

    if (!changedScopes.size) {
      return {
        updated: false,
        loaderFound: true,
        changedScripts: 0,
        changedScopes: [],
        latestSha: latest.sha,
        latestShortSha: latest.sha.slice(0, 8),
        latestVersion: latest.version || '',
        latestTag: latest.tag || '',
        latestImportUrl: worldEngineImportUrl(latest.sha),
      };
    }

    await persistScriptTreeMutation(adapter, treeScan, changedScopes, async () => {
      const verified = await scan();
      const written = verified.matches.filter(item => changedScopes.has(item.scope));
      return written.length > 0 && written.every(
        item => item.kind === 'loader' && item.refs.length > 0 && item.refs.every(value => value === latest.sha),
      );
    });

    return {
      updated: true,
      loaderFound: true,
      changedScripts,
      changedScopes: [...changedScopes],
      latestSha: latest.sha,
      latestShortSha: latest.sha.slice(0, 8),
      latestVersion: latest.version || '',
      latestTag: latest.tag || '',
      latestImportUrl: worldEngineImportUrl(latest.sha),
    };
  }

  async function hotReload(updated) {
    const before = host?.Samsara?.worldEngine;
    if (before?.busy === true || before?.committing === true) {
      return { hotReloaded: false, reloadRequired: true, busy: true };
    }
    host.SamsaraWorldEngineLoader = {
      repository: REPOSITORY,
      sha: updated.latestSha,
      url: updated.latestImportUrl,
    };
    try {
      await loadScript(updated.latestImportUrl);
    } catch (error) {
      return { hotReloaded: false, reloadRequired: true, hotReloadError: error?.message || String(error) };
    }
    const after = host?.Samsara?.worldEngine;
    if (!after || after === before) {
      return { hotReloaded: false, reloadRequired: true, hotReloadError: '新世界推进脚本未建立新的运行实例' };
    }
    return { hotReloaded: true, reloadRequired: false, busy: false };
  }

  return {
    check,
    updateLoaderLink,
    async updateAndReload() {
      const updated = await updateLoaderLink();
      if (!updated.updated) return { ...updated, hotReloaded: false, reloadRequired: false };
      return { ...updated, ...(await hotReload(updated)) };
    },
    current: () => currentRuntime(host),
  };
}

export const worldEngineUpdater = createWorldEngineUpdater();
