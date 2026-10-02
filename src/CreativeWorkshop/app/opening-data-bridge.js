import { listOpeningAssets } from '../../opening/character-assets/registry.js';
import { listInstalledStoreCatalogs } from '../../opening/store/installed-catalogs.js';

export const OPENING_DATA_REQUEST = 'reincarnation:opening-data-request';
export const OPENING_DATA_RESPONSE = 'reincarnation:opening-data-response';
export const OPENING_DATA_CHANGED = 'reincarnation:opening-data-changed';

const TRUSTED_OPENING_ORIGINS = new Set([
  'https://cdn.jsdelivr.net',
  'https://workshop.6661816.xyz',
  'https://workshop-test.6661816.xyz',
]);

function hostOrigin(host) {
  try { return String(host?.location?.origin || ''); } catch { return ''; }
}

export function isTrustedOpeningOrigin(origin, host) {
  const value = String(origin || '');
  return Boolean(value && (value === hostOrigin(host) || TRUSTED_OPENING_ORIGINS.has(value)));
}

export function bindOpeningDataBridge({
  host = globalThis.window,
  readAssets = listOpeningAssets,
  readStoreCatalogs = listInstalledStoreCatalogs,
} = {}) {
  if (!host?.addEventListener) return () => {};
  const clients = new Map();

  const snapshot = async () => {
    const [assets, storeCatalogs] = await Promise.all([
      readAssets(),
      readStoreCatalogs(),
    ]);
    return {
      assets: Array.isArray(assets) ? assets : [],
      storeCatalogs: Array.isArray(storeCatalogs) ? storeCatalogs : [],
    };
  };

  const send = async (source, origin, type, requestId = '', detail = {}) => {
    if (!source?.postMessage) return;
    try {
      source.postMessage({
        type,
        requestId,
        detail,
        ...(await snapshot()),
      }, origin && origin !== 'null' ? origin : '*');
    } catch (error) {
      console.warn('[轮回战场创意工坊] 发送开局资产桥数据失败', error);
    }
  };

  const onMessage = event => {
    if (event?.data?.type !== OPENING_DATA_REQUEST) return;
    if (!isTrustedOpeningOrigin(event.origin, host)) return;
    if (!event.source?.postMessage) return;
    clients.set(event.source, event.origin);
    void send(
      event.source,
      event.origin,
      OPENING_DATA_RESPONSE,
      String(event.data.requestId || ''),
    );
  };

  const broadcast = event => {
    const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
    for (const [source, origin] of clients.entries()) {
      void send(source, origin, OPENING_DATA_CHANGED, '', detail);
    }
  };

  host.addEventListener('message', onMessage);
  host.addEventListener('reincarnation:opening-assets-changed', broadcast);
  host.addEventListener('reincarnation:opening-store-changed', broadcast);

  return () => {
    host.removeEventListener?.('message', onMessage);
    host.removeEventListener?.('reincarnation:opening-assets-changed', broadcast);
    host.removeEventListener?.('reincarnation:opening-store-changed', broadcast);
    clients.clear();
  };
}
