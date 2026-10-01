const REPOSITORY = 'Unspoken-MomoTea/Battlefield-of-Reincarnation';
const ENTRY_PATH = '/script/辅助计算脚本.js';
const JSDELIVR_PATTERN = new RegExp(
  `(https:\\/\\/(?:(?:testingcf|cdn)\\.)?jsdelivr\\.net\\/gh\\/Unspoken-MomoTea\\/Battlefield-of-Reincarnation@)([^/'"\\s]+)(\\/script\\/辅助计算脚本\\.js)`,
  'gu',
);

export function calculatorLoaderRefs(content) {
  const refs = [];
  JSDELIVR_PATTERN.lastIndex = 0;
  let match;
  while ((match = JSDELIVR_PATTERN.exec(String(content || '')))) refs.push(match[2]);
  JSDELIVR_PATTERN.lastIndex = 0;
  return refs;
}

export function isLegacyCalculatorScript(script) {
  const content = String(script?.content || '');
  return content.includes('__辅助计算脚本_loaded__') && content.includes('VARIABLE_UPDATE_ENDED') && calculatorLoaderRefs(content).length === 0;
}

export function rewriteCalculatorLoaderContent(content, ref, resolvedSha = '') {
  JSDELIVR_PATTERN.lastIndex = 0;
  let next = String(content || '').replace(JSDELIVR_PATTERN, `$1${ref}$3`);
  JSDELIVR_PATTERN.lastIndex = 0;
  if (resolvedSha && next.includes('host.SamsaraCalculatorLoader')) {
    next = next.replace(/const sha = '[^']*';/u, `const sha = '${resolvedSha}';`);
  }
  return next;
}

export function calculatorImportUrl(ref) {
  return `https://cdn.jsdelivr.net/gh/${REPOSITORY}@${ref}${ENTRY_PATH}`;
}

export function buildCalculatorLoaderContent(ref, resolvedSha = '') {
  const url = calculatorImportUrl(ref);
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
  host.SamsaraCalculatorLoader = { repository, ref, sha, url };
  import(url).catch(error => {
    console.error('[主神终端] 远程加载失败:', error);
    try { host.toastr && host.toastr.error && host.toastr.error(error.message || String(error), '辅助计算加载失败'); } catch (_) {}
  });
})();`;
}

export const CALCULATOR_REPOSITORY = REPOSITORY;
export const CALCULATOR_ENTRY_PATH = ENTRY_PATH;
export const CALCULATOR_SOURCE_PATH = 'script/辅助计算脚本.js';
