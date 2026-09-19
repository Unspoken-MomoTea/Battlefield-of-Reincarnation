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
