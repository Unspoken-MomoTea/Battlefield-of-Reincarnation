const DEFAULT_API_BASE = 'https://workshop.6661816.xyz';

export function resolveHostWindow() {
  let host = window;
  let candidate = window;
  while (candidate.parent && candidate.parent !== candidate) {
    try {
      const parent = candidate.parent;
      if (!parent.document?.body) break;
      host = parent;
      candidate = parent;
    } catch {
      break;
    }
  }
  return host;
}

export function getApiBase() {
  const host = resolveHostWindow();
  const configured =
    host.ReincarnationWorkshopConfig?.apiBase ??
    window.ReincarnationWorkshopConfig?.apiBase ??
    DEFAULT_API_BASE;
  return String(configured).replace(/\/$/u, '');
}


const UPDATE_CHANNELS = new Set(['testing', 'stable']);
const DEFAULT_UPDATE_REFS = {
  testing: 'main',
  stable: 'workshop-stable',
};

export function getUpdateChannel() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.updateChannel ??
    window.ReincarnationWorkshopConfig?.updateChannel ??
    '',
  ).trim().toLowerCase();
  if (UPDATE_CHANNELS.has(configured)) return configured;

  try {
    const hostname = new URL(getApiBase()).hostname.toLowerCase();
    if (hostname === 'workshop-test.6661816.xyz') return 'testing';
  } catch {}

  return 'stable';
}

export function getUpdateRef() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.updateRef ??
    window.ReincarnationWorkshopConfig?.updateRef ??
    '',
  ).trim();
  if (configured) return configured;
  return DEFAULT_UPDATE_REFS[getUpdateChannel()];
}
