const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const ENTRY_PATH = '/script/悬浮球状态栏.js';
const JSDELIVR_PATTERN = new RegExp(
  `(https:\\/\\/(?:(?:testingcf|cdn)\\.)?jsdelivr\\.net\\/gh\\/Unspoken-MomoTea\\/Battlefield-of-Reincarnation@)([^/'"\\s]+)(\\/script\\/世界推进系统\\.js)`,
  'gu',
);

export function statusBarLoaderRefs(content) {
  const refs = [];
  JSDELIVR_PATTERN.lastIndex = 0;
  let match;
  while ((match = JSDELIVR_PATTERN.exec(String(content || '')))) refs.push(match[2]);
  JSDELIVR_PATTERN.lastIndex = 0;
  return refs;
}

export function isLegacyStatusBarScript(script) {
  const content = String(script?.content || '');
  return content.includes('/* 轮回战场 · 世界引擎') && content.includes('host.Samsara.statusBar');
}

export function rewriteStatusBarLoaderContent(content, ref, resolvedSha = '') {
  JSDELIVR_PATTERN.lastIndex = 0;
  let next = String(content || '').replace(JSDELIVR_PATTERN, `$1${ref}$3`);
  JSDELIVR_PATTERN.lastIndex = 0;
  if (resolvedSha && next.includes('host.SamsaraStatusBarLoader')) {
    next = next.replace(/const sha = '[^']*';/u, `const sha = '${resolvedSha}';`);
  }
  return next;
}

export function statusBarImportUrl(ref) {
  return `https://cdn.jsdelivr.net/gh/${REPOSITORY}@${ref}${ENTRY_PATH}`;
}

export function buildStatusBarLoaderContent(ref, resolvedSha = '') {
  const url = statusBarImportUrl(ref);
  const sha = resolvedSha || (/^[0-9a-f]{40}$/iu.test(String(ref)) ? String(ref) : '');
  return `(() => {
  'use strict';
  const repository = '${REPOSITORY}';
  const ref = '${ref}';
  const sha = '${sha}';
  const url = '${url}';
  let host = window;
  try {
    while (host.parent && host.parent !== host) { void host.parent.document; host = host.parent; }
  } catch (_) {}
  host.SamsaraStatusBarLoader = { repository, ref, sha, url };
  import(url).catch(error => {
    console.error('[主神终端] 远程加载失败:', error);
    try { host.toastr && host.toastr.error && host.toastr.error(error.message || String(error), '状态栏加载失败'); } catch (_) {}
  });
})();`;
}

export const STATUS_BAR_REPOSITORY = REPOSITORY;
export const STATUS_BAR_ENTRY_PATH = ENTRY_PATH;
