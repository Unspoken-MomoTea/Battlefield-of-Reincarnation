import { getApiBase, getUpdateChannel, getUpdateRef } from '../config.js';
import { createTavernAdapter } from './tavern-adapter.js';
import { latestTaggedRelease, validCommitSha } from './release-tags.js';
import { SCRIPT_TREE_SCOPES, cloneScriptTree, scriptsInTrees } from './script-tree-update.js';
import {
  isWorkshopLoaderScript,
  rewriteWorkshopLoaderContent,
  workshopLoaderChannel,
  workshopLoaderRefs,
} from './workshop-loader.js';

const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const ENTRY_PATH = '/src/CreativeWorkshop/index.js';
const GITHUB_COMMITS_URL = `https://api.github.com/repos/${REPOSITORY}/commits`;
const GITHUB_COMPARE_BASE = `https://api.github.com/repos/${REPOSITORY}/compare/`;
const CLIENT_SOURCE_PATH = 'src/CreativeWorkshop';
const HOT_IMPORT_BASE = `https://cdn.jsdelivr.net/gh/${REPOSITORY}@`;

function installRefForLatest(latest) {
  return latest?.releaseSource === 'tag' && latest?.tag ? latest.tag : latest.sha;
}

function importUrlForRef(ref) {
  return `${HOT_IMPORT_BASE}${ref}${ENTRY_PATH}`;
}

