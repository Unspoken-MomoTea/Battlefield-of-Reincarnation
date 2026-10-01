import { getApiBase, getCalculatorUpdateChannel, getCalculatorUpdateRef, resolveHostWindow } from '../config.js';
import { createTavernAdapter } from './tavern-adapter.js';
import { latestTaggedRelease, validCommitSha } from './release-tags.js';
import { persistScriptTreeMutation, scanScriptTrees, scriptFromScan } from './script-tree-update.js';
import {
  buildCalculatorLoaderContent,
  isLegacyCalculatorScript,
  rewriteCalculatorLoaderContent,
  calculatorImportUrl,
  calculatorLoaderRefs,
} from './calculator-loader.js';

const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const SOURCE_PATH = 'script/辅助计算脚本.js';
const TAG_PREFIXES = ['calculator-v'];
const GITHUB_COMMITS_URL = `https://api.github.com/repos/${REPOSITORY}/commits`;
const GITHUB_COMPARE_BASE = `https://api.github.com/repos/${REPOSITORY}/compare/`;

function installRefForLatest(latest) {
  return latest?.releaseSource === 'tag' && latest?.tag ? latest.tag : latest.sha;
}

async function githubCalculatorSha(fetchImpl, ref) {
  const query = new URLSearchParams({ sha: String(ref), path: SOURCE_PATH, per_page: '1' });
  const response = await fetchImpl(`${GITHUB_COMMITS_URL}?${query}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`无法查询辅助计算 ${ref} 更新：GitHub HTTP ${response.status}`);
  const data = await response.json();
  const sha = String(Array.isArray(data) ? data[0]?.sha : data?.sha || '').trim();
  if (!validCommitSha(sha)) throw new Error(`GitHub 返回的 ${ref} 辅助计算提交无效`);
  return sha;
}

async function serverLatest(fetchImpl, channel, ref) {
  const response = await fetchImpl(`${getApiBase()}/api/components/latest?component=calculator`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`辅助计算更新服务 HTTP ${response.status}`);
  const data = await response.json();
  const sha = String(data?.sha || '').trim();
  if (!validCommitSha(sha)) throw new Error('辅助计算更新服务返回了无效提交');
  if (data?.channel && String(data.channel) !== channel) throw new Error('辅助计算更新通道不匹配');
  if (data?.ref && String(data.ref) !== ref) throw new Error('辅助计算更新 Ref 不匹配');
  return {
    sha,
    channel,
    ref,
    version: String(data?.version || ''),
    tag: String(data?.tag || ''),
    releaseSource: String(data?.release_source || ''),
    lookupSource: 'server',
    stale: Boolean(data?.stale),
  };
}

async function resolveLatest(fetchImpl, channel, ref) {
  let fromServer = null;
  try { fromServer = await serverLatest(fetchImpl, channel, ref); } catch {}
  if (channel === 'testing') {
    if (fromServer?.releaseSource === 'branch') return fromServer;
    const sha = await githubCalculatorSha(fetchImpl, ref);
    return { sha, channel, ref, version: '', tag: '', releaseSource: 'branch', lookupSource: 'github', stale: false };
  }
  if (fromServer?.releaseSource === 'tag') return fromServer;
  try {
    const tagged = await latestTaggedRelease(fetchImpl, TAG_PREFIXES);
    if (tagged) return { ...tagged, channel, ref };
  } catch {}
  return null;
}

async function refNeedsUpdate(fetchImpl, currentRef, latest) {
  const ref = String(currentRef || '').trim();
  if (!ref) return true;
  if (ref === latest.sha || (latest.tag && ref === latest.tag)) return false;
  if (latest?.releaseSource === 'tag') return true;
  if (latest?.releaseSource === 'branch' && latest?.lookupSource === 'server') {
    // A stale Worker snapshot must never downgrade a client that may already have a newer SHA.
    if (latest.stale && validCommitSha(ref)) return false;
    return true;
  }
  if (!validCommitSha(ref)) return true;
  try {
    const response = await fetchImpl(
      `${GITHUB_COMPARE_BASE}${encodeURIComponent(latest.sha)}...${encodeURIComponent(ref)}`,
      { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' },
    );
    if (!response.ok) return true;
    const data = await response.json();
    return !['ahead', 'identical'].includes(String(data?.status || '').toLowerCase());
  } catch {
    return true;
  }
}

function classifyCalculatorScript(script) {
  const refs = calculatorLoaderRefs(script?.content);
  if (refs.length) return { kind: 'loader', refs };
  if (isLegacyCalculatorScript(script)) return { kind: 'legacy', refs: [] };
  return null;
}

function currentRuntime(host) {
  const runtime = host?.SamsaraCalculatorRuntime || {};
  const info = host?.Samsara?.CalculatorInfo || {};
  const loader = host?.SamsaraCalculatorLoader || {};
  return {
    installed: Boolean(runtime.version || info.version || loader.sha || host?.__辅助计算脚本_loaded__),
    managedRuntime: Boolean(runtime.version || info.version),
    version: String(runtime.version || info.version || ''),
    sha: String(info.sha || runtime.sha || loader.sha || ''),
    ref: String(info.ref || runtime.ref || loader.ref || ''),
  };
}

export function createCalculatorUpdater({
  adapter = createTavernAdapter(),
  fetchImpl = globalThis.fetch?.bind(globalThis),
  channel = getCalculatorUpdateChannel(),
  ref = getCalculatorUpdateRef(),
  host = resolveHostWindow(),
  loadScript = url => import(url),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前环境缺少 fetch，无法检查辅助计算更新');

  const scan = () => scanScriptTrees(adapter, classifyCalculatorScript);

  async function check() {
    const treeScan = await scan();
    const latest = await resolveLatest(fetchImpl, channel, ref);
    const loaders = treeScan.matches.filter(item => item.kind === 'loader');
    const legacy = treeScan.matches.filter(item => item.kind === 'legacy');
    let updateAvailable = legacy.length > 0 && Boolean(latest);
    if (latest) {
      for (const item of loaders) {
        const checks = await Promise.all(item.refs.map(currentRef => refNeedsUpdate(fetchImpl, currentRef, latest)));
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
      latestLoaderRef: latest ? installRefForLatest(latest) : '',
      latestImportUrl: latest ? calculatorImportUrl(installRefForLatest(latest)) : '',
      updateAvailable,
    };
  }

  async function updateLoaderLink() {
    const treeScan = await scan();
    const latest = await resolveLatest(fetchImpl, channel, ref);
    if (!latest) throw new Error('当前正式通道尚未发布 calculator-vX.Y.Z Tag');
    if (!treeScan.matches.length) throw new Error('没有找到已安装的辅助计算脚本');
    const latestLoaderRef = installRefForLatest(latest);

    const changedScopes = new Set();
    let changedScripts = 0;
    let migratedLegacy = false;
    for (const item of treeScan.matches) {
      const script = scriptFromScan(treeScan, item);
      if (!script || typeof script.content !== 'string') continue;
      let next = script.content;
      if (item.kind === 'legacy') {
        next = buildCalculatorLoaderContent(latestLoaderRef, latest.sha);
        migratedLegacy = true;
      } else {
        const checks = await Promise.all(item.refs.map(currentRef => refNeedsUpdate(fetchImpl, currentRef, latest)));
        if (!checks.some(Boolean)) continue;
        next = rewriteCalculatorLoaderContent(script.content, latestLoaderRef, latest.sha);
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
        latestLoaderRef,
        latestShortSha: latest.sha.slice(0, 8),
        latestVersion: latest.version || '',
        latestTag: latest.tag || '',
        latestImportUrl: calculatorImportUrl(latestLoaderRef),
      };
    }

    await persistScriptTreeMutation(adapter, treeScan, changedScopes, async () => {
      const verified = await scan();
      const written = verified.matches.filter(item => changedScopes.has(item.scope));
      return written.length > 0 && written.every(
        item => item.kind === 'loader' && item.refs.length > 0 && item.refs.every(value => value === latestLoaderRef),
      );
    });

    return {
      updated: true,
      loaderFound: true,
      changedScripts,
      changedScopes: [...changedScopes],
      latestSha: latest.sha,
      latestLoaderRef,
      latestShortSha: latest.sha.slice(0, 8),
      latestVersion: latest.version || '',
      latestTag: latest.tag || '',
      latestImportUrl: calculatorImportUrl(latestLoaderRef),
      migratedLegacy,
    };
  }

  async function hotReload(updated) {
    if (updated.migratedLegacy) {
      return {
        hotReloaded: false,
        reloadRequired: true,
        legacyMigration: true,
        hotReloadError: '旧式内联辅助计算无法可靠注销历史订阅；本次先迁移为 loader，下次载入自动启用新版运行时',
      };
    }

    const before = host?.SamsaraCalculatorRuntime;
    host.SamsaraCalculatorLoader = {
      repository: REPOSITORY,
      ref: updated.latestLoaderRef || updated.latestSha,
      sha: updated.latestSha,
      url: updated.latestImportUrl,
    };
    try {
      await loadScript(updated.latestImportUrl);
    } catch (error) {
      return { hotReloaded: false, reloadRequired: true, hotReloadError: error?.message || String(error) };
    }
    const after = host?.SamsaraCalculatorRuntime;
    if (!after || after === before) {
      return { hotReloaded: false, reloadRequired: true, hotReloadError: '新辅助计算脚本未建立新的运行实例' };
    }
    return { hotReloaded: true, reloadRequired: false };
  }

  async function normalizeFormalLoaderLink() {
    const treeScan = await scan();
    const latest = await resolveLatest(fetchImpl, channel, ref);
    if (channel !== 'stable' || latest?.releaseSource !== 'tag' || !latest?.tag || !latest?.sha) {
      return { normalized: false, changedScripts: 0, changedScopes: [] };
    }

    const changedScopes = new Set();
    let changedScripts = 0;
    for (const item of treeScan.matches) {
      if (item.kind !== 'loader' || !item.refs.length || !item.refs.every(currentRef => currentRef === latest.sha)) {
        continue;
      }
      const script = scriptFromScan(treeScan, item);
      if (!script || typeof script.content !== 'string') continue;
      const next = rewriteCalculatorLoaderContent(script.content, latest.tag, latest.sha);
      if (next === script.content) continue;
      script.content = next;
      changedScopes.add(item.scope);
      changedScripts += 1;
    }

    if (!changedScopes.size) {
      return {
        normalized: false,
        changedScripts: 0,
        changedScopes: [],
        latestSha: latest.sha,
        latestTag: latest.tag,
        latestLoaderRef: latest.tag,
      };
    }

    await persistScriptTreeMutation(adapter, treeScan, changedScopes, async () => {
      const verified = await scan();
      const written = verified.matches.filter(item => changedScopes.has(item.scope));
      return written.length > 0 && written.every(
        item => item.kind === 'loader' && item.refs.length > 0 && item.refs.every(value => value === latest.tag),
      );
    });

    return {
      normalized: true,
      changedScripts,
      changedScopes: [...changedScopes],
      latestSha: latest.sha,
      latestTag: latest.tag,
      latestLoaderRef: latest.tag,
    };
  }

  return {
    check,
    updateLoaderLink,
    normalizeFormalLoaderLink,
    async updateAndReload() {
      const updated = await updateLoaderLink();
      if (!updated.updated) return { ...updated, hotReloaded: false, reloadRequired: false };
      return { ...updated, ...(await hotReload(updated)) };
    },
    current: () => currentRuntime(host),
  };
}

export const calculatorUpdater = createCalculatorUpdater();
