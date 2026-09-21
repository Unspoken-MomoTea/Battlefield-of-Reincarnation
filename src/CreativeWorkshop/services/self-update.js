import { getApiBase } from '../config.js';
import { createTavernAdapter } from './tavern-adapter.js';

const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const ENTRY_PATH = '/src/CreativeWorkshop/index.js';
const SCOPES = ['character', 'preset', 'global'];
const GITHUB_MAIN_COMMIT = `https://api.github.com/repos/${REPOSITORY}/commits/main`;
const HOT_IMPORT_BASE = `https://testingcf.jsdelivr.net/gh/${REPOSITORY}@`;
const JSDELIVR_PATTERN = new RegExp(
  `(https:\\/\\/(?:testingcf\\.)?jsdelivr\\.net\\/gh\\/Unspoken-MomoTea\\/Battlefield-of-Reincarnation@)([^/'"\\s]+)(\\/src\\/CreativeWorkshop\\/index\\.js)`,
  'gu',
);

function clone(value) {
  return structuredClone(value);
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

function loaderRefs(content) {
  const refs = [];
  JSDELIVR_PATTERN.lastIndex = 0;
  let match;
  while ((match = JSDELIVR_PATTERN.exec(String(content || '')))) {
    refs.push(match[2]);
  }
  JSDELIVR_PATTERN.lastIndex = 0;
  return refs;
}

function rewriteLoaderContent(content, sha) {
  JSDELIVR_PATTERN.lastIndex = 0;
  const next = String(content || '').replace(JSDELIVR_PATTERN, `$1${sha}$3`);
  JSDELIVR_PATTERN.lastIndex = 0;
  return next;
}

async function githubMainSha(fetchImpl) {
  const response = await fetchImpl(GITHUB_MAIN_COMMIT, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`无法查询工坊最新版本：GitHub HTTP ${response.status}`);
  const data = await response.json();
  const sha = String(data?.sha || '').trim();
  if (!/^[0-9a-f]{40}$/iu.test(sha)) throw new Error('GitHub 返回的最新提交无效');
  return sha;
}

async function latestMainSha(fetchImpl) {
  try {
    const response = await fetchImpl(`${getApiBase()}/api/client/latest`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      const sha = String(data?.sha || '').trim();
      if (/^[0-9a-f]{40}$/iu.test(sha)) return sha;
    }
  } catch {}

  return githubMainSha(fetchImpl);
}

async function resolveLatestShaForRefs(fetchImpl, refs) {
  let latestSha = await latestMainSha(fetchImpl);
  if ((refs || []).some(ref => ref !== latestSha)) {
    try {
      latestSha = await githubMainSha(fetchImpl);
    } catch {}
  }
  return latestSha;
}

async function scanLoaders(adapter) {
  const loaders = [];
  const treesByScope = new Map();
  for (const scope of SCOPES) {
    const trees = clone(await adapter.getScriptTrees(scope));
    treesByScope.set(scope, trees);
    for (const location of scriptsInTrees(trees)) {
      const refs = loaderRefs(location.script.content);
      if (!refs.length) continue;
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
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前环境缺少 fetch，无法检查工坊更新');

  return {
    async check() {
      const scan = await scanLoaders(adapter);
      const refs = [...new Set(scan.loaders.flatMap(item => item.refs))];
      const latestSha = await resolveLatestShaForRefs(fetchImpl, refs);
      return {
        repository: REPOSITORY,
        entryPath: ENTRY_PATH,
        latestSha,
        latestShortSha: latestSha.slice(0, 8),
        latestImportUrl: importUrlForSha(latestSha),
        loaders: scan.loaders,
        refs,
        loaderFound: scan.loaders.length > 0,
        updateAvailable: scan.loaders.some(item => item.refs.some(ref => ref !== latestSha)),
      };
    },

    async updateLoaderLink() {
      const { loaders, treesByScope } = await scanLoaders(adapter);
      const refs = [...new Set(loaders.flatMap(item => item.refs))];
      const latestSha = await resolveLatestShaForRefs(fetchImpl, refs);
      if (!loaders.length) {
        return {
          updated: false,
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
      for (const loader of loaders) {
        const trees = treesByScope.get(loader.scope);
        const tree = trees[loader.treeIndex];
        const script = loader.scriptIndex === null ? tree : tree?.scripts?.[loader.scriptIndex];
        if (!script || typeof script.content !== 'string') continue;
        const nextContent = rewriteLoaderContent(script.content, latestSha);
        if (nextContent === script.content) continue;
        script.content = nextContent;
        changedScopes.add(loader.scope);
        changedScripts += 1;
      }

      if (!changedScopes.size) {
        return {
          updated: false,
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
          await adapter.replaceScriptTrees(treesByScope.get(scope), scope);
          written.push(scope);
        }
      } catch (error) {
        for (const scope of written.reverse()) {
          try { await adapter.replaceScriptTrees(originals.get(scope), scope); } catch {}
        }
        throw error;
      }

      return {
        updated: true,
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