async function githubClientSha(fetchImpl, ref) {
  const query = new URLSearchParams({
    sha: String(ref),
    path: CLIENT_SOURCE_PATH,
    per_page: '1',
  });
  const response = await fetchImpl(`${GITHUB_COMMITS_URL}?${query}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`无法查询工坊 ${ref} 客户端更新：GitHub HTTP ${response.status}`);
  }
  const data = await response.json();
  const sha = String(Array.isArray(data) ? data[0]?.sha : data?.sha || '').trim();
  if (!validCommitSha(sha)) throw new Error(`GitHub 返回的 ${ref} 创意工坊提交无效`);
  return sha;
}

async function refNeedsClientUpdate(fetchImpl, currentRef, latest) {
  const ref = String(currentRef || '').trim();
  if (!ref) return true;
  if (ref === latest.sha || (latest.tag && ref === latest.tag)) return false;
  if (!validCommitSha(ref)) return true;

  try {
    const response = await fetchImpl(
      `${GITHUB_COMPARE_BASE}${encodeURIComponent(latest.sha)}...${encodeURIComponent(ref)}`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
      },
    );
    if (!response.ok) return true;
    const data = await response.json();
    // currentRef 如果位于最新工坊提交之后，说明只是 main 上又有其它模块提交；
    // 它已经包含最新工坊代码，不应该因此提示“创意工坊更新”。
    return !['ahead', 'identical'].includes(String(data?.status || '').toLowerCase());
  } catch {
    return true;
  }
}

async function serverLatest(fetchImpl, expectedChannel, expectedRef) {
  const response = await fetchImpl(`${getApiBase()}/api/client/latest`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`工坊更新服务 HTTP ${response.status}`);

  const data = await response.json();
  const sha = String(data?.sha || '').trim();
  const channel = String(data?.channel || '').trim();
  const ref = String(data?.ref || '').trim();
  if (!validCommitSha(sha)) throw new Error('工坊更新服务返回了无效提交');
  if (channel && channel !== expectedChannel) {
    throw new Error(`更新通道不匹配：客户端 ${expectedChannel}，服务器 ${channel}`);
  }
  if (ref && ref !== expectedRef) {
    throw new Error(`更新引用不匹配：客户端 ${expectedRef}，服务器 ${ref}`);
  }
  return {
    sha,
    channel: channel || expectedChannel,
    ref: ref || expectedRef,
    version: String(data?.version || ''),
    tag: String(data?.tag || ''),
    releaseSource: String(data?.release_source || ''),
    cached: Boolean(data?.cached),
    checkedAt: Number(data?.checked_at || 0),
  };
}

async function githubRefHeadSha(fetchImpl, ref) {
  const response = await fetchImpl(
    `https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(ref)}`,
    { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`无法查询 ${ref}：GitHub HTTP ${response.status}`);
  const data = await response.json();
  const sha = String(data?.sha || '').trim();
  if (!validCommitSha(sha)) throw new Error(`GitHub 返回的 ${ref} 提交无效`);
  return sha;
}

async function githubStableWorkshop(fetchImpl, ref) {
  const tagged = await latestTaggedRelease(fetchImpl, ['workshop-v', 'V']);
  const headSha = await githubRefHeadSha(fetchImpl, ref);
  if (tagged && tagged.sha === headSha) return { ...tagged, channel: 'stable', ref };
  return {
    sha: await githubClientSha(fetchImpl, ref),
    channel: 'stable',
    ref,
    version: '',
    tag: '',
    releaseSource: 'legacy-ref',
  };
}

async function resolveLatestShaForRefs(fetchImpl, refs, channel, ref) {
  let server = null;
  try { server = await serverLatest(fetchImpl, channel, ref); } catch {}

  if (channel === 'testing') {
    try {
      return {
        sha: await githubClientSha(fetchImpl, ref),
        channel,
        ref,
        version: '',
        tag: '',
        releaseSource: 'branch',
      };
    } catch {
      if (server) return server;
      throw new Error('无法解析创意工坊测试版最新提交');
    }
  }

  if (server?.releaseSource === 'tag') {
    const serverMatchesInstalled = refs.length > 0
      && refs.every(currentRef => currentRef === server.sha || currentRef === server.tag);
    if (!server.cached || !serverMatchesInstalled) return server;

    try {
      const stable = await githubStableWorkshop(fetchImpl, ref);
      if (stable.releaseSource === 'tag') return stable;
    } catch {}
    return server;
  }

  try {
    const stable = await githubStableWorkshop(fetchImpl, ref);
    if (stable.releaseSource === 'tag') return stable;
  } catch {}

  const error = new Error('创意工坊正式版本 Tag 尚未就绪，请稍后重新检查');
  error.code = 'formal_release_tag_pending';
  throw error;
}

async function scanLoaders(adapter, updateChannel = '') {
  const loaders = [];
  const treesByScope = new Map();
  for (const scope of SCRIPT_TREE_SCOPES) {
    let trees;
    try {
      trees = cloneScriptTree(await adapter.getScriptTrees(scope));
    } catch (error) {
      console.warn(`[轮回战场创意工坊] 无法读取 ${scope} 脚本树，继续扫描其它作用域`, error);
      continue;
    }
    treesByScope.set(scope, trees);
    for (const location of scriptsInTrees(trees)) {
      const refs = workshopLoaderRefs(location.script.content);
      if (!refs.length && !isWorkshopLoaderScript(location.script)) continue;
      const detectedChannel = workshopLoaderChannel(location.script.content);
      if (detectedChannel && updateChannel && detectedChannel !== updateChannel) continue;
      loaders.push({
        scope,
        treeIndex: location.treeIndex,
        scriptIndex: location.scriptIndex,
        folder: location.folder,
        id: String(location.script.id || ''),
        name: String(location.script.name || ''),
        refs,
        detectedChannel,
      });
    }
  }
  return { loaders, treesByScope };
}

export function createWorkshopSelfUpdater({
  adapter = createTavernAdapter(),
  fetchImpl = globalThis.fetch?.bind(globalThis),
  channel = getUpdateChannel(),
  ref = getUpdateRef(),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前环境缺少 fetch，无法检查工坊更新');
  if (!['testing', 'stable'].includes(channel)) throw new Error(`未知工坊更新通道：${channel}`);
  if (!String(ref || '').trim()) throw new Error('工坊更新引用不能为空');

  const updateChannel = String(channel);
  const updateRef = String(ref);

  async function resolve(scan) {
    const refs = [...new Set(scan.loaders.flatMap(item => item.refs))];
    const latest = await resolveLatestShaForRefs(
      fetchImpl,
      refs,
      updateChannel,
      updateRef,
    );
    const staleRefs = new Set();
    for (const currentRef of refs) {
      if (await refNeedsClientUpdate(fetchImpl, currentRef, latest)) {
        staleRefs.add(currentRef);
      }
    }
    return { refs, latest, staleRefs };
  }

  async function normalizeFormalLoaderLink() {
    const scan = await scanLoaders(adapter, updateChannel);
    const { latest } = await resolve(scan);
    if (updateChannel !== 'stable' || latest?.releaseSource !== 'tag' || !latest?.tag || !latest?.sha) {
      return { normalized: false, changedScripts: 0, changedScopes: [] };
    }

    const changedScopes = new Set();
    let changedScripts = 0;
    for (const loader of scan.loaders) {
      if (!loader.refs.length || !loader.refs.every(currentRef => currentRef === latest.sha)) continue;
      const trees = scan.treesByScope.get(loader.scope);
      const tree = trees?.[loader.treeIndex];
      const script = loader.scriptIndex === null ? tree : tree?.scripts?.[loader.scriptIndex];
      if (!script || typeof script.content !== 'string') continue;
      const nextContent = rewriteWorkshopLoaderContent(script.content, latest.tag);
      if (nextContent === script.content) continue;
      script.content = nextContent;
      changedScopes.add(loader.scope);
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

    const originals = new Map();
    const written = [];
    try {
      for (const scope of changedScopes) {
        originals.set(scope, cloneScriptTree(await adapter.getScriptTrees(scope)));
        await adapter.replaceScriptTrees(scan.treesByScope.get(scope), scope);
        written.push(scope);
      }
      const verified = await scanLoaders(adapter, updateChannel);
      const writtenLoaders = verified.loaders.filter(item => changedScopes.has(item.scope));
      const invalid = writtenLoaders.filter(item =>
        !item.refs.length || item.refs.some(currentRef => currentRef !== latest.tag)
      );
      if (!writtenLoaders.length || invalid.length) {
        throw new Error('正式版本链接规范化后校验失败');
      }
    } catch (error) {
      for (const scope of written.reverse()) {
        try { await adapter.replaceScriptTrees(originals.get(scope), scope); } catch {}
      }
      throw error;
    }

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
    normalizeFormalLoaderLink,
    async check() {
      const scan = await scanLoaders(adapter, updateChannel);
      const { refs, latest, staleRefs } = await resolve(scan);
      return {
        repository: REPOSITORY,
        entryPath: ENTRY_PATH,
        channel: latest.channel,
        ref: latest.ref,
        latestVersion: latest.version || '',
        latestTag: latest.tag || '',
        releaseSource: latest.releaseSource || '',
        latestSha: latest.sha,
        latestLoaderRef: installRefForLatest(latest),
        latestShortSha: latest.sha.slice(0, 8),
        latestImportUrl: importUrlForRef(installRefForLatest(latest)),
        loaders: scan.loaders,
        refs,
        loaderFound: scan.loaders.length > 0,
        updateAvailable: scan.loaders.some(item => item.refs.some(currentRef => staleRefs.has(currentRef))),
      };
    },

    async updateLoaderLink() {
      const scan = await scanLoaders(adapter, updateChannel);
      const { refs, latest, staleRefs } = await resolve(scan);
      const latestSha = latest.sha;
      const latestLoaderRef = installRefForLatest(latest);

      if (!scan.loaders.length) {
        return {
          updated: false,
          channel: latest.channel,
          ref: latest.ref,
        latestVersion: latest.version || '',
        latestTag: latest.tag || '',
        releaseSource: latest.releaseSource || '',
          latestSha,
          latestLoaderRef,
          latestShortSha: latestSha.slice(0, 8),
          latestImportUrl: importUrlForRef(latestLoaderRef),
          loaderFound: false,
          changedScripts: 0,
          changedScopes: [],
        };
      }

      const changedScopes = new Set();
      let changedScripts = 0;
      for (const loader of scan.loaders) {
        if (loader.refs.length && !loader.refs.some(currentRef => staleRefs.has(currentRef))) continue;
        const trees = scan.treesByScope.get(loader.scope);
        const tree = trees[loader.treeIndex];
        const script = loader.scriptIndex === null ? tree : tree?.scripts?.[loader.scriptIndex];
        if (!script || typeof script.content !== 'string') continue;
        const nextContent = rewriteWorkshopLoaderContent(script.content, latestLoaderRef);
        if (nextContent === script.content) continue;
        script.content = nextContent;
        changedScopes.add(loader.scope);
        changedScripts += 1;
      }

      if (!changedScopes.size) {
        const staleOrUnknown = scan.loaders.some(item =>
          !item.refs.length || item.refs.some(currentRef => staleRefs.has(currentRef))
        );
        if (staleOrUnknown) {
          throw new Error('找到了创意工坊载入脚本，但没有识别到可自动改写的版本链接');
        }
        return {
          updated: false,
          channel: latest.channel,
          ref: latest.ref,
        latestVersion: latest.version || '',
        latestTag: latest.tag || '',
        releaseSource: latest.releaseSource || '',
          latestSha,
          latestLoaderRef,
          latestShortSha: latestSha.slice(0, 8),
          latestImportUrl: importUrlForRef(latestLoaderRef),
          loaderFound: true,
          changedScripts: 0,
          changedScopes: [],
        };
      }

      const originals = new Map();
      const written = [];
      try {
        for (const scope of changedScopes) {
          originals.set(scope, cloneScriptTree(await adapter.getScriptTrees(scope)));
          await adapter.replaceScriptTrees(scan.treesByScope.get(scope), scope);
          written.push(scope);
        }

        const verified = await scanLoaders(adapter, updateChannel);
        const writtenLoaders = verified.loaders.filter(item => changedScopes.has(item.scope));
        const stale = writtenLoaders.filter(item =>
          !item.refs.length || item.refs.some(currentRef => currentRef !== latestLoaderRef)
        );
        if (!writtenLoaders.length || stale.length) {
          throw new Error('创意工坊载入脚本写入后校验失败：Tavern Helper 未保存新的版本链接');
        }
      } catch (error) {
        for (const scope of written.reverse()) {
          try { await adapter.replaceScriptTrees(originals.get(scope), scope); } catch {}
        }
        throw error;
      }

      return {
        updated: true,
        channel: latest.channel,
        ref: latest.ref,
        latestVersion: latest.version || '',
        latestTag: latest.tag || '',
        releaseSource: latest.releaseSource || '',
        latestSha,
        latestLoaderRef,
        latestShortSha: latestSha.slice(0, 8),
        latestImportUrl: importUrlForRef(latestLoaderRef),
        loaderFound: true,
        changedScripts,
        changedScopes: [...changedScopes],
      };
    },
  };
}

export const workshopSelfUpdater = createWorkshopSelfUpdater();
