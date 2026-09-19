import { workshopApi } from '../api.js';
import { getInstalledProjects, getMetaRecord, putMetaRecord } from '../storage.js';

export const UPDATE_CHECK_COOLDOWN_MS = 15 * 60 * 1000;
const META_KEY = 'project-update-check';

function normalizeIds(installed) {
  return [...new Set(installed.map(item => String(item.id || '').trim()).filter(Boolean))].sort();
}

function sameIds(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function buildResult(installed, response, checkedAt, fromCache) {
  const versions = new Map((response.items || []).map(item => [item.id, item]));
  const unavailable = new Set(response.unavailable || []);
  return {
    checkedAt,
    fromCache,
    items: installed.map(item => {
      const remote = versions.get(item.id);
      return {
        id: item.id,
        name: item.name,
        localVersion: Number(item.version || 0),
        remoteVersion: remote ? Number(remote.version) : null,
        updateAvailable: remote ? Number(remote.version) > Number(item.version || 0) : false,
        unavailable: unavailable.has(item.id) || !remote,
      };
    }),
  };
}

export function createUpdateChecker({
  api,
  listInstalled,
  getMeta,
  setMeta,
  now = () => Date.now(),
  cooldownMs = UPDATE_CHECK_COOLDOWN_MS,
}) {
  async function checkAll(force = false) {
    const installed = await listInstalled();
    const ids = normalizeIds(installed);
    if (!ids.length) return { checkedAt: now(), fromCache: false, items: [] };

    const current = await getMeta(META_KEY);
    const currentIds = Array.isArray(current?.ids) ? current.ids : [];
    const fresh = current && now() - Number(current.checkedAt || 0) < cooldownMs && sameIds(ids, currentIds);
    if (!force && fresh && current.response) {
      return buildResult(installed, current.response, Number(current.checkedAt), true);
    }

    const response = await api.getProjectVersions(ids);
    const checkedAt = now();
    await setMeta({ key: META_KEY, ids, response, checkedAt });
    return buildResult(installed, response, checkedAt, false);
  }

  return { checkAll };
}

export const updateChecker = createUpdateChecker({
  api: workshopApi,
  listInstalled: getInstalledProjects,
  getMeta: getMetaRecord,
  setMeta: putMetaRecord,
});
