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

function openingFrameLooksTrusted(frame) {
  const src = String(
    frame?.getAttribute?.('src')
    || frame?.src
    || '',
  ).trim();
  if (src) {
    try {
      const origin = new URL(src, hostOrigin(globalThis.window) || undefined).origin;
      if (TRUSTED_OPENING_ORIGINS.has(origin)) return true;
    } catch {}
  }

  const srcdoc = String(
    frame?.getAttribute?.('srcdoc')
    || frame?.srcdoc
    || '',
  );
  return (
    srcdoc.includes('轮回战场 · 建档协议')
    || srcdoc.includes('reincarnation:opening-data-request')
    || srcdoc.includes('class="wizard-layout"')
  );
}

function isTrustedOpaqueOpeningSource(source, host) {
  const rootDocument = host?.document;
  if (!source || !rootDocument?.querySelectorAll) return false;
  const visited = new Set();

  const scan = doc => {
    if (!doc || visited.has(doc)) return false;
    visited.add(doc);
    let frames = [];
    try { frames = [...doc.querySelectorAll('iframe')]; } catch { return false; }

    for (const frame of frames) {
      let frameWindow = null;
      try { frameWindow = frame.contentWindow; } catch {}
      if (frameWindow === source && openingFrameLooksTrusted(frame)) return true;
      try {
        if (frameWindow?.document && scan(frameWindow.document)) return true;
      } catch {}
    }
    return false;
  };

  return scan(rootDocument);
}

function isTrustedOpeningRequest(event, host) {
  if (isTrustedOpeningOrigin(event?.origin, host)) return true;
  return String(event?.origin || '') === 'null'
    && isTrustedOpaqueOpeningSource(event?.source, host);
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
    if (!isTrustedOpeningRequest(event, host)) return;
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
