const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const ENTRY_PATH = '/script/世界推进系统.js';
const JSDELIVR_PATTERN = new RegExp(
  `(https:\\/\\/(?:(?:testingcf|cdn)\\.)?jsdelivr\\.net\\/gh\\/Unspoken-MomoTea\\/Battlefield-of-Reincarnation@)([^/'"\\s]+)(\\/script\\/世界推进系统\\.js)`,
  'gu',
);

export function worldEngineLoaderRefs(content) {
  const refs = [];
  JSDELIVR_PATTERN.lastIndex = 0;
  let match;
  while ((match = JSDELIVR_PATTERN.exec(String(content || '')))) refs.push(match[2]);
  JSDELIVR_PATTERN.lastIndex = 0;
  return refs;
}

export function isLegacyWorldEngineScript(script) {
  const content = String(script?.content || '');
  return content.includes('/* 轮回战场 · 世界引擎') && content.includes('host.Samsara.worldEngine');
}

export function rewriteWorldEngineLoaderContent(content, ref, resolvedSha = '') {
  JSDELIVR_PATTERN.lastIndex = 0;
  let next = String(content || '').replace(JSDELIVR_PATTERN, `$1${ref}$3`);
  JSDELIVR_PATTERN.lastIndex = 0;
  if (resolvedSha && next.includes('host.SamsaraWorldEngineLoader')) {
    next = next.replace(/const sha = '[^']*';/u, `const sha = '${resolvedSha}';`);
  }
  return next;
}

export function worldEngineImportUrl(ref) {
  return `https://cdn.jsdelivr.net/gh/${REPOSITORY}@${ref}${ENTRY_PATH}`;
}

export function buildWorldEngineLoaderContent(ref, resolvedSha = '') {
  const url = worldEngineImportUrl(ref);
  const sha = resolvedSha || (/^[0-9a-f]{40}$/iu.test(String(ref)) ? String(ref) : '');
  return `(() => {
  'use strict';
  const repository = '${REPOSITORY}';
  const sha = '${sha}';
  const url = '${url}';
  let host = window;
  try {
    while (host.parent && host.parent !== host) { void host.parent.document; host = host.parent; }
  } catch (_) {}
  host.SamsaraWorldEngineLoader = { repository, sha, url };
  import(url).catch(error => {
    console.error('[世界推进] 远程加载失败:', error);
    try { host.toastr && host.toastr.error && host.toastr.error(error.message || String(error), '世界推进加载失败'); } catch (_) {}
  });
})();`;
}

export const WORLD_ENGINE_REPOSITORY = REPOSITORY;
export const WORLD_ENGINE_ENTRY_PATH = ENTRY_PATH;
