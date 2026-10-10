const DEFAULT_API_BASE = 'https://workshop.6661816.xyz';

export function resolveHostWindow() {
  const currentWindow = globalThis.window;
  if (!currentWindow) return globalThis;

  let host = currentWindow;
  let candidate = currentWindow;
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
    globalThis.window?.ReincarnationWorkshopConfig?.apiBase ??
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
    globalThis.window?.ReincarnationWorkshopConfig?.updateChannel ??
    '',
  ).trim().toLowerCase();
  if (UPDATE_CHANNELS.has(configured)) return configured;

  try {
    const hostname = new URL(getApiBase()).hostname.toLowerCase();
    if (hostname === 'workshop-test.6661816.xyz') return 'testing';
  } catch {}

  return 'stable';
}

// The bazaar is a normal workshop feature on both public release channels.
export function isMarketEnabled(channel = getUpdateChannel()) {
  return channel === 'stable' || channel === 'testing';
}

export function getUpdateRef() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.updateRef ??
    globalThis.window?.ReincarnationWorkshopConfig?.updateRef ??
    '',
  ).trim();
  if (configured) return configured;
  return DEFAULT_UPDATE_REFS[getUpdateChannel()];
}


export function getWorldEngineUpdateChannel() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.worldEngineUpdateChannel ??
    globalThis.window?.ReincarnationWorkshopConfig?.worldEngineUpdateChannel ??
    '',
  ).trim().toLowerCase();
  return UPDATE_CHANNELS.has(configured) ? configured : 'stable';
}

export function getWorldEngineUpdateRef() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.worldEngineUpdateRef ??
    globalThis.window?.ReincarnationWorkshopConfig?.worldEngineUpdateRef ??
    '',
  ).trim();
  if (configured) return configured;
  return getWorldEngineUpdateChannel() === 'testing' ? 'main' : 'world-engine-v*';
}


export function getStatusBarUpdateChannel() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.statusBarUpdateChannel ??
    globalThis.window?.ReincarnationWorkshopConfig?.statusBarUpdateChannel ??
    '',
  ).trim().toLowerCase();
  return UPDATE_CHANNELS.has(configured) ? configured : 'stable';
}

export function getStatusBarUpdateRef() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.statusBarUpdateRef ??
    globalThis.window?.ReincarnationWorkshopConfig?.statusBarUpdateRef ??
    '',
  ).trim();
  if (configured) return configured;
  return getStatusBarUpdateChannel() === 'testing' ? 'main' : 'status-bar-v*';
}


export function getCalculatorUpdateChannel() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.calculatorUpdateChannel ??
    globalThis.window?.ReincarnationWorkshopConfig?.calculatorUpdateChannel ??
    '',
  ).trim().toLowerCase();
  return UPDATE_CHANNELS.has(configured) ? configured : 'stable';
}

export function getCalculatorUpdateRef() {
  const host = resolveHostWindow();
  const configured = String(
    host.ReincarnationWorkshopConfig?.calculatorUpdateRef ??
    globalThis.window?.ReincarnationWorkshopConfig?.calculatorUpdateRef ??
    '',
  ).trim();
  if (configured) return configured;
  return getCalculatorUpdateChannel() === 'testing' ? 'main' : 'calculator-v*';
}
