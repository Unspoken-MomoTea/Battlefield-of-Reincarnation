import { getApiBase } from '../config.js';

function validCommitSha(value) {
  return /^[0-9a-f]{40}$/iu.test(String(value || '').trim());
}

async function responseMessage(response) {
  try {
    const body = await response.json();
    return String(body?.message || body?.error || '').trim();
  } catch {
    return '';
  }
}

export function createOpeningUpdater({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  apiBase = getApiBase(),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前环境缺少 fetch，无法检查开局系统');

  async function check() {
    const base = String(apiBase).replace(/\/$/u, '');
    const response = await fetchImpl(base + '/api/components/latest?component=opening', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await responseMessage(response);
      throw new Error(message || ('开局更新服务 HTTP ' + response.status));
    }

    const data = await response.json();
    const sha = String(data?.sha || '').trim();
    if (String(data?.component || '') !== 'opening' || !validCommitSha(sha)) {
      throw new Error('开局更新服务返回了无效版本');
    }

    return {
      healthy: true,
      channel: String(data?.channel || ''),
      ref: String(data?.ref || ''),
      sha,
      shortSha: sha.slice(0, 8),
      version: String(data?.version || ''),
      tag: String(data?.tag || ''),
      releaseSource: String(data?.release_source || ''),
      entryPath: String(data?.entry_path || ''),
      sourcePath: String(data?.source_path || ''),
      loaderUrl: base + '/opening/latest',
    };
  }

  return { check };
}

export const openingUpdater = createOpeningUpdater();
