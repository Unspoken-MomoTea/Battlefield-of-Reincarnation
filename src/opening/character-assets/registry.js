const DB_NAME = 'reincarnation-workshop';
const STORE_NAME = 'opening_assets';
const DB_VERSION = 4;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined' && typeof indexedDB?.open === 'function';
}

function openDb() {
  if (!hasIndexedDb()) return Promise.reject(new Error('当前环境不支持 IndexedDB，无法使用开局资产库'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('installed_projects')) db.createObjectStore('installed_projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('opening_store_catalogs')) db.createObjectStore('opening_store_catalogs', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开开局资产数据库'));
  });
}

async function withStore(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let value;
      try { value = action(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error || new Error('开局资产数据库操作失败'));
      tx.onabort = () => reject(tx.error || new Error('开局资产数据库操作已取消'));
    });
  } finally {
    db.close();
  }
}

export async function putOpeningAsset(asset) {
  if (!asset?.id) throw new Error('开局资产缺少 id');
  await withStore('readwrite', store => store.put(structuredClone(asset)));
  return asset;
}

export async function removeOpeningAssetsByProject(projectId) {
  if (!hasIndexedDb()) return 0;
  const all = await listOpeningAssets();
  const targets = all.filter(asset => asset.sourceProjectId === projectId);
  if (!targets.length) return 0;
  await withStore('readwrite', store => targets.forEach(asset => store.delete(asset.id)));
  return targets.length;
}

export async function listOpeningAssets(kind = '') {
  if (!hasIndexedDb()) return [];
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const values = request.result || [];
        resolve(kind ? values.filter(asset => asset.kind === kind) : values);
      };
      request.onerror = () => reject(request.error || new Error('读取开局资产失败'));
    });
  } finally {
    db.close();
  }
}

export function createOpeningAssetRecord(project, asset, index = 0, itemIndex = 0) {
  return {
    ...structuredClone(asset),
    id: `${project.id}:${index}:${itemIndex}`,
    sourceProjectId: project.id,
    sourceProjectName: project.name,
    sourceVersion: project.version,
    avatarUrl: String(asset?.avatarUrl || project?.coverUrl || '').trim(),
  };
}

export async function replaceProjectOpeningAssets(project, dataArtifacts = []) {
  const supported = dataArtifacts.flatMap((artifact, index) => {
    const values = Array.isArray(artifact?.content) ? artifact.content : [artifact?.content];
    return values.map((asset, itemIndex) => ({ asset, index, itemIndex })).filter(({ asset }) => {
      if (!asset || typeof asset !== 'object') return false;
      if (!['opening_character', 'opening_partner'].includes(asset.kind)) return false;
      const build = asset.build || asset.character;
      return Boolean(build && typeof build === 'object' && Object.keys(build).length);
    });
  });
  if (!hasIndexedDb()) {
    if (supported.length) throw new Error('当前环境不支持 IndexedDB，无法安装开局角色或伙伴');
    return 0;
  }
  await removeOpeningAssetsByProject(project.id);
  let count = 0;
  for (const { asset, index, itemIndex } of supported) {
      await putOpeningAsset(createOpeningAssetRecord(project, asset, index, itemIndex));
      count += 1;
  }
  return count;
}

export async function listOpeningAssetsByProject(projectId) {
  return (await listOpeningAssets()).filter(asset => asset.sourceProjectId === projectId);
}
export async function restoreProjectOpeningAssets(projectId, assets = []) {
  if (!hasIndexedDb()) {
    if (assets.length) throw new Error('当前环境不支持 IndexedDB，无法恢复开局资产');
    return;
  }
  await removeOpeningAssetsByProject(projectId);
  for (const asset of assets) await putOpeningAsset(asset);
}
