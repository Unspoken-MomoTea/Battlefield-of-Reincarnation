const providers = new Map();

export function registerOpeningStoreProvider(id, provider) {
  const key = String(id || '').trim();
  if (!key) throw new Error('开局商店 provider id 不能为空');
  if (!provider || typeof provider.getCatalog !== 'function') {
    throw new Error('开局商店 provider 必须实现 getCatalog()');
  }
  providers.set(key, provider);
  return () => providers.delete(key);
}

export function unregisterOpeningStoreProvider(id) {
  return providers.delete(String(id || '').trim());
}

export function listOpeningStoreProviders() {
  return [...providers.entries()].map(([id, provider]) => ({ id, provider }));
}

export async function collectOpeningStoreCatalog(context = {}) {
  const merged = { equipments: [], items: [], skills: [] };
  for (const [providerId, provider] of providers) {
    const catalog = await provider.getCatalog(context);
    for (const kind of Object.keys(merged)) {
      for (const item of catalog?.[kind] || []) {
        merged[kind].push({ ...structuredClone(item), providerId });
      }
    }
  }
  return merged;
}
