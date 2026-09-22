import { getApiBase, getUpdateChannel, getUpdateRef } from '../config.js';
import { createTavernAdapter } from './tavern-adapter.js';
import {
  isWorkshopLoaderScript,
  rewriteWorkshopLoaderContent,
  workshopLoaderRefs,
} from './workshop-loader.js';

const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const ENTRY_PATH = '/src/CreativeWorkshop/index.js';
const SCOPES = ['character', 'preset', 'global'];
const GITHUB_COMMIT_BASE = `https://api.github.com/repos/${REPOSITORY}/commits/`;
const HOT_IMPORT_BASE = `https://cdn.jsdelivr.net/gh/${REPOSITORY}@`;

function clone(value) {
  return structuredClone(value);
}

function validSha(value) {
  return /^[0-9a-f]{40}$/iu.test(String(value || '').trim());
}

function importUrlForSha(sha) {
  return `${HOT_IMPORT_BASE}${sha}${ENTRY_PATH}`;
}

function scriptsInTrees(trees) {
  const values = [];
  (trees || []).forEach((tree, treeIndex) => {
    if (!tree || typeof tree !== 'object') return;
    if (tree.type === 'folder') {
      (tree.scripts || []).forEach((script, scriptIndex) => {
        if (!script || typeof script !== 'object' || typeof script.content !== 'string') return;
        values.push({ treeIndex, scriptIndex, folder: tree.name || '', script });
      });
      return;
    }
    if (typeof tree.content === 'string') {
      values.push({ treeIndex, scriptIndex: null, folder: '', script: tree });
    }
  });
  return values;
}

async function githubRefSha(fetchImpl, ref) {
  const response = await fetchImpl(`${GITHUB_COMMIT_BASE}${encodeURIComponent(ref)}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`无法查询工坊 ${ref} 更新：GitHub HTTP ${response.status}`);
  }
  const data = await response.json();
  const sha = String(data?.sha || '').trim();
  if (!validSha(sha)) throw new Error(`GitHub 返回的 ${ref} 提交无效`);
  return sha;
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
  if (!validSha(sha)) throw new Error('工坊更新服务返回了无效提交');
  if (channel && channel !== expectedChannel) {
    throw new Error(`更新通道不匹配：客户端 ${expectedChannel}，服务器 ${channel}`);
  }
  if (ref && ref !== expectedRef) {
    throw new Error(`更新引用不匹配：客户端 ${expectedRef}，服务器 ${ref}`);
  }
  return { sha, channel: channel || expectedChannel, ref: ref || expectedRef };
}

async function resolveLatestShaForRefs(fetchImpl, refs, channel, ref) {
  let latest;
  try {
    latest = await serverLatest(fetchImpl, channel, ref);
  } catch {
    latest = { sha: await githubRefSha(fetchImpl, ref), channel, ref };
  }

  // KV 允许短时缓存。如果当前 loader 与 Worker 返回值不同，再向“本通道自己的 ref”
  // 核对一次，避免缓存把客户端降级。正式版绝不核对 main。
  if ((refs || []).some(currentRef => currentRef !== latest.sha)) {
    try {
      latest = { sha: await githubRefSha(fetchImpl, ref), channel, ref };
    } catch {}
  }

  return latest;
}

async function scanLoaders(adapter) {
  const loaders = [];
  const treesByScope = new Map();
  for (const scope of SCOPES) {
    let trees;
    try {
      trees = clone(await adapter.getScriptTrees(scope));
    } catch (error) {
      console.warn(`[轮回战场创意工坊] 无法读取 ${scope} 脚本树，继续扫描其它作用域`, error);
      continue;
    }
    treesByScope.set(scope, trees);
    for (const location of scriptsInTrees(trees)) {
      const refs = workshopLoaderRefs(location.script.content);
      if (!refs.length && !isWorkshopLoaderScript(location.script)) continue;
      loaders.push({
        scope,
        treeIndex: location.treeIndex,
        scriptIndex: location.scriptIndex,
        folder: location.folder,
        id: String(location.script.id || ''),
        name: String(location.script.name || ''),
        refs,
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
    return { refs, latest };
  }

  return {
    async check() {
      const scan = await scanLoaders(adapter);
      const { refs, latest } = await resolve(scan);
      return {
        repository: REPOSITORY,
        entryPath: ENTRY_PATH,
        channel: latest.channel,
        ref: latest.ref,
        latestSha: latest.sha,
        latestShortSha: latest.sha.slice(0, 8),
        latestImportUrl: importUrlForSha(latest.sha),
        loaders: scan.loaders,
        refs,
        loaderFound: scan.loaders.length > 0,
        updateAvailable: scan.loaders.some(item => item.refs.some(currentRef => currentRef !== latest.sha)),
      };
    },

    async updateLoaderLink() {
      const scan = await scanLoaders(adapter);
      const { refs, latest } = await resolve(scan);
      const latestSha = latest.sha;

      if (!scan.loaders.length) {
        return {
          updated: false,
          channel: latest.channel,
          ref: latest.ref,
          latestSha,
          latestShortSha: latestSha.slice(0, 8),
          latestImportUrl: importUrlForSha(latestSha),
          loaderFound: false,
          changedScripts: 0,
          changedScopes: [],
        };
      }

      const changedScopes = new Set();
      let changedScripts = 0;
      for (const loader of scan.loaders) {
        const trees = scan.treesByScope.get(loader.scope);
        const tree = trees[loader.treeIndex];
        const script = loader.scriptIndex === null ? tree : tree?.scripts?.[loader.scriptIndex];
        if (!script || typeof script.content !== 'string') continue;
        const nextContent = rewriteWorkshopLoaderContent(script.content, latestSha);
        if (nextContent === script.content) continue;
        script.content = nextContent;
        changedScopes.add(loader.scope);
        changedScripts += 1;
      }

      if (!changedScopes.size) {
        const staleOrUnknown = scan.loaders.some(item =>
          !item.refs.length || item.refs.some(currentRef => currentRef !== latestSha)
        );
        if (staleOrUnknown) {
          throw new Error('找到了创意工坊载入脚本，但没有识别到可自动改写的固定提交链接');
        }
        return {
          updated: false,
          channel: latest.channel,
          ref: latest.ref,
          latestSha,
          latestShortSha: latestSha.slice(0, 8),
          latestImportUrl: importUrlForSha(latestSha),
          loaderFound: true,
          changedScripts: 0,
          changedScopes: [],
        };
      }

      const originals = new Map();
      const written = [];
      try {
        for (const scope of changedScopes) {
          originals.set(scope, clone(await adapter.getScriptTrees(scope)));
          await adapter.replaceScriptTrees(scan.treesByScope.get(scope), scope);
          written.push(scope);
        }

        const verified = await scanLoaders(adapter);
        const writtenLoaders = verified.loaders.filter(item => changedScopes.has(item.scope));
        const stale = writtenLoaders.filter(item =>
          !item.refs.length || item.refs.some(currentRef => currentRef !== latestSha)
        );
        if (!writtenLoaders.length || stale.length) {
          throw new Error('创意工坊载入脚本写入后校验失败：Tavern Helper 未保存新的固定提交链接');
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
        latestSha,
        latestShortSha: latestSha.slice(0, 8),
        latestImportUrl: importUrlForSha(latestSha),
        loaderFound: true,
        changedScripts,
        changedScopes: [...changedScopes],
      };
    },
  };
}

export const workshopSelfUpdater = createWorkshopSelfUpdater();
